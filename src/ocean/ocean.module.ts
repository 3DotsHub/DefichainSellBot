import { Module } from '@nestjs/common';
import { Ocean } from './ocean.api.service';
import { Wallet } from './ocean.wallet.service';

@Module({
	providers: [Ocean, Wallet],
	exports: [Ocean, Wallet],
	controllers: [],
})
export class OceanModule {}
