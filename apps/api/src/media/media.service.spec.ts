import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import { MediaService } from './media.service';
import { MediaRepository } from './media.repository';

describe('Media registration and ownership', () => {
  const userId = '6aac5ae9-f260-44ec-9554-c7c608120028';
  const id = '490f926b-6787-4a82-b3c0-bab6d038c058';
  const token = 'c582a2a0-9786-47b4-91a7-733d0f860e47';
  const input = {
    imagekitFileId: 'file_fixture',
    url: 'https://images.example.com/photo.jpg',
    uploadToken: token,
  };
  const folder = `/stylist/${userId}/${token}`;
  const repository = {
    grant: jest.fn(),
    createGrant: jest.fn(),
    register: jest.fn(),
    fail: jest.fn(),
    find: jest.fn(),
    list: jest.fn(),
    remove: jest.fn(),
  };
  const storage = {
    authentication: jest.fn(),
    get: jest.fn(),
    url: jest.fn(),
    delete: jest.fn(),
  };
  const queue = { add: jest.fn() };
  const service = new MediaService(
    repository as unknown as MediaRepository,
    storage,
    queue as unknown as Queue,
  );
  const row = {
    id,
    userId,
    imagekitFileId: input.imagekitFileId,
    filePath: `${folder}/photo.jpg`,
    status: 'pending',
    errorCode: null,
    createdAt: new Date('2026-10-12T00:00:00Z'),
    tags: null,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    repository.grant.mockResolvedValue({
      token,
      userId,
      folder,
      usedAt: null,
      expiresAt: new Date(Date.now() + 60000),
    });
    repository.register.mockResolvedValue(row);
    storage.get.mockResolvedValue({
      fileId: input.imagekitFileId,
      filePath: row.filePath,
      url: input.url,
      isPrivate: true,
      fileType: 'image',
      size: 1000,
    });
    storage.url.mockReturnValue(
      'https://images.example.com/private-signed.jpg?ik-s=test',
    );
  });

  it('registers a verified private image and enqueues IDs without image URLs', async () => {
    const result = await service.create('garment', userId, input);
    expect(result.status).toBe('pending');
    expect(result.url).toContain('ik-s=');
    expect(queue.add).toHaveBeenCalledWith(
      'garment',
      { kind: 'garment', userId, id },
      expect.objectContaining({ attempts: 2 }),
    );
    expect(JSON.stringify(queue.add.mock.calls)).not.toContain(input.url);
  });

  it('rejects another user grant before fetching the file', async () => {
    repository.grant.mockResolvedValue(null);
    await expect(
      service.create('garment', userId, input),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(storage.get).not.toHaveBeenCalled();
  });

  it.each([{ usedAt: new Date() }, { expiresAt: new Date(0) }])(
    'rejects used/expired grants %p',
    async (patch) => {
      repository.grant.mockResolvedValue({
        folder,
        usedAt: null,
        expiresAt: new Date(Date.now() + 60000),
        ...patch,
      });
      await expect(
        service.create('model-photo', userId, input),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(storage.get).not.toHaveBeenCalled();
    },
  );

  it.each([
    { filePath: '/another-user/photo.jpg' },
    { isPrivate: false },
    { fileType: 'video' },
    { size: 11 * 1024 * 1024 },
    { url: 'https://attacker.example.com/photo.jpg' },
    { fileId: 'other-file' },
  ])('rejects untrusted upload metadata %p', async (patch) => {
    storage.get.mockResolvedValue({
      fileId: input.imagekitFileId,
      filePath: row.filePath,
      url: input.url,
      isPrivate: true,
      fileType: 'image',
      size: 1000,
      ...patch,
    });
    await expect(
      service.create('garment', userId, input),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.register).not.toHaveBeenCalled();
  });

  it('preserves a failed row when queue submission fails', async () => {
    queue.add.mockRejectedValue(new Error('Redis unavailable'));
    await expect(
      service.create('garment', userId, input),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(repository.fail).toHaveBeenCalledWith(
      'garment',
      userId,
      id,
      'MEDIA_PROCESSING_FAILED',
    );
  });

  it('cannot read or delete another user resource', async () => {
    repository.find.mockResolvedValue(null);
    await expect(service.get('garment', userId, id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.remove('model-photo', userId, id),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('does not delete the DB row if storage deletion fails', async () => {
    repository.find.mockResolvedValue(row);
    storage.delete.mockRejectedValue(new Error('storage unavailable'));
    await expect(service.remove('garment', userId, id)).rejects.toThrow();
    expect(repository.remove).not.toHaveBeenCalled();
  });

  it('returns a bounded page with nextCursor and fresh signed URLs', async () => {
    repository.list.mockResolvedValue([row, { ...row, id: token }]);
    const page = await service.list('garment', userId, { limit: 1 });
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBe(id);
  });
});
