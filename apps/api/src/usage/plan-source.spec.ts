import { createClerkClient } from '@clerk/backend';
import { ClerkPlanSource } from './plan.service';
import { RuntimeConfig } from '../config/runtime-config';

jest.mock('@clerk/backend', () => ({ createClerkClient: jest.fn() }));
const subscription = jest.fn();
const config = {
  values: {
    CLERK_BILLING_ENABLED: 'true',
    CLERK_PLUS_PLAN_SLUG: 'plus',
    CLERK_PRO_PLAN_SLUG: 'pro',
  },
} as RuntimeConfig;
const source = new ClerkPlanSource(config);
beforeEach(() => {
  jest.clearAllMocks();
  config.values.CLERK_BILLING_ENABLED = 'true';
  jest.mocked(createClerkClient).mockReturnValue({
    billing: { getUserBillingSubscription: subscription },
  } as unknown as ReturnType<typeof createClerkClient>);
});

it('keeps Billing disabled as Free without calling Clerk', async () => {
  config.values.CLERK_BILLING_ENABLED = 'false';
  await expect(source.get('user_fixture')).resolves.toMatchObject({
    plan: 'free',
  });
  expect(createClerkClient).not.toHaveBeenCalled();
});

it('gets paid rights from the server subscription and supports cancellation only until expiry', async () => {
  subscription.mockResolvedValue({
    subscriptionItems: [
      {
        status: 'canceled',
        periodStart: Date.now() - 60000,
        periodEnd: Date.now() + 30000,
        plan: { slug: 'pro' },
      },
    ],
  });
  await expect(source.get('user_verified')).resolves.toMatchObject({
    plan: 'pro',
  });
  expect(subscription).toHaveBeenCalledWith('user_verified');
  subscription.mockResolvedValue({
    subscriptionItems: [
      {
        status: 'canceled',
        periodStart: 0,
        periodEnd: Date.now() - 1,
        plan: { slug: 'pro' },
      },
    ],
  });
  await expect(source.get('user_verified')).resolves.toMatchObject({
    plan: 'free',
  });
});

it('never infers paid access from feature names on an unrecognized plan', async () => {
  subscription.mockResolvedValue({
    subscriptionItems: [
      {
        status: 'active',
        periodStart: 0,
        periodEnd: null,
        plan: { slug: 'unrecognized', features: [{ slug: 'priority_queue' }] },
      },
    ],
  });
  await expect(source.get('user_verified')).resolves.toMatchObject({
    plan: 'free',
  });
});

it('fails closed and hides provider details when Billing fails', async () => {
  subscription.mockRejectedValue(new Error('private provider detail'));
  await expect(source.get('user_verified')).rejects.toMatchObject({
    status: 503,
    message: 'Service Unavailable',
  });
});
