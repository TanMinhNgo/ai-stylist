import { randomUUID } from 'node:crypto';
import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { StylistRepository } from './stylist.repository';
import { StylistService } from './stylist.service';
import { FakeStylistProvider } from './fake-stylist.provider';
import { ImageStorageProvider } from '../uploads/image-storage.provider';
describe('Stylist scheduling and image preservation', () => {
  const userId = randomUUID(),
    id = randomUUID();
  const repo = {
    create: jest.fn(),
    fail: jest.fn(),
    prepareDelete: jest.fn(),
    find: jest.fn(),
    available: jest.fn(),
  };
  const queue = { add: jest.fn() };
  const storage = { delete: jest.fn() };
  const service = new StylistService(
    repo as unknown as StylistRepository,
    new FakeStylistProvider(),
    storage as unknown as ImageStorageProvider,
    queue as unknown as Queue,
  );
  beforeEach(() => {
    jest.resetAllMocks();
    repo.create.mockResolvedValue({ id, status: 'queued' });
    queue.add.mockResolvedValue({});
  });
  it('queues IDs only with one attempt and a deterministic job id', async () => {
    await expect(
      service.create(userId, 'key12345', { kind: 'advice', outfitId: id }),
    ).resolves.toEqual({ jobId: id });
    expect(queue.add).toHaveBeenCalledWith(
      'stylist',
      { userId, id },
      expect.objectContaining({ jobId: `stylist-${id}`, attempts: 1 }),
    );
  });
  it('does not enqueue ready idempotent requests again', async () => {
    repo.create.mockResolvedValue({ id, status: 'ready' });
    await service.create(userId, 'key12345', {
      kind: 'suggest',
      request: { occasion: 'casual' },
    });
    expect(queue.add).not.toHaveBeenCalled();
  });
  it('never returns deleted garments from a previously ready suggestion', async () => {
    const garmentId = randomUUID();
    repo.find.mockResolvedValue({
      id,
      userId,
      kind: 'suggest',
      status: 'ready',
      outfitId: null,
      errorCode: null,
      provider: 'fake',
      createdAt: new Date(),
      result: {
        occasion: 'casual',
        isMock: true,
        outfits: [{ garmentIds: [garmentId], reason: 'x' }],
        message: 'x',
      },
    });
    repo.available.mockResolvedValue([]);
    const result = await service.getJob(userId, id);
    expect(result.result?.outfits).toEqual([]);
    expect(result.result?.message).toContain('không còn');
  });
  it('an enqueue failure marks advice failed but never deletes the try-on image', async () => {
    queue.add.mockRejectedValue(new Error('private connection'));
    await expect(
      service.create(userId, 'key12345', { kind: 'advice', outfitId: id }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(repo.fail).toHaveBeenCalledWith(userId, id, 'INTERNAL_ERROR');
    expect(storage.delete).not.toHaveBeenCalled();
  });
  it('automatic advice errors are contained so try-on remains usable', async () => {
    const log = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    queue.add.mockRejectedValue(new Error('private URL'));
    await expect(service.auto(userId, id)).resolves.toBeUndefined();
    expect(JSON.stringify(log.mock.calls)).not.toContain('private URL');
    log.mockRestore();
  });
  it('tombstones before deleting files and leaves metadata to retry a failed cleanup', async () => {
    repo.prepareDelete.mockResolvedValue('private-file');
    storage.delete.mockRejectedValue(new Error('storage unavailable'));
    await expect(service.remove(userId, id)).rejects.toThrow();
    expect(repo.prepareDelete.mock.invocationCallOrder[0]).toBeLessThan(
      storage.delete.mock.invocationCallOrder[0],
    );
  });
});
