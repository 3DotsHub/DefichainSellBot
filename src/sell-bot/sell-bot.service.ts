import { Injectable, Logger } from '@nestjs/common';
import { Cron, Interval } from '@nestjs/schedule';
import { Ocean } from 'src/defichain/services/defichain.ocean.client.service';
import { Wallet } from 'src/defichain/services/defichain.ocean.wallet.service';
import { fromAddress } from '@defichain/jellyfish-address';
import { ApiPagedResponse } from '@defichain/whale-api-client';
import { AddressUnspent, AddressToken, AddressHistory } from '@defichain/whale-api-client/dist/api/address';
import { PoolId, PoolSwap } from '@defichain/jellyfish-transaction/dist/script/dftx/dftx_pool';
import { CTransactionSegWit, TransactionSegWit } from '@defichain/jellyfish-transaction';
import { BigNumber } from 'bignumber.js';
import { SellBotBestPathDVMService } from './sell-bot.bestPathDVM.service';
import { SellBotBestPathEVMService } from './sell-bot.bestPathEVM.service';
import { ethers } from 'ethers';
import { VanillaSwapRouterV2Addr, DMCChainId, WDFI_DST, BTC_DST, DUSD_DST } from 'src/defichain/defichain.config';
import { EvmProvider } from 'src/defichain/services/defichain.evm.provider.service';
import ERC20 from './ERC20.json';

// params
const sellBotServiceNameOverwrite: string = '';
const fromTokenName: string = process.env.FROM_TOKEN_NAME;
const fromTokenAmount: number = parseFloat(process.env.FROM_TOKEN_AMOUNT);
const toTokenName: string = process.env.TO_TOKEN_NAME;
const toTokenAddressDVM: string = process.env.TO_TOKEN_ADDRESS_DVM;
const toTokenAddressEVM: string = process.env.TO_TOKEN_ADDRESS_EVM;
const minPrice: BigNumber = new BigNumber(process.env.MIN_PRICE);
const INTERVALSEC: number = parseInt(process.env.INTERVALSEC || '1200');

@Injectable()
export class SellBotService {
	private readonly logger = new Logger(sellBotServiceNameOverwrite || this.constructor.name);
	private running: boolean = false;
	private scanning: boolean = false;
	private latestTxIdConfirmed: boolean = true;
	private latestTxId: string;
	private readonly restartPolicyDelay: number = 10000;

	constructor(
		private ocean: Ocean,
		private wallet: Wallet,
		private evmProvider: EvmProvider,
		private sellBotBestPathDVMService: SellBotBestPathDVMService,
		private sellBotBestPathEVMService: SellBotBestPathEVMService
	) {
		if (!INTERVALSEC) throw new Error('Missing INTERVALSEC in .env, see .env.example');
		setTimeout(() => this.showAddr(), this.restartPolicyDelay / 2);
		setTimeout(() => this.sellAction(), this.restartPolicyDelay);
	}

	// show bot address
	async showAddr() {
		this.logger.log('');
		this.logger.log(`######## You are using DVM >>> ${await this.wallet.active.getAddress()} <<< ########`);
		this.logger.log(`######## You are using EVM >>> ${await this.wallet.active.getEvmAddress()} <<< ########`);
		this.logger.log(`######## Swapping to >>> ${toTokenAddressDVM} <<< ########`);
		this.logger.log(`######## Swapping to >>> ${toTokenAddressEVM} <<< ########`);
		this.logger.log('');
	}

	// @Cron(cronCommand)
	@Interval(INTERVALSEC * 1000)
	async sellAction() {
		if (!fromTokenName || !fromTokenAmount || !toTokenName || !toTokenAddressDVM || !toTokenAddressEVM || !minPrice)
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

			// DVM
			const bestPathDVM = await this.sellBotBestPathDVMService.dicover(fromToken.id, toToken.id);
			const bestPoolsName: string[] = bestPathDVM.bestPriceResult.poolPairNames;
			const bestPools: PoolId[] = bestPathDVM.bestPriceResult.poolPairIds.map((p) => {
				return {
					id: parseInt(p),
				};
			});

			// EVM
			const bestPathEvm = await this.sellBotBestPathEVMService.dicover();

			// DVM vs EVM
			const isDVMOverEVM = bestPathDVM.bestPriceResult.priceRatio > bestPathEvm.bestPriceResult;

			this.logger.log(
				`BestPathDVM: ${bestPoolsName.join(' | ')} with an avg. of ${
					bestPathDVM.bestPriceResult.priceRatio
				} ${toTokenName}/${fromTokenName}`
			);
			this.logger.log(
				`BestPathEVM: ${bestPathEvm.bestPricePathNames.join(' | ')} with an avg. of ${bestPathEvm.bestPriceResult.toFixed(
					8
				)} ${toTokenName}/${fromTokenName}`
			);

			// make tx
			if (isDVMOverEVM) {
				const fromScript = await this.wallet.active.getScript();
				const toScript = fromAddress(toTokenAddressDVM, 'mainnet').script;
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
			} else {
				const amountIn = ethers.parseEther(fromTokenAmount.toString());
				const walletEVM = new ethers.Wallet((await this.wallet.active.privateKey()).toString('hex'), this.evmProvider);

				// dfi available?
				const dfiAmountFrom = await this.evmProvider.getBalance(walletEVM.address);
				const nonce = await walletEVM.getNonce();
				if (dfiAmountFrom < 0) throw 'No dfi for gas fee available.';

				// approve amount
				const dusdContract = new ethers.Contract(DUSD_DST.address, ERC20.abi, walletEVM);
				const availableAmount = await dusdContract.balanceOf(await this.wallet.active.getEvmAddress());
				const approvedAmount = await dusdContract.allowance(walletEVM.address, VanillaSwapRouterV2Addr);
				if (availableAmount < fromTokenAmount) throw 'Top up your DUSD amount on the EVM side';

				// need to approve more?
				if (approvedAmount < fromTokenAmount) {
					this.logger.log('Approving 20x amount of fromTokenAmount');
					const amountInToApprove = ethers.parseEther((fromTokenAmount * 20).toString());

					const txApprove = await dusdContract.approve(VanillaSwapRouterV2Addr, amountInToApprove, {
						chainId: DMCChainId,
						from: walletEVM.address,
						nonce,
						value: 0,
						gasPrice: ethers.toBigInt('10000000000'),
						gasLimit: ethers.toBigInt('1000000'),
					});

					const txApproveReceipt = await txApprove.wait();
					this.logger.log('Approved 20x amount of fromTokenAmount');
				}

				// swap
				const ABI_Swap = [
					'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
				];
				const amountOutMin = ethers.parseUnits(
					minPrice.multipliedBy(ethers.parseEther(fromTokenAmount.toString()).toString()).toFixed(0).toString(),
					'wei'
				);
				const path = [DUSD_DST.address, WDFI_DST.address, BTC_DST.address];
				const deadline = Date.now() + 120 * 1000;
				const routerContract = new ethers.Contract(VanillaSwapRouterV2Addr, ABI_Swap, walletEVM);
				const txSwap = await routerContract.swapExactTokensForTokens(amountIn, amountOutMin, path, toTokenAddressEVM, deadline, {
					chainId: DMCChainId,
					from: walletEVM.address,
					nonce,
					value: ethers.parseEther('0'),
					gasPrice: ethers.toBigInt('10000000000'),
					gasLimit: ethers.toBigInt('1000000'),
				});
				const txSwapReceipt = await txSwap.wait();

				this.latestTxId = `${txSwapReceipt.hash}@${txSwapReceipt.blockNumber}`;
				this.latestTxIdConfirmed = false;

				// show updated
				this.logger.log(`Broadcasted: ${this.latestTxId}`);
			}
		} catch (error) {
			if (error != 'SyntaxError: Unexpected token < in JSON at position 0') this.logger.error(error);
			this.running = false;
			setTimeout(() => this.sellAction(), this.restartPolicyDelay);
		}

		this.running = false;
	}

	@Interval(10000)
	async checkForBroadcastedTx() {
		if (this.scanning || !this.latestTxId || this.latestTxIdConfirmed) return;
		this.scanning = true;

		try {
			if (this.latestTxId.slice(0, 2) === '0x') {
				// EVM Tx
				const [txId, blk] = this.latestTxId.split('@');

				// get swapOutAmount
				const btcContract = new ethers.Contract(BTC_DST.address, ERC20.abi, this.evmProvider);
				const eventLogFilter = btcContract.filters.Transfer(null, await this.wallet.active.getEvmAddress());
				const eventLog = await btcContract.queryFilter(eventLogFilter, parseInt(blk));
				const fromTx = eventLog.find((tx) => tx.transactionHash === txId);

				if (fromTx) {
					const swappedAmount = parseInt(fromTx.data.slice(2), 16) / 10 ** 18;
					const avg = (swappedAmount / fromTokenAmount).toFixed(8);
					this.latestTxIdConfirmed = true;

					// show swap details
					this.logger.log(
						`Swapped: ${fromTokenAmount} to ${swappedAmount} for avg. ${avg} ${toTokenName}/${fromTokenName} at block ${fromTx.blockNumber} txn ${fromTx.index}\n`
					);
				}
			} else {
				// DVM Tx
				const addr: string = await this.wallet.active.getAddress();
				const txs: ApiPagedResponse<AddressHistory> = await this.ocean.address.listAccountHistory(addr, 3);
				if (txs.length === 0) return;

				const fromTx = txs.find((tx) => tx.txid === this.latestTxId);

				if (fromTx) {
					const toTx = await this.ocean.address.getAccountHistory(toTokenAddressDVM, fromTx.block.height, fromTx.txn);
					this.latestTxIdConfirmed = true;

					const avg = (-parseFloat(toTx.amounts[0].split('@')[0]) / parseFloat(fromTx.amounts[0].split('@')[0])).toFixed(8);
					this.logger.log(
						`Swapped: ${fromTx.amounts[0]} to ${toTx.amounts[0]} for avg. ${avg} ${toTokenName}/${fromTokenName} at block ${fromTx.block.height} txn ${fromTx.txn}\n`
					);
				}
			}
		} catch (error) {
			if (error != 'SyntaxError: Unexpected token < in JSON at position 0') this.logger.error(error);
			this.scanning = false;
		}

		this.scanning = false;
	}
}
