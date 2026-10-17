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
import { RevenueCatPlanSource } from './revenuecat-plan.source';
import { RuntimeConfig } from '../config/runtime-config';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
@Global()
@Module({
  imports: [DatabaseModule, QueueModule],
  controllers: [UsageController, BillingController],
  providers: [
    BillingService,
    PlanService,
    ClerkPlanSource,
    RevenueCatPlanSource,
    {
      provide: PlanSource,
      inject: [RuntimeConfig, ClerkPlanSource, RevenueCatPlanSource],
      useFactory: (
        config: RuntimeConfig,
        clerk: ClerkPlanSource,
        revenuecat: RevenueCatPlanSource,
      ) =>
        config.values.BILLING_PROVIDER === 'revenuecat' ? revenuecat : clerk,
    },
    UsageService,
    JobLimitsService,
    RateLimitGuard,
    WorkService,
    AiMeter,
  ],
  exports: [
    RevenueCatPlanSource,
    PlanService,
    UsageService,
    JobLimitsService,
    RateLimitGuard,
    WorkService,
    AiMeter,
  ],
})
export class UsageModule {}
