import { Job, UnrecoverableError } from 'bullmq';
import { EMBEDDING_DIMENSIONS } from '@stylist/shared';
import { AnalysisProcessor } from './analysis.processor';
import { MediaRepository } from './media.repository';
import { ImageStorageProvider } from '../uploads/image-storage.provider';

export const fixtureTags = {
  category: 'top',
  type: 'shirt',
  slot: 'top',
  colors: ['trắng'],
  material: 'cotton',
  formality: 3,
  pattern: 'solid',
  fit: 'regular',
  length: 'regular',
  sleeve: 'long',
  neckline: 'cổ bẻ',
  rise: null,
  season: ['all'],
  occasions: ['đi làm'],
};

describe('Analysis worker', () => {
  const data = {
    kind: 'garment',
    userId: '6aac5ae9-f260-44ec-9554-c7c608120028',
    id: '490f926b-6787-4a82-b3c0-bab6d038c058',
  };
  const repository = {
    find: jest.fn(),
    fail: jest.fn(),
    readyPhoto: jest.fn(),
    readyGarment: jest.fn(),
  };
  const storage = { url: jest.fn(() => 'https://images.example.com/private') };
  const vision = {
    garment: jest.fn(),
    modelPhoto: jest.fn(),
    embedding: jest.fn(),
  };
  const worker = new AnalysisProcessor(
    repository as unknown as MediaRepository,
    storage as unknown as ImageStorageProvider,
    vision,
  );
  const job = (kind = 'garment', attemptsMade = 0) =>
    ({ data: { ...data, kind }, attemptsMade, opts: { attempts: 2 } }) as Job;
  beforeEach(() => {
    jest.clearAllMocks();
    repository.find.mockResolvedValue({
      filePath: '/private',
      status: 'pending',
    });
    vision.garment.mockResolvedValue(fixtureTags);
    vision.embedding.mockResolvedValue(Array(EMBEDDING_DIMENSIONS).fill(0.1));
    vision.modelPhoto.mockResolvedValue({
      allowed: true,
      fullBody: true,
      personCount: 1,
      lightingAdequate: true,
      bodyShape: 'unknown',
      skinTone: 'unknown',
      notes: '',
    });
  });

  it('validates tags and embedding before marking ready', async () => {
    await worker.process(job());
    expect(repository.readyGarment).toHaveBeenCalledWith(
      data.userId,
      data.id,
      fixtureTags,
      expect.arrayContaining([0.1]),
    );
    expect(storage.url).toHaveBeenCalledWith('/private', 1024);
  });
  it('ignores jobs for deleted or already processed rows', async () => {
    repository.find.mockResolvedValue(null);
    await worker.process(job());
    repository.find.mockResolvedValue({ status: 'ready' });
    await worker.process(job());
    expect(vision.garment).not.toHaveBeenCalled();
  });
  it('marks malformed output failed without retrying or leaking provider data', async () => {
    vision.garment.mockResolvedValue({ ...fixtureTags, slot: 'bag' });
    await expect(worker.process(job())).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(repository.fail).toHaveBeenCalledWith(
      'garment',
      data.userId,
      data.id,
      'MEDIA_PROCESSING_FAILED',
    );
    expect(vision.embedding).not.toHaveBeenCalled();
  });
  it('rejects wrong embedding dimensions', async () => {
    vision.embedding.mockResolvedValue([1]);
    await expect(worker.process(job())).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(repository.readyGarment).not.toHaveBeenCalled();
  });
  it.each([
    [{ allowed: false }, 'PHOTO_NOT_ALLOWED'],
    [{ personCount: 2 }, 'PHOTO_MULTIPLE_PEOPLE'],
    [{ fullBody: false }, 'PHOTO_NOT_FULL_BODY'],
    [{ lightingAdequate: false }, 'PHOTO_NOT_USABLE'],
  ])('records unusable photo error %s', async (patch, code) => {
    vision.modelPhoto.mockResolvedValue({
      allowed: true,
      fullBody: true,
      personCount: 1,
      lightingAdequate: true,
      bodyShape: 'unknown',
      skinTone: 'unknown',
      notes: '',
      ...patch,
    });
    await worker.process(job('model-photo'));
    expect(repository.fail).toHaveBeenCalledWith(
      'model-photo',
      data.userId,
      data.id,
      code,
    );
    expect(repository.readyPhoto).not.toHaveBeenCalled();
  });
  it('retries temporary failures and records failure only on the last attempt', async () => {
    vision.garment.mockRejectedValue(new Error('private signed URL and token'));
    await expect(worker.process(job())).rejects.toThrow(
      'Media analysis failed',
    );
    expect(repository.fail).not.toHaveBeenCalled();
    await expect(worker.process(job('garment', 1))).rejects.toThrow(
      'Media analysis failed',
    );
    expect(repository.fail).toHaveBeenCalledTimes(1);
  });
});
