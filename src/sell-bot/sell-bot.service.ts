import { Injectable, Logger } from '@nestjs/common';
import { Cron, Interval } from '@nestjs/schedule';
import { Ocean } from 'src/ocean/ocean.api.service';
import { Wallet } from 'src/ocean/ocean.wallet.service';
import { fromAddress } from '@defichain/jellyfish-address';
import { ApiPagedResponse } from '@defichain/whale-api-client';
import { AddressUnspent, AddressToken, AddressHistory } from '@defichain/whale-api-client/dist/api/address';
import { PoolId, PoolSwap } from '@defichain/jellyfish-transaction/dist/script/dftx/dftx_pool';
import { CTransactionSegWit, TransactionSegWit } from '@defichain/jellyfish-transaction';
import { BigNumber } from 'bignumber.js';
import { SellBotBestPathService } from './sell-bot.bestPath.service';

// params
const sellBotServiceNameOverwrite: string = '';
const fromTokenName: string = process.env.FROM_TOKEN_NAME;
const fromTokenAmount: number = parseFloat(process.env.FROM_TOKEN_AMOUNT);
const toTokenName: string = process.env.TO_TOKEN_NAME;
const toTokenAddress: string = process.env.TO_TOKEN_ADDRESS;
const minPrice: BigNumber = new BigNumber(process.env.MIN_PRICE);
const INTERVALSEC: number = parseInt(process.env.INTERVALSEC);

@Injectable()
export class SellBotService {
	private readonly logger = new Logger(sellBotServiceNameOverwrite || this.constructor.name);
	private running: boolean = false;
	private scanning: boolean = false;
	private latestTxIdConfirmed: boolean = true;
	private latestTxId: string;

	constructor(private ocean: Ocean, private wallet: Wallet, private sellBotBestPathService: SellBotBestPathService) {
		if (!INTERVALSEC) throw new Error('Missing INTERVALSEC in .env, see .env.example');
		this.showAddr();
	}

	// show bot address
	async showAddr() {
		this.logger.log(`######## You are using >>> ${await this.wallet.active.getAddress()} <<< ########`);
	}

	// @Cron(cronCommand)
	@Interval(INTERVALSEC * 1000)
	async sellAction() {
		if (!fromTokenName || !fromTokenAmount || !toTokenName || !toTokenAddress || !minPrice)
			throw new Error('Missing params, see .env.example');

		if (this.running || !this.latestTxIdConfirmed) return;
		this.running = true;

		this.logger.log(
			`Running: ${fromTokenAmount} ${fromTokenName} to ${toTokenName} with min. ${minPrice.toFixed(
				8
			)} ${toTokenName}/${fromTokenName}`
		);

		try {
			const addr: string = await this.wallet.active.getAddress();
			const utxo: ApiPagedResponse<AddressUnspent> = await this.ocean.address.listTransactionUnspent(addr);
			const tokens: ApiPagedResponse<AddressToken> = await this.ocean.address.listToken(addr);
			const availableTokens = await this.ocean.tokens.list(200);
			if (!utxo || utxo.length === 0) throw 'No UTXOs available.';
			if (!tokens || tokens.length === 0) throw 'No TOKENs available';

			const fromToken = tokens.find((tkn) => tkn.symbol === fromTokenName);
			const toToken = availableTokens.find((tkn) => tkn.symbol === toTokenName);
			if (!fromToken || parseFloat(fromToken.amount) < fromTokenAmount) throw 'From token amount below threshold';
			if (!toToken) throw 'To token not found';

			const bestPath = await this.sellBotBestPathService.dicover(fromToken.id, toToken.id);
			const bestPoolsName: string[] = bestPath.bestPriceResult.poolPairNames;
			const bestPools: PoolId[] = bestPath.bestPriceResult.poolPairIds.map((p) => {
				return {
					id: parseInt(p),
				};
			});

			this.logger.log(
				`BestPath: ${bestPoolsName.join(' | ')} with an avg. of ${
					bestPath.bestPriceResult.priceRatio
				} ${toTokenName}/${fromTokenName}`
			);

			const fromScript = await this.wallet.active.getScript();
			const toScript = fromAddress(toTokenAddress, 'mainnet').script;
			const maxPriceString = new BigNumber('1').dividedBy(minPrice).toFixed(8);
			const poolSwapData: PoolSwap = {
				fromScript: fromScript,
				fromTokenId: parseInt(fromToken.id),
				fromAmount: new BigNumber(fromTokenAmount),
				toScript: toScript,
				toTokenId: parseInt(toToken.id),
				maxPrice: new BigNumber(maxPriceString),
			};

			// create SegWit Tx
			const txSegWit: TransactionSegWit = await this.wallet.active
				.withTransactionBuilder()
				.dex.compositeSwap({ pools: bestPools, poolSwap: poolSwapData }, fromScript);

			// broadcasting Tx
			const txHex: string = new CTransactionSegWit(txSegWit).toHex();
			const test = await this.ocean.rawtx.test({ hex: txHex });
			this.latestTxId = await this.ocean.rawtx.send({ hex: txHex });
			this.latestTxIdConfirmed = false;

			// show updated
			this.logger.log(`Broadcasted: ${this.latestTxId}`);
		} catch (error) {
			this.logger.error(error);
			this.running = false;
		}

		this.running = false;
	}

	@Interval(10000)
	async checkForBroadcastedTx() {
		if (this.scanning || !this.latestTxId || this.latestTxIdConfirmed) return;
		this.scanning = true;

		try {
			const addr: string = await this.wallet.active.getAddress();
			const txs: ApiPagedResponse<AddressHistory> = await this.ocean.address.listAccountHistory(addr, 3);
			if (txs.length === 0) return;

			const fromTx = txs.find((tx) => tx.txid === this.latestTxId);

			if (fromTx) {
				this.latestTxIdConfirmed = true;

				const toTx = await this.ocean.address.getAccountHistory(toTokenAddress, fromTx.block.height, fromTx.txn);

				const avg = (-parseFloat(toTx.amounts[0].split('@')[0]) / parseFloat(fromTx.amounts[0].split('@')[0])).toFixed(8);
				this.logger.log(
					`Swapped: ${fromTx.amounts[0]} to ${toTx.amounts[0]} for avg. ${avg} ${toTokenName}/${fromTokenName} at block ${fromTx.block.height} txn ${fromTx.txn}`
				);
			}
		} catch (error) {
			this.logger.error(error);
			this.scanning = false;
		}

		this.scanning = false;
	}
}
