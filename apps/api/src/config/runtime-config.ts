import { Global, Injectable, Module } from '@nestjs/common';
import { z } from 'zod';
import { AffiliateCatalog, PLAN_TRY_ON_LIMITS } from '@stylist/shared';

const schema = z.object({
  BILLING_PROVIDER: z.enum(['clerk', 'revenuecat']).default('clerk'),
  REVENUECAT_API_KEY: z.string().min(1).optional(),
  REVENUECAT_WEBHOOK_SECRET: z.string().min(32).optional(),
  REVENUECAT_PLUS_ENTITLEMENT: z.string().min(1).default('plus'),
  REVENUECAT_PRO_ENTITLEMENT: z.string().min(1).default('pro'),
  REVENUECAT_ALLOW_SANDBOX: z.enum(['true', 'false']).default('false'),
  WEATHER_ENABLED: z.enum(['true', 'false']).default('false'),
  OPEN_METEO_API_KEY: z.string().min(1).optional(),
  AFFILIATE_PRODUCTS_JSON: z
    .string()
    .default('[]')
    .transform((value, ctx) => {
      try {
        return AffiliateCatalog.parse(JSON.parse(value));
      } catch {
        ctx.addIssue({
          code: 'custom',
          message: 'Invalid curated affiliate catalog',
        });
        return z.NEVER;
      }
    }),
  CLERK_BILLING_ENABLED: z.enum(['true', 'false']).default('false'),
  CLERK_PLUS_PLAN_SLUG: z.string().min(1).default('plus'),
  CLERK_PRO_PLAN_SLUG: z.string().min(1).default('pro'),
  USAGE_FREE_LIMIT: z.coerce
    .number()
    .int()
    .min(0)
    .max(10000)
    .default(PLAN_TRY_ON_LIMITS.free),
  USAGE_PLUS_LIMIT: z.coerce
    .number()
    .int()
    .min(0)
    .max(10000)
    .default(PLAN_TRY_ON_LIMITS.plus),
  USAGE_PRO_LIMIT: z.coerce
    .number()
    .int()
    .min(0)
    .max(10000)
    .default(PLAN_TRY_ON_LIMITS.pro),
  AI_RATE_LIMIT_PER_MINUTE: z.coerce
    .number()
    .int()
    .min(1)
    .max(1000)
    .default(10),
  AI_MAX_ACTIVE_JOBS: z.coerce.number().int().min(1).max(100).default(4),
  AI_COST_RATES_JSON: z
    .string()
    .default('{}')
    .transform((value, ctx) => {
      try {
        return z
          .record(
            z.string(),
            z.strictObject({
              input: z.number().finite().nonnegative(),
              output: z.number().finite().nonnegative(),
            }),
          )
          .parse(JSON.parse(value));
      } catch {
        ctx.addIssue({
          code: 'custom',
          message: 'Expected model rates per million tokens',
        });
        return z.NEVER;
      }
    }),
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
    if (
      result.data.CLERK_PLUS_PLAN_SLUG === result.data.CLERK_PRO_PLAN_SLUG ||
      [
        result.data.CLERK_PLUS_PLAN_SLUG,
        result.data.CLERK_PRO_PLAN_SLUG,
      ].includes('free')
    )
      throw new Error(
        'Invalid API configuration: CLERK_PLUS_PLAN_SLUG, CLERK_PRO_PLAN_SLUG',
      );
    this.values = result.data;
    if (
      this.values.REVENUECAT_PLUS_ENTITLEMENT ===
      this.values.REVENUECAT_PRO_ENTITLEMENT
    )
      throw new Error('RevenueCat entitlement IDs must differ');
    if (
      this.values.BILLING_PROVIDER === 'revenuecat' &&
      (!this.values.REVENUECAT_API_KEY ||
        !this.values.REVENUECAT_WEBHOOK_SECRET)
    )
      throw new Error('RevenueCat requires API key and webhook signing secret');
    if (
      process.env.NODE_ENV === 'production' &&
      this.values.REVENUECAT_ALLOW_SANDBOX === 'true'
    )
      throw new Error(
        'RevenueCat sandbox entitlements are disabled in production',
      );
    if (
      process.env.NODE_ENV === 'production' &&
      this.values.WEATHER_ENABLED === 'true' &&
      !this.values.OPEN_METEO_API_KEY
    )
      throw new Error('Commercial weather requires OPEN_METEO_API_KEY');
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
