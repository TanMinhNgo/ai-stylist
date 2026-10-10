import {
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { verifyToken } from '@clerk/backend';
import { verifyWebhook } from '@clerk/backend/webhooks';
import { ClerkIdentityProvider } from './clerk-identity.provider';
import { RuntimeConfig } from '../config/runtime-config';

jest.mock('@clerk/backend', () => ({
  createClerkClient: jest.fn(() => ({ users: {} })),
  verifyToken: jest.fn(),
}));
jest.mock('@clerk/backend/webhooks', () => ({ verifyWebhook: jest.fn() }));

describe('ClerkIdentityProvider', () => {
  const config = {
    values: {
      CLERK_SECRET_KEY: 'sk_test_fixture',
      CLERK_WEBHOOK_SECRET: 'whsec_fixture',
    },
    authorizedParties: ['https://app.example.com'],
  } as RuntimeConfig;
  const provider = new ClerkIdentityProvider(config);
  beforeEach(() => jest.resetAllMocks());

  it('uses Clerk verification and authorized parties', async () => {
    jest
      .mocked(verifyToken)
      .mockResolvedValue({ sub: 'user_1', sid: 'sess_1' } as Awaited<
        ReturnType<typeof verifyToken>
      >);
    await expect(provider.verifyToken('valid')).resolves.toBe('user_1');
    expect(verifyToken).toHaveBeenCalledWith('valid', {
      secretKey: 'sk_test_fixture',
      authorizedParties: ['https://app.example.com'],
    });
  });

  it('rejects verification failures and non-session tokens', async () => {
    jest.mocked(verifyToken).mockRejectedValue(new Error('secret'));
    await expect(provider.verifyToken('bad')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    jest
      .mocked(verifyToken)
      .mockResolvedValue({ sub: 'user_1' } as Awaited<
        ReturnType<typeof verifyToken>
      >);
    await expect(provider.verifyToken('not-session')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('uses explicit webhook secret and rejects signature failures', async () => {
    jest.mocked(verifyWebhook).mockRejectedValue(new Error('bad signature'));
    await expect(
      provider.verifyWebhook(new Request('https://example.com')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(verifyWebhook).toHaveBeenCalledWith(expect.any(Request), {
      signingSecret: 'whsec_fixture',
    });
  });

  it('fails closed if webhook signing secret is absent', async () => {
    const absent = new ClerkIdentityProvider({
      values: { CLERK_SECRET_KEY: 'sk_test_fixture' },
      authorizedParties: [],
    } as unknown as RuntimeConfig);
    await expect(
      absent.verifyWebhook(new Request('https://example.com')),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(verifyWebhook).not.toHaveBeenCalled();
  });
});
