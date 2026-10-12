import { randomUUID } from 'node:crypto';
import { Job, UnrecoverableError } from 'bullmq';
import { TryOnProcessor } from './try-on.processor';
import { TryOnRepository } from './try-on.repository';
import { TryOnService } from './try-on.service';
import { TryOnProviderError } from './try-on.provider';
import { ImageStorageProvider } from '../uploads/image-storage.provider';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('Try-on worker transitions and replay protection', () => {
  const userId = randomUUID(),
    id = randomUUID();
  const repository = {
    find: jest.fn(),
    inputs: jest.fn(),
    begin: jest.fn(),
    retry: jest.fn(),
    checkpoint: jest.fn(),
    complete: jest.fn(),
    expired: jest.fn(),
  };
  const service = { fail: jest.fn() };
  const provider = {
    name: 'fake' as const,
    model: 'fake',
    generate: jest.fn(),
  };
  const storage = {
    url: jest.fn(() => 'https://images.example.com/signed'),
    saveResult: jest.fn(),
    delete: jest.fn(),
  };
  const processor = new TryOnProcessor(
    repository as unknown as TryOnRepository,
    service as unknown as TryOnService,
    provider,
    storage as unknown as ImageStorageProvider,
  );
  const job = {
    data: { userId, id },
    opts: { attempts: 3 },
    attemptsMade: 0,
  } as Job;
  const row = {
    id,
    userId,
    status: 'queued',
    provider: 'fake',
    imageModel: 'fake',
    modelPhotoId: randomUUID(),
    garmentIds: [randomUUID()],
    occasion: 'đi làm',
    generationStartedAt: null,
    resultFileId: null,
    deadlineAt: new Date(Date.now() + 60000),
  };
  beforeEach(() => {
    jest.resetAllMocks();
    repository.find.mockResolvedValue({ ...row, status: 'processing' });
    repository.inputs.mockResolvedValue({
      photo: { filePath: '/photo' },
      garments: [{ filePath: '/shirt' }],
    });
    repository.begin.mockResolvedValue(true);
    repository.checkpoint.mockResolvedValue(true);
    repository.expired.mockResolvedValue([]);
    provider.generate.mockResolvedValue(Buffer.from('image'));
    storage.url.mockReturnValue('https://images.example.com/signed');
    storage.saveResult.mockResolvedValue({
      fileId: 'result',
      filePath: '/result',
    });
  });
  it('generates once, checkpoints the file, and atomically finalizes an outfit', async () => {
    await processor.process(job);
    expect(repository.begin).toHaveBeenCalledWith(userId, id);
    expect(provider.generate).toHaveBeenCalledTimes(1);
    expect(repository.checkpoint).toHaveBeenCalledWith(userId, id, {
      fileId: 'result',
      filePath: '/result',
    });
    expect(repository.complete).toHaveBeenCalledWith(userId, id);
    expect(service.fail).not.toHaveBeenCalled();
  });
  it.each(['done', 'failed'])('skips terminal %s jobs', async (status) => {
    repository.find.mockResolvedValue({ ...row, status });
    await processor.process(job);
    expect(provider.generate).not.toHaveBeenCalled();
  });
  it('resumes a committed upload without a second AI call or upload', async () => {
    repository.find.mockResolvedValue({ ...row, resultFileId: 'existing' });
    await processor.process(job);
    expect(repository.complete).toHaveBeenCalledWith(userId, id);
    expect(provider.generate).not.toHaveBeenCalled();
    expect(storage.saveResult).not.toHaveBeenCalled();
  });
  it('does not repeat an ambiguous generation after a crash', async () => {
    repository.find.mockResolvedValue({
      ...row,
      generationStartedAt: new Date(),
    });
    await processor.process(job);
    expect(service.fail).toHaveBeenCalledWith(
      userId,
      id,
      'TRYON_PROVIDER_ERROR',
    );
    expect(provider.generate).not.toHaveBeenCalled();
  });
  it('retries safe transient failures but stops on the third attempt', async () => {
    provider.generate.mockRejectedValue(
      new TryOnProviderError('TRYON_PROVIDER_ERROR', true),
    );
    await expect(processor.process(job)).rejects.toThrow(
      'TRYON_PROVIDER_ERROR',
    );
    expect(repository.retry).toHaveBeenCalledTimes(1);
    expect(service.fail).not.toHaveBeenCalled();
    await expect(
      processor.process({ ...job, attemptsMade: 2 } as Job),
    ).rejects.toBeInstanceOf(UnrecoverableError);
    expect(service.fail).toHaveBeenCalledWith(
      userId,
      id,
      'TRYON_PROVIDER_ERROR',
    );
  });
  it('never retries content rejections and refunds through the failure hook', async () => {
    provider.generate.mockRejectedValue(
      new TryOnProviderError('TRYON_CONTENT_REJECTED'),
    );
    await expect(processor.process(job)).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(repository.retry).not.toHaveBeenCalled();
    expect(service.fail).toHaveBeenCalledWith(
      userId,
      id,
      'TRYON_CONTENT_REJECTED',
    );
  });
  it('fails expired jobs and sweeps abandoned jobs without AI', async () => {
    repository.find.mockResolvedValue({ ...row, deadlineAt: new Date(0) });
    await processor.process(job);
    expect(service.fail).toHaveBeenCalledWith(userId, id, 'TRYON_TIMEOUT');
    repository.expired.mockResolvedValue([{ id, userId }]);
    await processor.sweep();
    expect(service.fail).toHaveBeenCalledTimes(2);
    expect(provider.generate).not.toHaveBeenCalled();
  });
  it.each([
    new NotFoundException(),
    new BadRequestException({ code: 'TRYON_GARMENT_NOT_ALLOWED' }),
  ])('validates inputs again before generation', async (error) => {
    repository.inputs.mockRejectedValue(error);
    await expect(processor.process(job)).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(provider.generate).not.toHaveBeenCalled();
    expect(repository.begin).not.toHaveBeenCalled();
  });
  it('cleans output if a concurrent expiry prevents committing it', async () => {
    repository.checkpoint.mockResolvedValue(false);
    await processor.process(job);
    expect(storage.delete).toHaveBeenCalledWith('result');
    expect(repository.complete).not.toHaveBeenCalled();
  });
  it('sanitizes unknown errors instead of writing private URLs to Redis', async () => {
    provider.generate.mockRejectedValue(
      new Error('https://private.example/token=secret'),
    );
    await expect(processor.process(job)).rejects.toThrow(
      'TRYON_PROVIDER_ERROR',
    );
    expect(service.fail).toHaveBeenCalledWith(
      userId,
      id,
      'TRYON_PROVIDER_ERROR',
    );
  });
  it('sanitizes DB errors during checkpoint recovery too', async () => {
    repository.find.mockResolvedValue({ ...row, resultFileId: 'existing' });
    repository.complete.mockRejectedValue(
      new Error('postgresql://private:secret@host/db'),
    );
    await expect(processor.process(job)).rejects.toThrow(
      'Try-on processing failed',
    );
    expect(provider.generate).not.toHaveBeenCalled();
  });
  it('preserves an uploaded file when checkpoint committed but its receipt was lost', async () => {
    repository.checkpoint.mockRejectedValue(
      new Error('connection lost after commit'),
    );
    repository.find
      .mockResolvedValueOnce({ ...row, status: 'processing' })
      .mockResolvedValueOnce({ ...row, status: 'processing' })
      .mockResolvedValueOnce({
        ...row,
        status: 'processing',
        resultFileId: 'result',
      });
    await expect(processor.process(job)).rejects.toThrow(
      'Try-on processing failed',
    );
    expect(storage.delete).not.toHaveBeenCalled();
    expect(service.fail).not.toHaveBeenCalled();
    expect(provider.generate).toHaveBeenCalledTimes(1);
  });
});
