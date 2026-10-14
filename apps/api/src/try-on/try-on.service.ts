import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CreateTryOnRequest, TryOnJobResponse } from '@stylist/shared';
import { TryOnRepository } from './try-on.repository';
import { TryOnProvider } from './try-on.provider';
import { ImageStorageProvider } from '../uploads/image-storage.provider';

@Injectable()
export class TryOnService {
  private readonly logger = new Logger(TryOnService.name);
  constructor(
    private readonly repository: TryOnRepository,
    private readonly provider: TryOnProvider,
    private readonly storage: ImageStorageProvider,
    @InjectQueue('try-on') private readonly queue: Queue,
  ) {}
  async create(userId: string, key: string, input: CreateTryOnRequest) {
    const row = await this.repository.create(
      userId,
      key,
      input,
      this.provider.name,
      this.provider.model,
    );
    if (row.status === 'queued') {
      try {
        await this.queue.add(
          'generate',
          { id: row.id, userId },
          {
            jobId: row.id,
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: 100,
            removeOnFail: 100,
          },
        );
      } catch {
        await this.fail(userId, row.id, 'TRYON_PROVIDER_ERROR');
        throw new ServiceUnavailableException();
      }
    }
    return { jobId: row.id };
  }
  async get(userId: string, id: string) {
    let row = await this.repository.find(userId, id);
    if (!row) throw new NotFoundException();
    if (
      ['queued', 'processing'].includes(row.status) &&
      row.deadlineAt <= new Date()
    ) {
      await this.fail(userId, id, 'TRYON_TIMEOUT');
      row = await this.repository.find(userId, id);
      if (!row) throw new NotFoundException();
    }
    const visible = row.status === 'done' && !row.outfit?.deletedAt;
    return TryOnJobResponse.parse({
      id: row.id,
      status: row.status,
      provider: row.provider,
      createdAt: row.createdAt.toISOString(),
      errorCode: row.errorCode,
      resultUrl:
        visible && row.resultFilePath
          ? this.storage.url(row.resultFilePath, 1600)
          : null,
      outfitId: visible ? (row.outfit?.id ?? null) : null,
    });
  }
  async fail(userId: string, id: string, code: string) {
    const row = await this.repository.fail(userId, id, code);
    if (row?.resultFileId) {
      try {
        await this.storage.delete(row.resultFileId);
      } catch {
        this.logger.error('Failed try-on result cleanup needs retry');
      }
    }
  }
}
