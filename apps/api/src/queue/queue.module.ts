import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { RedisService } from './redis.service';

@Module({ providers: [RedisService], exports: [RedisService] })
export class RedisModule {}

@Module({
  imports: [
    RedisModule,
    BullModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisService],
      useFactory: (redis: RedisService) => ({ connection: redis.client }),
    }),
  ],
  exports: [BullModule, RedisModule],
})
export class QueueModule {}
