import { randomUUID, createHash } from 'node:crypto';
import { SharingRepository } from './sharing.repository';
import { PublicShareGuard } from './public-share.guard';
import { RedisService } from '../queue/redis.service';
import { PrismaService } from '../database/prisma.service';
import { JobLimitsService } from '../usage/job-limits.service';
import { ImageStorageProvider } from '../uploads/image-storage.provider';

describe('capability sharing ownership and revocation', () => {
  const userId = randomUUID(),
    collectionId = randomUUID(),
    outfitId = randomUUID();
  const lookbookShare = {
    create: jest.fn<
      unknown,
      [{ data: { tokenHash: string; title: string } }]
    >(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    deleteMany: jest.fn(),
  };
  const outfitCollection = { findFirst: jest.fn() },
    garment = { findMany: jest.fn() };
  const tx = { lookbookShare, outfitCollection, garment },
    lock = jest.fn(),
    url = jest.fn().mockReturnValue('https://images.example/short-signed');
  const db = { ...tx, $transaction: (fn: (tx: unknown) => unknown) => fn(tx) };
  const repo = new SharingRepository(
    db as unknown as PrismaService,
    { lock } as unknown as JobLimitsService,
    { url } as unknown as ImageStorageProvider,
  );
  beforeEach(() => {
    jest.clearAllMocks();
    lock.mockResolvedValue(undefined);
    lookbookShare.count.mockResolvedValue(0);
  });
  it('validates selected collection membership, stores only a hashed random capability and enforces cap/tombstones', async () => {
    outfitCollection.findFirst.mockResolvedValue(null);
    const body = { outfitIds: [outfitId], expiresInHours: 24 };
    await expect(repo.create(userId, collectionId, body)).rejects.toMatchObject(
      { status: 404 },
    );
    expect(lookbookShare.create).not.toHaveBeenCalled();
    outfitCollection.findFirst.mockResolvedValue({
      name: 'Chosen title',
      items: [{ outfitId }],
    });
    lookbookShare.create.mockImplementation(({ data }: { data: object }) => ({
      ...data,
      id: randomUUID(),
      createdAt: new Date(),
    }));
    const created = await repo.create(userId, collectionId, body);
    const call = lookbookShare.create.mock.calls[0][0];
    expect(created.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(call.data.tokenHash).toBe(
      createHash('sha256').update(created.token).digest('hex'),
    );
    expect(JSON.stringify(call.data)).not.toContain(created.token);
    expect(call.data.title).toBe('Chosen title');
    expect(outfitCollection.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: collectionId, userId } }),
    );
    lookbookShare.count.mockResolvedValue(20);
    await expect(repo.create(userId, collectionId, body)).rejects.toMatchObject(
      { status: 429 },
    );
    lock.mockRejectedValueOnce(new Error('tombstone'));
    await expect(repo.create(userId, collectionId, body)).rejects.toThrow(
      'tombstone',
    );
  });
  it('public view excludes unselected/removed/unready outfits and all identity, advice and file metadata', async () => {
    const garmentId = randomUUID();
    const row = {
      userId,
      title: 'Chosen',
      expiresAt: new Date(Date.now() + 3600000),
      outfitIds: [outfitId],
      collection: {
        items: [
          {
            outfitId,
            outfit: {
              filePath: '/private/result.png',
              tryOnJob: { garmentIds: [garmentId] },
            },
          },
          {
            outfitId: randomUUID(),
            outfit: {
              filePath: '/new-not-shared.png',
              tryOnJob: { garmentIds: [garmentId] },
            },
          },
        ],
      },
    };
    lookbookShare.findFirst.mockResolvedValue(row);
    garment.findMany.mockResolvedValue([{ id: garmentId }]);
    const result = await repo.publicView('x'.repeat(43));
    expect(result.outfits).toEqual([
      { imageUrl: 'https://images.example/short-signed' },
    ]);
    expect(url).toHaveBeenCalledWith(
      '/private/result.png',
      1200,
      'jpg',
      expect.any(Number),
    );
    expect(url).toHaveBeenCalledWith('/private/result.png', 1200, 'jpg', 60);
    expect(JSON.stringify(result)).not.toContain(userId);
    expect(lookbookShare.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          collection: { user: { deletedAt: null } },
        }) as unknown,
      }),
    );
    garment.findMany.mockResolvedValue([]);
    expect((await repo.publicView('x'.repeat(43))).outfits).toEqual([]);
    lookbookShare.findFirst.mockResolvedValue(null);
    await expect(repo.publicView('x'.repeat(43))).rejects.toMatchObject({
      status: 404,
    });
    await repo.remove(userId, outfitId);
    expect(lookbookShare.deleteMany).toHaveBeenLastCalledWith({
      where: { id: outfitId, userId },
    });
  });
});
it('public sharing has one bounded anonymous counter, fails closed and returns a retry time', async () => {
  const evalCommand = jest.fn().mockResolvedValue([601, 5000]);
  const guard = new PublicShareGuard({
    client: { eval: evalCommand },
  } as unknown as RedisService);
  await expect(guard.canActivate()).rejects.toMatchObject({
    status: 429,
    response: { details: { retryAfterSeconds: 5 } },
  });
  expect(evalCommand).toHaveBeenCalledWith(
    expect.any(String),
    1,
    'stylist:public-share-rate',
  );
  evalCommand.mockResolvedValue([1, 60000]);
  expect(await guard.canActivate()).toBe(true);
  evalCommand.mockRejectedValue(new Error('Redis down'));
  await expect(guard.canActivate()).rejects.toMatchObject({ status: 503 });
});
