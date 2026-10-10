import { Global, Injectable, Module } from '@nestjs/common';
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.url().refine((url) => /^postgres(ql)?:/.test(url)),
  REDIS_URL: z.url().refine((url) => /^rediss?:/.test(url)),
  CLERK_SECRET_KEY: z.string().startsWith('sk_'),
  CLERK_WEBHOOK_SECRET: z.string().startsWith('whsec_').optional(),
});

@Injectable()
export class RuntimeConfig {
  readonly values: z.infer<typeof schema>;
  readonly authorizedParties: string[];

  constructor() {
    const result = schema.safeParse({
      ...process.env,
      CLERK_WEBHOOK_SECRET: process.env.CLERK_WEBHOOK_SECRET || undefined,
    });
    if (!result.success) {
      throw new Error(
        `Invalid API configuration: ${result.error.issues.map((issue) => issue.path.join('.')).join(', ')}`,
      );
    }
    this.values = result.data;
    this.authorizedParties = (process.env.CLERK_AUTHORIZED_PARTIES ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }
}

@Global()
@Module({ providers: [RuntimeConfig], exports: [RuntimeConfig] })
export class RuntimeConfigModule {}
