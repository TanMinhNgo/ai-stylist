import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { QueueModule } from '../queue/queue.module';
import { PlanningModule } from '../planning/planning.module';
import { ContextRepository } from './context.repository';
import { ContextService } from './context.service';
import { ContextController } from './context.controller';
import { WeatherProvider, OpenMeteoWeatherProvider } from './weather.provider';
@Module({
  imports: [DatabaseModule, QueueModule, PlanningModule],
  providers: [
    ContextRepository,
    ContextService,
    { provide: WeatherProvider, useClass: OpenMeteoWeatherProvider },
  ],
  controllers: [ContextController],
})
export class ContextModule {}
