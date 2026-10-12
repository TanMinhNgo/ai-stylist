import { randomUUID } from 'node:crypto';
import { Queue } from 'bullmq';
import { TryOnService } from './try-on.service';
import { TryOnRepository } from './try-on.repository';
import { ImageStorageProvider } from '../uploads/image-storage.provider';
import { FakeTryOnProvider } from './fake-try-on.provider';

describe('Try-on service', () => {
  const id = randomUUID(),
    userId = randomUUID();
  const repository = { create: jest.fn(), find: jest.fn(), fail: jest.fn() };
  const queue = { add: jest.fn() };
  const storage = {
    url: jest.fn(() => 'https://images.example.com/signed'),
    delete: jest.fn(),
  };
  const service = new TryOnService(
    repository as unknown as TryOnRepository,
    new FakeTryOnProvider(),
    storage as unknown as ImageStorageProvider,
    queue as unknown as Queue,
  );
  const input = {
    modelPhotoId: randomUUID(),
    garmentIds: [randomUUID()],
    occasion: 'đi làm',
  };
  beforeEach(() => {
    jest.clearAllMocks();
    repository.create.mockResolvedValue({ id, status: 'queued' });
    repository.fail.mockResolvedValue(null);
    queue.add.mockResolvedValue({});
  });
  it('enqueues only IDs with deterministic jobId and bounded retries', async () => {
    expect(await service.create(userId, 'key12345', input)).toEqual({
      jobId: id,
    });
    expect(repository.create).toHaveBeenCalledWith(
      userId,
      'key12345',
      input,
      'fake',
      'fake',
    );
    expect(queue.add).toHaveBeenCalledWith(
      'generate',
      { id, userId },
      expect.objectContaining({ jobId: id, attempts: 3 }),
    );
  });
  it('returns an existing completed job without enqueueing it again', async () => {
    repository.create.mockResolvedValue({ id, status: 'done' });
    await service.create(userId, 'key12345', input);
    expect(queue.add).not.toHaveBeenCalled();
  });
  it('marks enqueue failure and refunds before returning 503', async () => {
    queue.add.mockRejectedValue(new Error('private Redis URL'));
    await expect(service.create(userId, 'key12345', input)).rejects.toThrow();
    expect(repository.fail).toHaveBeenCalledWith(
      userId,
      id,
      'TRYON_PROVIDER_ERROR',
    );
  });
  it('hides resources belonging to another user', async () => {
    repository.find.mockResolvedValue(null);
    await expect(service.get(userId, id)).rejects.toThrow('Not Found');
    expect(storage.url).not.toHaveBeenCalled();
  });
  it('returns fresh signed result and outfit ID only when done', async () => {
    repository.find.mockResolvedValue({
      id,
      status: 'done',
      provider: 'fake',
      createdAt: new Date(),
      errorCode: null,
      resultFilePath: '/private',
      outfit: { id },
      deadlineAt: new Date(),
    });
    expect(await service.get(userId, id)).toEqual(
      expect.objectContaining({
        resultUrl: 'https://images.example.com/signed',
        outfitId: id,
        provider: 'fake',
      }),
    );
  });
  it('fails overdue jobs during polling even if the worker is offline', async () => {
    const row = {
      id,
      status: 'processing',
      provider: 'fake',
      createdAt: new Date(),
      errorCode: null,
      resultFilePath: null,
      outfit: null,
      deadlineAt: new Date(0),
    };
    repository.find.mockResolvedValueOnce(row).mockResolvedValueOnce({
      ...row,
      status: 'failed',
      errorCode: 'TRYON_TIMEOUT',
    });
    expect((await service.get(userId, id)).status).toBe('failed');
    expect(repository.fail).toHaveBeenCalledWith(userId, id, 'TRYON_TIMEOUT');
  });
});
