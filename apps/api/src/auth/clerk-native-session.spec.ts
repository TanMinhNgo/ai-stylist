import { generateKeyPairSync, sign } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import { verifyToken } from '@clerk/backend';
import { RuntimeConfig } from '../config/runtime-config';
import { ClerkIdentityProvider } from './clerk-identity.provider';

// Only replace JWKS retrieval with a local public key; use the actual Clerk verifier.
jest.mock('@clerk/backend', () => {
  const actual =
    jest.requireActual<typeof import('@clerk/backend')>('@clerk/backend');
  return { ...actual, verifyToken: jest.fn(actual.verifyToken) };
});

describe('Native session verification with the actual Clerk SDK', () => {
  const originalEnv = process.env;
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  const jwtKey = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const actual =
    jest.requireActual<typeof import('@clerk/backend')>('@clerk/backend');

  function token(extra: Record<string, unknown> = {}) {
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(
      JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'fixture' }),
    ).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        sub: 'user_native',
        sid: 'sess_native',
        iss: 'https://fixture.clerk.accounts.dev',
        iat: now,
        nbf: now - 1,
        exp: now + 60,
        ...extra,
      }),
    ).toString('base64url');
    const input = `${header}.${payload}`;
    return `${input}.${sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url')}`;
  }

  beforeEach(() => {
    process.env = {
      DATABASE_URL: 'postgresql://user:fixture@localhost/db',
      REDIS_URL: 'redis://localhost:6379',
      CLERK_SECRET_KEY: 'sk_test_fixture',
      CORS_ORIGINS: 'http://localhost:8081',
    };
    jest
      .mocked(verifyToken)
      .mockImplementation((jwt, options) =>
        actual.verifyToken(jwt, { ...options, jwtKey }),
      );
  });
  afterEach(() => {
    process.env = originalEnv;
  });

  it('accepts a valid signed native session without azp even when CORS is configured', async () => {
    const config = new RuntimeConfig();
    expect(config.authorizedParties).toEqual([]);
    await expect(
      new ClerkIdentityProvider(config).verifyToken(token()),
    ).resolves.toBe('user_native');
  });

  it('still rejects expired native sessions', async () => {
    const provider = new ClerkIdentityProvider(new RuntimeConfig());
    await expect(
      provider.verifyToken(token({ exp: Math.floor(Date.now() / 1000) - 60 })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('still rejects a changed signature and pending sessions', async () => {
    const provider = new ClerkIdentityProvider(new RuntimeConfig());
    const valid = token();
    const [header, payload, signature] = valid.split('.');
    const altered = (signature[0] === 'A' ? 'B' : 'A') + signature.slice(1);
    await expect(
      provider.verifyToken(`${header}.${payload}.${altered}`),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      provider.verifyToken(token({ sts: 'pending' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('enforces explicitly configured authorized parties for web clients', async () => {
    process.env.CLERK_AUTHORIZED_PARTIES = 'https://app.example.com';
    const provider = new ClerkIdentityProvider(new RuntimeConfig());
    await expect(
      provider.verifyToken(token({ azp: 'https://app.example.com' })),
    ).resolves.toBe('user_native');
    await expect(
      provider.verifyToken(token({ azp: 'https://untrusted.example.com' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(provider.verifyToken(token())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
