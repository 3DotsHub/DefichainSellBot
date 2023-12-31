import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import { Ocean } from 'src/defichain/services/defichain.ocean.client.service';
import { EvmProvider } from 'src/defichain/services/defichain.evm.provider.service';
import { VanillaSwapRouterV2Addr, WDFI_DST, BTC_DST, DUSD_DST } from 'src/defichain/defichain.config';

type DiscoverEVMData = {
	bestPricePath: string[];
	bestPricePathNames: string[];
	bestPriceResult: number;
};

@Injectable()
export class SellBotBestPathEVMService {
	private readonly logger = new Logger(this.constructor.name);
	constructor(private ocean: Ocean, private evmProvider: EvmProvider) {}

	async dicover(fromTokenId?: string, toTokenId?: string): Promise<DiscoverEVMData> {
		const ABI = ['function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)'];
		const amountIn = ethers.parseEther('1');
		const path = [DUSD_DST.address, WDFI_DST.address, BTC_DST.address];
		const pathNames = ['DUSD-WDFI', 'BTC-WDFI'];
		const router = new ethers.Contract(VanillaSwapRouterV2Addr, ABI, this.evmProvider);

		const amounts = await router.getAmountsOut(amountIn, path);
		const price = ethers.formatUnits(amounts.at(-1).toString(), 18);

		return {
			bestPricePath: path,
			bestPricePathNames: pathNames,
			bestPriceResult: parseFloat(price),
		};
	}
}
