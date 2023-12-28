import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import { TokenIdentifier } from '@defichain/whale-api-client/dist/api/poolpairs';
import { Ocean } from 'src/defichain/defichain.ocean.client.service';
import { DmcProvider } from 'src/defichain/defichain.dmc.provider.service';

type PriceResult = {
	poolPairIds: string[];
	poolPairNames: string[];
	priceRatio: number;
	dexFeePct: number;
	comFeePct: number;
};

type DiscoverData = {
	fromToken: TokenIdentifier;
	toToken: TokenIdentifier;
	allPriceResults: PriceResult[];
	bestPriceResult: PriceResult;
};

@Injectable()
export class SellBotBestPathService {
	private readonly logger = new Logger(this.constructor.name);

	constructor(private ocean: Ocean, private dmcProvider: DmcProvider) {}

	async dicoverDVM(fromTokenId: string, toTokenId: string): Promise<DiscoverData> {
		return null;
	}

	async dicoverEVM(fromTokenId: string, toTokenId: string): Promise<DiscoverData> {
		const RouterV2Addr = '0x3E8C92491fc73390166BA00725B8F5BD734B8fba';
		const tokenAddr = {
			dusd: '0xFf0000000000000000000000000000000000000F',
			wdfi: '0x49febbF9626B2D39aBa11C01d83Ef59b3D56d2A4',
			btc: '0xff00000000000000000000000000000000000002',
		};
		const ABI = ['function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)'];
		const amountIn = ethers.parseEther('10');
		const path = [tokenAddr.dusd, tokenAddr.wdfi, tokenAddr.btc];
		const router = new ethers.Contract(RouterV2Addr, ABI, this.dmcProvider);

		const amounts = await router.getAmountsOut(amountIn, path);
		const price = ethers.formatUnits(amounts.at(-1).toString(), 18);
		console.log('price', parseFloat(price));

		return null;
	}

	async dicover(fromTokenId: string, toTokenId: string): Promise<DiscoverData> {
		const { fromToken, toToken, paths } = await this.ocean.poolpairs.getAllPaths(fromTokenId, toTokenId);

		let bestPriceResult: PriceResult;
		const allPriceResults: PriceResult[] = paths.map((path) => {
			const poolPairIds: string[] = [];
			const poolPairNames: string[] = [];
			let priceRatio: number = 1;
			let dexFeePct: number = 0;
			let comFeePct: number = 0;
			let refToken: TokenIdentifier = fromToken;

			for (let p of path) {
				poolPairIds.push(p.poolPairId);
				poolPairNames.push(p.symbol);

				// make ref entry
				const refEntryAB = p.tokenB.id === refToken.id;

				// dex fee correction
				if (p.estimatedDexFeesInPct) {
					const dexFee = refEntryAB ? p.estimatedDexFeesInPct.ab : p.estimatedDexFeesInPct.ba;
					priceRatio *= 1 - parseFloat(dexFee);
					dexFeePct += parseFloat(dexFee);
				}

				// com fee correction
				priceRatio *= 1 - parseFloat(p.commissionFeeInPct);
				comFeePct += parseFloat(p.commissionFeeInPct);

				// price correction
				const price = refEntryAB ? p.priceRatio.ab : p.priceRatio.ba;
				priceRatio *= parseFloat(price);

				// adj refToken
				refToken = refEntryAB ? p.tokenA : p.tokenB;
			}

			// limit priceRatio to 8 digits float
			priceRatio = parseFloat(priceRatio.toFixed(8));

			// construct payload
			const payload = {
				poolPairIds,
				poolPairNames,
				priceRatio,
				dexFeePct,
				comFeePct,
			};

			// adj bestPriceResult
			if (!bestPriceResult) bestPriceResult = payload;
			else if (priceRatio > bestPriceResult.priceRatio) {
				bestPriceResult = payload;
			}

			return payload;
		});

		return {
			fromToken,
			toToken,
			allPriceResults,
			bestPriceResult,
		};
	}
}
