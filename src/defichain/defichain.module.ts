import { Module } from '@nestjs/common';
import { Ocean } from './services/defichain.ocean.client.service';
import { Wallet } from './services/defichain.ocean.wallet.service';
import { EvmProvider } from './services/defichain.evm.provider.service';

@Module({
	providers: [Ocean, Wallet, EvmProvider],
	exports: [Ocean, Wallet, EvmProvider],
	controllers: [],
})
export class DefichainModule {}
