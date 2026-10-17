import { RevenueCatPlanSource, revenueCatPlan } from './revenuecat-plan.source';
import { verifyRevenueCatSignature } from './billing.service';
import { createHmac } from 'node:crypto';
import { RuntimeConfig } from '../config/runtime-config';
const now = Date.parse('2026-10-17T12:00:00Z');
const active = {
  expires_date: '2026-11-17T12:00:00Z',
  purchase_date: '2026-10-16T12:00:00Z',
  product_identifier: 'monthly',
};
const payload = (
  entitlements: object,
  subscription = { is_sandbox: false },
) => ({
  subscriber: { entitlements, subscriptions: { monthly: subscription } },
});
it('selects highest active server entitlement and clamps cache to expiry, independent of cancellation', () => {
  expect(
    revenueCatPlan(
      payload({ pro: active, plus: active }),
      'plus',
      'pro',
      false,
      now,
    ).plan,
  ).toBe('pro');
  expect(
    revenueCatPlan(
      payload({
        plus: { ...active, expires_date: new Date(now + 1000).toISOString() },
      }),
      'plus',
      'pro',
      false,
      now,
    ),
  ).toEqual({ plan: 'plus', validUntil: now + 1000 });
  expect(
    revenueCatPlan(
      payload({
        pro: { ...active, expires_date: new Date(now).toISOString() },
      }),
      'plus',
      'pro',
      false,
      now,
    ).plan,
  ).toBe('free');
});
it('never grants production rights for sandbox, refunded, future or unsupported lifetime entitlements', () => {
  expect(
    revenueCatPlan(
      payload({ pro: active }, { is_sandbox: true }),
      'plus',
      'pro',
      false,
      now,
    ).plan,
  ).toBe('free');
  expect(
    revenueCatPlan(
      payload({ pro: active }, { is_sandbox: true }),
      'plus',
      'pro',
      true,
      now,
    ).plan,
  ).toBe('pro');
  expect(
    revenueCatPlan(
      {
        subscriber: {
          entitlements: { pro: active },
          subscriptions: {
            monthly: { is_sandbox: false, refunded_at: active.purchase_date },
          },
        },
      },
      'plus',
      'pro',
      false,
      now,
    ).plan,
  ).toBe('free');
  expect(
    revenueCatPlan(
      payload({ pro: { ...active, purchase_date: active.expires_date } }),
      'plus',
      'pro',
      false,
      now,
    ).plan,
  ).toBe('free');
  expect(
    revenueCatPlan(
      payload({ pro: { ...active, expires_date: null } }),
      'plus',
      'pro',
      false,
      now,
    ).plan,
  ).toBe('free');
  expect(() =>
    revenueCatPlan({ subscriber: {} }, 'plus', 'pro', false, now),
  ).toThrow();
});
it('honors an explicit provider grace period, bounded by that period', () => {
  const end = now + 500;
  const data = {
    subscriber: {
      entitlements: {
        plus: { ...active, expires_date: '2026-10-01T00:00:00Z' },
      },
      subscriptions: {
        monthly: {
          is_sandbox: false,
          grace_period_expires_date: new Date(end).toISOString(),
        },
      },
    },
  };
  expect(revenueCatPlan(data, 'plus', 'pro', false, now)).toEqual({
    plan: 'plus',
    validUntil: end,
  });
});
it('verifies exact raw bytes and rejects stale, altered, malformed and missing signatures', () => {
  const raw = Buffer.from('{"event": "test"}'),
    secret = 'a'.repeat(32),
    t = Math.floor(now / 1000);
  const signature = createHmac('sha256', secret)
    .update(`${t}.`)
    .update(raw)
    .digest('hex');
  expect(
    verifyRevenueCatSignature(raw, `t=${t},v1=${signature}`, secret, now),
  ).toBe(true);
  expect(
    verifyRevenueCatSignature(
      Buffer.from('{}'),
      `t=${t},v1=${signature}`,
      secret,
      now,
    ),
  ).toBe(false);
  expect(
    verifyRevenueCatSignature(
      raw,
      `t=${t},v1=${signature}`,
      secret,
      now + 301000,
    ),
  ).toBe(false);
  expect(verifyRevenueCatSignature(raw, `t=${t},v1=xx`, secret, now)).toBe(
    false,
  );
  expect(verifyRevenueCatSignature(undefined, undefined, secret, now)).toBe(
    false,
  );
});
describe('RevenueCat network boundary', () => {
  const source = new RevenueCatPlanSource({
    values: {
      REVENUECAT_API_KEY: 'fixture',
      REVENUECAT_PLUS_ENTITLEMENT: 'plus',
      REVENUECAT_PRO_ENTITLEMENT: 'pro',
    },
  } as RuntimeConfig);
  afterEach(() => jest.restoreAllMocks());
  it('treats missing subscribers as free and provider/schema failures as unavailable', async () => {
    const fetcher = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('', { status: 404 }));
    expect((await source.get('user_a/b')).plan).toBe('free');
    expect(fetcher.mock.calls[0][0]).toBe(
      'https://api.revenuecat.com/v1/subscribers/user_a%2Fb',
    );
    fetcher.mockResolvedValueOnce(new Response('{}', { status: 200 }));
    await expect(source.get('user_a')).rejects.toMatchObject({ status: 503 });
    fetcher.mockRejectedValueOnce(new Error('private provider details'));
    await expect(source.get('user_a')).rejects.toMatchObject({ status: 503 });
  });
  it('deletes provider data idempotently, while not treating it as canceling store subscriptions', async () => {
    const fetcher = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('', { status: 404 }));
    await source.remove('user_a');
    expect(fetcher).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
