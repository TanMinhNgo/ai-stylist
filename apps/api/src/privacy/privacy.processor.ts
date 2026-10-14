import {
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { Processor, OnWorkerEvent, WorkerHost } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';
import { z } from 'zod';
import { PrivacyService } from './privacy.service';
const payload = z.strictObject({ id: z.uuid(), userId: z.uuid() });
@Processor('privacy', { concurrency: 1 })
export class PrivacyProcessor
  extends WorkerHost
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(PrivacyProcessor.name);
  private timer?: ReturnType<typeof setInterval>;
  private sweeping = false;
  constructor(private readonly privacy: PrivacyService) {
    super();
  }
  @OnWorkerEvent('error') onWorkerError() {
    this.logger.error('Privacy worker connection error');
  }
  onApplicationBootstrap() {
    const run = () => {
      void this.sweep().catch(() =>
        this.logger.error('Privacy recovery failed'),
      );
    };
    this.timer = setInterval(run, 60000);
    this.timer.unref();
    run();
  }
  onModuleDestroy() {
    clearInterval(this.timer);
  }
  async sweep() {
    if (this.sweeping) return;
    this.sweeping = true;
    try {
      for (const row of await this.privacy.due())
        await this.privacy.enqueue(row.id, row.userId);
    } finally {
      this.sweeping = false;
    }
  }
  async process(job: Job) {
    const parsed = payload.safeParse(job.data);
    if (!parsed.success) throw new UnrecoverableError('Invalid deletion job');
    try {
      await this.privacy.purge(parsed.data.id, parsed.data.userId);
    } catch {
      throw new Error('Account deletion deferred');
    }
  }
}
