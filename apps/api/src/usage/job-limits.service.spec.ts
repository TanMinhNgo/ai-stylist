import type { Prisma } from '../generated/prisma/client';
import { RuntimeConfig } from '../config/runtime-config';
import { JobLimitsService } from './job-limits.service';
it('counts draining worker leases, but does not count a running job twice', async () => {
  const limits = new JobLimitsService({
    values: { AI_MAX_ACTIVE_JOBS: 2 },
  } as RuntimeConfig);
  const db = {
    tryOnJob: { findMany: jest.fn().mockResolvedValue([{ id: 'active' }]) },
    stylistJob: { findMany: jest.fn().mockResolvedValue([]) },
    assetJob: { findMany: jest.fn().mockResolvedValue([]) },
    modelPhoto: { findMany: jest.fn().mockResolvedValue([]) },
    garment: { findMany: jest.fn().mockResolvedValue([]) },
    workLease: { findMany: jest.fn().mockResolvedValue([{ jobId: 'active' }]) },
  };
  await expect(
    limits.check(db as unknown as Prisma.TransactionClient, 'u'),
  ).resolves.toBeUndefined();
  db.workLease.findMany.mockResolvedValue([
    { jobId: 'active' },
    { jobId: 'timed-out-but-draining' },
  ]);
  await expect(
    limits.check(db as unknown as Prisma.TransactionClient, 'u'),
  ).rejects.toMatchObject({ response: { code: 'RATE_LIMITED' } });
});
