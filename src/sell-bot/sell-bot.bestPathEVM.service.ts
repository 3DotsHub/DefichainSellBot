import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import { Ocean } from 'src/defichain/services/defichain.ocean.client.service';
import { EvmProvider } from 'src/defichain/services/defichain.evm.provider.service';
import { VanillaSwapRouterV2 } from 'src/defichain/defichain.config';

type PriceResult = {
	poolPairPath: string[];
	poolPairNames: string[];
	priceRatio: number;
}[];

type DiscoverEVMData = {
	allPriceResults: PriceResult;
	bestPricePath: string[];
	bestPricePathNames: string[];
	bestPriceResult: number;
};

@Injectable()
export class SellBotBestPathEVMService {
	private readonly logger = new Logger(this.constructor.name);
	constructor(private ocean: Ocean, private evmProvider: EvmProvider) {}

	allPaths() {
		return [
			{
				pathNames: ['DUSD', 'WDFI', 'BTC'],
				path: [
					'0xff0000000000000000000000000000000000000f',
					'0x49febbf9626b2d39aba11c01d83ef59b3d56d2a4',
					'0xff00000000000000000000000000000000000002',
				],
			},
			{
				pathNames: ['DUSD', 'VAN', 'WDFI', 'BTC'],
				path: [
					'0xff0000000000000000000000000000000000000f',
					'0x870c765f8af9b189c324be88b99884e5bae4514b',
					'0x49febbf9626b2d39aba11c01d83ef59b3d56d2a4',
					'0xff00000000000000000000000000000000000002',
				],
			},

			{
				pathNames: ['DUSD', 'HOSP', 'WDFI', 'BTC'],
				path: [
					'0xff0000000000000000000000000000000000000f',
					'0x5128e0407a5b9b123ad942f9a9f0c151aef7d1ef',
					'0x49febbf9626b2d39aba11c01d83ef59b3d56d2a4',
					'0xff00000000000000000000000000000000000002',
				],
			},
			{
				pathNames: ['DUSD', 'JELLO', 'WDFI', 'BTC'],
				path: [
					'0xff0000000000000000000000000000000000000f',
					'0xccf58ce4f55156536c5f18de2975e75d7a754cb8',
					'0x49febbf9626b2d39aba11c01d83ef59b3d56d2a4',
					'0xff00000000000000000000000000000000000002',
				],
			},
			{
				pathNames: ['DUSD', 'MUSD', 'WDFI', 'BTC'],
				path: [
					'0xff0000000000000000000000000000000000000f',
					'0x80b6897ba629d6c42584ec162cca29f1e34783be',
					'0x49febbf9626b2d39aba11c01d83ef59b3d56d2a4',
					'0xff00000000000000000000000000000000000002',
				],
			},
			{
				pathNames: ['DUSD', 'MLAND', 'WDFI', 'BTC'],
				path: [
					'0xff0000000000000000000000000000000000000f',
					'0x40713cd6eb30c6754f5721bfd4e6e50fda9e2954',
					'0x49febbf9626b2d39aba11c01d83ef59b3d56d2a4',
					'0xff00000000000000000000000000000000000002',
				],
			},
			{
				pathNames: ['DUSD', 'VAN', 'USDT', 'WDFI', 'BTC'],
				path: [
					'0xff0000000000000000000000000000000000000f',
					'0x870c765f8af9b189c324be88b99884e5bae4514b',
					'0xff00000000000000000000000000000000000003',
					'0x49febbf9626b2d39aba11c01d83ef59b3d56d2a4',
					'0xff00000000000000000000000000000000000002',
				],
			},
		];
	}

	async quotePath(amount?: string, path?: string[]) {
		const amountIn = ethers.parseEther(amount || '1');
		const router = new ethers.Contract(VanillaSwapRouterV2.address, VanillaSwapRouterV2.abi, this.evmProvider);
		const amounts = await router.getAmountsOut(amountIn, path);
		const adj = Math.floor(parseFloat(amounts.at(-1).toString()) / parseFloat(amount));
		return ethers.formatUnits(adj.toString(), 18);
	}

	async discover(amount?: string, pathArray?: string[]): Promise<DiscoverEVMData> {
		const priceQuotes = [];
		const paths = this.allPaths();
		let bestIdx: number;

		for (let p of paths) {
			priceQuotes.push(await this.quotePath(amount, p.path));
			if (bestIdx == undefined) bestIdx = 0;
			else if (priceQuotes.at(-1) > priceQuotes[bestIdx]) bestIdx = priceQuotes.length - 1;
		}

		const allPriceResults: PriceResult = paths.map((p, idx) => {
			return {
				poolPairPath: p.path,
				poolPairNames: p.pathNames,
				priceRatio: parseFloat(priceQuotes[idx]),
			};
		});

		return {
			allPriceResults,
			bestPricePath: paths[bestIdx].path,
			bestPricePathNames: paths[bestIdx].pathNames,
			bestPriceResult: parseFloat(priceQuotes[bestIdx]),
		};
	}
}
