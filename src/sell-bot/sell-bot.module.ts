import { Module } from '@nestjs/common';
import { DefichainModule } from 'src/defichain/defichain.module';
import { SellBotService } from './sell-bot.service';
import { SellBotBestPathDVMService } from './sell-bot.bestPathDVM.service';
import { SellBotBestPathEVMService } from './sell-bot.bestPathEVM.service';
import { SellBotBestPathHYBService } from './sell-bot.bestPathHYB.service';
import { SellBotTransferDomainService } from './sell-bot.transferDomain.service';
import { SellBotTransferDomainDFIService } from './sell-bot.transferDomainDFI.service';
import { SellBotTransferDomainUSDTService } from './sell-bot.transferDomainUSDT.service';

@Module({
	providers: [
		SellBotService,
		SellBotBestPathDVMService,
		SellBotBestPathEVMService,
		SellBotBestPathHYBService,
		SellBotTransferDomainService,
		SellBotTransferDomainDFIService,
		SellBotTransferDomainUSDTService,
	],
	controllers: [],
	imports: [DefichainModule],
	exports: [],
})
export class SellBotModule {}
