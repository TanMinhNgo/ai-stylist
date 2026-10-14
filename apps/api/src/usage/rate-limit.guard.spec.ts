import type { ExecutionContext } from '@nestjs/common';
import { RateLimitGuard } from './rate-limit.guard';
import { RedisService } from '../queue/redis.service';
import { RuntimeConfig } from '../config/runtime-config';
it('throttles by verified user ID with a retry delay, and fails closed if Redis fails', async () => {
  const evalMock = jest.fn().mockResolvedValue([3, 1500]);
  const guard = new RateLimitGuard(
    { client: { eval: evalMock } } as unknown as RedisService,
    { values: { AI_RATE_LIMIT_PER_MINUTE: 2 } } as RuntimeConfig,
  );
  const ctx = {
    switchToHttp: () => ({ getRequest: () => ({ user: { id: 'verified' } }) }),
  } as ExecutionContext;
  await expect(guard.canActivate(ctx)).rejects.toMatchObject({
    response: { code: 'RATE_LIMITED', details: { retryAfterSeconds: 2 } },
  });
  expect(evalMock).toHaveBeenCalledWith(
    expect.any(String),
    1,
    'stylist:rate:verified',
  );
  evalMock.mockRejectedValue(new Error('private Redis URL'));
  await expect(guard.canActivate(ctx)).rejects.toMatchObject({ status: 503 });
});
