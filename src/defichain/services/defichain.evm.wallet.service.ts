import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers';
import { selectedNetwork, dmcUrl } from '../defichain.config';
import { Wallet } from './defichain.ocean.wallet.service';

// const walletEVM = new ethers.Wallet((await this.wallet.active.privateKey()).toString('hex'), this.evmProvider);

@Injectable()
export class EvmWallet extends Wallet {
	// constructor(private wallet: Wallet) {
	// }
}
