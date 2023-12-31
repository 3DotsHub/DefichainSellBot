import { Injectable } from '@nestjs/common';
import { MainNet } from '@defichain/jellyfish-network';
import { JellyfishWallet } from '@defichain/jellyfish-wallet';
import { WhaleWalletAccountProvider, WhaleWalletAccount } from '@defichain/whale-api-wallet';
import { MnemonicHdNodeProvider, MnemonicHdNode } from '@defichain/jellyfish-wallet-mnemonic';
import { Ocean } from './defichain.ocean.client.service';

const seed: string[] = JSON.parse(process.env.SEED);

const Bip32Options = {
	bip32: {
		public: MainNet.bip32.publicPrefix,
		private: MainNet.bip32.privatePrefix,
	},
	wif: MainNet.wifPrefix,
};

@Injectable()
export class Wallet extends JellyfishWallet<WhaleWalletAccount, MnemonicHdNode> {
	public readonly walletIndex: number = 0;
	public readonly active: WhaleWalletAccount;

	constructor(private ocean: Ocean) {
		if (!seed) throw new Error('Seed not available or invalid. Stringifyed string[] type needed.');
		super(MnemonicHdNodeProvider.fromWords(seed, Bip32Options), new WhaleWalletAccountProvider(ocean, MainNet));
		this.active = this.getWalletAccountByIdx(this.walletIndex);
	}

	getWalletAccountByIdx(idx: number): WhaleWalletAccount {
		return this.get(idx);
	}
}
