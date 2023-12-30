import { Module } from '@nestjs/common';
import { DefichainModule } from 'src/defichain/defichain.module';
import { SellBotService } from './sell-bot.service';
import { SellBotBestPathDVMService } from './sell-bot.bestPathDVM.service';
import { SellBotBestPathEVMService } from './sell-bot.bestPathEVM.service';

@Module({
	providers: [SellBotService, SellBotBestPathDVMService, SellBotBestPathEVMService],
	controllers: [],
	imports: [DefichainModule],
	exports: [],
})
export class SellBotModule {}
