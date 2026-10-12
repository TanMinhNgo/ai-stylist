import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  Logger,
  HttpException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { z } from 'zod';
import {
  AssetQuotaResponse,
  AssetJobResponse,
  IdeaJobResponse,
  IdeaProposals,
  MannequinAsset,
  ErrorCode,
  type AssetInput,
  type IdeaRequest,
} from '@stylist/shared';
import { RuntimeConfig } from '../config/runtime-config';
import { ImageStorageProvider } from '../uploads/image-storage.provider';
import { AssetRepository } from './asset.repository';
import { AssetProvider } from './asset.provider';
import type { AssetJob } from '../generated/prisma/client';
const metaSchema = z.strictObject({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  bounds: z.tuple([
    z.number().int().nonnegative(),
    z.number().int().nonnegative(),
    z.number().int().positive(),
    z.number().int().positive(),
  ]),
});
@Injectable()
export class AssetService {
  private readonly logger = new Logger(AssetService.name);
  constructor(
    private readonly repo: AssetRepository,
    private readonly provider: AssetProvider,
    private readonly storage: ImageStorageProvider,
    private readonly config: RuntimeConfig,
    @InjectQueue('garment-assets') private readonly queue: Queue,
  ) {}
  enabled(userId: string) {
    if (this.config.values.ASSET_GENERATION_ENABLED !== 'true') return false;
    const ids = (this.config.values.ASSET_GENERATION_USER_IDS || '')
      .split(',')
      .map((i) => i.trim())
      .filter(Boolean);
    return ids.length
      ? ids.includes(userId)
      : process.env.NODE_ENV !== 'production';
  }
  private guard(userId: string) {
    if (!this.enabled(userId))
      throw new ForbiddenException({
        code: 'ASSET_DISABLED',
        message: 'Asset generation is not enabled for this account',
      });
  }
  async quota(userId: string) {
    return AssetQuotaResponse.parse({
      enabled: this.enabled(userId),
      ...(await this.repo.usage(userId)),
    });
  }
  async create(userId: string, key: string, items: AssetInput[]) {
    this.guard(userId);
    const rows = await this.repo.create(
      userId,
      `assets:${key}`,
      items,
      this.provider.name,
      this.provider.model,
    );
    await this.enqueue(rows);
    return { jobIds: rows.map((j) => j.id) };
  }
  async plan(userId: string, key: string, request: IdeaRequest) {
    this.guard(userId);
    const rows = await this.repo.create(
      userId,
      `plan:${key}`,
      [{ source: 'plan', request }],
      this.provider.name,
      this.provider.model,
    );
    await this.enqueue(rows);
    return { jobId: rows[0].id };
  }
  private async enqueue(rows: AssetJob[]) {
    for (const row of rows)
      if (row.status === 'queued') {
        try {
          await this.queue.add(
            'asset',
            { id: row.id, userId: row.userId },
            {
              jobId: `asset-${row.id}`,
              attempts: 3,
              backoff: { type: 'exponential', delay: 2000 },
              removeOnComplete: 100,
              removeOnFail: 100,
            },
          );
        } catch {
          await this.repo.cancelQueued(
            row.userId,
            rows.map((job) => job.id),
          );
          throw new HttpException(
            {
              code: 'ASSET_PROVIDER_ERROR',
              message: 'Generation queue unavailable',
            },
            503,
          );
        }
      }
  }
  async auto(userId: string, id: string) {
    const row = await this.repo.automatic(userId, id);
    if (!row) return;
    try {
      await this.create(userId, `auto-${id}-${row.assetBodyKey}-v1`, [
        {
          source: 'photo',
          garmentId: id,
          bodyKey: row.assetBodyKey === 'm' ? 'm' : 'f',
        },
      ]);
    } catch (error) {
      const response =
        error instanceof HttpException ? error.getResponse() : null;
      const parsed = ErrorCode.safeParse(
        response && typeof response === 'object'
          ? 'code' in response
            ? response.code
            : undefined
          : undefined,
      );
      await this.repo.deferred(
        userId,
        id,
        parsed.success ? parsed.data : 'ASSET_PROVIDER_ERROR',
      );
      if (!parsed.success)
        this.logger.error('Automatic mannequin asset deferred');
    }
  }
  render(row: AssetJob | null | undefined) {
    if (!row || row.status !== 'ready' || row.deletedAt || !row.resultFilePath)
      return null;
    const meta = metaSchema.parse(row.renderMeta);
    return MannequinAsset.parse({
      ...meta,
      bodyKey: row.bodyKey,
      isMock: row.provider === 'fake',
      url: this.storage.url(row.resultFilePath, 1024, 'png'),
      thumbnailUrl: this.storage.url(row.resultFilePath, 400, 'png'),
    });
  }
  private async getRow(userId: string, id: string) {
    let row = await this.repo.find(userId, id);
    if (!row) throw new NotFoundException();
    if (
      ['queued', 'processing'].includes(row.status) &&
      row.deadlineAt <= new Date()
    ) {
      await this.repo.fail(
        userId,
        id,
        'ASSET_TIMEOUT',
        !row.generationStartedAt || row.kind === 'plan',
      );
      row = await this.repo.find(userId, id);
      if (!row) throw new NotFoundException();
    }
    return row;
  }
  async get(userId: string, id: string) {
    const row = await this.getRow(userId, id);
    if (row.kind === 'plan') throw new NotFoundException();
    return AssetJobResponse.parse({
      id: row.id,
      status: row.status,
      source: row.kind,
      bodyKey: row.bodyKey,
      errorCode: row.errorCode,
      garmentId: row.garmentId,
      asset: this.render(row),
      createdAt: row.createdAt.toISOString(),
    });
  }
  async getPlan(userId: string, id: string) {
    const row = await this.getRow(userId, id);
    if (row.kind !== 'plan') throw new NotFoundException();
    return IdeaJobResponse.parse({
      id: row.id,
      status: row.status,
      bodyKey: row.bodyKey,
      errorCode: row.errorCode,
      items:
        row.status === 'ready' ? IdeaProposals.parse(row.proposals).items : [],
      createdAt: row.createdAt.toISOString(),
    });
  }
}
