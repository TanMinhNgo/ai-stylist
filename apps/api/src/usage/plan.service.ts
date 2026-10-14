import {
  Injectable,
  ServiceUnavailableException,
  NotFoundException,
} from '@nestjs/common';
import { createClerkClient } from '@clerk/backend';
import { Plan } from '@stylist/shared';
import { z } from 'zod';
import { RuntimeConfig } from '../config/runtime-config';
import { PrismaService } from '../database/prisma.service';
import { RedisService, redisCommand } from '../queue/redis.service';
export abstract class PlanSource {
  abstract get(
    clerkUserId: string,
  ): Promise<{ plan: Plan; validUntil: number }>;
}
export function subscriptionPlan(
  items: {
    status: string;
    periodStart: number;
    periodEnd: number | null;
    plan: { slug: string } | null;
  }[],
  plus: string,
  pro: string,
  now = Date.now(),
): { plan: Plan; validUntil: number } {
  // Canceled items retain access through their current period, not indefinitely.
  const eligible = items.filter(
    (i) =>
      ['active', 'canceled'].includes(i.status) &&
      i.periodStart <= now &&
      (i.periodEnd === null ? i.status === 'active' : i.periodEnd > now),
  );
  const paid =
    eligible.find((i) => i.plan?.slug === pro) ??
    eligible.find((i) => i.plan?.slug === plus);
  return {
    plan: paid?.plan?.slug === pro ? 'pro' : paid ? 'plus' : 'free',
    validUntil: Math.min(now + 60000, paid?.periodEnd ?? Infinity),
  };
}
@Injectable()
export class ClerkPlanSource extends PlanSource {
  constructor(private readonly config: RuntimeConfig) {
    super();
  }
  async get(clerkUserId: string) {
    if (this.config.values.CLERK_BILLING_ENABLED !== 'true')
      return { plan: 'free' as const, validUntil: Date.now() + 60000 };
    try {
      const sub = await createClerkClient({
        secretKey: this.config.values.CLERK_SECRET_KEY,
      }).billing.getUserBillingSubscription(clerkUserId);
      return subscriptionPlan(
        sub.subscriptionItems,
        this.config.values.CLERK_PLUS_PLAN_SLUG,
        this.config.values.CLERK_PRO_PLAN_SLUG,
      );
    } catch {
      throw new ServiceUnavailableException();
    }
  }
}
const cached = z.strictObject({ plan: Plan, validUntil: z.number().finite() });
@Injectable()
export class PlanService {
  constructor(
    private readonly source: PlanSource,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}
  private version(clerkId: string) {
    return `stylist:plan-version:${clerkId}`;
  }
  async invalidate(clerkId: string) {
    await redisCommand(this.redis.client.incr(this.version(clerkId)));
  }
  async getUserPlan(userId: string): Promise<Plan> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) throw new NotFoundException();
    const revision =
      (await redisCommand(
        this.redis.client.get(this.version(user.clerkUserId)),
      )) ?? '0';
    const key = `stylist:plan:${userId}:${revision}`;
    const value = await redisCommand(this.redis.client.get(key));
    let found: z.infer<typeof cached> | undefined;
    try {
      found = cached.parse(JSON.parse(value ?? 'null'));
    } catch {
      /* Malformed cache is a miss. */
    }
    if (found && found.validUntil > Date.now()) return found.plan;
    const plan = cached.parse(await this.source.get(user.clerkUserId));
    await redisCommand(
      this.redis.client.set(
        key,
        JSON.stringify(plan),
        'PX',
        Math.max(1, Math.min(60000, plan.validUntil - Date.now())),
      ),
    );
    return plan.plan;
  }
}
