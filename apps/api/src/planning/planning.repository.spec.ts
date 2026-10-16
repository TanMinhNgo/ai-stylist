import { createHash, randomUUID } from 'node:crypto';
import { PlanningRepository } from './planning.repository';
import { PrismaService } from '../database/prisma.service';
import { JobLimitsService } from '../usage/job-limits.service';
describe('planner cap and durable wear confirmation', () => {
  const userId = randomUUID(),
    id = randomUUID();
  const plannerDay = {
    findUnique: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
  };
  const wearRecord = { findFirst: jest.fn(), create: jest.fn() };
  const tx = { plannerDay, wearRecord };
  const lock = jest.fn();
  const db = {
    $transaction: (fn: (value: typeof tx) => unknown) =>
      Promise.resolve(fn(tx)),
  };
  const repo = new PlanningRepository(
    db as unknown as PrismaService,
    { lock } as unknown as JobLimitsService,
  );
  beforeEach(() => {
    jest.resetAllMocks();
    lock.mockResolvedValue(undefined);
  });
  it('blocks a new planner slot at cap but allows editing an existing one', async () => {
    const date = new Date().toISOString().slice(0, 10),
      body = { timeZone: 'UTC', occasion: 'Work', outfitId: null };
    plannerDay.findUnique.mockResolvedValue(null);
    plannerDay.count.mockResolvedValue(730);
    await expect(repo.putDay(userId, date, body)).rejects.toMatchObject({
      status: 429,
      response: { details: { resource: 'planner', limit: 730 } },
    });
    expect(plannerDay.upsert).not.toHaveBeenCalled();
    plannerDay.findUnique.mockResolvedValue({ id });
    await expect(repo.putDay(userId, date, body)).resolves.toMatchObject({
      date,
      isPlanned: true,
    });
    expect(plannerDay.upsert).toHaveBeenCalledTimes(1);
  });
  it('returns a stored wear receipt after outfit deletion without revalidating or counting again', async () => {
    const body = {
      timeZone: 'UTC',
      date: '2026-10-17',
      outfitId: randomUUID(),
    };
    wearRecord.findFirst.mockResolvedValue({
      id,
      userId,
      date: new Date(body.date),
      timeZone: 'UTC',
      outfitId: null,
      garmentIds: [randomUUID()],
      createdAt: new Date(),
      requestHash: createHash('sha256')
        .update(JSON.stringify([body.date, body.timeZone, body.outfitId]))
        .digest('hex'),
    });
    await expect(repo.wear(userId, id, body)).resolves.toMatchObject({
      id,
      outfitId: null,
      garmentCount: 1,
    });
    expect(wearRecord.findFirst).toHaveBeenCalledWith({
      where: { id, userId },
    });
    expect(wearRecord.create).not.toHaveBeenCalled();
    await expect(
      repo.wear(userId, id, { ...body, date: '2026-10-16' }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('does not write after a user tombstone invalidates the lock', async () => {
    lock.mockRejectedValue(new Error('tombstone'));
    await expect(
      repo.putDay(userId, new Date().toISOString().slice(0, 10), {
        timeZone: 'UTC',
        occasion: 'Work',
        outfitId: null,
      }),
    ).rejects.toThrow('tombstone');
    expect(plannerDay.upsert).not.toHaveBeenCalled();
  });
});
