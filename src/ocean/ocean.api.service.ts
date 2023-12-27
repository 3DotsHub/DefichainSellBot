import { Injectable } from '@nestjs/common';
import { WhaleApiClient } from '@defichain/whale-api-client';
import { selectedNetwork, oceanUrl } from './defichain.config';

@Injectable()
export class Ocean extends WhaleApiClient {
	public readonly network: string;

	constructor() {
		super({
			version: 'v0',
			network: selectedNetwork,
			url: oceanUrl[selectedNetwork],
		});
		this.network = selectedNetwork;
	}
}
