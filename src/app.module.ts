// CORE IMPORTS
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

// APP IMPORTS
import { AppController } from './app.controller';

// MODULES IMPORTS
import { DefichainModule } from './defichain/defichain.module';
import { SellBotModule } from './sell-bot/sell-bot.module';

@Module({
	imports: [ScheduleModule.forRoot(), DefichainModule, SellBotModule],
	controllers: [AppController],
	providers: [],
})
export class AppModule {}
