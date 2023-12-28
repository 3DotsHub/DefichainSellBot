import { Module } from '@nestjs/common';
import { DefichainModule } from 'src/defichain/defichain.module';
import { SellBotService } from './sell-bot.service';
import { SellBotBestPathService } from './sell-bot.bestPath.service';

@Module({
	providers: [SellBotService, SellBotBestPathService],
	controllers: [],
	imports: [DefichainModule],
	exports: [],
})
export class SellBotModule {}
