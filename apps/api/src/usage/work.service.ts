import { Injectable, Logger } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { JobLimitsService } from './job-limits.service';
export const workContext = new AsyncLocalStorage<{
  userId: string;
  jobId: string;
}>();
@Injectable()
export class WorkService {
  private readonly logger = new Logger(WorkService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly limits: JobLimitsService,
  ) {}
  async run<T>(userId: string, jobId: string, operation: () => Promise<T>) {
    const id = randomUUID();
    const acquired = await this.prisma.$transaction(async (tx) => {
      await this.limits.lock(tx, userId, false);
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (user?.deletedAt) return false;
      await tx.workLease.create({
        data: {
          id,
          userId,
          jobId,
          expiresAt: new Date(Date.now() + 20 * 60000),
        },
      });
      return true;
    });
    if (!acquired) return;
    // Covers the whole worker, including uploads after the AI call; crashed leases expire.
    const timer = setInterval(() => {
      void this.prisma.workLease
        .updateMany({
          where: { id },
          data: { expiresAt: new Date(Date.now() + 20 * 60000) },
        })
        .catch(() => this.logger.error('Worker lease renewal failed'));
    }, 60000);
    timer.unref();
    try {
      return await workContext.run({ userId, jobId }, operation);
    } finally {
      clearInterval(timer);
      await this.prisma.workLease
        .deleteMany({ where: { id } })
        .catch(() => this.logger.error('Worker lease release needs recovery'));
    }
  }
}
