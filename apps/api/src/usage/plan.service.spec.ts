import { PlanService } from './plan.service';
import { RedisService } from '../queue/redis.service';
import { PrismaService } from '../database/prisma.service';
import { RuntimeConfig } from '../config/runtime-config';
it('a webhook revision prevents a late cache fill from restoring the old plan', async () => {
  const values = new Map<string, string>();
  const client = {
    get: jest.fn((key: string) => Promise.resolve(values.get(key) ?? null)),
    set: jest.fn((key: string, value: string) => {
      values.set(key, value);
      return Promise.resolve('OK');
    }),
    incr: jest.fn((key: string) => {
      const n = Number(values.get(key) ?? '0') + 1;
      values.set(key, String(n));
      return Promise.resolve(n);
    }),
  };
  let release!: (plan: { plan: 'pro'; validUntil: number }) => void;
  let started!: () => void;
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  const source = {
    get: jest
      .fn()
      .mockImplementationOnce(() => {
        started();
        return new Promise((resolve) => {
          release = resolve;
        });
      })
      .mockResolvedValue({ plan: 'free', validUntil: Date.now() + 60000 }),
  };
  const service = new PlanService(
    source,
    { client } as unknown as RedisService,
    {
      user: {
        findFirst: jest.fn().mockResolvedValue({ clerkUserId: 'user_fixture' }),
      },
    } as unknown as PrismaService,
    { values: { CLERK_BILLING_ENABLED: 'true' } } as RuntimeConfig,
  );
  const pending = service.getUserPlan('fixture');
  await entered;
  await service.invalidate('user_fixture');
  release({ plan: 'pro', validUntil: Date.now() + 60000 });
  await pending;
  expect(await service.getUserPlan('fixture')).toBe('free');
  expect(source.get).toHaveBeenCalledTimes(2);
});

it('disabling Billing cannot reuse cached Pro rights or call the subscription provider', async () => {
  const source = { get: jest.fn() };
  const client = {
    get: jest
      .fn()
      .mockResolvedValue(
        JSON.stringify({ plan: 'pro', validUntil: Date.now() + 60000 }),
      ),
  };
  const service = new PlanService(
    source,
    { client } as unknown as RedisService,
    {
      user: {
        findFirst: jest.fn().mockResolvedValue({ clerkUserId: 'user_fixture' }),
      },
    } as unknown as PrismaService,
    { values: { CLERK_BILLING_ENABLED: 'false' } } as RuntimeConfig,
  );
  await expect(service.getUserPlan('fixture')).resolves.toBe('free');
  expect(client.get).not.toHaveBeenCalled();
  expect(source.get).not.toHaveBeenCalled();
});
