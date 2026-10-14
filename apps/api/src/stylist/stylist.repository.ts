import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import {
  GarmentTags,
  ModelPhotoAnalysis,
  StyleProfile,
  isTryOnAllowed,
  type UpdateStyleProfileRequest,
  type OutfitListQuery,
  type SuggestRequest,
} from '@stylist/shared';
import { PrismaService } from '../database/prisma.service';
import type { Prisma } from '../generated/prisma/client';
import { snapshotOutfit } from './snapshot';
import { parseVector, tasteVector, formalityRange } from './taste';

export type StylistInput =
  | { kind: 'advice'; outfitId: string }
  | { kind: 'suggest'; request: SuggestRequest };
const alive = { user: { deletedAt: null }, deletedAt: null };
const active = {
  status: { in: ['queued', 'processing'] },
  user: { deletedAt: null },
};
@Injectable()
export class StylistRepository {
  constructor(private readonly prisma: PrismaService) {}
  private async lock(db: Prisma.TransactionClient, userId: string) {
    const users = await db.$queryRaw<
      { id: string }[]
    >`SELECT id FROM users WHERE id=${userId}::uuid AND deleted_at IS NULL FOR UPDATE`;
    if (!users.length) throw new NotFoundException();
  }
  async profile(userId: string, db: Prisma.TransactionClient = this.prisma) {
    const row = await db.styleProfile.findFirst({
      where: { userId, user: { deletedAt: null } },
    });
    const photo = row
      ? null
      : await db.modelPhoto.findFirst({
          where: { userId, status: 'ready', user: { deletedAt: null } },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        });
    const analysis = ModelPhotoAnalysis.safeParse(photo?.analysis);
    return StyleProfile.parse({
      styles: row?.styles ?? [],
      occasions: row?.occasions ?? [],
      budget: row?.budget ?? null,
      preferredColors: row?.preferredColors ?? [],
      avoidedColors: row?.avoidedColors ?? [],
      bodyShape: row
        ? row.bodyShape
        : analysis.success
          ? analysis.data.bodyShape
          : null,
      skinTone: row
        ? row.skinTone
        : analysis.success
          ? analysis.data.skinTone
          : null,
      updatedAt: row?.updatedAt.toISOString() ?? null,
    });
  }
  async updateProfile(userId: string, input: UpdateStyleProfileRequest) {
    await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, userId);
      const previous = await this.profile(userId, tx);
      const data = {
        ...input,
        bodyShape:
          input.bodyShape === undefined ? previous.bodyShape : input.bodyShape,
        skinTone:
          input.skinTone === undefined ? previous.skinTone : input.skinTone,
      };
      await tx.styleProfile.upsert({
        where: { userId },
        create: { userId, ...data },
        update: data,
      });
    });
    return this.profile(userId);
  }
  findOutfit(userId: string, id: string) {
    return this.prisma.outfit.findFirst({
      where: { id, userId, ...alive },
      include: { tryOnJob: true },
    });
  }
  async outfit(userId: string, id: string) {
    const row = await this.findOutfit(userId, id);
    if (!row) throw new NotFoundException();
    return row;
  }
  async list(userId: string, query: OutfitListQuery) {
    if (query.cursor && !(await this.findOutfit(userId, query.cursor)))
      throw new NotFoundException();
    return this.prisma.outfit.findMany({
      where: {
        userId,
        ...alive,
        savedAt: { not: null },
        ...(query.liked !== undefined ? { liked: query.liked } : {}),
      },
      include: { tryOnJob: true },
      take: query.limit + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
  }
  async save(userId: string, id: string, saved: boolean) {
    await this.outfit(userId, id);
    await this.prisma.outfit.updateMany({
      where: { id, userId, ...alive },
      data: { savedAt: saved ? new Date() : null },
    });
    return this.outfit(userId, id);
  }
  async feedback(userId: string, id: string, liked: boolean | null) {
    await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, userId);
      const row = await tx.outfit.findFirst({
        where: { id, userId, ...alive },
        include: { tryOnJob: true },
      });
      if (!row) throw new NotFoundException();
      if (!row.garmentSnapshot)
        await snapshotOutfit(tx, userId, id, row.tryOnJob.garmentIds);
      await tx.outfit.updateMany({
        where: { id, userId, ...alive },
        data: {
          liked,
          feedbackAt:
            liked === null
              ? null
              : row.liked === liked && row.feedbackAt
                ? row.feedbackAt
                : new Date(),
        },
      });
      await this.recompute(tx, userId);
    });
    return this.outfit(userId, id);
  }
  private async recompute(db: Prisma.TransactionClient, userId: string) {
    const rows = await db.$queryRaw<
      { vector: string; liked: boolean; at: Date }[]
    >`
      SELECT embedding::text AS vector,liked,feedback_at AS at FROM outfits
      WHERE user_id=${userId}::uuid AND deleted_at IS NULL AND liked IS NOT NULL AND embedding IS NOT NULL
      ORDER BY feedback_at DESC,id LIMIT 50`;
    const vector = tasteVector(
      rows.flatMap((r) => {
        const v = parseVector(r.vector);
        return v ? [{ vector: v, liked: r.liked, at: r.at }] : [];
      }),
    );
    const initial = await this.profile(userId, db);
    await db.styleProfile.upsert({
      where: { userId },
      create: {
        userId,
        bodyShape: initial.bodyShape,
        skinTone: initial.skinTone,
      },
      update: {},
    });
    if (vector)
      await db.$executeRaw`UPDATE style_profiles SET taste_vector=${JSON.stringify(vector)}::vector WHERE user_id=${userId}::uuid`;
    else
      await db.$executeRaw`UPDATE style_profiles SET taste_vector=NULL WHERE user_id=${userId}::uuid`;
  }
  async prepareDelete(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, userId);
      const row = await tx.outfit.findFirst({
        where: { id, userId, user: { deletedAt: null } },
      });
      if (!row) throw new NotFoundException();
      await tx.outfit.updateMany({
        where: { id, userId },
        data: { deletedAt: new Date(), adviceStatus: null, adviceJobId: null },
      });
      await tx.stylistJob.updateMany({
        where: {
          userId,
          outfitId: id,
          status: { in: ['queued', 'processing'] },
        },
        data: { status: 'failed', errorCode: 'NOT_FOUND' },
      });
      await this.recompute(tx, userId);
      return row.imagekitFileId;
    });
  }
  async candidates(userId: string, occasion: string) {
    const [min, max] = formalityRange(occasion);
    const rows = await this.prisma.$queryRaw<
      { id: string; tags: unknown; source: string }[]
    >`
      SELECT g.id,g.tags,g.source FROM garments g LEFT JOIN style_profiles s ON s.user_id=g.user_id
      WHERE g.user_id=${userId}::uuid AND g.status='ready' AND g.deleting_at IS NULL
      AND EXISTS(SELECT 1 FROM users WHERE id=${userId}::uuid AND deleted_at IS NULL)
      AND (g.tags->>'formality')::int BETWEEN ${min} AND ${max}
      ORDER BY CASE WHEN s.taste_vector IS NOT NULL AND g.embedding IS NOT NULL THEN g.embedding <=> s.taste_vector END ASC NULLS LAST,g.created_at DESC,g.id
      LIMIT 60`;
    return rows.flatMap((r) => {
      const t = GarmentTags.safeParse(r.tags);
      return t.success && isTryOnAllowed(t.data.type)
        ? [{ id: r.id, tags: t.data, source: r.source }]
        : [];
    });
  }
  async liked(userId: string) {
    return this.prisma.outfit.findMany({
      where: { userId, ...alive, liked: true },
      select: { garmentSnapshot: true, advice: true },
      orderBy: [{ feedbackAt: 'desc' }, { id: 'desc' }],
      take: 5,
    });
  }
  async available(userId: string, ids: string[]) {
    const rows = await this.prisma.garment.findMany({
      where: {
        id: { in: ids },
        userId,
        status: 'ready',
        deletingAt: null,
        user: { deletedAt: null },
      },
      take: 12,
    });
    return rows.flatMap((r) => {
      const tags = GarmentTags.safeParse(r.tags);
      return tags.success && isTryOnAllowed(tags.data.type)
        ? [{ id: r.id, tags: tags.data, source: r.source }]
        : [];
    });
  }
  async create(
    userId: string,
    key: string,
    input: StylistInput,
    provider: string,
    model: string,
  ) {
    const hash = createHash('sha256')
      .update(JSON.stringify(input))
      .digest('hex');
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, userId);
      const old = await tx.stylistJob.findUnique({
        where: { userId_key: { userId, key } },
      });
      if (old) {
        if (old.requestHash !== hash)
          throw new ConflictException({
            code: 'IDEMPOTENCY_CONFLICT',
            message: 'Key already used',
          });
        if (
          old.outfitId &&
          !(await tx.outfit.findFirst({
            where: { id: old.outfitId, userId, ...alive },
          }))
        )
          throw new NotFoundException();
        return old;
      }
      if (input.kind === 'advice') {
        const outfit = await tx.outfit.findFirst({
          where: { id: input.outfitId, userId, ...alive },
          include: { tryOnJob: true },
        });
        if (!outfit) throw new NotFoundException();
        if (!outfit.garmentSnapshot)
          await snapshotOutfit(
            tx,
            userId,
            outfit.id,
            outfit.tryOnJob.garmentIds,
          );
        if (outfit.adviceJobId) {
          const current = await tx.stylistJob.findFirst({
            where: { id: outfit.adviceJobId, userId, ...active },
          });
          if (current)
            throw new ConflictException({
              code: 'IDEMPOTENCY_CONFLICT',
              message: 'Advice is already processing',
            });
        }
      }
      const row = await tx.stylistJob.create({
        data: {
          id: randomUUID(),
          userId,
          key,
          requestHash: hash,
          kind: input.kind,
          input,
          outfitId: input.kind === 'advice' ? input.outfitId : null,
          provider,
          model,
          deadlineAt: new Date(Date.now() + 5 * 60000),
        },
      });
      if (input.kind === 'advice')
        await tx.outfit.updateMany({
          where: { id: input.outfitId, userId, ...alive },
          data: {
            adviceJobId: row.id,
            adviceStatus: 'queued',
            adviceErrorCode: null,
          },
        });
      return row;
    });
  }
  find(userId: string, id: string) {
    return this.prisma.stylistJob.findFirst({
      where: { id, userId, user: { deletedAt: null } },
      include: { outfit: true },
    });
  }
  async begin(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, userId);
      const row = await tx.stylistJob.findFirst({
        where: { id, userId, ...active },
      });
      if (!row) return false;
      const changed = await tx.stylistJob.updateMany({
        where: {
          id,
          userId,
          ...active,
          startedAt: null,
          deadlineAt: { gt: new Date() },
        },
        data: { status: 'processing', startedAt: new Date() },
      });
      if (changed.count && row.outfitId)
        await tx.outfit.updateMany({
          where: { id: row.outfitId, userId, ...alive, adviceJobId: id },
          data: { adviceStatus: 'processing' },
        });
      return changed.count === 1;
    });
  }
  async fail(userId: string, id: string, code: string) {
    await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, userId);
      const row = await tx.stylistJob.findFirst({
        where: { id, userId, ...active },
      });
      if (!row) return;
      await tx.stylistJob.updateMany({
        where: { id, userId, ...active },
        data: { status: 'failed', errorCode: code },
      });
      if (row.outfitId)
        await tx.outfit.updateMany({
          where: { id: row.outfitId, userId, ...alive, adviceJobId: id },
          data: { adviceStatus: 'failed', adviceErrorCode: code },
        });
    });
  }
  async complete(userId: string, id: string, result: Prisma.InputJsonValue) {
    await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, userId);
      const row = await tx.stylistJob.findFirst({
        where: { id, userId, ...active, deadlineAt: { gt: new Date() } },
      });
      if (!row) return;
      if (row.outfitId) {
        const changed = await tx.outfit.updateMany({
          where: { id: row.outfitId, userId, ...alive, adviceJobId: id },
          data: {
            advice: result,
            adviceStatus: 'ready',
            adviceErrorCode: null,
            advicePromptVersion: 'stylist-v1',
            adviceKnowledgeVersion: 'knowledge-v1',
            adviceProvider: row.provider,
          },
        });
        if (!changed.count) {
          await tx.stylistJob.updateMany({
            where: { id, userId },
            data: { status: 'failed', errorCode: 'NOT_FOUND' },
          });
          return;
        }
      }
      await tx.stylistJob.updateMany({
        where: { id, userId, ...active },
        data: { status: 'ready', result, errorCode: null },
      });
    });
  }
  expired() {
    return this.prisma.stylistJob.findMany({
      where: { ...active, deadlineAt: { lte: new Date() } },
      select: { id: true, userId: true },
      take: 100,
    });
  }
}
