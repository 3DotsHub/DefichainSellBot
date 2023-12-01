// CORE IMPORTS
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';

// APP IMPORTS
import { AppController } from './app.controller';

// MODULES IMPORTS
import { OceanModule } from './ocean/ocean.module';
import { SellBotModule } from './sell-bot/sell-bot.module';

@Module({
	imports: [ConfigModule.forRoot(), ScheduleModule.forRoot(), OceanModule, SellBotModule],
	controllers: [AppController],
	providers: [],
})
export class AppModule {}
