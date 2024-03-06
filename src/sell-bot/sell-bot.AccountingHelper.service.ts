import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';

import { EvmProvider } from 'src/defichain/services/defichain.evm.provider.service';
import { Ocean } from 'src/defichain/services/defichain.ocean.client.service';
import { Wallet } from 'src/defichain/services/defichain.ocean.wallet.service';
import { BTC_DST, DUSD_DST, ERC20ABI } from 'src/defichain/defichain.config';
import fs from 'fs';

type AllSwapsEventLog = { from: (ethers.Log | ethers.EventLog)[]; to: (ethers.Log | ethers.EventLog)[] };

@Injectable()
export class SellBotAccountingHelperService {
	private readonly logger = new Logger(this.constructor.name);
	private readonly logFile = './logs/eventFilterBTCSwaps';

	constructor(private ocean: Ocean, private wallet: Wallet, private evmProvider: EvmProvider) {
		setTimeout(() => this.getEVMSwaps(), 100);
	}

	async fetchAllDUSDDeposits() {
		const blockHeight = await this.evmProvider.getBlockNumber();
		const contract = new ethers.Contract(DUSD_DST.address, ERC20ABI, this.evmProvider);
		const eventLogFilter = contract.filters.Transfer(null, await this.wallet.active.getEvmAddress());
		const step = 20000;
		let next = 0;
		let eventLog: (ethers.Log | ethers.EventLog)[] = [];

		while (next < blockHeight) {
			const maxNext = next + step > blockHeight ? blockHeight : next + step;
			this.logger.log(`Requesting from ${next} to ${maxNext}, blocks: ${blockHeight}`);

			const eventLogsChunk = await contract.queryFilter(eventLogFilter, next, maxNext);
			eventLog = eventLog.concat(eventLogsChunk);
			this.logger.log(`Response lenght is ${eventLogsChunk.length}`);

			next += step;
			if (next > blockHeight) break;
		}

		return eventLog;
	}

	async fetchAllSwaps(): Promise<AllSwapsEventLog> {
		const blockHeight = await this.evmProvider.getBlockNumber();
		const contractFrom = new ethers.Contract(DUSD_DST.address, ERC20ABI, this.evmProvider);
		const contractTo = new ethers.Contract(BTC_DST.address, ERC20ABI, this.evmProvider);
		const eventLogFilterFrom = contractTo.filters.Transfer(await this.wallet.active.getEvmAddress());
		const eventLogFilterTo = contractFrom.filters.Transfer(null, await this.wallet.active.getEvmAddress());
		const step = 20000;
		let next = 129990;
		let eventLogFrom: (ethers.Log | ethers.EventLog)[] = [];
		let eventLogTo: (ethers.Log | ethers.EventLog)[] = [];

		while (next < blockHeight) {
			const maxNext = next + step > blockHeight ? blockHeight : next + step;
			this.logger.log(`Requesting from ${next} to ${maxNext}, blocks: ${blockHeight}`);

			const eventLogsChunkFrom = await contractFrom.queryFilter(eventLogFilterFrom, next, maxNext);
			const eventLogsChunkTo = await contractTo.queryFilter(eventLogFilterTo, next, maxNext);
			eventLogFrom = eventLogFrom.concat(eventLogsChunkFrom);
			eventLogTo = eventLogTo.concat(eventLogsChunkTo);
			this.logger.log(`${eventLogsChunkFrom.length}, ${eventLogsChunkTo.length}`);

			next += step;
			if (next > blockHeight) break;
		}

		return { from: eventLogFrom, to: eventLogTo };
	}

	async saveAllSwaps(allSwapData: AllSwapsEventLog) {
		fs.writeFileSync(this.logFile + 'From.json', JSON.stringify(allSwapData.from));
		fs.writeFileSync(this.logFile + 'To.json', JSON.stringify(allSwapData.to));
	}

	async loadAllSwaps(): Promise<AllSwapsEventLog> {
		const from = JSON.parse(fs.readFileSync(this.logFile + 'From.json').toString()) as (ethers.Log | ethers.EventLog)[];
		const to = JSON.parse(fs.readFileSync(this.logFile + 'To.json').toString()) as (ethers.Log | ethers.EventLog)[];
		return { from, to };
	}

	dataToArray(data: string) {
		return parseInt(data.substring(2), 16) / 10 ** 18;
	}

	async getEVMSwaps() {
		const walletEVM = new ethers.Wallet((await this.wallet.active.privateKey()).toString('hex'), this.evmProvider);
		const dvmAddress = await this.wallet.active.getAddress();
		const evmAddress = await this.wallet.active.getEvmAddress();
		const dvmScript = await this.wallet.active.getScript();
		const evmScript = await this.wallet.active.getEvmScript();

		this.logger.log('Starting...');
		const allSwaps = await this.fetchAllSwaps();
		await this.saveAllSwaps(allSwaps);
		this.logger.log('Stored. Length: ' + (allSwaps.from.length + allSwaps.to.length));

		// load data
		const list = await this.loadAllSwaps();
		const dataListFrom = list.from.map((l) => {
			return {
				...l,
				data: this.dataToArray(l.data),
			};
		});
		const dataListTo = list.to.map((l) => {
			return {
				...l,
				data: this.dataToArray(l.data),
			};
		});

		// make csv and store
		const csvFrom = dataListFrom.map((l) => {
			return `${l.transactionHash}, ${l.blockNumber}, ${l.transactionIndex}, ${l.data}`;
		});
		fs.writeFileSync(this.logFile + 'From.csv', csvFrom.join('\n'));

		const csvTo = dataListTo.map((l) => {
			return `${l.transactionHash}, ${l.blockNumber}, ${l.transactionIndex}, ${l.data}`;
		});
		fs.writeFileSync(this.logFile + 'To.csv', csvTo.join('\n'));

		// done
		this.logger.log('Done.');
	}

	async getDUSDDeposits() {
		this.logger.log('Starting...');
		const allDeposits = await this.fetchAllDUSDDeposits();
		const list = allDeposits.map((l) => {
			return {
				...l,
				data: this.dataToArray(l.data),
			};
		});

		const csvTo = list.map((l) => {
			return `${l.transactionHash}, ${l.blockNumber}, ${l.transactionIndex}, ${l.data}`;
		});
		fs.writeFileSync(this.logFile + 'Deposits.csv', csvTo.join('\n'));

		// done
		this.logger.log('Done.');
	}
}
