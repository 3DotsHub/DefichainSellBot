import { Injectable } from '@nestjs/common';
import { JsonRpcProvider } from 'ethers';
import { selectedNetwork, dmcUrl } from '../defichain.config';

@Injectable()
export class EvmProvider extends JsonRpcProvider {
	public readonly network: string;

	constructor() {
		super(dmcUrl + selectedNetwork);
		this.network = selectedNetwork;
	}
}
