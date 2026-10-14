import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { RedisService } from './redis.service';

export async function queueOptions(redis: RedisService) {
  try {
    await redis.onModuleInit();
  } catch (error) {
    redis.onModuleDestroy();
    throw error;
  }
  return { connection: redis.client };
}

@Module({ providers: [RedisService], exports: [RedisService] })
export class RedisModule {}

@Module({
  imports: [
    RedisModule,
    BullModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisService],
      useFactory: queueOptions,
    }),
  ],
  exports: [BullModule, RedisModule],
})
export class QueueModule {}
