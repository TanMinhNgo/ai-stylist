import { RuntimeConfig } from '../config/runtime-config';
import { PrismaService } from '../database/prisma.service';
import { PlanService, subscriptionPlan } from './plan.service';
import { UsageService, month } from './usage.service';
import type { Prisma } from '../generated/prisma/client';
import { measuredUsage } from './ai-meter.service';
describe('UTC quota and billing boundaries', () => {
  const config = {
    values: { USAGE_FREE_LIMIT: 1, USAGE_PLUS_LIMIT: 50, USAGE_PRO_LIMIT: 200 },
  } as RuntimeConfig;
  const usage = new UsageService(
    {} as PrismaService,
    config,
    {} as PlanService,
  );
  it('rolls December into January UTC, not local midnight', () => {
    expect(month(new Date('2026-12-31T23:59:59Z'))).toEqual({
      start: new Date('2026-12-01T00:00:00Z'),
      reset: new Date('2027-01-01T00:00:00Z'),
    });
  });
  it('refuses a last-credit race loser without writing a debit', async () => {
    const ledger = {
      findUnique: jest.fn().mockResolvedValue(null),
      aggregate: jest.fn().mockResolvedValue({ _sum: { delta: -1 } }),
      create: jest.fn(),
    };
    await expect(
      usage.reserve(
        { usageLedger: ledger } as unknown as Prisma.TransactionClient,
        'u',
        'j',
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'QUOTA_EXCEEDED',
        details: { resetsAt: expect.any(String) as string },
      },
    });
    expect(ledger.create).not.toHaveBeenCalled();
  });
  it('refunds against the reservation month, even in a later month', async () => {
    const original = new Date('2026-09-01T00:00:00Z');
    const ledger = {
      findFirst: jest.fn().mockResolvedValue({ periodStart: original }),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    };
    await usage.refund(
      { usageLedger: ledger } as unknown as Prisma.TransactionClient,
      'u',
      'j',
    );
    expect(ledger.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'u', jobId: 'j', delta: 1, periodStart: original }],
      skipDuplicates: true,
    });
  });
  it('does not grant paid access to upcoming, past-due, ended or expired canceled items', () => {
    for (const status of [
      'upcoming',
      'past_due',
      'ended',
      'incomplete',
      'abandoned',
    ])
      expect(
        subscriptionPlan(
          [{ status, periodStart: 0, periodEnd: 200, plan: { slug: 'pro' } }],
          'plus',
          'pro',
          100,
        ).plan,
      ).toBe('free');
    expect(
      subscriptionPlan(
        [
          {
            status: 'canceled',
            periodStart: 0,
            periodEnd: 99,
            plan: { slug: 'pro' },
          },
        ],
        'plus',
        'pro',
        100,
      ).plan,
    ).toBe('free');
  });
  it('caps the cache at the canceled access expiry and prefers Pro', () => {
    expect(
      subscriptionPlan(
        [
          {
            status: 'active',
            periodStart: 0,
            periodEnd: 500,
            plan: { slug: 'plus' },
          },
          {
            status: 'canceled',
            periodStart: 0,
            periodEnd: 200,
            plan: { slug: 'pro' },
          },
        ],
        'plus',
        'pro',
        100,
      ),
    ).toEqual({ plan: 'pro', validUntil: 200 });
  });
  it('unknown price or missing usage stays null, not free', () => {
    expect(
      measuredUsage({ usage: { input_tokens: 10, output_tokens: 20 } })
        .estimatedUsd,
    ).toBeNull();
    expect(measuredUsage({}, { input: 1, output: 2 }).estimatedUsd).toBeNull();
    expect(
      measuredUsage(
        { usage: { input_tokens: 1000000, output_tokens: 1000000 } },
        { input: 1, output: 2 },
      ).estimatedUsd,
    ).toBe(3);
  });
});
