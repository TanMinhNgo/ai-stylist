import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import Redis from 'ioredis';
import { RuntimeConfig } from '../config/runtime-config';

export async function redisCommand<T>(command: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      command,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error('Redis command timeout')),
          5000,
        );
      }),
    ]);
  } catch {
    throw new ServiceUnavailableException();
  } finally {
    clearTimeout(timer);
  }
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  readonly client: Redis;
  private readonly logger = new Logger(RedisService.name);
  private accessDenied = false;

  constructor(config: RuntimeConfig) {
    this.client = new Redis(config.values.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
      connectTimeout: 5000,
      retryStrategy: (attempt) => Math.min(attempt * 200, 2000),
    });
    this.client.on('error', (error: unknown) => {
      if (error instanceof Error && /allowlist/i.test(error.message))
        this.accessDenied = true;
      this.logger.error(
        this.accessDenied
          ? 'Redis access denied: current public IP is not allowlisted'
          : 'Redis connection error',
      );
    });
  }

  async onModuleInit() {
    // BullMQ may start the shared connection before Nest invokes this hook.
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (this.client.status === 'wait') await this.client.connect();
      await Promise.race([
        this.client.ping(),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new Error('Redis readiness timeout')),
            5000,
          );
        }),
      ]);
      this.accessDenied = false;
    } catch (error) {
      if (this.accessDenied)
        throw new Error(
          'Redis access denied: current public IP is not allowlisted',
        );
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  onModuleDestroy() {
    this.client.disconnect();
  }
}
