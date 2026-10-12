import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type {
  GarmentTags,
  MediaListQuery,
  GarmentListQuery,
  ModelPhotoAnalysis,
} from '@stylist/shared';
import { EMBEDDING_DIMENSIONS } from '@stylist/shared';

export type MediaKind = 'model-photo' | 'garment';

@Injectable()
export class MediaRepository {
  constructor(private readonly prisma: PrismaService) {}
  grant(token: string, userId: string) {
    return this.prisma.uploadGrant.findFirst({
      where: { token, userId, user: { deletedAt: null } },
    });
  }
  createGrant(token: string, userId: string, folder: string, expiresAt: Date) {
    return this.prisma.uploadGrant.create({
      data: { token, userId, folder, expiresAt },
    });
  }
  async register(
    kind: MediaKind,
    token: string,
    userId: string,
    file: { fileId: string; filePath: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.uploadGrant.updateMany({
        where: {
          token,
          userId,
          usedAt: null,
          expiresAt: { gt: new Date() },
          user: { deletedAt: null },
        },
        data: { usedAt: new Date(), imagekitFileId: file.fileId },
      });
      if (claimed.count !== 1)
        throw new BadRequestException({
          code: 'UPLOAD_EXPIRED',
          message: 'Upload authorization expired or already used',
        });
      const data = {
        userId,
        imagekitFileId: file.fileId,
        filePath: file.filePath,
      };
      return kind === 'garment'
        ? tx.garment.create({ data })
        : tx.modelPhoto.create({ data });
    });
  }
  find(kind: MediaKind, userId: string, id: string) {
    const where = { id, userId, user: { deletedAt: null } };
    return kind === 'garment'
      ? this.prisma.garment.findFirst({ where })
      : this.prisma.modelPhoto.findFirst({ where });
  }
  async list(
    kind: MediaKind,
    userId: string,
    query: MediaListQuery | GarmentListQuery,
  ) {
    if (query.cursor && !(await this.find(kind, userId, query.cursor)))
      throw new NotFoundException();
    const args = {
      where: { userId, user: { deletedAt: null } },
      take: query.limit + 1,
      orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    };
    return kind === 'garment'
      ? this.prisma.garment.findMany({
          ...args,
          where: {
            ...args.where,
            category: (query as GarmentListQuery).category,
          },
        })
      : this.prisma.modelPhoto.findMany(args);
  }
  async fail(kind: MediaKind, userId: string, id: string, errorCode: string) {
    const args = {
      where: { id, userId, status: 'pending', user: { deletedAt: null } },
      data: { status: 'failed', errorCode },
    };
    if (kind === 'garment') await this.prisma.garment.updateMany(args);
    else await this.prisma.modelPhoto.updateMany(args);
  }
  async readyPhoto(userId: string, id: string, analysis: ModelPhotoAnalysis) {
    await this.prisma.modelPhoto.updateMany({
      where: { id, userId, status: 'pending', user: { deletedAt: null } },
      data: {
        status: 'ready',
        analysis,
        promptVersion: 'photo-v1',
        errorCode: null,
      },
    });
  }
  async readyGarment(
    userId: string,
    id: string,
    tags: GarmentTags,
    embedding: number[],
  ) {
    if (
      embedding.length !== EMBEDDING_DIMENSIONS ||
      embedding.some((value) => !Number.isFinite(value))
    )
      throw new Error('Invalid embedding');
    const vector = '[' + embedding.join(',') + ']';
    await this.prisma.$executeRaw`
      UPDATE garments SET tags = ${JSON.stringify(tags)}::jsonb, category = ${tags.category},
        embedding = ${vector}::vector, status = 'ready', prompt_version = 'garment-v1', error_code = NULL
      WHERE id = ${id}::uuid AND user_id = ${userId}::uuid AND status = 'pending'
        AND EXISTS (SELECT 1 FROM users WHERE users.id = ${userId}::uuid AND deleted_at IS NULL)
    `;
  }
  async remove(kind: MediaKind, userId: string, id: string) {
    if (kind === 'garment')
      await this.prisma.garment.deleteMany({ where: { id, userId } });
    else await this.prisma.modelPhoto.deleteMany({ where: { id, userId } });
  }
}
