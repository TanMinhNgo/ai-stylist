import { PrivacyService } from './privacy.service';
import { PrismaService } from '../database/prisma.service';
import { JobLimitsService } from '../usage/job-limits.service';
import { PlanService } from '../usage/plan.service';
import { ImageStorageProvider } from '../uploads/image-storage.provider';
import { ClerkAccountSource } from './account-source';
import { RuntimeConfig } from '../config/runtime-config';
import { RevenueCatPlanSource } from '../usage/revenuecat-plan.source';
import type { Queue } from 'bullmq';

it('purges every Phase7 table with owner scope before deleting referenced business data', async () => {
  const tables = [
    'stylistJob',
    'lookbookShare',
    'calendarEvent',
    'affiliateClick',
    'outfitCollection',
    'plannerDay',
    'wearRecord',
    'outfit',
    'tryOnJob',
    'garment',
    'assetJob',
    'modelPhoto',
    'uploadGrant',
    'styleProfile',
    'usageLedger',
    'aiCall',
    'workLease',
  ];
  const calls: string[] = [],
    tx = Object.fromEntries(
      tables.map((table) => [
        table,
        {
          deleteMany: jest.fn((args: unknown) => {
            expect(args).toEqual({ where: { userId: 'owner' } });
            calls.push(table);
            return Promise.resolve({ count: 0 });
          }),
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
      ]),
    );
  const accountDeletion = {
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  };
  const findMany = jest.fn().mockResolvedValue([]);
  const db = {
    accountDeletion,
    user: {
      findUnique: jest.fn().mockResolvedValue({
        deletedAt: new Date(),
        clerkUserId: 'user_owner',
      }),
    },
    uploadGrant: { findMany },
    workLease: { count: jest.fn().mockResolvedValue(0) },
    modelPhoto: { findMany },
    garment: { findMany },
    outfit: { findMany },
    tryOnJob: { findMany },
    assetJob: { findMany },
    $transaction: (fn: (value: unknown) => unknown) =>
      fn({ ...tx, accountDeletion }),
  };
  const service = new PrivacyService(
    db as unknown as PrismaService,
    { lock: jest.fn() } as unknown as JobLimitsService,
    { invalidate: jest.fn() } as unknown as PlanService,
    {
      listUserFiles: jest.fn().mockResolvedValue([]),
    } as unknown as ImageStorageProvider,
    { remove: jest.fn() },
    {} as Queue,
  );
  await service.purge('receipt', 'owner');
  expect(new Set(calls)).toEqual(new Set(tables));
  for (const table of ['lookbookShare', 'calendarEvent', 'affiliateClick'])
    expect(calls.indexOf(table)).toBeLessThan(calls.indexOf('outfit'));
  expect(accountDeletion.updateMany).toHaveBeenLastCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ status: 'completed' }) as unknown,
    }),
  );
});
it('retains the tombstone for recovery if configured RevenueCat account removal fails', async () => {
  const source = new ClerkAccountSource(
    { values: { REVENUECAT_API_KEY: 'fixture' } } as RuntimeConfig,
    {
      remove: jest.fn().mockRejectedValue(new Error('RevenueCat unavailable')),
    } as unknown as RevenueCatPlanSource,
  );
  await expect(source.remove('user_owner')).rejects.toThrow(
    'RevenueCat unavailable',
  );
});
