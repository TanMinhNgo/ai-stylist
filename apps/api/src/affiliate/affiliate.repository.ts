import {
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AffiliateClickResponse } from '@stylist/shared';
import { PrismaService } from '../database/prisma.service';
import { JobLimitsService } from '../usage/job-limits.service';
@Injectable()
export class AffiliateRepository {
  constructor(
    private readonly db: PrismaService,
    private readonly locks: JobLimitsService,
  ) {}
  record(userId: string, id: string, productId: string, available: boolean) {
    return this.db.$transaction(async (tx) => {
      await this.locks.lock(tx, userId);
      const key = { userId, id };
      const old = await tx.affiliateClick.findUnique({
        where: { userId_id: key },
      });
      if (old) {
        if (old.productId !== productId)
          throw new ConflictException({
            code: 'IDEMPOTENCY_CONFLICT',
            message: 'Click ID already used',
          });
        return AffiliateClickResponse.parse({ recorded: true });
      }
      if (!available) throw new NotFoundException();
      const now = new Date(),
        start = new Date(now.toISOString().slice(0, 10));
      await tx.affiliateClick.deleteMany({
        where: {
          userId,
          createdAt: { lt: new Date(now.getTime() - 30 * 86400000) },
        },
      });
      if (
        (await tx.affiliateClick.count({
          where: { userId, createdAt: { gte: start } },
        })) >= 100
      )
        throw new HttpException(
          {
            code: 'QUOTA_EXCEEDED',
            message: 'Click tracking limit reached',
            details: { resource: 'affiliate_clicks', limit: 100 },
          },
          429,
        );
      await tx.affiliateClick.create({ data: { ...key, productId } });
      return AffiliateClickResponse.parse({ recorded: true });
    });
  }
}
