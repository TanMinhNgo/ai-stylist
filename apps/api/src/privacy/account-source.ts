import { Injectable } from '@nestjs/common';
import { createClerkClient } from '@clerk/backend';
import { isClerkAPIResponseError } from '@clerk/shared/error';
import { RuntimeConfig } from '../config/runtime-config';
export abstract class AccountSource {
  abstract remove(clerkUserId: string): Promise<void>;
}
@Injectable()
export class ClerkAccountSource extends AccountSource {
  constructor(private readonly config: RuntimeConfig) {
    super();
  }
  async remove(clerkUserId: string) {
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
