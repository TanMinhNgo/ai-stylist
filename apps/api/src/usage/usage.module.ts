import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { QueueModule } from '../queue/queue.module';
import { PlanService, PlanSource, ClerkPlanSource } from './plan.service';
import { UsageService } from './usage.service';
import { JobLimitsService } from './job-limits.service';
import { RateLimitGuard } from './rate-limit.guard';
import { UsageController } from './usage.controller';
import { WorkService } from './work.service';
import { AiMeter } from './ai-meter.service';
@Global()
@Module({
  imports: [DatabaseModule, QueueModule],
  controllers: [UsageController],
  providers: [
    PlanService,
    { provide: PlanSource, useClass: ClerkPlanSource },
    UsageService,
    JobLimitsService,
    RateLimitGuard,
    WorkService,
    AiMeter,
  ],
  exports: [
    PlanService,
    UsageService,
    JobLimitsService,
    RateLimitGuard,
    WorkService,
    AiMeter,
  ],
})
export class UsageModule {}
