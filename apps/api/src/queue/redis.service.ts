import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import Redis from 'ioredis';
import { RuntimeConfig } from '../config/runtime-config';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  readonly client: Redis;
  private readonly logger = new Logger(RedisService.name);

  constructor(config: RuntimeConfig) {
    this.client = new Redis(config.values.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
      connectTimeout: 5000,
      retryStrategy: (attempt) => Math.min(attempt * 200, 2000),
    });
    this.client.on('error', () => this.logger.error('Redis connection error'));
  }

  async onModuleInit() {
    await this.client.connect();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        this.client.ping(),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new Error('Redis readiness timeout')),
            5000,
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  onModuleDestroy() {
    this.client.disconnect();
  }
}
