import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import { CTransactionSegWit, TransferDomain } from '@defichain/jellyfish-transaction';
import { Prevout } from '@defichain/jellyfish-transaction-builder';
import { fromAddress } from '@defichain/jellyfish-address';
import BigNumber from 'bignumber.js';

import { EvmProvider } from 'src/defichain/services/defichain.evm.provider.service';
import { Ocean } from 'src/defichain/services/defichain.ocean.client.service';
import { Wallet } from 'src/defichain/services/defichain.ocean.wallet.service';
import { DUSDBond2Y, DMCChainId } from 'src/defichain/defichain.config';
import fs from 'fs';

@Injectable()
export class SellBotDUSDBondService {
	private readonly logger = new Logger(this.constructor.name);

	constructor(private ocean: Ocean, private wallet: Wallet, private evmProvider: EvmProvider) {
		// setTimeout(() => this.check(), 100);
	}

	async fetchAllRewards() {
		const contract = new ethers.Contract(DUSDBond2Y.address, DUSDBond2Y.abi, this.evmProvider);
		const eventLogFilter = contract.filters.RewardsAdded(null);
		return await contract.queryFilter(eventLogFilter, 190000);
	}

	async saveAllRewards(eventLog: (ethers.Log | ethers.EventLog)[]) {
		fs.writeFileSync('./logs/eventFilterDUSDBond_RewardsAdded.json', JSON.stringify(eventLog));
	}

	async loadAllRewards() {
		return JSON.parse(fs.readFileSync('./logs/eventFilterDUSDBond_RewardsAdded.json').toString()) as (ethers.Log | ethers.EventLog)[];
	}

	dataToArray(data: string) {
		return data
			.substring(2)
			.match(/.{1,64}/g)
			.map((i) => parseInt(i, 16));
	}

	async check() {
		const walletEVM = new ethers.Wallet((await this.wallet.active.privateKey()).toString('hex'), this.evmProvider);
		const dvmAddress = await this.wallet.active.getAddress();
		const evmAddress = await this.wallet.active.getEvmAddress();
		const dvmScript = await this.wallet.active.getScript();
		const evmScript = await this.wallet.active.getEvmScript();

		const allRewards = await this.fetchAllRewards();
		await this.saveAllRewards(allRewards);

		// load data
		const list = await this.loadAllRewards();
		const dataList = list.map((l) => {
			return {
				...l,
				data: this.dataToArray(l.data),
			};
		});

		const csv = dataList.map((l) => {
			return `${l.blockNumber}, ${l.data.at(0)}, ${l.data.at(1)}, ${l.data.at(2)}, ${l.data.at(3)}`;
		});

		fs.writeFileSync('./logs/eventFilterDUSDBond_RewardsAdded.csv', csv.join('\n'));
		this.logger.log('Done. ' + allRewards.length);
	}
}
