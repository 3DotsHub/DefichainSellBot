import { Injectable } from '@nestjs/common';
import { WhaleApiClient } from '@defichain/whale-api-client';
import { selectedNetwork, oceanUrl } from '../defichain.config';

@Injectable()
export class Ocean extends WhaleApiClient {
	private readonly waitTimeoutThreshold: number = 10 * 60; // 10min in sec
	private readonly waitInterval: number = 5; // in sec
	private scanning: boolean = false;
	public readonly network: string;

	constructor() {
		super({
			version: 'v0',
			network: selectedNetwork,
			url: oceanUrl[selectedNetwork],
		});
		this.network = selectedNetwork;
	}

	async waitForTx(txId: string) {
		const refTime: Date = new Date();
		return new Promise((resolve) => {
			let running: boolean = false;
			let intervalId: NodeJS.Timeout;

			// runner function with promise resolving
			const runner = () => {
				if (running) return;
				running = true;

				this.transactions
					.get(txId)
					.then((tx) => {
						if (intervalId !== undefined) clearInterval(intervalId);
						resolve(true);
						running = false;
					})
					.catch((error) => {
						const diff = new Date().getTime() - refTime.getTime();
						if (diff > this.waitTimeoutThreshold * 1000) {
							console.log(error);
							if (intervalId !== undefined) clearInterval(intervalId);
							resolve(false);
						}
						running = false;
					});
			};

			// run once and continue with interval
			runner();
			intervalId = setInterval(runner, this.waitInterval * 1000);
		});
	}
}
