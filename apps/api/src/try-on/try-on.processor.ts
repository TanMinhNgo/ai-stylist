import {
  OnApplicationBootstrap,
  OnModuleDestroy,
  Logger,
  HttpException,
} from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';
import { z } from 'zod';
import { TryOnRepository } from './try-on.repository';
import { TryOnService } from './try-on.service';
import { TryOnProvider, TryOnProviderError } from './try-on.provider';
import { ImageStorageProvider } from '../uploads/image-storage.provider';
import { ErrorCode } from '@stylist/shared';
import { StylistService } from '../stylist/stylist.service';
import { WorkService } from '../usage/work.service';

const payload = z.strictObject({ id: z.uuid(), userId: z.uuid() });
@Processor('try-on', { concurrency: 1, maxStalledCount: 1 })
export class TryOnProcessor
  extends WorkerHost
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private timer?: ReturnType<typeof setInterval>;
  private sweeping = false;
  private readonly logger = new Logger(TryOnProcessor.name);
  @OnWorkerEvent('error')
  onWorkerError() {
    this.logger.error('Try-on worker connection error');
  }
  constructor(
    private readonly repository: TryOnRepository,
    private readonly service: TryOnService,
    private readonly provider: TryOnProvider,
    private readonly storage: ImageStorageProvider,
    private readonly stylist?: StylistService,
    private readonly work?: WorkService,
  ) {
    super();
  }
  onApplicationBootstrap() {
    this.timer = setInterval(() => {
      void this.sweep().catch(() =>
        this.logger.error('Try-on expiry sweep failed'),
      );
    }, 60000);
    this.timer.unref();
    void this.sweep().catch(() =>
      this.logger.error('Try-on expiry sweep failed'),
    );
  }
  onModuleDestroy() {
    clearInterval(this.timer);
  }
  private async complete(userId: string, id: string) {
    await this.repository.complete(userId, id);
    try {
      if (this.stylist) {
        const row = await this.repository.find(userId, id);
        if (row?.outfit && !row.outfit.deletedAt)
          await this.stylist.auto(userId, row.outfit.id);
      }
    } catch {
      this.logger.error('Advice scheduling deferred; try-on image preserved');
    }
  }
  async sweep() {
    if (this.sweeping) return;
    this.sweeping = true;
    try {
      for (const row of await this.repository.expired())
        await this.service.fail(row.userId, row.id, 'TRYON_TIMEOUT');
    } finally {
      this.sweeping = false;
    }
  }
  async process(job: Job) {
    const { userId, id } = payload.parse(job.data);
    return this.work
      ? this.work.run(userId, id, () => this.execute(job))
      : this.execute(job);
  }
  private async execute(job: Job) {
    try {
      return await this.run(job);
    } catch (error) {
      if (error instanceof UnrecoverableError) throw error;
      if (error instanceof z.ZodError)
        throw new UnrecoverableError('Invalid try-on job');
      const code =
        error instanceof Error ? ErrorCode.safeParse(error.message) : null;
      throw new Error(code?.success ? code.data : 'Try-on processing failed');
    }
  }
  private async run(job: Job) {
    const { userId, id } = payload.parse(job.data);
    const row = await this.repository.find(userId, id);
    if (!row || ['done', 'failed'].includes(row.status)) return;
    if (row.deadlineAt <= new Date()) {
      await this.service.fail(userId, id, 'TRYON_TIMEOUT');
      return;
    }
    if (row.resultFileId) {
      await this.complete(userId, id);
      return;
    }
    if (
      row.generationStartedAt ||
      row.provider !== this.provider.name ||
      row.imageModel !== this.provider.model
    ) {
      // A crash after starting an AI call is ambiguous; never spend twice automatically.
      await this.service.fail(userId, id, 'TRYON_PROVIDER_ERROR');
      return;
    }
    try {
      const { photo, garments } = await this.repository.inputs(userId, row);
      if (!(await this.repository.begin(userId, id))) return;
      const bytes = await this.provider.generate({
        modelPhotoUrl: this.storage.url(photo.filePath, 1024),
        garmentUrls: garments.map((g) => this.storage.url(g.filePath, 1024)),
        occasion: row.occasion,
      });
      const current = await this.repository.find(userId, id);
      if (
        !current ||
        current.status !== 'processing' ||
        current.deadlineAt <= new Date()
      ) {
        await this.service.fail(userId, id, 'TRYON_TIMEOUT');
        return;
      }
      const uploaded = await this.storage.saveResult(bytes, userId, id);
      if (!(await this.repository.checkpoint(userId, id, uploaded))) {
        await this.storage.delete(uploaded.fileId);
        return;
      }
      await this.complete(userId, id);
    } catch (error) {
      // An uncertain checkpoint may already reference the file; never delete it here.
      const checkpoint = await this.repository.find(userId, id);
      // Resume DB finalization after a committed upload without calling AI again.
      if (checkpoint?.resultFileId && checkpoint.status === 'processing')
        throw new Error('Try-on finalization failed');
      const providerError = error instanceof TryOnProviderError ? error : null;
      const httpCode =
        error instanceof HttpException
          ? ErrorCode.safeParse(
              (error.getResponse() as { code?: unknown }).code,
            )
          : null;
      const code =
        providerError?.code ??
        (httpCode?.success
          ? httpCode.data
          : error instanceof HttpException && error.getStatus() === 404
            ? 'NOT_FOUND'
            : 'TRYON_PROVIDER_ERROR');
      if (
        providerError?.retryable &&
        job.attemptsMade + 1 < (job.opts.attempts ?? 1)
      ) {
        await this.repository.retry(userId, id);
        throw new Error(code);
      }
      await this.service.fail(userId, id, code);
      throw new UnrecoverableError(code);
    }
  }
}
