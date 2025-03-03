import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import { TokenIdentifier } from '@defichain/whale-api-client/dist/api/poolpairs';
import { Ocean } from 'src/defichain/services/defichain.ocean.client.service';
import { EvmProvider } from 'src/defichain/services/defichain.evm.provider.service';

export type PriceResult = {
	poolPairIds: string[];
	poolPairNames: string[];
	priceRatio: number;
	dexFeePct: number;
	comFeePct: number;
};

export type DiscoverData = {
	fromToken: TokenIdentifier;
	toToken: TokenIdentifier;
	allPriceResults: PriceResult[];
	bestPriceResult: PriceResult;
};

@Injectable()
export class SellBotBestPathDVMService {
	private readonly logger = new Logger(this.constructor.name);

	constructor(private ocean: Ocean) {}

	async discover(fromTokenId: string, toTokenId: string): Promise<DiscoverData> {
		const { fromToken, toToken, paths } = await this.ocean.poolpairs.getAllPaths(fromTokenId, toTokenId);

		let bestPriceResult: PriceResult;
		const allPriceResults: PriceResult[] = paths.map((path) => {
			const poolPairNames: string[] = [fromToken.symbol];
			const poolPairIds: string[] = [];
			let priceRatio: number = 1;
			let dexFeePct: number = 0;
			let comFeePct: number = 0;
			let refToken: TokenIdentifier = fromToken;

			for (let p of path) {
				poolPairIds.push(p.poolPairId);

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
				poolPairNames.push(refToken.symbol);
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

	toDisplay(data: DiscoverData) {
		const showSats = (p: number) => Math.floor(p * 10 ** 10) / 100;
		data.allPriceResults.map((r) => this.logger.log(`${r.poolPairNames.join(' > ')} >>> ${showSats(r.priceRatio)} Sats <<<`));
		console.log('');
	}
}
