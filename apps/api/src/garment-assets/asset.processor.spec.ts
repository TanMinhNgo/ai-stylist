import { randomUUID } from 'node:crypto';
import { Job, UnrecoverableError } from 'bullmq';
import { AssetProcessor } from './asset.processor';
import { AssetRepository } from './asset.repository';
import { AssetProviderError } from './asset.provider';
import { AssetService } from './asset.service';
import { ImageStorageProvider } from '../uploads/image-storage.provider';
import { VisionProvider } from '../media/vision.provider';
import { EMBEDDING_DIMENSIONS } from '@stylist/shared';
describe('Asset worker replay, failures and deletion race', () => {
  const userId = randomUUID(),
    id = randomUUID();
  const tags = {
    category: 'top',
    type: 'shirt',
    slot: 'top',
    colors: ['white'],
    material: 'cotton',
    formality: 3,
    pattern: 'solid',
    fit: 'regular',
    length: 'regular',
    sleeve: 'long',
    neckline: 'collar',
    rise: null,
    season: ['all'],
    occasions: ['work'],
  };
  const repo = {
    find: jest.fn(),
    begin: jest.fn(),
    checkpoint: jest.fn(),
    complete: jest.fn(),
    fail: jest.fn(),
    retry: jest.fn(),
    readyPlan: jest.fn(),
    expired: jest.fn(),
  };
  const provider = {
    name: 'fake' as const,
    model: 'fake',
    generate: jest.fn(),
    checkPhoto: jest.fn(),
    plan: jest.fn(),
  };
  const image = { normalize: jest.fn() },
    storage = {
      url: jest.fn(() => 'https://images.example.com/signed'),
      saveResult: jest.fn(),
      delete: jest.fn(),
    },
    vision = { garment: jest.fn(), embedding: jest.fn() },
    service = { enabled: () => true };
  const processor = new AssetProcessor(
    repo as unknown as AssetRepository,
    provider,
    image,
    storage as unknown as ImageStorageProvider,
    vision as unknown as VisionProvider,
    service as unknown as AssetService,
  );
  const input = {
    source: 'idea',
    type: 'shirt',
    prompt: 'áo trắng',
    bodyKey: 'm',
  };
  const row = {
    id,
    userId,
    status: 'processing',
    input,
    kind: 'idea',
    provider: 'fake',
    imageModel: 'fake',
    deadlineAt: new Date(Date.now() + 60000),
    generationStartedAt: null,
    resultFileId: null,
    resultFilePath: null,
    garment: null,
  };
  const job = {
    data: { userId, id },
    opts: { attempts: 3 },
    attemptsMade: 0,
  } as Job;
  beforeEach(() => {
    jest.resetAllMocks();
    repo.find.mockResolvedValue(row);
    repo.begin.mockResolvedValue(true);
    repo.checkpoint.mockResolvedValue(true);
    repo.expired.mockResolvedValue([]);
    repo.find
      .mockResolvedValueOnce(row)
      .mockResolvedValueOnce({ ...row, generationStartedAt: new Date() })
      .mockResolvedValue({
        ...row,
        generationStartedAt: new Date(),
        resultFileId: 'result',
        resultFilePath: '/result',
      });
    provider.generate.mockResolvedValue(Buffer.from('image'));
    image.normalize.mockResolvedValue({
      image: Buffer.from('normalized'),
      meta: { width: 1024, height: 1536, bounds: [64, 64, 896, 1408] },
    });
    storage.saveResult.mockResolvedValue({
      fileId: 'result',
      filePath: '/result',
    });
    storage.url.mockReturnValue('https://images.example.com/signed');
    vision.garment.mockResolvedValue(tags);
    vision.embedding.mockResolvedValue(Array(EMBEDDING_DIMENSIONS).fill(0.1));
  });
  it('creates a concept with image checkpoint and tag/embedding once', async () => {
    await processor.process(job);
    expect(provider.generate).toHaveBeenCalledTimes(1);
    expect(repo.complete).toHaveBeenCalledWith(
      userId,
      id,
      tags,
      Array(EMBEDDING_DIMENSIONS).fill(0.1),
    );
  });
  it('resumes a checkpoint without generating or uploading another image', async () => {
    repo.find.mockReset().mockResolvedValue({
      ...row,
      resultFileId: 'result',
      resultFilePath: '/result',
      generationStartedAt: new Date(),
    });
    await processor.process(job);
    expect(provider.generate).not.toHaveBeenCalled();
    expect(storage.saveResult).not.toHaveBeenCalled();
  });
  it('does not replay an ambiguous image call after a worker crash', async () => {
    repo.find
      .mockReset()
      .mockResolvedValue({ ...row, generationStartedAt: new Date() });
    await expect(processor.process(job)).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(provider.generate).not.toHaveBeenCalled();
    expect(repo.fail).toHaveBeenCalledWith(
      userId,
      id,
      'ASSET_PROVIDER_ERROR',
      false,
    );
  });
  it('refunds confirmed pre-generation failures but preserves the original garment', async () => {
    repo.find.mockReset().mockResolvedValue({
      ...row,
      kind: 'photo',
      input: { source: 'photo', garmentId: randomUUID(), bodyKey: 'm' },
      garment: {
        status: 'ready',
        deletingAt: null,
        tags,
        filePath: '/original',
      },
    });
    provider.checkPhoto.mockRejectedValue(
      new AssetProviderError('ASSET_INPUT_INVALID', true),
    );
    await expect(processor.process(job)).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(repo.fail).toHaveBeenCalledWith(
      userId,
      id,
      'ASSET_INPUT_INVALID',
      true,
    );
    expect(provider.generate).not.toHaveBeenCalled();
  });
  it('retries only safe failures then releases a confirmed unused reservation', async () => {
    repo.find.mockReset().mockResolvedValue(row);
    provider.generate.mockRejectedValue(
      new AssetProviderError('ASSET_PROVIDER_ERROR', true, true),
    );
    await expect(processor.process(job)).rejects.toThrow(
      'ASSET_PROVIDER_ERROR',
    );
    expect(repo.retry).toHaveBeenCalledWith(userId, id);
    expect(repo.fail).not.toHaveBeenCalled();
    await expect(
      processor.process({ ...job, attemptsMade: 2 } as Job),
    ).rejects.toBeInstanceOf(UnrecoverableError);
    expect(repo.fail).toHaveBeenCalledWith(
      userId,
      id,
      'ASSET_PROVIDER_ERROR',
      true,
    );
  });
  it('cannot resurrect a garment deleted while generation was running', async () => {
    repo.find
      .mockReset()
      .mockResolvedValueOnce(row)
      .mockResolvedValueOnce(null);
    await processor.process(job);
    expect(storage.saveResult).not.toHaveBeenCalled();
    expect(repo.complete).not.toHaveBeenCalled();
  });
  it('preserves a file when checkpoint committed but its response was lost', async () => {
    repo.checkpoint.mockRejectedValue(new Error('private checkpoint error'));
    await expect(processor.process(job)).rejects.toThrow(
      'Asset processing failed',
    );
    expect(storage.delete).not.toHaveBeenCalled();
    expect(provider.generate).toHaveBeenCalledTimes(1);
  });
  it('skips terminal jobs and expires queued reservations without AI', async () => {
    repo.find.mockReset().mockResolvedValue({ ...row, status: 'ready' });
    await processor.process(job);
    expect(provider.generate).not.toHaveBeenCalled();
    repo.expired.mockResolvedValue([
      { id, userId, kind: 'idea', generationStartedAt: null },
    ]);
    await processor.sweep();
    expect(repo.fail).toHaveBeenCalledWith(userId, id, 'ASSET_TIMEOUT', true);
  });
});
