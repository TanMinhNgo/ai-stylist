import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createClerkClient, verifyToken } from '@clerk/backend';
import { verifyWebhook } from '@clerk/backend/webhooks';
import { IdentityProvider } from './identity.provider';
import { RuntimeConfig } from '../config/runtime-config';

@Injectable()
export class ClerkIdentityProvider extends IdentityProvider {
  private readonly client: ReturnType<typeof createClerkClient>;

  constructor(private readonly config: RuntimeConfig) {
    super();
    this.client = createClerkClient({
      secretKey: config.values.CLERK_SECRET_KEY,
    });
  }

  async verifyToken(token: string): Promise<string> {
    try {
      const claims = await verifyToken(token, {
        secretKey: this.config.values.CLERK_SECRET_KEY,
        authorizedParties: this.config.authorizedParties,
      });
      if (
        !claims.sub.startsWith('user_') ||
        typeof claims.sid !== 'string' ||
        claims.sts === 'pending'
      ) {
        throw new Error('Not a user session');
      }
      return claims.sub;
    } catch {
      throw new UnauthorizedException();
    }
  }

  async getUser(clerkUserId: string) {
    const user = await this.client.users.getUser(clerkUserId);
    return {
      clerkUserId: user.id,
      email:
        user.emailAddresses.find(
          (email) => email.id === user.primaryEmailAddressId,
        )?.emailAddress ?? null,
      updatedAt: user.updatedAt,
    };
  }

  async verifyWebhook(request: Request): Promise<unknown> {
    const signingSecret = this.config.values.CLERK_WEBHOOK_SECRET;
    if (!signingSecret)
      throw new ServiceUnavailableException('Webhook is not configured');
    try {
      return await verifyWebhook(request, { signingSecret });
    } catch {
      throw new UnauthorizedException();
    }
  }
}
