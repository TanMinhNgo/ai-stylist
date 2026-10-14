import { queueOptions } from './queue.module';
import { RedisService } from './redis.service';
it('does not create queue connections until Redis readiness succeeds', async () => {
  let ready!: () => void;
  const redis = {
    client: {},
    onModuleInit: () =>
      new Promise<void>((resolve) => {
        ready = resolve;
      }),
    onModuleDestroy: jest.fn(),
  };
  let returned = false;
  const pending = queueOptions(redis as unknown as RedisService).then(
    (value) => {
      returned = true;
      return value;
    },
  );
  await Promise.resolve();
  expect(returned).toBe(false);
  ready();
  expect(await pending).toEqual({ connection: redis.client });
  expect(redis.onModuleDestroy).not.toHaveBeenCalled();
});
it('disconnects failed startup rather than leaving reconnecting workers alive', async () => {
  const redis = {
    client: {},
    onModuleInit: jest.fn().mockRejectedValue(new Error('Redis access denied')),
    onModuleDestroy: jest.fn(),
  };
  await expect(queueOptions(redis as unknown as RedisService)).rejects.toThrow(
    'Redis access denied',
  );
  expect(redis.onModuleDestroy).toHaveBeenCalledTimes(1);
});
