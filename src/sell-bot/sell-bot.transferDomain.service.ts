import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import { CTransactionSegWit, TransferDomain } from '@defichain/jellyfish-transaction';
import { Prevout } from '@defichain/jellyfish-transaction-builder';
import { fromAddress } from '@defichain/jellyfish-address';
import BigNumber from 'bignumber.js';

import { EvmProvider } from 'src/defichain/services/defichain.evm.provider.service';
import { Ocean } from 'src/defichain/services/defichain.ocean.client.service';
import { Wallet } from 'src/defichain/services/defichain.ocean.wallet.service';
import { TransferDomainType, TransferDomainV1, BTC_DST, ERC20ABI, DMCChainId, DUSD_DST } from 'src/defichain/defichain.config';

@Injectable()
export class SellBotTransferDomainService {
	private readonly logger = new Logger(this.constructor.name);
	private readonly toTokenAddressDVM: string = process.env.TO_TOKEN_ADDRESS_DVM;
	private readonly threshold: BigInt = ethers.parseEther(process.env.THRESHOLD_TRANSFERDOMAIN || '0.01');
	private readonly thresholdReadable: string = (parseFloat(this.threshold.toString()) / 10 ** 18).toFixed(8);

	constructor(private ocean: Ocean, private wallet: Wallet, private evmProvider: EvmProvider) {}

	async checkForTransferDomainBTC() {
		const walletEVM = new ethers.Wallet((await this.wallet.active.privateKey()).toString('hex'), this.evmProvider);
		const dvmAddress = await this.wallet.active.getAddress();
		const evmAddress = await this.wallet.active.getEvmAddress();
		const dvmScript = await this.wallet.active.getScript();
		const evmScript = await this.wallet.active.getEvmScript();
		const toTokenAddressDVMScript = fromAddress(this.toTokenAddressDVM, 'mainnet').script;

		// check for threshold
		// const btcContract = new ethers.Contract(BTC_DST.address, ERC20ABI, this.evmProvider);
		// const amountOnEvmAddress = await btcContract.balanceOf(evmAddress);
		// const amountToTransfer = new BigNumber(Math.floor(parseFloat(amountOnEvmAddress) / 10 ** 10) / 10 ** 8);
		const amountToTransfer = new BigNumber('289990');
		// if (amountOnEvmAddress < this.threshold) return;

		// create EVM TD TX
		this.logger.log(`TransferDomain of ${amountToTransfer} DUSD from EVM to DVM`);
		return

		const ITransferDomainV1 = new ethers.Interface(TransferDomainV1.abi);
		const data = ITransferDomainV1.encodeFunctionData('transferDST20', [
			DUSD_DST.address,
			evmAddress,
			TransferDomainV1.address,
			ethers.parseEther(amountToTransfer.toString()),
			this.toTokenAddressDVM,
		]);
		const evmTx = {
			to: TransferDomainV1.address,
			nonce: await walletEVM.getNonce(),
			chainId: DMCChainId,
			data,
			value: 0,
			gasPrice: 0,
			gasLimit: 0,
			type: 0,
		};
		const evmSignedTx = (await walletEVM.signTransaction(evmTx)).substring(2); // rm prefix '0x'

		// create TransferDomain Tx
		const transferDomain: TransferDomain = {
			items: [
				{
					src: {
						address: evmScript,
						domain: TransferDomainType.EVM,
						amount: {
							token: 15,
							amount: amountToTransfer,
						},
						data: new Uint8Array(Buffer.from(evmSignedTx, 'hex')),
					},
					dst: {
						address: toTokenAddressDVMScript,
						domain: TransferDomainType.DVM,
						amount: {
							token: 15,
							amount: amountToTransfer,
						},
						data: new Uint8Array([]),
					},
				},
			],
		};

		// utxo check
		const utxoList = await this.ocean.address.listTransactionUnspent(dvmAddress);
		if (utxoList.length == 0) {
			this.logger.error('No utxo available for', dvmAddress);
			return;
		}
		const utxoIdx = -1;
		const utxo: Prevout = {
			txid: utxoList.at(utxoIdx).vout.txid,
			vout: utxoList.at(utxoIdx).vout.n,
			value: new BigNumber(utxoList.at(utxoIdx).vout.value),
			script: dvmScript,
			tokenId: utxoList.at(utxoIdx).vout.tokenId || 0,
		};

		// signing dvm tx
		const dvmSignedTx = await this.wallet.active.withTransactionBuilder().account.transferDomain(transferDomain, dvmScript, [utxo]);
		const segWitSignedTx = new CTransactionSegWit(dvmSignedTx);

		// sending
		const txid = await this.ocean.rawtx.send({ hex: segWitSignedTx.toHex() });
		this.logger.log(`Broadcasted: ${txid}`);
		this.logger.log(`TransferDomain: ${amountToTransfer} BTC to ${this.toTokenAddressDVM}\n`);
	}
}
