import { Global, Injectable, Module } from '@nestjs/common';
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.url().refine((url) => /^postgres(ql)?:/.test(url)),
  REDIS_URL: z.url().refine((url) => /^rediss?:/.test(url)),
  CLERK_SECRET_KEY: z.string().startsWith('sk_'),
  CLERK_WEBHOOK_SECRET: z.string().startsWith('whsec_').optional(),
  IMAGEKIT_PUBLIC_KEY: z.string().optional(),
  IMAGEKIT_PRIVATE_KEY: z.string().optional(),
  IMAGEKIT_URL_ENDPOINT: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_VISION_MODEL: z.string().optional(),
  OPENAI_EMBEDDING_MODEL: z.string().optional(),
  OPENAI_IMAGE_MODEL: z.string().optional(),
  TRYON_PROVIDER: z.enum(['openai', 'fake']).default('openai'),
  STYLIST_PROVIDER: z.enum(['openai', 'fake']).default('openai'),
  ASSET_PROVIDER: z.enum(['openai', 'fake']).default('openai'),
  ASSET_GENERATION_ENABLED: z.enum(['true', 'false']).default('false'),
  ASSET_GENERATION_USER_IDS: z.string().default(''),
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
    if (
      process.env.NODE_ENV === 'production' &&
      (this.values.TRYON_PROVIDER === 'fake' ||
        this.values.STYLIST_PROVIDER === 'fake' ||
        this.values.ASSET_PROVIDER === 'fake')
    )
      throw new Error('Fake AI providers are disabled in production');
    this.authorizedParties = (process.env.CLERK_AUTHORIZED_PARTIES ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }
}

@Global()
@Module({ providers: [RuntimeConfig], exports: [RuntimeConfig] })
export class RuntimeConfigModule {}
