import { Module } from '@nestjs/common';
import { Ocean } from './defichain.ocean.client.service';
import { Wallet } from './defichain.ocean.wallet.service';
import { DmcProvider } from './defichain.dmc.provider.service';

@Module({
	providers: [Ocean, Wallet, DmcProvider],
	exports: [Ocean, Wallet, DmcProvider],
	controllers: [],
})
export class DefichainModule {}
