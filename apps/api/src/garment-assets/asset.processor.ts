import {
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';
import { z } from 'zod';
import {
  GarmentTags,
  IdeaProposals,
  EMBEDDING_DIMENSIONS,
  ErrorCode,
} from '@stylist/shared';
import { AssetRepository, JobInput } from './asset.repository';
import { AssetProvider, AssetProviderError } from './asset.provider';
import { AssetImage } from './asset-image';
import { AssetService } from './asset.service';
import { ImageStorageProvider } from '../uploads/image-storage.provider';
import { VisionProvider } from '../media/vision.provider';
const payload = z.strictObject({ userId: z.uuid(), id: z.uuid() });
@Processor('garment-assets', { concurrency: 1, maxStalledCount: 1 })
export class AssetProcessor
  extends WorkerHost
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private timer?: ReturnType<typeof setInterval>;
  private sweeping = false;
  private readonly logger = new Logger(AssetProcessor.name);
  constructor(
    private readonly repo: AssetRepository,
    private readonly provider: AssetProvider,
    private readonly image: AssetImage,
    private readonly storage: ImageStorageProvider,
    private readonly vision: VisionProvider,
    private readonly service: AssetService,
  ) {
    super();
  }
  onApplicationBootstrap() {
    this.timer = setInterval(() => {
      void this.sweep().catch(() =>
        this.logger.error('Asset expiry sweep failed'),
      );
    }, 60000);
    this.timer.unref();
    void this.sweep().catch(() =>
      this.logger.error('Asset expiry sweep failed'),
    );
  }
  onModuleDestroy() {
    clearInterval(this.timer);
  }
  async sweep() {
    if (this.sweeping) return;
    this.sweeping = true;
    try {
      for (const row of await this.repo.expired())
        await this.repo.fail(
          row.userId,
          row.id,
          'ASSET_TIMEOUT',
          !row.generationStartedAt || row.kind === 'plan',
        );
    } finally {
      this.sweeping = false;
    }
  }
  async process(job: Job) {
    try {
      await this.run(job);
    } catch (error) {
      if (error instanceof UnrecoverableError) throw error;
      if (error instanceof z.ZodError)
        throw new UnrecoverableError('Invalid asset job');
      const code = ErrorCode.safeParse(
        error instanceof Error ? error.message : null,
      );
      throw new Error(code.success ? code.data : 'Asset processing failed');
    }
  }
  private async run(job: Job) {
    const { userId, id } = payload.parse(job.data);
    let row = await this.repo.find(userId, id);
    if (!row || ['ready', 'failed'].includes(row.status)) return;
    if (row.deadlineAt <= new Date()) {
      await this.repo.fail(
        userId,
        id,
        'ASSET_TIMEOUT',
        !row.generationStartedAt || row.kind === 'plan',
      );
      return;
    }
    try {
      const input = JobInput.parse(row.input);
      if (
        row.provider !== this.provider.name ||
        row.imageModel !== this.provider.model
      )
        throw new AssetProviderError(
          'ASSET_PROVIDER_ERROR',
          !row.generationStartedAt,
        );
      if (input.source === 'plan') {
        if (row.generationStartedAt)
          throw new AssetProviderError('ASSET_PROVIDER_ERROR', true);
        if (!this.service.enabled(userId))
          throw new AssetProviderError('ASSET_PROVIDER_ERROR', true);
        if (!(await this.repo.begin(userId, id))) return;
        const items = IdeaProposals.parse({
          items: await this.provider.plan(input.request),
        }).items;
        if (
          input.request.menu !== 'outfit' &&
          (items.length !== 1 || items[0].type !== input.request.type)
        )
          throw new AssetProviderError('ASSET_INPUT_INVALID', true);
        await this.repo.readyPlan(userId, id, items);
        return;
      }
      const originalTags =
        input.source === 'photo' ? GarmentTags.parse(row.garment?.tags) : null;
      if (
        input.source === 'photo' &&
        (!row.garment ||
          row.garment.deletingAt ||
          row.garment.status !== 'ready')
      )
        throw new AssetProviderError(
          'ASSET_INPUT_INVALID',
          !row.generationStartedAt,
        );
      const type = input.source === 'idea' ? input.type : originalTags!.type;
      if (!row.resultFileId) {
        if (row.generationStartedAt)
          throw new AssetProviderError('ASSET_PROVIDER_ERROR');
        if (!this.service.enabled(userId))
          throw new AssetProviderError('ASSET_PROVIDER_ERROR', true);
        const referenceUrl =
          input.source === 'photo'
            ? this.storage.url(row.garment!.filePath, 1024)
            : undefined;
        if (referenceUrl) await this.provider.checkPhoto(referenceUrl, type);
        if (!(await this.repo.begin(userId, id))) return;
        const bytes = await this.provider.generate({
          type,
          bodyKey: input.bodyKey,
          prompt:
            input.source === 'idea'
              ? input.prompt
              : JSON.stringify(originalTags),
          referenceUrl,
        });
        const normalized = await this.image.normalize(bytes, type);
        const current = await this.repo.find(userId, id);
        if (
          !current ||
          current.status !== 'processing' ||
          current.deadlineAt <= new Date()
        )
          return;
        const file = await this.storage.saveResult(
          normalized.image,
          userId,
          id,
        );
        if (!(await this.repo.checkpoint(userId, id, file, normalized.meta))) {
          await this.storage.delete(file.fileId);
          return;
        }
        row = await this.repo.find(userId, id);
        if (!row || row.status !== 'processing') return;
      }
      if (!row.resultFilePath)
        throw new AssetProviderError('ASSET_PROVIDER_ERROR');
      const tags =
        originalTags ??
        GarmentTags.parse(
          await this.vision.garment(
            this.storage.url(row.resultFilePath, 1024, 'png'),
          ),
        );
      if (tags.type !== type)
        throw new AssetProviderError('ASSET_INPUT_INVALID');
      const embedding =
        input.source === 'idea'
          ? z
              .array(z.number().finite())
              .length(EMBEDDING_DIMENSIONS)
              .parse(await this.vision.embedding(JSON.stringify(tags)))
          : null;
      await this.repo.complete(userId, id, tags, embedding);
    } catch (error) {
      // Do not delete a file after an uncertain checkpoint or finalization receipt.
      const current = await this.repo.find(userId, id);
      if (!current || ['ready', 'failed'].includes(current.status)) return;
      if (
        current.resultFileId &&
        !(error instanceof AssetProviderError || error instanceof z.ZodError)
      ) {
        if (job.attemptsMade + 1 < (job.opts.attempts ?? 1))
          throw new Error('Asset finalization failed');
      }
      const providerError = error instanceof AssetProviderError ? error : null;
      const refundable =
        providerError?.refundable ?? !current.generationStartedAt;
      const code = providerError?.code ?? 'ASSET_PROVIDER_ERROR';
      if (
        providerError?.retryable &&
        !current.resultFileId &&
        job.attemptsMade + 1 < (job.opts.attempts ?? 1)
      ) {
        await this.repo.retry(userId, id);
        throw new Error(code);
      }
      await this.repo.fail(userId, id, code, refundable);
      throw new UnrecoverableError(code);
    }
  }
}
