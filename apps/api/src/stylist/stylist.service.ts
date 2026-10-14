import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { z } from 'zod';
import {
  Outfit,
  GarmentTags,
  StylistAdvice,
  StylistJobResponse,
  SuggestResponse,
  type OutfitListQuery,
} from '@stylist/shared';
import { StylistRepository, StylistInput } from './stylist.repository';
import { StylistProvider } from './stylist.provider';
import { ImageStorageProvider } from '../uploads/image-storage.provider';
export const snapshotSchema = z
  .array(z.strictObject({ id: z.uuid(), tags: GarmentTags }))
  .max(4);
@Injectable()
export class StylistService {
  private readonly logger = new Logger(StylistService.name);
  constructor(
    private readonly repo: StylistRepository,
    private readonly provider: StylistProvider,
    private readonly storage: ImageStorageProvider,
    @InjectQueue('stylist') private readonly queue: Queue,
  ) {}
  async create(userId: string, key: string, input: StylistInput) {
    const row = await this.repo.create(
      userId,
      `${input.kind}:${key}`,
      input,
      this.provider.name,
      this.provider.model,
    );
    if (row.status === 'queued')
      try {
        await this.queue.add(
          'stylist',
          { userId, id: row.id },
          {
            jobId: `stylist-${row.id}`,
            attempts: 1,
            removeOnComplete: 100,
            removeOnFail: 100,
          },
        );
      } catch {
        await this.repo.fail(userId, row.id, 'INTERNAL_ERROR');
        throw new ServiceUnavailableException();
      }
    return { jobId: row.id };
  }
  async auto(userId: string, outfitId: string) {
    try {
      await this.create(userId, `auto-${outfitId}-v1`, {
        kind: 'advice',
        outfitId,
      });
    } catch {
      this.logger.error('Automatic advice deferred; try-on image preserved');
    }
  }
  async getJob(userId: string, id: string) {
    let row = await this.repo.find(userId, id);
    if (!row || row.outfit?.deletedAt) throw new NotFoundException();
    if (
      ['queued', 'processing'].includes(row.status) &&
      row.deadlineAt <= new Date()
    ) {
      await this.repo.fail(userId, id, 'INTERNAL_ERROR');
      row = await this.repo.find(userId, id);
      if (!row) throw new NotFoundException();
    }
    let result =
      row.kind === 'suggest' && row.status === 'ready'
        ? SuggestResponse.parse(row.result)
        : null;
    if (result?.outfits.length) {
      const current = new Set(
        (
          await this.repo.available(
            userId,
            result.outfits.flatMap((o) => o.garmentIds),
          )
        ).map((g) => g.id),
      );
      const outfits = result.outfits.filter((o) =>
        o.garmentIds.every((id) => current.has(id)),
      );
      if (outfits.length !== result.outfits.length)
        result = {
          ...result,
          outfits,
          message: 'Một số món không còn trong tủ đồ. Hãy xin gợi ý mới.',
        };
    }
    return StylistJobResponse.parse({
      id: row.id,
      kind: row.kind,
      status: row.status,
      outfitId: row.outfitId,
      errorCode: row.errorCode,
      result,
      isMock: row.provider === 'fake',
      createdAt: row.createdAt.toISOString(),
    });
  }
  response(row: Awaited<ReturnType<StylistRepository['outfit']>>) {
    return Outfit.parse({
      id: row.id,
      url: this.storage.url(row.filePath, 1600),
      thumbnailUrl: this.storage.url(row.filePath, 400),
      occasion: row.tryOnJob.occasion,
      garments: row.garmentSnapshot
        ? snapshotSchema.parse(row.garmentSnapshot)
        : [],
      liked: row.liked,
      savedAt: row.savedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      advice: row.advice ? StylistAdvice.parse(row.advice) : null,
      adviceStatus: row.adviceStatus,
      adviceErrorCode: row.adviceErrorCode,
      promptVersion: row.advicePromptVersion,
      knowledgeVersion: row.adviceKnowledgeVersion,
      isMock: row.tryOnJob.provider === 'fake',
      adviceIsMock: row.adviceProvider === 'fake',
    });
  }
  async outfit(userId: string, id: string) {
    return this.response(await this.repo.outfit(userId, id));
  }
  async list(userId: string, query: OutfitListQuery) {
    const rows = await this.repo.list(userId, query);
    const page = rows.slice(0, query.limit);
    return {
      items: page.map((r) => this.response(r)),
      nextCursor: rows.length > query.limit ? page.at(-1)!.id : null,
    };
  }
  async remove(userId: string, id: string) {
    const fileId = await this.repo.prepareDelete(userId, id);
    await this.storage.delete(fileId);
    return { deleted: true as const };
  }
  async finish(userId: string, id: string, result: unknown, kind: string) {
    const parsed =
      kind === 'advice'
        ? StylistAdvice.parse(result)
        : SuggestResponse.parse(result);
    await this.repo.complete(userId, id, parsed);
  }
}
