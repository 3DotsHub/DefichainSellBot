import { Injectable, Logger } from '@nestjs/common';
import { Ocean } from 'src/ocean/ocean.api.service';
import { AddressToken } from '@defichain/whale-api-client/dist/api/address';
import { BestSwapPathResult, TokenIdentifier } from '@defichain/whale-api-client/dist/api/poolpairs';

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

	constructor(private ocean: Ocean) {}

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
