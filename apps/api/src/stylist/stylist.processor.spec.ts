import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';
import { StyleProfile, GarmentTags } from '@stylist/shared';
import { StylistProcessor } from './stylist.processor';
import { StylistRepository } from './stylist.repository';
import { StylistService } from './stylist.service';
import { FakeStylistProvider } from './fake-stylist.provider';
import { ImageStorageProvider } from '../uploads/image-storage.provider';
const profile = StyleProfile.parse({
  styles: [],
  occasions: [],
  budget: null,
  preferredColors: [],
  avoidedColors: [],
  bodyShape: null,
  skinTone: null,
  updatedAt: null,
});
describe('Stylist worker ownership, replay and optional advice', () => {
  const userId = randomUUID(),
    id = randomUUID(),
    outfitId = randomUUID();
  const repo = {
    find: jest.fn(),
    begin: jest.fn(),
    profile: jest.fn(),
    liked: jest.fn(),
    outfit: jest.fn(),
    candidates: jest.fn(),
    available: jest.fn(),
    fail: jest.fn(),
    expired: jest.fn(),
  };
  const provider = new FakeStylistProvider();
  const service = { finish: jest.fn() };
  const storage = { url: jest.fn() };
  const worker = new StylistProcessor(
    repo as unknown as StylistRepository,
    provider,
    service as unknown as StylistService,
    storage as unknown as ImageStorageProvider,
  );
  const row = {
    id,
    userId,
    status: 'queued',
    kind: 'advice',
    input: { kind: 'advice', outfitId },
    startedAt: null,
    provider: 'fake',
    model: 'fake',
    deadlineAt: new Date(Date.now() + 60000),
  };
  const job = { data: { userId, id } } as Job;
  beforeEach(() => {
    jest.resetAllMocks();
    repo.find.mockResolvedValue(row);
    repo.begin.mockResolvedValue(true);
    repo.profile.mockResolvedValue(profile);
    repo.liked.mockResolvedValue([]);
    repo.outfit.mockResolvedValue({
      filePath: '/private/outfit.png',
      garmentSnapshot: [],
      tryOnJob: { occasion: 'đi làm' },
    });
    storage.url.mockReturnValue('https://example.com/private');
    repo.expired.mockResolvedValue([]);
  });
  it('stores advice independently without altering the image result', async () => {
    await worker.process(job);
    expect(service.finish).toHaveBeenCalledWith(
      userId,
      id,
      expect.objectContaining({ summary: expect.any(String) as string }),
      'advice',
    );
    expect(repo.fail).not.toHaveBeenCalled();
  });
  it('does not replay a started model call after an uncertain crash', async () => {
    repo.find.mockResolvedValue({ ...row, startedAt: new Date() });
    await expect(worker.process(job)).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(service.finish).not.toHaveBeenCalled();
    expect(repo.fail).toHaveBeenCalledWith(userId, id, 'INTERNAL_ERROR');
  });
  it('a deleted outfit fails advice without resurrecting its image', async () => {
    repo.outfit.mockRejectedValue(new Error('private URL'));
    await expect(worker.process(job)).rejects.toThrow(
      'Stylist processing failed',
    );
    expect(service.finish).not.toHaveBeenCalled();
  });
  it('does not expose a private database error when failure recovery is also unavailable', async () => {
    const log = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    repo.outfit.mockRejectedValue(new Error('private image URL'));
    repo.fail.mockRejectedValue(new Error('private database credentials'));
    await expect(worker.process(job)).rejects.toThrow(
      'Stylist processing failed',
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain('credentials');
    log.mockRestore();
  });
  it('rechecks candidate ownership/deletion after the provider returns', async () => {
    const tags = GarmentTags.parse({
      category: 'top',
      type: 'shirt',
      slot: 'top',
      colors: ['white'],
      material: 'cotton',
      formality: 2,
      pattern: 'solid',
      fit: 'regular',
      length: 'regular',
      sleeve: 'long',
      neckline: null,
      rise: null,
      season: ['all'],
      occasions: ['casual'],
    });
    const top = { id: randomUUID(), tags, source: 'user_photo' },
      bottom = {
        id: randomUUID(),
        tags: GarmentTags.parse({
          ...tags,
          type: 'trousers',
          category: 'pants',
          slot: 'bottom',
        }),
        source: 'user_photo',
      };
    repo.find.mockResolvedValue({
      ...row,
      kind: 'suggest',
      input: { kind: 'suggest', request: { occasion: 'casual' } },
    });
    repo.candidates.mockResolvedValue([top, bottom]);
    repo.available.mockResolvedValue([top]);
    await expect(worker.process(job)).rejects.toThrow(
      'Stylist processing failed',
    );
    expect(service.finish).not.toHaveBeenCalled();
  });
  it('sweeps expired jobs without exposing provider exceptions', async () => {
    repo.expired.mockResolvedValue([{ userId, id }]);
    await worker.sweep();
    expect(repo.fail).toHaveBeenCalledWith(userId, id, 'INTERNAL_ERROR');
  });
});
