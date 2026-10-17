import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  BillingSessionResponse,
  BillingSyncResponse,
  RevenueCatWebhook,
  WebhookAckResponse,
} from '@stylist/shared';
import type { User } from '../generated/prisma/client';
import { RuntimeConfig } from '../config/runtime-config';
import { PlanService } from './plan.service';
export function verifyRevenueCatSignature(
  raw: Buffer | undefined,
  header: string | undefined,
  secret: string | undefined,
  now = Date.now(),
) {
  if (!raw || !secret || !header) return false;
  const match = /^t=(\d{1,12}),v1=([a-fA-F0-9]{64})$/.exec(header);
  if (!match || Math.abs(now / 1000 - Number(match[1])) > 300) return false;
  const expected = createHmac('sha256', secret)
    .update(`${match[1]}.`)
    .update(raw)
    .digest();
  return timingSafeEqual(expected, Buffer.from(match[2], 'hex'));
}
@Injectable()
export class BillingService {
  constructor(
    private readonly config: RuntimeConfig,
    private readonly plans: PlanService,
  ) {}
  async session(user: User) {
    const c = this.config.values,
      enabled = c.BILLING_PROVIDER === 'revenuecat';
    return BillingSessionResponse.parse({
      provider: c.BILLING_PROVIDER ?? 'clerk',
      enabled,
      appUserId: enabled ? user.clerkUserId : null,
      entitlementIds: enabled
        ? {
            plus: c.REVENUECAT_PLUS_ENTITLEMENT,
            pro: c.REVENUECAT_PRO_ENTITLEMENT,
          }
        : null,
      plan: await this.plans.getUserPlan(user.id),
      purchaseAndRestore: enabled ? 'native_sdk' : 'unavailable',
      managementUrls: enabled
        ? {
            ios: 'https://apps.apple.com/account/subscriptions',
            android: 'https://play.google.com/store/account/subscriptions',
          }
        : null,
    });
  }
  async sync(user: User) {
    await this.plans.invalidate(user.clerkUserId);
    return BillingSyncResponse.parse({
      plan: await this.plans.getUserPlan(user.id),
    });
  }
  async webhook(
    raw: Buffer | undefined,
    signature: string | undefined,
    body: unknown,
  ) {
    if (
      !verifyRevenueCatSignature(
        raw,
        signature,
        this.config.values.REVENUECAT_WEBHOOK_SECRET,
      )
    )
      throw new UnauthorizedException();
    const parsed = RevenueCatWebhook.safeParse(body);
    if (!parsed.success) throw new BadRequestException();
    const { event } = parsed.data;
    // Events only evict cache; never assign rights from an old/duplicate event payload.
    const ids = new Set(
      [
        event.app_user_id,
        event.original_app_user_id,
        ...(event.aliases ?? []),
        ...(event.transferred_from ?? []),
        ...(event.transferred_to ?? []),
      ].filter((id): id is string => !!id && /^user_[A-Za-z0-9]+$/.test(id)),
    );
    for (const id of ids) await this.plans.invalidate(id);
    return WebhookAckResponse.parse({ received: true });
  }
}
