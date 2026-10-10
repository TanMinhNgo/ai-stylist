import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { RuntimeConfig } from '../config/runtime-config';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(config: RuntimeConfig) {
    super({
      adapter: new PrismaPg({
        connectionString: config.values.DATABASE_URL,
        connectionTimeoutMillis: 5000,
        query_timeout: 10000,
        max: 5,
      }),
    });
  }

  async onModuleInit() {
    await this.$connect();
    await this.user.count();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
