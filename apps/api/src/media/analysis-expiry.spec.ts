import { randomUUID } from 'node:crypto';
import { Job } from 'bullmq';
import { AnalysisProcessor } from './analysis.processor';
import { MediaRepository } from './media.repository';
import { VisionProvider } from './vision.provider';
import { ImageStorageProvider } from '../uploads/image-storage.provider';
it('stale analysis cannot start a paid call after its admission window expires', async () => {
  const id = randomUUID(),
    userId = randomUUID();
  const repo = {
    find: jest.fn().mockResolvedValue({
      status: 'pending',
      createdAt: new Date(Date.now() - 16 * 60000),
    }),
    fail: jest.fn().mockResolvedValue(undefined),
  };
  const vision = { modelPhoto: jest.fn() };
  const worker = new AnalysisProcessor(
    repo as unknown as MediaRepository,
    {} as ImageStorageProvider,
    vision as unknown as VisionProvider,
  );
  await worker.process({ data: { id, userId, kind: 'model-photo' } } as Job);
  expect(repo.fail).toHaveBeenCalledWith(
    'model-photo',
    userId,
    id,
    'MEDIA_PROCESSING_FAILED',
  );
  expect(vision.modelPhoto).not.toHaveBeenCalled();
});
