import { HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import {
  CreateLookbookShareResponse,
  LookbookSharesResponse,
  LookbookShareResponse,
  PublicLookbookResponse,
  type CreateLookbookShareRequest,
} from '@stylist/shared';
import { PrismaService } from '../database/prisma.service';
import type { LookbookShare } from '../generated/prisma/client';
import { JobLimitsService } from '../usage/job-limits.service';
import { ImageStorageProvider } from '../uploads/image-storage.provider';
const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');
@Injectable()
export class SharingRepository {
  constructor(
    private readonly db: PrismaService,
    private readonly locks: JobLimitsService,
    private readonly storage: ImageStorageProvider,
  ) {}
  private response(row: LookbookShare) {
    return LookbookShareResponse.parse({
      id: row.id,
      collectionId: row.collectionId,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
    });
  }
  create(
    userId: string,
    collectionId: string,
    body: CreateLookbookShareRequest,
  ) {
    return this.db.$transaction(async (tx) => {
      await this.locks.lock(tx, userId);
      const collection = await tx.outfitCollection.findFirst({
        where: { id: collectionId, userId },
        include: {
          items: {
            where: {
              outfitId: { in: body.outfitIds },
              outfit: { deletedAt: null },
            },
          },
        },
      });
      if (!collection || collection.items.length !== body.outfitIds.length)
        throw new NotFoundException();
      await tx.lookbookShare.deleteMany({
        where: { userId, expiresAt: { lte: new Date() } },
      });
      if ((await tx.lookbookShare.count({ where: { userId } })) >= 20)
        throw new HttpException(
          {
            code: 'QUOTA_EXCEEDED',
            message: 'Share link limit reached',
            details: { resource: 'lookbook_shares', limit: 20 },
          },
          429,
        );
      const token = randomBytes(32).toString('base64url');
      const row = await tx.lookbookShare.create({
        data: {
          userId,
          collectionId,
          title: collection.name,
          tokenHash: hashToken(token),
          outfitIds: body.outfitIds,
          expiresAt: new Date(Date.now() + body.expiresInHours * 3600000),
        },
      });
      return CreateLookbookShareResponse.parse({
        ...this.response(row),
        token,
        publicPath: `/shared-lookbooks/${token}`,
      });
    });
  }
  async list(userId: string, collectionId: string) {
    if (
      !(await this.db.outfitCollection.findFirst({
        where: { id: collectionId, userId, user: { deletedAt: null } },
      }))
    )
      throw new NotFoundException();
    const rows = await this.db.lookbookShare.findMany({
      where: { userId, collectionId, expiresAt: { gt: new Date() } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 20,
    });
    return LookbookSharesResponse.parse({
      items: rows.map((row) => this.response(row)),
    });
  }
  remove(userId: string, id: string) {
    return this.db.$transaction(async (tx) => {
      await this.locks.lock(tx, userId);
      await tx.lookbookShare.deleteMany({ where: { id, userId } });
      return { deleted: true as const };
    });
  }
  async publicView(token: string) {
    const row = await this.db.lookbookShare.findFirst({
      where: {
        tokenHash: hashToken(token),
        expiresAt: { gt: new Date() },
        collection: { user: { deletedAt: null } },
      },
      include: {
        collection: {
          include: {
            items: {
              where: { outfit: { deletedAt: null } },
              include: { outfit: { include: { tryOnJob: true } } },
            },
          },
        },
      },
    });
    if (!row) throw new NotFoundException();
    const selected = row.collection.items.filter((item) =>
      row.outfitIds.includes(item.outfitId),
    );
    const ids = [
      ...new Set(selected.flatMap((item) => item.outfit.tryOnJob.garmentIds)),
    ];
    const available = new Set(
      (
        await this.db.garment.findMany({
          where: {
            userId: row.userId,
            user: { deletedAt: null },
            id: { in: ids },
            status: 'ready',
            deletingAt: null,
          },
          select: { id: true },
        })
      ).map((item) => item.id),
    );
    const ttl = Math.min(
      60,
      Math.floor((row.expiresAt.getTime() - Date.now()) / 1000),
    );
    if (ttl < 1) throw new NotFoundException();
    return PublicLookbookResponse.parse({
      title: row.title,
      expiresAt: row.expiresAt.toISOString(),
      imageUrlsExpireAt: new Date(Date.now() + ttl * 1000).toISOString(),
      outfits: selected
        .filter(
          (item) =>
            item.outfit.tryOnJob.garmentIds.length > 0 &&
            item.outfit.tryOnJob.garmentIds.every((id) => available.has(id)),
        )
        .map((item) => ({
          imageUrl: this.storage.url(item.outfit.filePath, 1200, 'jpg', ttl),
        })),
    });
  }
}
