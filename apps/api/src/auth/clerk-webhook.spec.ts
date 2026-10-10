import { createHmac, randomBytes } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import { ClerkIdentityProvider } from './clerk-identity.provider';
import { RuntimeConfig } from '../config/runtime-config';

describe('Clerk signature verification (real SDK, no network)', () => {
  const bytes = randomBytes(32);
  const provider = new ClerkIdentityProvider({
    values: {
      CLERK_SECRET_KEY: 'sk_test_fixture',
      CLERK_WEBHOOK_SECRET: `whsec_${bytes.toString('base64')}`,
    },
    authorizedParties: [],
  } as unknown as RuntimeConfig);
  const body = JSON.stringify({
    type: 'user.deleted',
    timestamp: Date.now(),
    data: { id: 'user_fixture', deleted: true },
  });

  function signed(
    payload = body,
    timestamp = String(Math.floor(Date.now() / 1000)),
    signatureBody = body,
  ) {
    const id = 'event_fixture';
    const signature = createHmac('sha256', bytes)
      .update(`${id}.${timestamp}.${signatureBody}`)
      .digest('base64');
    return new Request('https://example.com/webhooks/clerk', {
      method: 'POST',
      body: payload,
      headers: {
        'svix-id': id,
        'svix-timestamp': timestamp,
        'svix-signature': `v1,${signature}`,
      },
    });
  }

  it('accepts a correctly signed payload', async () => {
    await expect(provider.verifyWebhook(signed())).resolves.toMatchObject(
      JSON.parse(body),
    );
  });

  it('rejects tampered bodies and expired signatures', async () => {
    await expect(
      provider.verifyWebhook(signed(body + ' ')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      provider.verifyWebhook(signed(body, '1')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
