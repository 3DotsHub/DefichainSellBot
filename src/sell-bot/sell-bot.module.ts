import { Module } from '@nestjs/common';
import { DefichainModule } from 'src/defichain/defichain.module';
import { SellBotService } from './sell-bot.service';
import { SellBotBestPathDVMService } from './sell-bot.bestPathDVM.service';
import { SellBotBestPathEVMService } from './sell-bot.bestPathEVM.service';
import { SellBotTransferDomainService } from './sell-bot.transferDomain.service';
import { SellBotDUSDBondService } from './sell-bot.DUSDBond.service';
import { SellBotAccountingHelperService } from './sell-bot.AccountingHelper.service';

@Module({
	providers: [
		SellBotService,
		SellBotBestPathDVMService,
		SellBotBestPathEVMService,
		SellBotTransferDomainService,
		SellBotDUSDBondService,
		SellBotAccountingHelperService,
	],
	controllers: [],
	imports: [DefichainModule],
	exports: [],
})
export class SellBotModule {}
