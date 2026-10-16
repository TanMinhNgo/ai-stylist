import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { PlanningController } from './planning.controller';
import { PlanningService } from './planning.service';
import { PlanningRepository } from './planning.repository';
import { InsightsRepository } from './insights.repository';
@Module({
  imports: [DatabaseModule],
  controllers: [PlanningController],
  providers: [PlanningService, PlanningRepository, InsightsRepository],
})
export class PlanningModule {}
