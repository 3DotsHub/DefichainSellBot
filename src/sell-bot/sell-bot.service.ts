import { Injectable, Logger } from '@nestjs/common';
import { Cron, Interval } from '@nestjs/schedule';
import { Ocean } from 'src/ocean/ocean.api.service';
import { Wallet } from 'src/ocean/ocean.wallet.service';
import { ApiPagedResponse } from '@defichain/whale-api-client';
import { AddressUnspent, AddressToken, AddressHistory } from '@defichain/whale-api-client/dist/api/address';
import { PoolId, PoolSwap } from '@defichain/jellyfish-transaction/dist/script/dftx/dftx_pool';
import { CTransactionSegWit, TransactionSegWit } from '@defichain/jellyfish-transaction';
import { BigNumber } from 'bignumber.js';

// params
const sellBotServiceNameOverwrite: string = '';
const fromTokenName: string = 'DUSD';
const fromTokenAmount: number = 0.001;
const toTokenName: string = 'USDT';
const maxPrice: BigNumber = new BigNumber('9223372036854775807');

@Injectable()
export class SellBotService {
	private readonly logger = new Logger(sellBotServiceNameOverwrite || this.constructor.name);
	private running: boolean = false;
	private scanning: boolean = false;
	private latestTxIdConfirmed: boolean = true;
	private latestTxId: string;

	constructor(private ocean: Ocean, private wallet: Wallet) {}

	// @Cron('* * * * *')
	@Interval(30000)
	async sellAction() {
		if (this.running || !this.latestTxIdConfirmed) return;
		this.running = true;

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

			const bestPath = await this.ocean.poolpairs.getBestPath(fromToken.id, toToken.id);
			const bestPools: PoolId[] = bestPath.bestPath.map((p) => {
				return {
					id: parseInt(p.poolPairId),
				};
			});

			const fromScript = await this.wallet.active.getScript();
			const toScript = await this.wallet.active.getScript();
			const poolSwapData: PoolSwap = {
				fromScript: fromScript,
				fromTokenId: parseInt(fromToken.id),
				fromAmount: new BigNumber(fromTokenAmount),
				toScript: toScript,
				toTokenId: parseInt(toToken.id),
				maxPrice: maxPrice,
			};

			// create SegWit Tx
			const txSegWit: TransactionSegWit = await this.wallet.active
				.withTransactionBuilder()
				.dex.compositeSwap({ pools: bestPools, poolSwap: poolSwapData }, fromScript);

			// broadcasting Tx
			const txHex: string = new CTransactionSegWit(txSegWit).toHex();
			this.latestTxId = await this.ocean.rawtx.send({ hex: txHex });
			this.latestTxIdConfirmed = false;

			// show updated
			this.logger.log(`Sell action broadcasted: ${this.latestTxId}`);
		} catch (error) {
			this.logger.error(error);
			this.running = false;
		}

		this.running = false;
	}

	@Interval(5000)
	async checkForBroadcastedTx() {
		if (this.scanning || !this.latestTxId || this.latestTxIdConfirmed) return;
		this.scanning = true;

		const addr: string = await this.wallet.active.getAddress();
		const txs: ApiPagedResponse<AddressHistory> = await this.ocean.address.listAccountHistory(addr, 3);
		if (txs.length === 0) return;

		const foundTx = txs.find((tx) => tx.txid === this.latestTxId);

		if (foundTx) {
			const avg = (-parseFloat(foundTx.amounts[0].split('@')[0]) / parseFloat(foundTx.amounts[1].split('@')[0])).toFixed(8);
			this.logger.log(`Swapped ${foundTx.amounts[1]} to ${foundTx.amounts[0]} for avg. ${avg} at block ${foundTx.block.height}`);
			this.latestTxIdConfirmed = true;
		}

		this.scanning = false;
	}
}
