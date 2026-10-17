import { RuntimeConfig } from './runtime-config';

describe('RuntimeConfig', () => {
  const original = process.env;
  beforeEach(() => {
    process.env = {
      DATABASE_URL: 'postgresql://user:secret@localhost/db',
      REDIS_URL: 'redis://localhost:6379',
      CLERK_SECRET_KEY: 'sk_test_fixture',
    };
  });
  afterEach(() => {
    process.env = original;
  });

  it('allows absent webhook secret but validates required dependencies', () => {
    expect(new RuntimeConfig().values.CLERK_WEBHOOK_SECRET).toBeUndefined();
    process.env.DATABASE_URL = 'private_invalid_value';
    expect(() => new RuntimeConfig()).toThrow('DATABASE_URL');
    try {
      new RuntimeConfig();
    } catch (error) {
      expect((error as Error).message).not.toContain('private_invalid_value');
    }
  });

  it('keeps integrations opt-in and rejects conflicting entitlements, production sandbox and unlicensed weather', () => {
    expect(new RuntimeConfig().values).toMatchObject({
      BILLING_PROVIDER: 'clerk',
      WEATHER_ENABLED: 'false',
      AFFILIATE_PRODUCTS_JSON: [],
    });
    process.env.BILLING_PROVIDER = 'revenuecat';
    expect(() => new RuntimeConfig()).toThrow('requires API key');
    process.env.REVENUECAT_API_KEY = 'fixture';
    process.env.REVENUECAT_WEBHOOK_SECRET = 'x'.repeat(32);
    expect(new RuntimeConfig().values.BILLING_PROVIDER).toBe('revenuecat');
    process.env.REVENUECAT_PLUS_ENTITLEMENT = 'pro';
    expect(() => new RuntimeConfig()).toThrow('must differ');
    delete process.env.REVENUECAT_PLUS_ENTITLEMENT;
    process.env.NODE_ENV = 'production';
    process.env.REVENUECAT_ALLOW_SANDBOX = 'true';
    expect(() => new RuntimeConfig()).toThrow('sandbox');
    process.env.REVENUECAT_ALLOW_SANDBOX = 'false';
    process.env.WEATHER_ENABLED = 'true';
    expect(() => new RuntimeConfig()).toThrow('Commercial weather');
  });

  it('reads the browser allowlist without changing LAN settings', () => {
    process.env.CLERK_AUTHORIZED_PARTIES =
      'https://app.example.com, http://localhost:8081';
    expect(new RuntimeConfig().authorizedParties).toEqual([
      'https://app.example.com',
      'http://localhost:8081',
    ]);
  });

  it('does not use CORS origins as native token authorized parties', () => {
    process.env.CORS_ORIGINS = 'http://localhost:8081';
    expect(new RuntimeConfig().authorizedParties).toEqual([]);
    process.env.CLERK_AUTHORIZED_PARTIES = '';
    expect(new RuntimeConfig().authorizedParties).toEqual([]);
  });

  it('permits fake try-on only outside production', () => {
    process.env.TRYON_PROVIDER = 'fake';
    expect(new RuntimeConfig().values.TRYON_PROVIDER).toBe('fake');
    process.env.NODE_ENV = 'production';
    expect(() => new RuntimeConfig()).toThrow('disabled in production');
    process.env.TRYON_PROVIDER = 'openai';
    expect(new RuntimeConfig().values.TRYON_PROVIDER).toBe('openai');
  });
  it('rejects a fake stylist in production', () => {
    process.env.STYLIST_PROVIDER = 'fake';
    expect(new RuntimeConfig().values.STYLIST_PROVIDER).toBe('fake');
    process.env.NODE_ENV = 'production';
    expect(() => new RuntimeConfig()).toThrow('disabled in production');
  });
  it('defaults to Phase6 quotas while permitting explicit internal overrides', () => {
    expect(new RuntimeConfig().values).toMatchObject({
      USAGE_FREE_LIMIT: 5,
      USAGE_PLUS_LIMIT: 20,
      USAGE_PRO_LIMIT: 60,
    });
    process.env.USAGE_PLUS_LIMIT = '50';
    expect(new RuntimeConfig().values.USAGE_PLUS_LIMIT).toBe(50);
  });
  it('rejects overlapping paid/free plan slugs instead of granting the wrong rights', () => {
    process.env.CLERK_PLUS_PLAN_SLUG = 'pro';
    expect(() => new RuntimeConfig()).toThrow('CLERK_PLUS_PLAN_SLUG');
    process.env.CLERK_PLUS_PLAN_SLUG = 'free';
    expect(() => new RuntimeConfig()).toThrow('CLERK_PLUS_PLAN_SLUG');
  });
});
