import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import { Ocean } from 'src/defichain/services/defichain.ocean.client.service';
import { EvmProvider } from 'src/defichain/services/defichain.evm.provider.service';
import { VanillaSwapRouterV2 } from 'src/defichain/defichain.config';
import { DiscoverData, SellBotBestPathDVMService } from './sell-bot.bestPathDVM.service';

export type PathResult = {
	pathNames: string[];
	path: string[];
};

export type PriceResult = {
	poolPairPath: string[];
	poolPairNames: string[];
	priceRatio: number;
}[];

export type DiscoverEVMData = {
	allPriceResults: PriceResult;
	bestPricePath: string[];
	bestPricePathNames: string[];
	bestPriceResult: number;
};

export type DiscoverTDData = {
	bestPricePath: string[];
	bestPricePathNames: string[];
	bestPriceResult: number;
	discoverEVM: DiscoverEVMData;
	discoverDVM: DiscoverData;
};

@Injectable()
export class SellBotBestPathHYBService {
	private readonly logger = new Logger(this.constructor.name);
	constructor(private ocean: Ocean, private evmProvider: EvmProvider, private sellBotBestPathDVMService: SellBotBestPathDVMService) {}

	allPathsToDFI(): PathResult[] {
		return [
			{
				pathNames: ['DUSD', 'WDFI'],
				path: ['0xff0000000000000000000000000000000000000f', '0x49febbf9626b2d39aba11c01d83ef59b3d56d2a4'],
			},
			{
				pathNames: ['DUSD', 'VAN', 'WDFI'],
				path: [
					'0xff0000000000000000000000000000000000000f',
					'0x870c765f8af9b189c324be88b99884e5bae4514b',
					'0x49febbf9626b2d39aba11c01d83ef59b3d56d2a4',
				],
			},
			{
				pathNames: ['DUSD', 'HOSP', 'WDFI'],
				path: [
					'0xff0000000000000000000000000000000000000f',
					'0x5128e0407a5b9b123ad942f9a9f0c151aef7d1ef',
					'0x49febbf9626b2d39aba11c01d83ef59b3d56d2a4',
				],
			},
			// {
			// 	pathNames: ['DUSD', 'JELLO', 'WDFI'],
			// 	path: [
			// 		'0xff0000000000000000000000000000000000000f',
			// 		'0xCCF58CE4F55156536C5f18dE2975E75D7A754CB8',
			// 		'0x49febbf9626b2d39aba11c01d83ef59b3d56d2a4',
			// 	],
			// },
			{
				pathNames: ['DUSD', 'MUSD', 'WDFI'],
				path: [
					'0xff0000000000000000000000000000000000000f',
					'0x80b6897ba629d6c42584ec162cca29f1e34783be',
					'0x49febbf9626b2d39aba11c01d83ef59b3d56d2a4',
				],
			},
			{
				pathNames: ['DUSD', 'MLAND', 'WDFI'],
				path: [
					'0xff0000000000000000000000000000000000000f',
					'0x40713cd6eb30c6754f5721bfd4e6e50fda9e2954',
					'0x49febbf9626b2d39aba11c01d83ef59b3d56d2a4',
				],
			},
			{
				pathNames: ['DUSD', 'VAN', 'USDT', 'WDFI'],
				path: [
					'0xff0000000000000000000000000000000000000f',
					'0x870c765f8af9b189c324be88b99884e5bae4514b',
					'0xff00000000000000000000000000000000000003',
					'0x49febbf9626b2d39aba11c01d83ef59b3d56d2a4',
				],
			},
		];
	}

	allPathsToUSDT(): PathResult[] {
		return [
			{
				pathNames: ['DUSD', 'WDFI', 'USDT'],
				path: [
					'0xff0000000000000000000000000000000000000f',
					'0x49febbf9626b2d39aba11c01d83ef59b3d56d2a4',
					'0xff00000000000000000000000000000000000003',
				],
			},
			{
				pathNames: ['DUSD', 'VAN', 'USDT'],
				path: [
					'0xff0000000000000000000000000000000000000f',
					'0x870c765f8af9b189c324be88b99884e5bae4514b',
					'0xff00000000000000000000000000000000000003',
				],
			},
			{
				pathNames: ['DUSD', 'VAN', 'WDFI', 'USDT'],
				path: [
					'0xff0000000000000000000000000000000000000f',
					'0x870c765f8af9b189c324be88b99884e5bae4514b',
					'0x49febbf9626b2d39aba11c01d83ef59b3d56d2a4',
					'0xff00000000000000000000000000000000000003',
				],
			},

			{
				pathNames: ['DUSD', 'WDFI', 'MUSD', 'USDT'],
				path: [
					'0xff0000000000000000000000000000000000000f',
					'0x49febbf9626b2d39aba11c01d83ef59b3d56d2a4',
					'0x80b6897ba629d6c42584ec162cca29f1e34783be',
					'0xff00000000000000000000000000000000000003',
				],
			},
			{
				pathNames: ['DUSD', 'VAN', 'WDFI', 'MUSD', 'USDT'],
				path: [
					'0xff0000000000000000000000000000000000000f',
					'0x870c765f8af9b189c324be88b99884e5bae4514b',
					'0x49febbf9626b2d39aba11c01d83ef59b3d56d2a4',
					'0x80b6897ba629d6c42584ec162cca29f1e34783be',
					'0xff00000000000000000000000000000000000003',
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

	async discover(amount?: string, pathArray?: PathResult[]): Promise<DiscoverEVMData> {
		const priceQuotes = [];
		const paths = pathArray;
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

	async discoverDFI(amount?: string): Promise<DiscoverTDData> {
		const discover = await this.discover(amount, this.allPathsToDFI());
		const discoverDFIDVM = await this.sellBotBestPathDVMService.discover('0', '2');
		const bestPricePath = discover.bestPricePath.concat(['TransferDomain@DFI'].concat(discoverDFIDVM.bestPriceResult.poolPairIds));
		const bestPricePathNames = discover.bestPricePathNames.concat(
			['TransferDomain@DFI'].concat(discoverDFIDVM.bestPriceResult.poolPairNames)
		);
		const bestPriceResult = discover.bestPriceResult * discoverDFIDVM.bestPriceResult.priceRatio;

		return {
			bestPricePath,
			bestPricePathNames,
			bestPriceResult,
			discoverEVM: discover,
			discoverDVM: discoverDFIDVM,
		};
	}

	async discoverUSDT(amount?: string): Promise<DiscoverTDData> {
		const discover = await this.discover(amount, this.allPathsToUSDT());
		const discoverUSDTDVM = await this.sellBotBestPathDVMService.discover('3', '2');
		const bestPricePath = discover.bestPricePath.concat(['TransferDomain@USDT'].concat(discoverUSDTDVM.bestPriceResult.poolPairIds));
		const bestPricePathNames = discover.bestPricePathNames.concat(
			['TransferDomain@USDT'].concat(discoverUSDTDVM.bestPriceResult.poolPairNames)
		);
		const bestPriceResult = discover.bestPriceResult * discoverUSDTDVM.bestPriceResult.priceRatio;

		return {
			bestPricePath,
			bestPricePathNames,
			bestPriceResult,
			discoverEVM: discover,
			discoverDVM: discoverUSDTDVM,
		};
	}

	toDisplay(data: DiscoverTDData) {
		const showSats = (p: number) => Math.floor(p * 10 ** 10) / 100;
		data.discoverEVM.allPriceResults.map((r) =>
			this.logger.log(
				`${r.poolPairNames.join(' > ')} > TD (${r.priceRatio}) > ${data.discoverDVM.bestPriceResult.poolPairNames.join(
					' > '
				)} >>> ${showSats(r.priceRatio * data.discoverDVM.bestPriceResult.priceRatio)} Sats <<<`
			)
		);
		console.log('');
	}
}
