import { Module } from '@nestjs/common';
import { OceanModule } from 'src/ocean/ocean.module';
import { SellBotService } from './sell-bot.service';
import { SellBotBestPathService } from './sell-bot.bestPath.service';

@Module({
	providers: [SellBotService, SellBotBestPathService],
	controllers: [],
	imports: [OceanModule],
	exports: [],
})
export class SellBotModule {}
