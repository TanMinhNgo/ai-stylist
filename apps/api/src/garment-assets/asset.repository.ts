import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  HttpException,
} from '@nestjs/common';
import { randomUUID, createHash } from 'node:crypto';
import { z } from 'zod';
import {
  AssetInput,
  IdeaRequest,
  GarmentTags,
  isTryOnAllowed,
  type IdeaProposal,
} from '@stylist/shared';
import { PrismaService } from '../database/prisma.service';
import type { Prisma, AssetJob } from '../generated/prisma/client';
import { MediaRepository } from '../media/media.repository';
import { assetDay } from './asset-time';
import type { RenderMeta } from './asset-image';

export const JobInput = z.union([
  AssetInput,
  z.strictObject({ source: z.literal('plan'), request: IdeaRequest }),
]);
export type JobInput = z.infer<typeof JobInput>;
const active = {
  status: { in: ['queued', 'processing'] },
  deletedAt: null,
  user: { deletedAt: null },
};
@Injectable()
export class AssetRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaRepository,
  ) {}
  find(userId: string, id: string) {
    return this.prisma.assetJob.findFirst({
      where: { id, userId, deletedAt: null, user: { deletedAt: null } },
      include: { garment: true },
    });
  }
  async usage(userId: string, db: Prisma.TransactionClient = this.prisma) {
    const { day, resetAt } = assetDay();
    const where = { userId, quotaDay: day, refundedAt: null };
    const [images, plans] = await Promise.all([
      db.assetJob.count({
        where: { ...where, kind: { in: ['photo', 'idea'] } },
      }),
      db.assetJob.count({
        where: {
          userId,
          quotaDay: day,
          kind: 'plan',
          OR: [{ refundedAt: null }, { generationStartedAt: { not: null } }],
        },
      }),
    ]);
    return {
      limit: 5 as const,
      remaining: Math.max(0, 5 - images),
      ideaPlansRemaining: Math.max(0, 10 - plans),
      resetAt: resetAt.toISOString(),
    };
  }
  create(
    userId: string,
    key: string,
    inputs: JobInput[],
    provider: 'openai' | 'fake',
    model: string,
  ) {
    const hash = createHash('sha256')
      .update(JSON.stringify(inputs))
      .digest('hex');
    return this.prisma.$transaction(async (tx) => {
      const users = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM users WHERE id = ${userId}::uuid AND deleted_at IS NULL FOR UPDATE`;
      if (!users.length) throw new NotFoundException();
      const old = await tx.assetJob.findMany({
        where: { userId, batchKey: key },
        orderBy: { itemIndex: 'asc' },
      });
      if (old.length) {
        if (old.some((j) => j.requestHash !== hash))
          throw new ConflictException({
            code: 'IDEMPOTENCY_CONFLICT',
            message: 'Key already used for another request',
          });
        if (old.some((j) => j.deletedAt)) throw new NotFoundException();
        return old;
      }
      for (const input of inputs)
        if (input.source === 'photo') {
          const garment = await tx.garment.findFirst({
            where: {
              id: input.garmentId,
              userId,
              deletingAt: null,
              user: { deletedAt: null },
            },
          });
          if (!garment) throw new NotFoundException();
          const tags = GarmentTags.safeParse(garment.tags);
          if (garment.status !== 'ready' || !tags.success)
            throw new BadRequestException({
              code: 'TRYON_INPUT_NOT_READY',
              message: 'Garment must finish analysis first',
            });
          if (
            !isTryOnAllowed(tags.data.type) ||
            (garment.requestedType && garment.requestedType !== tags.data.type)
          )
            throw new BadRequestException({
              code: 'ASSET_INPUT_INVALID',
              message: 'Select a clearly visible supported garment',
            });
        }
      const quota = await this.usage(userId, tx);
      const imageCount = inputs.filter((i) => i.source !== 'plan').length;
      if (
        imageCount > quota.remaining ||
        inputs.filter((i) => i.source === 'plan').length >
          quota.ideaPlansRemaining
      )
        throw new HttpException(
          {
            code: 'ASSET_QUOTA_EXCEEDED',
            message: 'Daily generation limit reached',
          },
          429,
        );
      const jobs: AssetJob[] = [];
      for (const [itemIndex, input] of inputs.entries())
        jobs.push(
          await tx.assetJob.create({
            data: {
              id: randomUUID(),
              userId,
              batchKey: key,
              itemIndex,
              requestHash: hash,
              kind: input.source,
              input,
              bodyKey:
                input.source === 'plan' ? input.request.bodyKey : input.bodyKey,
              garmentId: input.source === 'photo' ? input.garmentId : null,
              provider,
              imageModel: model,
              quotaDay: assetDay().day,
              deadlineAt: new Date(Date.now() + 15 * 60000),
            },
          }),
        );
      return jobs;
    });
  }
  async begin(userId: string, id: string) {
    return (
      (
        await this.prisma.assetJob.updateMany({
          where: {
            id,
            userId,
            ...active,
            generationStartedAt: null,
            deadlineAt: { gt: new Date() },
          },
          data: { status: 'processing', generationStartedAt: new Date() },
        })
      ).count === 1
    );
  }
  async retry(userId: string, id: string) {
    await this.prisma.assetJob.updateMany({
      where: { id, userId, ...active, resultFileId: null },
      data: { generationStartedAt: null },
    });
  }
  async checkpoint(
    userId: string,
    id: string,
    file: { fileId: string; filePath: string },
    meta: RenderMeta,
  ) {
    return (
      (
        await this.prisma.assetJob.updateMany({
          where: {
            id,
            userId,
            ...active,
            deadlineAt: { gt: new Date() },
            OR: [{ kind: 'idea' }, { garment: { deletingAt: null, userId } }],
          },
          data: {
            resultFileId: file.fileId,
            resultFilePath: file.filePath,
            renderMeta: { ...meta },
          },
        })
      ).count === 1
    );
  }
  async readyPlan(userId: string, id: string, items: IdeaProposal[]) {
    await this.prisma.assetJob.updateMany({
      where: { id, userId, ...active, deadlineAt: { gt: new Date() } },
      data: { status: 'ready', proposals: { items }, errorCode: null },
    });
  }
  complete(
    userId: string,
    id: string,
    tags: GarmentTags,
    embedding: number[] | null,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.assetJob.findFirst({
        where: { id, userId, ...active },
      });
      if (!row?.resultFileId || !row.resultFilePath) return;
      const changed = await tx.assetJob.updateMany({
        where: { id, userId, ...active, deadlineAt: { gt: new Date() } },
        data: { status: 'ready', errorCode: null },
      });
      if (!changed.count) return;
      let garmentId = row.garmentId;
      if (row.kind === 'idea') {
        if (!embedding) throw new Error('Missing embedding');
        const garment = await tx.garment.create({
          data: {
            userId,
            imagekitFileId: row.resultFileId,
            filePath: row.resultFilePath,
            source: 'ai_concept',
            assetBodyKey: row.bodyKey,
            currentAssetId: id,
          },
        });
        garmentId = garment.id;
        await this.media.readyGarment(userId, garment.id, tags, embedding, tx);
      } else {
        const updated = await tx.garment.updateMany({
          where: {
            id: garmentId!,
            userId,
            deletingAt: null,
            user: { deletedAt: null },
          },
          data: { currentAssetId: id, assetErrorCode: null },
        });
        if (!updated.count) throw new NotFoundException();
      }
      await tx.assetJob.updateMany({
        where: { id, userId },
        data: { garmentId },
      });
    });
  }
  async fail(userId: string, id: string, code: string, refundable = false) {
    await this.prisma.assetJob.updateMany({
      where: { id, userId, ...active },
      data: {
        status: 'failed',
        errorCode: code,
        ...(refundable ? { refundedAt: new Date() } : {}),
      },
    });
  }
  async cancelQueued(userId: string, ids: string[]) {
    await this.prisma.assetJob.updateMany({
      where: {
        userId,
        id: { in: ids },
        status: 'queued',
        generationStartedAt: null,
        deletedAt: null,
      },
      data: {
        status: 'failed',
        errorCode: 'ASSET_PROVIDER_ERROR',
        refundedAt: new Date(),
      },
    });
  }
  expired() {
    return this.prisma.assetJob.findMany({
      where: {
        status: { in: ['queued', 'processing'] },
        deletedAt: null,
        deadlineAt: { lte: new Date() },
      },
      select: { id: true, userId: true, generationStartedAt: true, kind: true },
      take: 100,
    });
  }
  async automatic(userId: string, id: string) {
    return this.prisma.garment.findFirst({
      where: {
        id,
        userId,
        status: 'ready',
        generateAsset: true,
        deletingAt: null,
        user: { deletedAt: null },
      },
    });
  }
  async deferred(userId: string, id: string, code: string) {
    await this.prisma.garment.updateMany({
      where: { id, userId, deletingAt: null },
      data: { assetErrorCode: code },
    });
  }
}
