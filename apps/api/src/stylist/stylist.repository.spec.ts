import { createHash, randomUUID } from 'node:crypto';
import { StylistRepository } from './stylist.repository';
import { PrismaService } from '../database/prisma.service';
import { JobLimitsService } from '../usage/job-limits.service';
import { PlanService } from '../usage/plan.service';
import type { Plan } from '@stylist/shared';

describe('stylist admission and worker policy', () => {
  const userId = randomUUID(),
    id = randomUUID();
  let plan: Plan;
  const jobs = {
    count: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
  };
  const tx = {
    $queryRaw: jest.fn(),
    stylistJob: jobs,
    outfit: { updateMany: jest.fn() },
  };
  const db = {
    $transaction: (fn: (value: typeof tx) => unknown) =>
      Promise.resolve(fn(tx)),
    stylistJob: jobs,
  };
  const plans = { getUserPlan: jest.fn(() => Promise.resolve(plan)) };
  const repo = new StylistRepository(
    db as unknown as PrismaService,
    { check: jest.fn() } as unknown as JobLimitsService,
    plans as unknown as PlanService,
  );
  const input = { kind: 'suggest' as const, request: { occasion: 'casual' } };
  beforeEach(() => {
    jest.clearAllMocks();
    plan = 'free';
    tx.$queryRaw.mockResolvedValue([{ id: userId }]);
    jobs.findUnique.mockResolvedValue(null);
    jobs.count.mockResolvedValue(0);
    jobs.create.mockImplementation((arg: { data: unknown }) =>
      Promise.resolve(arg.data),
    );
    jobs.updateMany.mockResolvedValue({ count: 1 });
    jobs.findFirst.mockResolvedValue({
      id,
      createdAt: new Date('2026-10-31T23:59:59Z'),
      input: { ...input, adviceLevel: 'advanced' },
    });
  });
  it.each<Plan>(['free', 'plus', 'pro'])(
    'assigns %s policy on the server and enforces its combined monthly cap',
    async (value) => {
      plan = value;
      const row = await repo.create(userId, 'key', input, 'fake', 'fake');
      expect(row.input).toMatchObject({
        adviceLevel: plan === 'free' ? 'basic' : 'advanced',
      });
      jobs.count.mockResolvedValue({ free: 10, plus: 60, pro: 180 }[plan]);
      await expect(
        repo.create(userId, 'other', input, 'fake', 'fake'),
      ).rejects.toMatchObject({
        status: 429,
        response: { code: 'QUOTA_EXCEEDED', details: { resource: 'stylist' } },
      });
      expect(jobs.create).toHaveBeenCalledTimes(1);
    },
  );
  it('returns an existing receipt even at quota or during a plan outage without reserving again', async () => {
    const old = {
      id,
      status: 'ready',
      requestHash: createHash('sha256')
        .update(JSON.stringify(input))
        .digest('hex'),
    };
    jobs.findUnique.mockResolvedValue(old);
    jobs.count.mockResolvedValue(999);
    expect(await repo.create(userId, 'key', input, 'fake', 'fake')).toBe(old);
    expect(plans.getUserPlan).not.toHaveBeenCalled();
    expect(jobs.create).not.toHaveBeenCalled();
    await expect(
      repo.create(
        userId,
        'key',
        { ...input, request: { occasion: 'work' } },
        'fake',
        'fake',
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('clamps a queued advanced job after downgrade and accounts in its original UTC month', async () => {
    expect(await repo.begin(userId, id)).toBe('basic');
    expect(jobs.count).toHaveBeenCalledWith({
      where: {
        userId,
        createdAt: {
          gte: new Date('2026-10-01T00:00:00Z'),
          lt: new Date('2026-11-01T00:00:00Z'),
        },
        startedAt: { not: null },
      },
    });
    expect(jobs.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          input: { ...input, adviceLevel: 'basic' },
          startedAt: expect.any(Date) as Date,
        }) as unknown,
      }),
    );
  });
  it('does not upgrade a basic or legacy queued job when a user buys a paid plan', async () => {
    plan = 'pro';
    jobs.findFirst.mockResolvedValue({ id, createdAt: new Date(), input });
    expect(await repo.begin(userId, id)).toBe('basic');
  });
  it('stops a downgraded job before its irreversible started marker at cap', async () => {
    jobs.count.mockResolvedValue(10);
    await expect(repo.begin(userId, id)).rejects.toMatchObject({ status: 429 });
    expect(jobs.updateMany).not.toHaveBeenCalled();
  });
  it('counts reservations and uncertain started failures, but releases failures before start', async () => {
    const usage = await repo.usage(userId);
    expect(usage).toMatchObject({
      plan: 'free',
      adviceLevel: 'basic',
      limit: 10,
      remaining: 10,
    });
    expect(jobs.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        userId,
        OR: [
          { status: { in: ['queued', 'processing', 'ready'] } },
          { startedAt: { not: null } },
        ],
      }) as unknown,
    });
  });
});
