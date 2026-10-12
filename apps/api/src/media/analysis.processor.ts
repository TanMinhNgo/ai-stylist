import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';
import { z } from 'zod';
import {
  GarmentTags,
  ModelPhotoAnalysis,
  EMBEDDING_DIMENSIONS,
} from '@stylist/shared';
import { MediaRepository } from './media.repository';
import { ImageStorageProvider } from '../uploads/image-storage.provider';
import { VisionProvider } from './vision.provider';
import { AssetService } from '../garment-assets/asset.service';

const payload = z.strictObject({
  kind: z.enum(['model-photo', 'garment']),
  userId: z.uuid(),
  id: z.uuid(),
});

@Processor('analysis', { concurrency: 2 })
export class AnalysisProcessor extends WorkerHost {
  constructor(
    private readonly repository: MediaRepository,
    private readonly storage: ImageStorageProvider,
    private readonly vision: VisionProvider,
    private readonly assets?: AssetService,
  ) {
    super();
  }

  async process(job: Job) {
    const { kind, userId, id } = payload.parse(job.data);
    const row = await this.repository.find(kind, userId, id);
    if (!row || row.status !== 'pending') return;
    try {
      const url = this.storage.url(row.filePath, 1024);
      if (kind === 'model-photo') {
        const analysis = ModelPhotoAnalysis.parse(
          await this.vision.modelPhoto(url),
        );
        const rejection = !analysis.allowed
          ? 'PHOTO_NOT_ALLOWED'
          : analysis.personCount !== 1
            ? 'PHOTO_MULTIPLE_PEOPLE'
            : !analysis.fullBody
              ? 'PHOTO_NOT_FULL_BODY'
              : !analysis.lightingAdequate
                ? 'PHOTO_NOT_USABLE'
                : null;
        if (rejection) {
          await this.repository.fail(kind, userId, id, rejection);
          return;
        }
        await this.repository.readyPhoto(userId, id, analysis);
      } else {
        const tags = GarmentTags.parse(await this.vision.garment(url));
        const embedding = z
          .array(z.number().finite())
          .length(EMBEDDING_DIMENSIONS)
          .parse(await this.vision.embedding(JSON.stringify(tags)));
        await this.repository.readyGarment(userId, id, tags, embedding);
        await this.assets?.auto(userId, id);
      }
    } catch (error) {
      const invalid = error instanceof z.ZodError;
      if (invalid || job.attemptsMade + 1 >= (job.opts.attempts ?? 1)) {
        await this.repository.fail(kind, userId, id, 'MEDIA_PROCESSING_FAILED');
      }
      // Never put provider messages or private URLs into Redis job errors.
      if (invalid) throw new UnrecoverableError('Invalid analysis output');
      throw new Error('Media analysis failed');
    }
  }
}
