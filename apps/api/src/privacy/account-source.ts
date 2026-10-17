import { Injectable } from '@nestjs/common';
import { createClerkClient } from '@clerk/backend';
import { isClerkAPIResponseError } from '@clerk/shared/error';
import { RuntimeConfig } from '../config/runtime-config';
import { RevenueCatPlanSource } from '../usage/revenuecat-plan.source';
export abstract class AccountSource {
  abstract remove(clerkUserId: string): Promise<void>;
}
@Injectable()
export class ClerkAccountSource extends AccountSource {
  constructor(
    private readonly config: RuntimeConfig,
    private readonly revenuecat: RevenueCatPlanSource,
  ) {
    super();
  }
  async remove(clerkUserId: string) {
    if (this.config.values.REVENUECAT_API_KEY)
      await this.revenuecat.remove(clerkUserId);
    try {
      await createClerkClient({
        secretKey: this.config.values.CLERK_SECRET_KEY,
      }).users.deleteUser(clerkUserId);
    } catch (error) {
      if (!isClerkAPIResponseError(error) || error.status !== 404)
        throw new Error('Account provider deletion failed');
    }
  }
}
