import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import {
  ClerkUserWebhook,
  MeResponse,
  WebhookAckResponse,
} from '@stylist/shared';
import { IdentityProvider } from './identity.provider';
import { UsersRepository } from './users.repository';
import type { User } from '../generated/prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly identity: IdentityProvider,
    private readonly users: UsersRepository,
  ) {}

  async currentUser(token: string): Promise<User> {
    const id = await this.identity.verifyToken(token);
    let user = await this.users.find(id);
    if (!user) {
      const profile = await this.identity.getUser(id);
      if (profile.clerkUserId !== id) throw new UnauthorizedException();
      user = await this.users.sync(profile);
    }
    if (!user || user.deletedAt) throw new UnauthorizedException();
    return user;
  }

  me(user: User): MeResponse {
    return MeResponse.parse({
      id: user.id,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
    });
  }

  async webhook(request: Request): Promise<WebhookAckResponse> {
    const event = await this.identity.verifyWebhook(request);
    const type =
      typeof event === 'object' && event !== null && 'type' in event
        ? event.type
        : undefined;
    if (
      !['user.created', 'user.updated', 'user.deleted'].includes(String(type))
    ) {
      return WebhookAckResponse.parse({ received: true });
    }
    const parsed = ClerkUserWebhook.safeParse(event);
    if (!parsed.success) throw new BadRequestException();
    const payload = parsed.data;
    if (payload.type === 'user.deleted') {
      await this.users.sync(
        {
          clerkUserId: payload.data.id,
          email: null,
          updatedAt: payload.timestamp,
        },
        true,
      );
    } else {
      const data = payload.data;
      await this.users.sync({
        clerkUserId: data.id,
        email:
          data.email_addresses.find(
            (email) => email.id === data.primary_email_address_id,
          )?.email_address ?? null,
        updatedAt: data.updated_at,
      });
    }
    return WebhookAckResponse.parse({ received: true });
  }
}
