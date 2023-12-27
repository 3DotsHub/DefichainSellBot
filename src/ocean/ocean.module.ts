import { Module } from '@nestjs/common';
import { Ocean } from './ocean.api.service';
import { Wallet } from './ocean.wallet.service';
import { DmcProvider } from './dmc.provider.service';

@Module({
	providers: [Ocean, Wallet, DmcProvider],
	exports: [Ocean, Wallet, DmcProvider],
	controllers: [],
})
export class OceanModule {}
