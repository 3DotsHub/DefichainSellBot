import { Injectable } from '@nestjs/common';
import { JsonRpcProvider } from 'ethers';

@Injectable()
export class DmcProvider extends JsonRpcProvider {
	public readonly network: string;

	constructor() {
		const _network = 'mainnet';
		super('https://dmc.mydefichain.com/' + _network);
		this.network = _network;
	}
}
