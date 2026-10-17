import { Injectable, HttpException } from '@nestjs/common';
import { RedisService, redisCommand } from '../queue/redis.service';
import { rateScript } from '../usage/rate-limit.guard';
@Injectable()
export class PublicShareGuard {
  constructor(private readonly redis: RedisService) {}
  async canActivate() {
    // One bounded counter avoids storing anonymous IPs or allocating keys for guessed tokens.
    const [count, ttl] = (await redisCommand(
      this.redis.client.eval(rateScript, 1, 'stylist:public-share-rate'),
    )) as [number, number];
    if (count > 600)
      throw new HttpException(
        {
          code: 'RATE_LIMITED',
          message: 'Please try again later',
          details: { retryAfterSeconds: Math.max(1, Math.ceil(ttl / 1000)) },
        },
        429,
      );
    return true;
  }
}
