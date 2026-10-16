import { PLAN_FEATURES, type Plan } from '@stylist/shared';
import { UsageService } from './usage.service';
import { RuntimeConfig } from '../config/runtime-config';
import { PrismaService } from '../database/prisma.service';
import { PlanService } from './plan.service';
import type { Prisma } from '../generated/prisma/client';

describe('subscription entitlements and plan transitions', () => {
  let plan: Plan, used: number;
  const ledger = {
    aggregate: jest.fn(() => Promise.resolve({ _sum: { delta: -used } })),
    findUnique: jest.fn(() => Promise.resolve(null)),
    create: jest.fn(() => {
      used++;
      return Promise.resolve();
    }),
  };
  const plans = { getUserPlan: jest.fn(() => Promise.resolve(plan)) };
  const config = {
    values: { USAGE_FREE_LIMIT: 5, USAGE_PLUS_LIMIT: 20, USAGE_PRO_LIMIT: 60 },
  } as RuntimeConfig;
  const service = new UsageService(
    { usageLedger: ledger } as unknown as PrismaService,
    config,
    plans as unknown as PlanService,
  );
  beforeEach(() => {
    jest.clearAllMocks();
    plan = 'free';
    used = 4;
  });

  it.each<Plan>(['free', 'plus', 'pro'])(
    'returns %s benefits without unlocking unimplemented features',
    async (value) => {
      plan = value;
      const access = await service.getEntitlements('verified-user');
      expect(access.includedFeatures).toEqual(PLAN_FEATURES[plan]);
      expect(access.availableFeatures.includes('advanced_outfit_advice')).toBe(
        plan !== 'free',
      );
      expect(
        access.availableFeatures.includes('accessory_recommendations'),
      ).toBe(plan !== 'free');
      expect(access.availableFeatures.includes('weekly_outfit_planner')).toBe(
        plan === 'pro',
      );
      expect(access.availableFeatures.includes('wardrobe_insights')).toBe(
        plan === 'pro',
      );
      expect(access.availableFeatures.includes('occasion_collections')).toBe(
        plan !== 'free',
      );
      expect(access.availableFeatures.includes('priority_queue')).toBe(
        plan === 'pro',
      );
      expect(access.tryOn).toMatchObject({
        limit: { free: 5, plus: 20, pro: 60 }[plan],
        period: 'calendar_month_utc',
      });
      expect(plans.getUserPlan).toHaveBeenCalledWith('verified-user');
    },
  );

  it('requires plan membership for paid features', async () => {
    await expect(
      service.requireFeature('u', 'digital_wardrobe'),
    ).resolves.toBeUndefined();
    await expect(
      service.requireFeature('u', 'priority_queue'),
    ).rejects.toMatchObject({
      status: 403,
      response: {
        code: 'FORBIDDEN',
        details: { feature: 'priority_queue', reason: 'not_included' },
      },
    });
    plan = 'pro';
    await expect(
      service.requireFeature('u', 'priority_queue'),
    ).resolves.toBeUndefined();
    await expect(
      service.requireFeature('u', 'weekly_outfit_planner'),
    ).resolves.toBeUndefined();
  });

  it('preserves usage across plan changes and blocks new debits above a downgraded cap', async () => {
    used = 8;
    const tx = { usageLedger: ledger } as unknown as Prisma.TransactionClient;
    for (const [value, limit, remaining] of [
      ['plus', 20, 12],
      ['pro', 60, 52],
      ['free', 5, 0],
    ] as const) {
      plan = value;
      expect(await service.get('u')).toMatchObject({
        plan,
        used: 8,
        limit,
        remaining,
      });
    }
    await expect(
      service.reserve(tx, 'u', 'new-job', plan),
    ).rejects.toMatchObject({ response: { code: 'QUOTA_EXCEEDED' } });
    expect(ledger.create).not.toHaveBeenCalled();
    plan = 'plus';
    await service.reserve(tx, 'u', 'new-job', plan);
    expect(await service.get('u')).toMatchObject({ used: 9, remaining: 11 });
  });

  it('reports a custom quota without claiming the catalog quota is active', async () => {
    config.values.USAGE_PLUS_LIMIT = 50;
    plan = 'plus';
    try {
      const access = await service.getEntitlements('u');
      expect(access.tryOn.limit).toBe(50);
      expect(access.includedFeatures).toContain('monthly_try_on_20');
      expect(access.availableFeatures).not.toContain('monthly_try_on_20');
    } finally {
      config.values.USAGE_PLUS_LIMIT = 20;
    }
  });
});
