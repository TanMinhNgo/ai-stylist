import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import {
  CreateTryOnRequest,
  GarmentTags,
  ModelPhotoAnalysis,
  isTryOnAllowed,
} from '@stylist/shared';
import { PrismaService } from '../database/prisma.service';
import type { Prisma } from '../generated/prisma/client';
import { UsageService } from '../usage/usage.service';

const active = {
  status: { in: ['queued', 'processing'] },
  user: { deletedAt: null },
};
@Injectable()
export class TryOnRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usage: UsageService,
  ) {}
  find(userId: string, id: string) {
    return this.prisma.tryOnJob.findFirst({
      where: { id, userId, user: { deletedAt: null } },
      include: { outfit: true },
    });
  }
  private async inputsFrom(
    db: Prisma.TransactionClient,
    userId: string,
    input: CreateTryOnRequest,
  ) {
    const photo = await db.modelPhoto.findFirst({
      where: { id: input.modelPhotoId, userId, user: { deletedAt: null } },
    });
    const garments = await db.garment.findMany({
      where: {
        id: { in: input.garmentIds },
        userId,
        user: { deletedAt: null },
      },
    });
    if (!photo || garments.length !== input.garmentIds.length)
      throw new NotFoundException();
    const analysis = ModelPhotoAnalysis.safeParse(photo.analysis);
    if (
      photo.status !== 'ready' ||
      !analysis.success ||
      !analysis.data.allowed ||
      !analysis.data.fullBody ||
      analysis.data.personCount !== 1 ||
      !analysis.data.lightingAdequate ||
      garments.some(
        (g) => g.status !== 'ready' || !GarmentTags.safeParse(g.tags).success,
      )
    )
      throw new BadRequestException({
        code: 'TRYON_INPUT_NOT_READY',
        message: 'Images must finish analysis before try-on',
      });
    if (garments.some((g) => !isTryOnAllowed(GarmentTags.parse(g.tags).type)))
      throw new BadRequestException({
        code: 'TRYON_GARMENT_NOT_ALLOWED',
        message: 'This clothing type cannot be used for try-on',
      });
    return {
      photo,
      garments: input.garmentIds.map((id) =>
        garments.find((g) => g.id === id)!,
      ),
    };
  }
  inputs(userId: string, input: CreateTryOnRequest) {
    return this.inputsFrom(this.prisma, userId, input);
  }
  create(
    userId: string,
    key: string,
    input: CreateTryOnRequest,
    provider: 'openai' | 'fake',
    imageModel: string,
  ) {
    const requestHash = createHash('sha256')
      .update(JSON.stringify(input))
      .digest('hex');
    return this.prisma.$transaction(async (tx) => {
      // Serialize submissions per user so concurrent keys reserve exactly once.
      const users = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM users WHERE id = ${userId}::uuid AND deleted_at IS NULL FOR UPDATE`;
      if (!users.length) throw new NotFoundException();
      const previous = await tx.tryOnJob.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey: key } },
      });
      if (previous) {
        if (previous.requestHash !== requestHash)
          throw new ConflictException({
            code: 'IDEMPOTENCY_CONFLICT',
            message: 'Key already used for another request',
          });
        return previous;
      }
      await this.inputsFrom(tx, userId, input);
      const id = randomUUID();
      this.usage.reserve(tx, userId, id);
      return tx.tryOnJob.create({
        data: {
          id,
          userId,
          idempotencyKey: key,
          requestHash,
          ...input,
          provider,
          imageModel,
          deadlineAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      });
    });
  }
  async begin(userId: string, id: string) {
    return (
      (
        await this.prisma.tryOnJob.updateMany({
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
    await this.prisma.tryOnJob.updateMany({
      where: { id, userId, ...active, resultFileId: null },
      data: { generationStartedAt: null },
    });
  }
  async checkpoint(
    userId: string,
    id: string,
    file: { fileId: string; filePath: string },
  ) {
    return (
      (
        await this.prisma.tryOnJob.updateMany({
          where: { id, userId, ...active, deadlineAt: { gt: new Date() } },
          data: { resultFileId: file.fileId, resultFilePath: file.filePath },
        })
      ).count === 1
    );
  }
  complete(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.tryOnJob.findFirst({
        where: { id, userId, ...active },
      });
      if (!row?.resultFileId || !row.resultFilePath) return;
      const updated = await tx.tryOnJob.updateMany({
        where: { id, userId, ...active, deadlineAt: { gt: new Date() } },
        data: { status: 'done', errorCode: null },
      });
      if (!updated.count) return;
      await tx.outfit.create({
        data: {
          userId,
          tryOnJobId: id,
          imagekitFileId: row.resultFileId,
          filePath: row.resultFilePath,
        },
      });
    });
  }
  fail(userId: string, id: string, errorCode: string) {
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.tryOnJob.updateMany({
        where: {
          id,
          userId,
          status: { in: ['queued', 'processing'] },
          refundedAt: null,
        },
        data: { status: 'failed', errorCode, refundedAt: new Date() },
      });
      if (!changed.count) return null;
      this.usage.refund(tx, userId, id);
      return tx.tryOnJob.findUnique({ where: { id } });
    });
  }
  expired() {
    return this.prisma.tryOnJob.findMany({
      where: {
        status: { in: ['queued', 'processing'] },
        deadlineAt: { lte: new Date() },
      },
      select: { id: true, userId: true },
      take: 100,
    });
  }
}
