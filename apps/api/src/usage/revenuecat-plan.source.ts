import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { z } from 'zod';
import { RuntimeConfig } from '../config/runtime-config';
import { PlanSource } from './plan.service';
const date = z.string().refine((v) => Number.isFinite(Date.parse(v)));
const subscriberResponse = z.object({
  subscriber: z.object({
    entitlements: z.record(
      z.string(),
      z.object({
        expires_date: date.nullable(),
        purchase_date: date,
        product_identifier: z.string(),
      }),
    ),
    subscriptions: z.record(
      z.string(),
      z.object({
        is_sandbox: z.boolean(),
        refunded_at: date.nullable().optional(),
        grace_period_expires_date: date.nullable().optional(),
      }),
    ),
  }),
});
export function revenueCatPlan(
  payload: unknown,
  plus: string,
  pro: string,
  allowSandbox: boolean,
  now = Date.now(),
) {
  const { subscriber } = subscriberResponse.parse(payload);
  for (const plan of ['pro', 'plus'] as const) {
    const entitlement = subscriber.entitlements[plan === 'pro' ? pro : plus];
    if (!entitlement || Date.parse(entitlement.purchase_date) > now) continue;
    const subscription =
      subscriber.subscriptions[entitlement.product_identifier];
    // shortcut: subscription products only; validate non-subscriptions separately before selling lifetime grants.
    if (
      !subscription ||
      subscription.refunded_at ||
      (subscription.is_sandbox && !allowSandbox)
    )
      continue;
    const end = Math.max(
      entitlement.expires_date === null
        ? 0
        : Date.parse(entitlement.expires_date),
      subscription.grace_period_expires_date
        ? Date.parse(subscription.grace_period_expires_date)
        : 0,
    );
    if (end > now) return { plan, validUntil: Math.min(now + 60000, end) };
  }
  return { plan: 'free' as const, validUntil: now + 60000 };
}
@Injectable()
export class RevenueCatPlanSource extends PlanSource {
  constructor(private readonly config: RuntimeConfig) {
    super();
  }
  private async call(clerkUserId: string, method: 'GET' | 'DELETE') {
    const key = this.config.values.REVENUECAT_API_KEY;
    if (!key) throw new ServiceUnavailableException();
    try {
      const response = await fetch(
        `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(clerkUserId)}`,
        {
          method,
          headers: { Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(5000),
          redirect: 'error',
        },
      );
      if (response.status === 404) return null;
      if (!response.ok) throw new Error('RevenueCat unavailable');
      return method === 'GET' ? ((await response.json()) as unknown) : null;
    } catch {
      throw new ServiceUnavailableException();
    }
  }
  async get(clerkUserId: string) {
    const response = await this.call(clerkUserId, 'GET');
    if (response === null)
      return { plan: 'free' as const, validUntil: Date.now() + 60000 };
    try {
      return revenueCatPlan(
        response,
        this.config.values.REVENUECAT_PLUS_ENTITLEMENT,
        this.config.values.REVENUECAT_PRO_ENTITLEMENT,
        this.config.values.REVENUECAT_ALLOW_SANDBOX === 'true',
      );
    } catch {
      throw new ServiceUnavailableException();
    }
  }
  async remove(clerkUserId: string) {
    await this.call(clerkUserId, 'DELETE');
  }
}
