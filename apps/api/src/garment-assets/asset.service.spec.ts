import { randomUUID } from 'node:crypto';
import { Queue } from 'bullmq';
import { HttpException } from '@nestjs/common';
import { AssetService } from './asset.service';
import { AssetRepository } from './asset.repository';
import { FakeAssetProvider } from './fake-asset.provider';
import { RuntimeConfig } from '../config/runtime-config';
import { ImageStorageProvider } from '../uploads/image-storage.provider';
describe('Asset service gates, queue receipts and private PNG responses', () => {
  const userId = randomUUID(),
    id = randomUUID();
  const repo = {
    create: jest.fn(),
    usage: jest.fn(),
    find: jest.fn(),
    fail: jest.fn(),
    cancelQueued: jest.fn(),
    automatic: jest.fn(),
    deferred: jest.fn(),
  };
  const storage = { url: jest.fn(() => 'https://images.example.com/signed') };
  const queue = { add: jest.fn() };
  const config = {
    values: { ASSET_GENERATION_ENABLED: 'true', ASSET_GENERATION_USER_IDS: '' },
  } as RuntimeConfig;
  const service = new AssetService(
    repo as unknown as AssetRepository,
    new FakeAssetProvider(),
    storage as unknown as ImageStorageProvider,
    config,
    queue as unknown as Queue,
  );
  const input = {
    source: 'idea' as const,
    type: 'shirt' as const,
    prompt: 'áo trắng',
    bodyKey: 'm' as const,
  };
  const nodeEnv = process.env.NODE_ENV;
  beforeEach(() => {
    jest.resetAllMocks();
    config.values.ASSET_GENERATION_ENABLED = 'true';
    config.values.ASSET_GENERATION_USER_IDS = '';
    process.env.NODE_ENV = 'test';
    repo.create.mockResolvedValue([{ id, userId, status: 'queued' }]);
    queue.add.mockResolvedValue({});
    storage.url.mockReturnValue('https://images.example.com/signed');
  });
  afterAll(() => {
    process.env.NODE_ENV = nodeEnv;
  });
  it('blocks generation while feature is disabled or user is outside allowlist', async () => {
    config.values.ASSET_GENERATION_ENABLED = 'false';
    await expect(service.create(userId, 'key12345', [input])).rejects.toThrow();
    config.values.ASSET_GENERATION_ENABLED = 'true';
    config.values.ASSET_GENERATION_USER_IDS = randomUUID();
    await expect(service.create(userId, 'key12345', [input])).rejects.toThrow();
    expect(repo.create).not.toHaveBeenCalled();
  });
  it('requires an explicit allowlist in production', () => {
    process.env.NODE_ENV = 'production';
    expect(service.enabled(userId)).toBe(false);
    config.values.ASSET_GENERATION_USER_IDS = userId;
    expect(service.enabled(userId)).toBe(true);
  });
  it('enqueues only owned job IDs, with bounded retries and no prompt/private URLs', async () => {
    expect(await service.create(userId, 'key12345', [input])).toEqual({
      jobIds: [id],
    });
    expect(queue.add).toHaveBeenCalledWith(
      'asset',
      { id, userId },
      expect.objectContaining({ jobId: `asset-${id}`, attempts: 3 }),
    );
  });
  it('cancels all unstarted batch jobs when enqueue fails', async () => {
    const second = randomUUID();
    repo.create.mockResolvedValue([
      { id, userId, status: 'queued' },
      { id: second, userId, status: 'queued' },
    ]);
    queue.add.mockRejectedValue(new Error('private URL'));
    await expect(service.create(userId, 'key12345', [input])).rejects.toThrow();
    expect(repo.cancelQueued).toHaveBeenCalledWith(userId, [id, second]);
  });
  it('returns existing ready jobs without queueing a second AI call', async () => {
    repo.create.mockResolvedValue([{ id, userId, status: 'ready' }]);
    await service.create(userId, 'key12345', [input]);
    expect(queue.add).not.toHaveBeenCalled();
  });
  it('keeps a ready garment when automatic generation hits its daily cap', async () => {
    repo.automatic.mockResolvedValue({ assetBodyKey: 'm' });
    repo.create.mockRejectedValue(
      new HttpException({ code: 'ASSET_QUOTA_EXCEEDED' }, 429),
    );
    await service.auto(userId, id);
    expect(repo.deferred).toHaveBeenCalledWith(
      userId,
      id,
      'ASSET_QUOTA_EXCEEDED',
    );
  });
  it('serves signed PNG and a mock badge, never a JPG overlay', () => {
    const row = {
      status: 'ready',
      deletedAt: null,
      resultFilePath: '/private',
      bodyKey: 'm',
      provider: 'fake',
      renderMeta: { width: 1024, height: 1536, bounds: [64, 64, 896, 1408] },
    };
    expect(
      service.render(row as Parameters<AssetService['render']>[0])?.isMock,
    ).toBe(true);
    expect(storage.url).toHaveBeenCalledWith('/private', 1024, 'png');
    expect(storage.url).toHaveBeenCalledWith('/private', 400, 'png');
  });
});
