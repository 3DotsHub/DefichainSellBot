import { Module } from '@nestjs/common';
import { OceanModule } from 'src/ocean/ocean.module';
import { SellBotService } from './sell-bot.service';

@Module({
	providers: [SellBotService],
	controllers: [],
	imports: [OceanModule],
	exports: [],
})
export class SellBotModule {}
