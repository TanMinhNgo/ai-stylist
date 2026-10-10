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
});
