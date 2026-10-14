import {
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';
import { z } from 'zod';
import { SuggestRequest, SuggestOutput, StylistAdvice } from '@stylist/shared';
import { StylistRepository } from './stylist.repository';
import { StylistProvider } from './stylist.provider';
import { StylistService, snapshotSchema } from './stylist.service';
import { ImageStorageProvider } from '../uploads/image-storage.provider';
import { validateSuggestions } from './suggestions';
import { WorkService } from '../usage/work.service';
const payload = z.strictObject({ userId: z.uuid(), id: z.uuid() });
const inputSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('advice'), outfitId: z.uuid() }),
  z.strictObject({ kind: z.literal('suggest'), request: SuggestRequest }),
]);
@Processor('stylist', { concurrency: 1, maxStalledCount: 1 })
export class StylistProcessor
  extends WorkerHost
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(StylistProcessor.name);
  private timer?: ReturnType<typeof setInterval>;
  private sweeping = false;
  constructor(
    private readonly repo: StylistRepository,
    private readonly provider: StylistProvider,
    private readonly service: StylistService,
    private readonly storage: ImageStorageProvider,
    private readonly work?: WorkService,
  ) {
    super();
  }
  @OnWorkerEvent('error') onWorkerError() {
    this.logger.error('Stylist worker connection error');
  }
  onApplicationBootstrap() {
    this.timer = setInterval(() => {
      void this.sweep().catch(() =>
        this.logger.error('Stylist expiry sweep failed'),
      );
    }, 60000);
    this.timer.unref();
    void this.sweep().catch(() =>
      this.logger.error('Stylist expiry sweep failed'),
    );
  }
  onModuleDestroy() {
    clearInterval(this.timer);
  }
  async sweep() {
    if (this.sweeping) return;
    this.sweeping = true;
    try {
      for (const r of await this.repo.expired())
        await this.repo.fail(r.userId, r.id, 'INTERNAL_ERROR');
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
    const { userId, id } = payload.parse(job.data);
    const row = await this.repo.find(userId, id);
    if (!row || ['ready', 'failed'].includes(row.status)) return;
    try {
      if (
        row.deadlineAt <= new Date() ||
        row.startedAt ||
        row.provider !== this.provider.name ||
        row.model !== this.provider.model
      )
        throw new Error('Invalid stylist job state');
      const input = inputSchema.parse(row.input);
      if (!(await this.repo.begin(userId, id))) return;
      const profile = await this.repo.profile(userId);
      const liked = await this.repo.liked(userId);
      if (input.kind === 'advice') {
        const outfit = await this.repo.outfit(userId, input.outfitId);
        const context = {
          occasion: outfit.tryOnJob.occasion,
          profile,
          garments: snapshotSchema
            .parse(outfit.garmentSnapshot ?? [])
            .map((g) => ({ ...g, source: 'outfit_snapshot' })),
          liked,
        };
        const result = StylistAdvice.parse(
          await this.provider.advice(
            context,
            this.storage.url(outfit.filePath, 1024),
          ),
        );
        await this.service.finish(userId, id, result, 'advice');
      } else {
        const garments = await this.repo.candidates(
          userId,
          input.request.occasion,
        );
        const result = validateSuggestions(
          SuggestOutput.parse(
            await this.provider.suggest({
              occasion: input.request.occasion,
              profile,
              garments,
              liked,
            }),
          ),
          garments,
        );
        // Recheck ownership and deletion after the model call, not only before it.
        validateSuggestions(
          result,
          await this.repo.available(
            userId,
            result.outfits.flatMap((o) => o.garmentIds),
          ),
        );
        await this.service.finish(
          userId,
          id,
          {
            ...result,
            isMock: this.provider.name === 'fake',
            occasion: input.request.occasion,
          },
          'suggest',
        );
      }
    } catch {
      try {
        await this.repo.fail(userId, id, 'INTERNAL_ERROR');
      } catch {
        this.logger.error('Stylist failure status needs recovery');
      }
      throw new UnrecoverableError('Stylist processing failed');
    }
  }
}
