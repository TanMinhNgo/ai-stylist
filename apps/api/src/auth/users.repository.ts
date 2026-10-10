import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import type { IdentityUser } from './identity.provider';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  find(clerkUserId: string) {
    return this.prisma.user.findUnique({ where: { clerkUserId } });
  }

  async sync(user: IdentityUser, deleted = false) {
    // Atomic version check prevents stale events and fallback requests resurrecting deleted users.
    await this.prisma.$executeRaw`
      INSERT INTO users (id, clerk_user_id, email, clerk_updated_at, deleted_at)
      VALUES (${randomUUID()}::uuid, ${user.clerkUserId}, ${deleted ? null : user.email},
              ${BigInt(user.updatedAt)}, ${deleted ? new Date(user.updatedAt) : null})
      ON CONFLICT (clerk_user_id) DO UPDATE SET
        email = EXCLUDED.email,
        clerk_updated_at = EXCLUDED.clerk_updated_at,
        deleted_at = EXCLUDED.deleted_at
      WHERE users.deleted_at IS NULL
        AND (EXCLUDED.deleted_at IS NOT NULL OR EXCLUDED.clerk_updated_at > users.clerk_updated_at)
    `;
    return this.find(user.clerkUserId);
  }
}
