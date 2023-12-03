// CORE IMPORTS
require('dotenv').config();
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

// APP IMPORTS
import { AppController } from './app.controller';

// MODULES IMPORTS
import { OceanModule } from './ocean/ocean.module';
import { SellBotModule } from './sell-bot/sell-bot.module';

@Module({
	imports: [ScheduleModule.forRoot(), OceanModule, SellBotModule],
	controllers: [AppController],
	providers: [],
})
export class AppModule {}
