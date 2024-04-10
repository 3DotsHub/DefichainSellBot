import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import { CTransactionSegWit, TransferDomain } from '@defichain/jellyfish-transaction';
import { Prevout } from '@defichain/jellyfish-transaction-builder';
import { fromAddress } from '@defichain/jellyfish-address';
import BigNumber from 'bignumber.js';

import { EvmProvider } from 'src/defichain/services/defichain.evm.provider.service';
import { Ocean } from 'src/defichain/services/defichain.ocean.client.service';
import { Wallet } from 'src/defichain/services/defichain.ocean.wallet.service';
import { TransferDomainType, TransferDomainV1, USDT_DST, ERC20ABI, DMCChainId } from 'src/defichain/defichain.config';

@Injectable()
export class SellBotTransferDomainUSDTService {
	private readonly logger = new Logger(this.constructor.name);
	constructor(private ocean: Ocean, private wallet: Wallet, private evmProvider: EvmProvider) {}

	async transferDomain(amount: number) {
		const walletEVM = new ethers.Wallet((await this.wallet.active.privateKey()).toString('hex'), this.evmProvider);
		const dvmAddress = await this.wallet.active.getAddress();
		const evmAddress = await this.wallet.active.getEvmAddress();
		const dvmScript = await this.wallet.active.getScript();
		const evmScript = await this.wallet.active.getEvmScript();
		const amountAdj8 = Math.floor(amount * 10 ** 8) / 10 ** 8;

		// create EVM TD TX
		this.logger.log(`Preparing TransferDomain of ${amountAdj8} USDT from EVM to DVM, target: ${dvmAddress}`);

		const ITransferDomainV1 = new ethers.Interface(TransferDomainV1.abi);
		const data = ITransferDomainV1.encodeFunctionData('transferDST20', [
			USDT_DST.address,
			evmAddress,
			TransferDomainV1.address,
			ethers.parseEther(amountAdj8.toString()),
			dvmAddress,
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
							token: 3,
							amount: new BigNumber(amountAdj8),
						},
						data: new Uint8Array(Buffer.from(evmSignedTx, 'hex')),
					},
					dst: {
						address: dvmScript,
						domain: TransferDomainType.DVM,
						amount: {
							token: 3,
							amount: new BigNumber(amountAdj8),
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
		this.logger.log(`Broadcasted and Waiting: ${txid}`);

		// waiting
		const completed = await this.ocean.waitForTx(txid);
		if (completed) this.logger.log(`Completed TransferDomain of ${amountAdj8} USDT`);
		else throw new Error('Timeout or Error while TransferDomain with USDT');
	}
}
