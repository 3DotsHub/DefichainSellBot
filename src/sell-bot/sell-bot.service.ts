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
import { SellBotBestPathHYBService } from './sell-bot.bestPathHYB.service';
import { ethers, TransactionResponse, TransactionReceipt } from 'ethers';
import { VanillaSwapRouterV2, DMCChainId, ERC20ABI, WDFI_DST, BTC_DST, DUSD_DST } from 'src/defichain/defichain.config';
import { EvmProvider } from 'src/defichain/services/defichain.evm.provider.service';
import { SellBotTransferDomainService } from './sell-bot.transferDomain.service';
import { SellBotTransferDomainDFIService } from './sell-bot.transferDomainDFI.service';
import { SellBotTransferDomainUSDTService } from './sell-bot.transferDomainUSDT.service';

const BestPathValidationStrings: string[] = ['DVM', 'EVM', 'HYBDFI', 'HYBUSDT'];

// params
const sellBotServiceNameOverwrite: string = '';
const fromTokenName: string = process.env.FROM_TOKEN_NAME;
const fromTokenAmount: number = parseFloat(process.env.FROM_TOKEN_AMOUNT);
const toTokenName: string = process.env.TO_TOKEN_NAME;
const toTokenAddressDVM: string = process.env.TO_TOKEN_ADDRESS_DVM;
const toTokenAddressEVM: string = process.env.TO_TOKEN_ADDRESS_EVM;
const minPrice: BigNumber = new BigNumber(process.env.MIN_PRICE);
const INTERVALSEC: number = parseInt(process.env.INTERVALSEC || '1200'); // default: 1200sec == 20min

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
		private sellBotBestPathEVMService: SellBotBestPathEVMService,
		private sellBotBestPathHYBService: SellBotBestPathHYBService,
		private sellBotTransferDomainService: SellBotTransferDomainService,
		private sellBotTransferDomainDFIService: SellBotTransferDomainDFIService,
		private sellBotTransferDomainUSDTService: SellBotTransferDomainUSDTService
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
			)} ${toTokenName}/${fromTokenName} each ${INTERVALSEC} sec.`
		);

		try {
			const walletEVM = new ethers.Wallet((await this.wallet.active.privateKey()).toString('hex'), this.evmProvider);
			const addr: string = await this.wallet.active.getAddress();
			const utxo: ApiPagedResponse<AddressUnspent> = await this.ocean.address.listTransactionUnspent(addr);
			const tokens: ApiPagedResponse<AddressToken> = await this.ocean.address.listToken(addr);
			const availableTokens = await this.ocean.tokens.list(200);
			if (!utxo || utxo.length === 0) throw 'No UTXOs available.';
			if (!tokens || tokens.length === 0) throw 'No TOKENs available';

			const fromToken = availableTokens.find((tkn) => tkn.symbol === fromTokenName);
			const toToken = availableTokens.find((tkn) => tkn.symbol === toTokenName);
			// if (!fromToken || parseFloat(fromToken.amount) < fromTokenAmount) throw 'From token amount below threshold';
			if (!toToken) throw 'To token not found';

			// poolPath mapping for DVM
			function poolPathMapping(ids: string[]): PoolId[] {
				return ids.map((p) => {
					return {
						id: parseInt(p),
					};
				});
			}

			// DVM
			const bestPathDVM = await this.sellBotBestPathDVMService.discover(fromToken.id, toToken.id);

			// EVM
			const bestPathEVM = await this.sellBotBestPathEVMService.discover(fromTokenAmount.toString());

			// HYB
			const bestPathHYBDFI = await this.sellBotBestPathHYBService.discoverDFI(fromTokenAmount.toString());
			const bestPathHYBUSDT = await this.sellBotBestPathHYBService.discoverUSDT(fromTokenAmount.toString());

			// Logging
			console.log('');
			this.sellBotBestPathDVMService.toDisplay(bestPathDVM);
			this.sellBotBestPathEVMService.toDisplay(bestPathEVM);
			this.sellBotBestPathHYBService.toDisplay(bestPathHYBDFI);
			this.sellBotBestPathHYBService.toDisplay(bestPathHYBUSDT);

			// Best Price Validation
			const bestPricesForValidation = [
				bestPathDVM.bestPriceResult.priceRatio,
				bestPathEVM.bestPriceResult,
				bestPathHYBDFI.bestPriceResult,
				bestPathHYBUSDT.bestPriceResult,
			];

			const bestPricesForValidationPrice = Math.max(...bestPricesForValidation);
			const bestPricesForValidationIdx = bestPricesForValidation.findIndex((v, i) => v == bestPricesForValidationPrice);

			// Logging all best results
			const currencyStr = `${toTokenName}/${fromTokenName}`;
			const showSats = (p: number) => Math.floor(p * 10 ** 10) / 100;
			this.logger.log(
				`DVM: ${bestPathDVM.bestPriceResult.poolPairNames.join(' > ')} --> ${showSats(
					bestPathDVM.bestPriceResult.priceRatio
				)} ${currencyStr}`
			);
			this.logger.log(
				`EVM: ${bestPathEVM.bestPricePathNames.join(' > ')} --> ${showSats(bestPathEVM.bestPriceResult)} ${currencyStr}`
			);
			this.logger.log(
				`HYBDFI: ${bestPathHYBDFI.bestPricePathNames.join(' > ')} --> ${showSats(bestPathHYBDFI.bestPriceResult)} ${currencyStr}`
			);
			this.logger.log(
				`HYBUSDT: ${bestPathHYBUSDT.bestPricePathNames.join(' > ')} --> ${showSats(bestPathHYBUSDT.bestPriceResult)} ${currencyStr}`
			);
			this.logger.log(
				`>>>>> ${BestPathValidationStrings[bestPricesForValidationIdx]}: --> ${showSats(
					bestPricesForValidationPrice
				)} ${currencyStr} <<<<<`
			);
			console.log('');

			// check minPrice met
			if (bestPricesForValidationPrice < parseFloat(minPrice.toFixed(8))) {
				this.logger.log(
					`Best price of ${minPrice.toFixed(8)} not met. ${
						BestPathValidationStrings[bestPricesForValidationIdx]
					} gave ${bestPricesForValidationPrice}\n`
				);
				this.running = false;
				return;
			}

			// prepare EVM layer
			if (bestPricesForValidationIdx > 0) {
				// dfi available?
				const dfiAmountFrom = await this.evmProvider.getBalance(walletEVM.address);
				if (dfiAmountFrom < 0.01 * 10 ** 18) throw 'Top up your DFI amount on the EVM side. Below 0.01 DFI';

				// approve amount
				const dusdContract = new ethers.Contract(DUSD_DST.address, ERC20ABI, walletEVM);
				const availableAmount = await dusdContract.balanceOf(await this.wallet.active.getEvmAddress());
				const approvedAmount = await dusdContract.allowance(walletEVM.address, VanillaSwapRouterV2.address);
				if (availableAmount < fromTokenAmount * 10 ** 18) throw 'Top up your DUSD amount on the EVM side';

				// need to approve more?
				if (approvedAmount < fromTokenAmount * 10 ** 18) {
					const amountInToApprove = ethers.parseEther((fromTokenAmount * 20).toString());
					this.logger.log(`Approving: 20x of swap amount (${fromTokenAmount * 20}) for ${VanillaSwapRouterV2.address}`);

					const txApprove: TransactionResponse = await dusdContract.approve(VanillaSwapRouterV2.address, amountInToApprove, {
						chainId: DMCChainId,
						from: walletEVM.address,
						nonce: await walletEVM.getNonce(),
						value: 0,
						gasPrice: ethers.toBigInt('10000000000'),
						gasLimit: ethers.toBigInt('1000000'),
					});

					// show update
					this.logger.log(`Broadcasted: ${txApprove.hash} for nonce ${txApprove.nonce}`);

					// wait for tx
					const txApproveReceipt: TransactionReceipt = await txApprove.wait();
					this.logger.log(
						`Approved: 20x of swap amount (${fromTokenAmount * 20}) at block ${txApproveReceipt.blockNumber} txn ${
							txApproveReceipt.index
						}`
					);
				}
			}

			// DVM
			if (bestPricesForValidationIdx == 0) {
				// Preparing Swap
				this.logger.log(`Preparing Swap on DVM of ${fromTokenAmount} DUSD through ${bestPathDVM.bestPriceResult.poolPairNames}`);

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
				const bestPools = poolPathMapping(bestPathDVM.bestPriceResult.poolPairIds);
				const txSegWit: TransactionSegWit = await this.wallet.active
					.withTransactionBuilder()
					.dex.compositeSwap({ pools: bestPools, poolSwap: poolSwapData }, fromScript);

				// broadcasting Tx
				const txHex: string = new CTransactionSegWit(txSegWit).toHex();
				this.latestTxId = await this.ocean.rawtx.send({ hex: txHex });
				this.latestTxIdConfirmed = false;

				// logging
				this.logger.log(`Broadcasted and Waiting: ${this.latestTxId}`);
			}

			// EVM
			if (bestPricesForValidationIdx == 1) {
				// Preparing Swap
				this.logger.log(`Preparing Swap on EVM of ${fromTokenAmount} DUSD through ${bestPathEVM.bestPricePathNames}`);

				// swap
				const amountIn = ethers.parseEther(fromTokenAmount.toString());
				const amountOutMin = ethers.parseUnits(
					minPrice.multipliedBy(ethers.parseEther(fromTokenAmount.toString()).toString()).toFixed(0).toString(),
					'wei'
				);
				const deadline = Date.now() + 120 * 1000;
				const routerContract = new ethers.Contract(VanillaSwapRouterV2.address, VanillaSwapRouterV2.abi, walletEVM);
				const txSwap: TransactionResponse = await routerContract.swapExactTokensForTokens(
					amountIn,
					amountOutMin,
					bestPathEVM.bestPricePath,
					toTokenAddressEVM,
					deadline,
					{
						chainId: DMCChainId,
						from: walletEVM.address,
						nonce: await walletEVM.getNonce(),
						value: ethers.parseEther('0'),
						gasPrice: ethers.toBigInt('10000000000'),
						gasLimit: ethers.toBigInt('1000000'),
					}
				);

				// show update
				this.logger.log(`Broadcasted and Waiting: ${txSwap.hash} for nonce ${txSwap.nonce}`);

				// wait for tx
				const txSwapReceipt: TransactionReceipt = await txSwap.wait();
				this.latestTxId = `${txSwapReceipt.hash}@${txSwapReceipt.blockNumber}`;
				this.latestTxIdConfirmed = false;
			}

			// HYBDFI
			if (bestPricesForValidationIdx == 2) {
				// prepare swap
				const slippage = 0.95;
				const amountIn = ethers.parseEther(fromTokenAmount.toString());
				const amountOutMin = ethers.parseEther(
					(fromTokenAmount * bestPathHYBDFI.discoverEVM.bestPriceResult * slippage).toString()
				);
				const deadline = Date.now() + 120 * 1000;
				const routerContract = new ethers.Contract(VanillaSwapRouterV2.address, VanillaSwapRouterV2.abi, walletEVM);

				// create EVM TD TX
				this.logger.log(
					`Preparing Swap on EVM of ${fromTokenAmount} DUSD through ${bestPathHYBDFI.discoverEVM.bestPricePathNames}`
				);

				// execute swap and sending
				const txSwap: TransactionResponse = await routerContract.swapExactTokensForETH(
					amountIn,
					amountOutMin,
					bestPathHYBDFI.discoverEVM.bestPricePath,
					toTokenAddressEVM,
					deadline,
					{
						chainId: DMCChainId,
						from: walletEVM.address,
						nonce: await walletEVM.getNonce(),
						value: ethers.parseEther('0'),
						gasPrice: ethers.toBigInt('10000000000'),
						gasLimit: ethers.toBigInt('1000000'),
					}
				);

				// Waiting
				this.logger.log(`Broadcasted and Waiting: ${txSwap.hash} for nonce ${txSwap.nonce}`);
				const txSwapReceipt: TransactionReceipt = await txSwap.wait();

				// get swapOutAmount
				const txSwapLastLog = txSwapReceipt.logs.at(-1);
				const txSwapDFIOut = parseInt(txSwapLastLog.data, 16);
				const txSwapDFIOut8Adj = Math.floor(txSwapDFIOut / 10 ** 10) / 10 ** 8;
				this.logger.log(`Completed Swap over EVM, amount: ${txSwapDFIOut / 10 ** 18} DFI`);

				// TransferDomain and wait
				await this.sellBotTransferDomainDFIService.transferDomain(txSwapDFIOut8Adj);

				// Prepare DVM
				this.logger.log(
					`Preparing Swap on DVM of ${txSwapDFIOut8Adj} DFI through ${bestPathHYBDFI.discoverDVM.bestPriceResult.poolPairNames}`
				);

				// Execute Swap DVM
				const fromScript = await this.wallet.active.getScript();
				const toScript = fromAddress(toTokenAddressDVM, 'mainnet').script;
				const maxPriceString = new BigNumber('1').dividedBy(minPrice).toFixed(8);
				const poolSwapData: PoolSwap = {
					fromScript: fromScript,
					fromTokenId: 0,
					fromAmount: new BigNumber(txSwapDFIOut8Adj),
					toScript: toScript,
					toTokenId: parseInt(toToken.id),
					maxPrice: new BigNumber(maxPriceString),
				};

				// create SegWit Tx
				const bestPools = poolPathMapping(bestPathHYBDFI.discoverDVM.bestPriceResult.poolPairIds);
				const txSegWit: TransactionSegWit = await this.wallet.active
					.withTransactionBuilder()
					.dex.compositeSwap({ pools: bestPools, poolSwap: poolSwapData }, fromScript);

				// broadcasting Tx
				const txHex: string = new CTransactionSegWit(txSegWit).toHex();
				this.latestTxId = await this.ocean.enforceBroadcasting(txHex);
				if (this.latestTxId == '') throw 'EnforceBroadcasting Timeout';
				this.latestTxIdConfirmed = false;

				// show updated
				this.logger.log(`Broadcasted and Waiting: ${this.latestTxId}`);
			}

			// HYBUSDT
			if (bestPricesForValidationIdx == 3) {
				// prepare swap
				const slippage = 0.95;
				const amountIn = ethers.parseEther(fromTokenAmount.toString());
				const amountOutMin = ethers.parseEther(
					(fromTokenAmount * bestPathHYBUSDT.discoverEVM.bestPriceResult * slippage).toString()
				);
				const deadline = Date.now() + 120 * 1000;
				const routerContract = new ethers.Contract(VanillaSwapRouterV2.address, VanillaSwapRouterV2.abi, walletEVM);

				// create EVM TD TX
				this.logger.log(
					`Preparing Swap on EVM of ${fromTokenAmount} DUSD through ${bestPathHYBUSDT.discoverEVM.bestPricePathNames}`
				);

				// execute swap and sending
				const txSwap: TransactionResponse = await routerContract.swapExactTokensForTokens(
					amountIn,
					amountOutMin,
					bestPathHYBUSDT.discoverEVM.bestPricePath,
					toTokenAddressEVM,
					deadline,
					{
						chainId: DMCChainId,
						from: walletEVM.address,
						nonce: await walletEVM.getNonce(),
						value: ethers.parseEther('0'),
						gasPrice: ethers.toBigInt('10000000000'),
						gasLimit: ethers.toBigInt('1000000'),
					}
				);

				// Waiting
				this.logger.log(`Broadcasted and Waiting: ${txSwap.hash} for nonce ${txSwap.nonce}`);
				const txSwapReceipt: TransactionReceipt = await txSwap.wait();

				// get swapOutAmount
				const txSwapLastLog = txSwapReceipt.logs.at(-1);
				const txSwapOut = parseInt(txSwapLastLog.data.slice(-32), 16);
				const txSwapOut8Adj = Math.floor(txSwapOut / 10 ** 10) / 10 ** 8;
				this.logger.log(`Completed Swap over EVM, amount: ${txSwapOut / 10 ** 18} USDT`);

				// TransferDomain and wait
				await this.sellBotTransferDomainUSDTService.transferDomain(txSwapOut8Adj);

				// Prepare DVM
				this.logger.log(
					`Preparing Swap on DVM of ${txSwapOut8Adj} USDT through ${bestPathHYBUSDT.discoverDVM.bestPriceResult.poolPairNames}`
				);

				// Execute Swap DVM
				const fromScript = await this.wallet.active.getScript();
				const toScript = fromAddress(toTokenAddressDVM, 'mainnet').script;
				const maxPriceString = new BigNumber('1').dividedBy(minPrice).toFixed(8);
				const poolSwapData: PoolSwap = {
					fromScript: fromScript,
					fromTokenId: 3,
					fromAmount: new BigNumber(txSwapOut8Adj),
					toScript: toScript,
					toTokenId: parseInt(toToken.id),
					maxPrice: new BigNumber(maxPriceString),
				};

				// create SegWit Tx
				const bestPools = poolPathMapping(bestPathHYBUSDT.discoverDVM.bestPriceResult.poolPairIds);
				const txSegWit: TransactionSegWit = await this.wallet.active
					.withTransactionBuilder()
					.dex.compositeSwap({ pools: bestPools, poolSwap: poolSwapData }, fromScript);

				// broadcasting Tx
				const txHex: string = new CTransactionSegWit(txSegWit).toHex();
				this.latestTxId = await this.ocean.enforceBroadcasting(txHex);
				if (this.latestTxId == '') throw 'EnforceBroadcasting Timeout';
				this.latestTxIdConfirmed = false;

				// show updated
				this.logger.log(`Broadcasted and Waiting: ${this.latestTxId}`);
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
				const VANLPAddr: string = '0xaCE955A73Efbef460e3d557021d3430b41448B3A';
				const btcContract = new ethers.Contract(BTC_DST.address, ERC20ABI, this.evmProvider);
				const eventLogFilter = btcContract.filters.Transfer(VANLPAddr, await this.wallet.active.getEvmAddress());
				const eventLog = await btcContract.queryFilter(eventLogFilter, parseInt(blk));
				const fromTx = eventLog.find((tx) => tx.transactionHash === txId);

				if (fromTx) {
					const swappedAmount = parseInt(fromTx.data.slice(2), 16) / 10 ** 18;
					const avg = Math.floor((swappedAmount / fromTokenAmount) * 10 ** 10) / 100;
					this.latestTxIdConfirmed = true;

					// show swap details
					this.logger.log(
						`Completed Swap: ${fromTokenAmount} to ${swappedAmount} for avg. ${avg} ${toTokenName}/${fromTokenName} at block ${fromTx.blockNumber} txn ${fromTx.index}\n`
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

					const avg = Math.floor((parseFloat(toTx.amounts[0].split('@')[0]) / fromTokenAmount) * 10 ** 10) / 100;
					this.logger.log(
						`Completed Swap: ${fromTokenAmount} to ${toTx.amounts[0]} for avg. ${avg} ${toTokenName}/${fromTokenName} at block ${fromTx.block.height} txn ${fromTx.txn}\n`
					);
				}
			}

			// Tx got confirmed, check for TransferDomain
			if (this.latestTxIdConfirmed == true) {
				await this.sellBotTransferDomainService.checkForTransferDomainBTC();
			}
		} catch (error) {
			if (error != 'SyntaxError: Unexpected token < in JSON at position 0') this.logger.error(error);
			this.scanning = false;
		}

		this.scanning = false;
	}
}
