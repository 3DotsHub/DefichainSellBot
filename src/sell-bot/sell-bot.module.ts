import { Module } from '@nestjs/common';
import { DefichainModule } from 'src/defichain/defichain.module';
import { SellBotService } from './sell-bot.service';
import { SellBotBestPathService } from './sell-bot.bestPath.service';
import { SellBotBestPathEVMService } from './sell-bot.bestPathEvm.service';

@Module({
	providers: [SellBotService, SellBotBestPathService, SellBotBestPathEVMService],
	controllers: [],
	imports: [DefichainModule],
	exports: [],
})
export class SellBotModule {}
