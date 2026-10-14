import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { RedisService, redisCommand } from '../queue/redis.service';
import { RuntimeConfig } from '../config/runtime-config';
import type { UserRequest } from '../auth/auth.decorators';
export const rateScript = `local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('PEXPIRE',KEYS[1],60000) end; return {n,redis.call('PTTL',KEYS[1])}`;
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly redis: RedisService,
    private readonly config: RuntimeConfig,
  ) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<UserRequest>();
    let result: unknown;
    try {
      result = await redisCommand(
        this.redis.client.eval(rateScript, 1, `stylist:rate:${req.user.id}`),
      );
    } catch {
      throw new ServiceUnavailableException();
    }
    const [count, ttl] = result as [number, number];
    if (count > this.config.values.AI_RATE_LIMIT_PER_MINUTE)
      throw new HttpException(
        {
          code: 'RATE_LIMITED',
          message: 'Please wait before submitting again',
          details: { retryAfterSeconds: Math.max(1, Math.ceil(ttl / 1000)) },
        },
        429,
      );
    return true;
  }
}
