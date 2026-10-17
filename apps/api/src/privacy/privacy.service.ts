import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AccountDeletionResponse } from '@stylist/shared';
import { PrismaService } from '../database/prisma.service';
import { JobLimitsService } from '../usage/job-limits.service';
import { PlanService } from '../usage/plan.service';
import { ImageStorageProvider } from '../uploads/image-storage.provider';
import { AccountSource } from './account-source';
@Injectable()
export class PrivacyService {
  private readonly logger = new Logger(PrivacyService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly limits: JobLimitsService,
    private readonly plans: PlanService,
    private readonly storage: ImageStorageProvider,
    private readonly accounts: AccountSource,
    @InjectQueue('privacy') private readonly queue: Queue,
  ) {}
  async request(userId: string) {
    const row = await this.prisma.$transaction(async (tx) => {
      await this.limits.lock(tx, userId, false);
      await tx.user.update({
        where: { id: userId },
        data: { deletedAt: new Date(), email: null },
      });
      const old = await tx.accountDeletion.findUnique({ where: { userId } });
      if (old) return old;
      await tx.tryOnJob.updateMany({
        where: { userId, status: { in: ['queued', 'processing'] } },
        data: { status: 'failed', errorCode: 'UNAUTHORIZED' },
      });
      await tx.stylistJob.updateMany({
        where: { userId, status: { in: ['queued', 'processing'] } },
        data: { status: 'failed', errorCode: 'UNAUTHORIZED' },
      });
      await tx.assetJob.updateMany({
        where: { userId },
        data: {
          deletedAt: new Date(),
          status: 'failed',
          errorCode: 'UNAUTHORIZED',
        },
      });
      return tx.accountDeletion.create({ data: { userId } });
    });
    await this.enqueue(row.id, userId).catch(() =>
      this.logger.error('Account deletion queued for recovery'),
    );
    return AccountDeletionResponse.parse({
      deletionId: row.id,
      status: row.status,
    });
  }
  async status(userId: string) {
    const row = await this.prisma.accountDeletion.findUnique({
      where: { userId },
    });
    if (!row) throw new NotFoundException();
    return AccountDeletionResponse.parse({
      deletionId: row.id,
      status: row.status,
    });
  }
  enqueue(id: string, userId: string) {
    // DB receipt/sweep survives Redis failure; completed queue receipts cannot block recovery.
    return this.queue.add(
      'purge',
      { id, userId },
      {
        jobId: `privacy-${id}-${Math.floor(Date.now() / 60000)}`,
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: 50,
      },
    );
  }
  async due() {
    return this.prisma.accountDeletion.findMany({
      where: { status: { not: 'completed' }, retryAt: { lte: new Date() } },
      take: 100,
    });
  }
  async purge(id: string, userId: string) {
    const claimed = await this.prisma.accountDeletion.updateMany({
      where: {
        id,
        userId,
        status: { not: 'completed' },
        retryAt: { lte: new Date() },
      },
      data: { status: 'processing', retryAt: new Date(Date.now() + 5 * 60000) },
    });
    if (!claimed.count) return;
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user?.deletedAt) throw new Error('Deletion was not authorized');
      await this.accounts.remove(user.clerkUserId);
      await this.plans.invalidate(user.clerkUserId);
      const grants = await this.prisma.uploadGrant.findMany({
        where: { userId },
        select: { expiresAt: true },
      });
      const leases = await this.prisma.workLease.count({
        where: { userId, expiresAt: { gt: new Date() } },
      });
      // Previously issued upload signatures remain usable until expiry, even after sign-out.
      if (
        leases ||
        grants.some((g) => g.expiresAt.getTime() + 120000 > Date.now())
      ) {
        await this.defer(id, userId, 'queued');
        return;
      }
      const [photos, garments, jobs, outfits, assets, uploads] =
        await Promise.all([
          this.prisma.modelPhoto.findMany({
            where: { userId },
            select: { imagekitFileId: true },
          }),
          this.prisma.garment.findMany({
            where: { userId },
            select: { imagekitFileId: true },
          }),
          this.prisma.tryOnJob.findMany({
            where: { userId },
            select: { resultFileId: true },
          }),
          this.prisma.outfit.findMany({
            where: { userId },
            select: { imagekitFileId: true },
          }),
          this.prisma.assetJob.findMany({
            where: { userId },
            select: { resultFileId: true },
          }),
          this.prisma.uploadGrant.findMany({
            where: { userId },
            select: { imagekitFileId: true },
          }),
        ]);
      const files = new Set(
        [...photos, ...garments, ...outfits, ...uploads]
          .map((x) => x.imagekitFileId)
          .concat([...jobs, ...assets].map((x) => x.resultFileId))
          .filter((x): x is string => !!x),
      );
      for (const file of files) await this.storage.delete(file);
      // Includes orphaned upload/results with ambiguous receipts; scope is the user's folder only.
      const orphaned = await this.storage.listUserFiles(userId);
      for (const file of orphaned) await this.storage.delete(file);
      if ((await this.storage.listUserFiles(userId)).length) {
        await this.defer(id, userId, 'queued');
        return;
      }
      await this.prisma.$transaction(async (tx) => {
        await this.limits.lock(tx, userId, false);
        await tx.stylistJob.deleteMany({ where: { userId } });
        await tx.lookbookShare.deleteMany({ where: { userId } });
        await tx.calendarEvent.deleteMany({ where: { userId } });
        await tx.affiliateClick.deleteMany({ where: { userId } });
        await tx.outfitCollection.deleteMany({ where: { userId } });
        await tx.plannerDay.deleteMany({ where: { userId } });
        await tx.wearRecord.deleteMany({ where: { userId } });
        await tx.outfit.deleteMany({ where: { userId } });
        await tx.tryOnJob.deleteMany({ where: { userId } });
        await tx.garment.updateMany({
          where: { userId },
          data: { currentAssetId: null },
        });
        await tx.assetJob.deleteMany({ where: { userId } });
        await tx.garment.deleteMany({ where: { userId } });
        await tx.modelPhoto.deleteMany({ where: { userId } });
        await tx.uploadGrant.deleteMany({ where: { userId } });
        await tx.styleProfile.deleteMany({ where: { userId } });
        await tx.usageLedger.deleteMany({ where: { userId } });
        await tx.aiCall.deleteMany({ where: { userId } });
        await tx.workLease.deleteMany({ where: { userId } });
        await tx.accountDeletion.updateMany({
          where: { id, userId },
          data: { status: 'completed', completedAt: new Date() },
        });
      });
    } catch {
      await this.defer(id, userId, 'failed');
      this.logger.error('Account deletion needs retry');
    }
  }
  private defer(id: string, userId: string, status: string) {
    return this.prisma.accountDeletion.updateMany({
      where: { id, userId },
      data: { status, retryAt: new Date(Date.now() + 60000) },
    });
  }
}
