import { HttpException, Injectable, NotFoundException } from '@nestjs/common';
import {
  COLLECTION_LIMIT,
  CollectionResponse,
  CollectionListResponse,
  type CollectionListQuery,
  type CreateCollectionRequest,
  type UpdateCollectionRequest,
} from '@stylist/shared';
import { PrismaService } from '../database/prisma.service';
import type { Prisma } from '../generated/prisma/client';
import { JobLimitsService } from '../usage/job-limits.service';
const alive = { user: { deletedAt: null } };
const include = {
  items: {
    where: { outfit: { deletedAt: null, ...alive } },
    orderBy: { outfitId: 'asc' as const },
  },
};
type Row = Prisma.OutfitCollectionGetPayload<{ include: typeof include }>;
@Injectable()
export class CollectionsRepository {
  constructor(
    private readonly db: PrismaService,
    private readonly locks: JobLimitsService,
  ) {}
  private response(row: Row) {
    return CollectionResponse.parse({
      id: row.id,
      name: row.name,
      occasion: row.occasion,
      outfitIds: row.items.map((item) => item.outfitId),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  }
  private async find(db: Prisma.TransactionClient, userId: string, id: string) {
    const row = await db.outfitCollection.findFirst({
      where: { id, userId, ...alive },
      include,
    });
    if (!row) throw new NotFoundException();
    return row;
  }
  async get(userId: string, id: string) {
    return this.response(await this.find(this.db, userId, id));
  }
  async list(userId: string, query: CollectionListQuery) {
    if (query.cursor) await this.find(this.db, userId, query.cursor);
    const rows = await this.db.outfitCollection.findMany({
      where: { userId, ...alive },
      include,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const page = rows.slice(0, query.limit);
    return CollectionListResponse.parse({
      items: page.map((row) => this.response(row)),
      nextCursor: rows.length > query.limit ? page.at(-1)!.id : null,
    });
  }
  private async replace(
    db: Prisma.TransactionClient,
    userId: string,
    collectionId: string,
    outfitIds: string[],
  ) {
    const count = await db.outfit.count({
      where: { id: { in: outfitIds }, userId, deletedAt: null, ...alive },
    });
    if (count !== outfitIds.length) throw new NotFoundException();
    await db.collectionOutfit.deleteMany({ where: { userId, collectionId } });
    if (outfitIds.length)
      await db.collectionOutfit.createMany({
        data: outfitIds.map((outfitId) => ({ userId, collectionId, outfitId })),
      });
  }
  create(userId: string, body: CreateCollectionRequest) {
    return this.db.$transaction(async (tx) => {
      await this.locks.lock(tx, userId);
      if (
        (await tx.outfitCollection.count({ where: { userId } })) >=
        COLLECTION_LIMIT
      )
        throw new HttpException(
          {
            code: 'QUOTA_EXCEEDED',
            message: 'Collection limit reached',
            details: { resource: 'collections', limit: COLLECTION_LIMIT },
          },
          429,
        );
      const row = await tx.outfitCollection.create({
        data: { userId, name: body.name, occasion: body.occasion },
      });
      await this.replace(tx, userId, row.id, body.outfitIds);
      return this.response(await this.find(tx, userId, row.id));
    });
  }
  update(userId: string, id: string, body: UpdateCollectionRequest) {
    return this.db.$transaction(async (tx) => {
      await this.locks.lock(tx, userId);
      await this.find(tx, userId, id);
      if (body.outfitIds !== undefined)
        await this.replace(tx, userId, id, body.outfitIds);
      await tx.outfitCollection.updateMany({
        where: { id, userId, ...alive },
        data: {
          name: body.name,
          occasion: body.occasion,
          updatedAt: new Date(),
        },
      });
      return this.response(await this.find(tx, userId, id));
    });
  }
  remove(userId: string, id: string) {
    return this.db.$transaction(async (tx) => {
      await this.locks.lock(tx, userId);
      await this.find(tx, userId, id);
      await tx.outfitCollection.deleteMany({ where: { id, userId } });
      return { deleted: true as const };
    });
  }
}
