import { Injectable, HttpException } from '@nestjs/common';
import { UsageResponse, type Plan } from '@stylist/shared';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { RuntimeConfig } from '../config/runtime-config';
import { PlanService } from './plan.service';

export function month(now = new Date()) {
  return {
    start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    reset: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  };
}

@Injectable()
export class UsageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: RuntimeConfig,
    readonly plans: PlanService,
  ) {}
  limit(plan: Plan) {
    return this.config.values[
      plan === 'pro'
        ? 'USAGE_PRO_LIMIT'
        : plan === 'plus'
          ? 'USAGE_PLUS_LIMIT'
          : 'USAGE_FREE_LIMIT'
    ];
  }
  async used(tx: Prisma.TransactionClient, userId: string, start: Date) {
    const sum = await tx.usageLedger.aggregate({
      where: { userId, periodStart: start },
      _sum: { delta: true },
    });
    return Math.max(0, -(sum._sum.delta ?? 0));
  }
  async get(userId: string) {
    const plan = await this.plans.getUserPlan(userId),
      period = month(),
      limit = this.limit(plan);
    const used = await this.used(this.prisma, userId, period.start);
    return UsageResponse.parse({
      plan,
      limit,
      used,
      remaining: Math.max(0, limit - used),
      resetsAt: period.reset.toISOString(),
    });
  }
  // Caller holds the user row lock; persist job and debit in the same transaction.
  async reserve(
    tx: Prisma.TransactionClient,
    userId: string,
    jobId: string,
    plan: Plan = 'free',
    now = new Date(),
  ) {
    if (
      await tx.usageLedger.findUnique({
        where: { jobId_delta: { jobId, delta: -1 } },
      })
    )
      return;
    const period = month(now);
    if ((await this.used(tx, userId, period.start)) >= this.limit(plan))
      throw new HttpException(
        {
          code: 'QUOTA_EXCEEDED',
          message: 'Monthly try-on limit reached',
          details: { resetsAt: period.reset.toISOString() },
        },
        429,
      );
    await tx.usageLedger.create({
      data: { userId, jobId, delta: -1, periodStart: period.start },
    });
  }
  async refund(tx: Prisma.TransactionClient, userId: string, jobId: string) {
    const debit = await tx.usageLedger.findFirst({
      where: { userId, jobId, delta: -1 },
    });
    if (!debit) return;
    await tx.usageLedger.createMany({
      data: [{ userId, jobId, delta: 1, periodStart: debit.periodStart }],
      skipDuplicates: true,
    });
  }
}
