import { Injectable, HttpException, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { RuntimeConfig } from '../config/runtime-config';
@Injectable()
export class JobLimitsService {
  constructor(private readonly config: RuntimeConfig) {}
  async lock(tx: Prisma.TransactionClient, userId: string, alive = true) {
    const found = await tx.$queryRaw<
      { id: string; deleted_at: Date | null }[]
    >`SELECT id,deleted_at FROM users WHERE id=${userId}::uuid FOR UPDATE`;
    if (!found.length || (alive && found[0].deleted_at))
      throw new NotFoundException();
  }
  async check(tx: Prisma.TransactionClient, userId: string, adding = 1) {
    const selection = {
      select: { id: true },
      take: this.config.values.AI_MAX_ACTIVE_JOBS + 1,
    };
    const [tryon, stylist, assets, photos, garments, leases] =
      await Promise.all([
        tx.tryOnJob.findMany({
          ...selection,
          where: {
            userId,
            status: { in: ['queued', 'processing'] },
            deadlineAt: { gt: new Date() },
          },
        }),
        tx.stylistJob.findMany({
          ...selection,
          where: {
            userId,
            status: { in: ['queued', 'processing'] },
            deadlineAt: { gt: new Date() },
          },
        }),
        tx.assetJob.findMany({
          ...selection,
          where: {
            userId,
            deletedAt: null,
            status: { in: ['queued', 'processing'] },
            deadlineAt: { gt: new Date() },
          },
        }),
        tx.modelPhoto.findMany({
          ...selection,
          where: {
            userId,
            status: 'pending',
            createdAt: { gt: new Date(Date.now() - 15 * 60000) },
          },
        }),
        tx.garment.findMany({
          ...selection,
          where: {
            userId,
            status: 'pending',
            deletingAt: null,
            createdAt: { gt: new Date(Date.now() - 15 * 60000) },
          },
        }),
        tx.workLease.findMany({
          where: { userId, expiresAt: { gt: new Date() } },
          select: { jobId: true },
          distinct: ['jobId'],
          take: selection.take,
        }),
      ]);
    // A timed-out job can still be draining a provider call; count its lease without double-counting live jobs.
    const ids = new Set(
      [...tryon, ...stylist, ...assets, ...photos, ...garments].map(
        (row) => row.id,
      ),
    );
    for (const lease of leases) ids.add(lease.jobId);
    if (ids.size + adding > this.config.values.AI_MAX_ACTIVE_JOBS)
      throw new HttpException(
        {
          code: 'RATE_LIMITED',
          message: 'Too many active jobs',
          details: { retryAfterSeconds: 30 },
        },
        429,
      );
  }
}
