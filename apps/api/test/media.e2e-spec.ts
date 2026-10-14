import { StylistProcessor } from '../src/stylist/stylist.processor';
import { AssetProcessor } from '../src/garment-assets/asset.processor';
import { TryOnProcessor } from '../src/try-on/try-on.processor';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { RuntimeConfig } from '../src/config/runtime-config';
import { PrismaService } from '../src/database/prisma.service';
import { RedisService } from '../src/queue/redis.service';
import { IdentityProvider } from '../src/auth/identity.provider';
import { UsersRepository } from '../src/auth/users.repository';
import { MediaRepository } from '../src/media/media.repository';
import { AnalysisProcessor } from '../src/media/analysis.processor';
import { ImageStorageProvider } from '../src/uploads/image-storage.provider';
import { Garment, UploadAuthResponse } from '@stylist/shared';

describe('Wardrobe endpoints (HTTP)', () => {
  let app: INestApplication<App>;
  const userId = '6aac5ae9-f260-44ec-9554-c7c608120028';
  const otherUserId = 'ea65d29f-4277-41af-af22-798117f91b55';
  const id = '490f926b-6787-4a82-b3c0-bab6d038c058';
  const token = 'c582a2a0-9786-47b4-91a7-733d0f860e47';
  const input = {
    imagekitFileId: 'file_1',
    url: 'https://images.example.com/file.jpg',
    uploadToken: token,
  };
  const folder = `/stylist/${userId}/${token}`;
  const row = {
    id,
    userId,
    imagekitFileId: 'file_1',
    filePath: `${folder}/file.jpg`,
    status: 'pending',
    errorCode: null,
    createdAt: new Date(),
    tags: null,
  };
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
    authentication: jest.fn((generated: string, expire: number) => ({
      token: generated,
      expire,
      signature: 'fixture',
      publicKey: 'public',
      urlEndpoint: 'https://images.example.com',
    })),
    get: jest.fn(),
    url: jest.fn(() => 'https://images.example.com/file.jpg?ik-s=fixture'),
    delete: jest.fn(),
  };
  const queue = { add: jest.fn() };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RuntimeConfig)
      .useValue({ values: {} })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(RedisService)
      .useValue({
        client: {},
        onModuleInit: async () => {},
        onModuleDestroy: () => {},
      })
      .overrideProvider(IdentityProvider)
      .useValue({
        verifyToken: (value: string) =>
          Promise.resolve(value === 'a' ? 'user_a' : 'user_b'),
      })
      .overrideProvider(UsersRepository)
      .useValue({
        find: (value: string) =>
          Promise.resolve({
            id: value === 'user_a' ? userId : otherUserId,
            deletedAt: null,
          }),
      })
      .overrideProvider(MediaRepository)
      .useValue(repository)
      .overrideProvider(ImageStorageProvider)
      .useValue(storage)
      .overrideProvider(getQueueToken('analysis'))
      .useValue(queue)
      .overrideProvider(AnalysisProcessor)
      .useValue({})
      .overrideProvider(getQueueToken('try-on'))
      .useValue({ add: jest.fn() })
      .overrideProvider(TryOnProcessor)
      .useValue({})
      .overrideProvider(getQueueToken('garment-assets'))
      .useValue({ add: jest.fn() })
      .overrideProvider(getQueueToken('stylist'))
      .useValue({})
      .overrideProvider(StylistProcessor)
      .useValue({})
      .overrideProvider(AssetProcessor)
      .useValue({})
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    repository.grant.mockImplementation((_token: string, owner: string) =>
      Promise.resolve(
        owner === userId
          ? {
              token,
              folder,
              usedAt: null,
              expiresAt: new Date(Date.now() + 60000),
            }
          : null,
      ),
    );
    repository.find.mockImplementation((_kind: string, owner: string) =>
      Promise.resolve(owner === userId ? row : null),
    );
    repository.register.mockResolvedValue(row);
    repository.list.mockResolvedValue([]);
    storage.get.mockResolvedValue({
      fileId: 'file_1',
      filePath: row.filePath,
      url: input.url,
      isPrivate: true,
      fileType: 'image',
      size: 100,
    });
  });
  it('requires auth and issues private upload requirements', async () => {
    await request(app.getHttpServer()).get('/uploads/auth').expect(401);
    const result = await request(app.getHttpServer())
      .get('/uploads/auth')
      .set('Authorization', 'Bearer a')
      .expect(200);
    expect(UploadAuthResponse.parse(result.body).isPrivateFile).toBe(true);
    expect(UploadAuthResponse.parse(result.body).folder).toContain(userId);
  });
  it('creates a pending garment with a shared response', async () => {
    const result = await request(app.getHttpServer())
      .post('/garments')
      .set('Authorization', 'Bearer a')
      .send(input)
      .expect(201);
    expect(Garment.parse(result.body).status).toBe('pending');
    expect(queue.add).toHaveBeenCalledTimes(1);
  });
  it('validates body/query/params before services', async () => {
    await request(app.getHttpServer())
      .post('/garments')
      .set('Authorization', 'Bearer a')
      .send({ ...input, userId: otherUserId })
      .expect(400);
    await request(app.getHttpServer())
      .get('/garments?limit=100')
      .set('Authorization', 'Bearer a')
      .expect(400);
    await request(app.getHttpServer())
      .delete('/model-photos/not-a-uuid')
      .set('Authorization', 'Bearer a')
      .expect(400);
    expect(repository.register).not.toHaveBeenCalled();
    expect(repository.list).not.toHaveBeenCalled();
  });
  it('cannot register, read or delete another user image', async () => {
    await request(app.getHttpServer())
      .post('/garments')
      .set('Authorization', 'Bearer b')
      .send(input)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/garments/${id}`)
      .set('Authorization', 'Bearer b')
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/model-photos/${id}`)
      .set('Authorization', 'Bearer b')
      .expect(404);
    expect(storage.get).not.toHaveBeenCalled();
    expect(storage.delete).not.toHaveBeenCalled();
  });
  it('passes owner/category/cursor/page size to the repository', async () => {
    await request(app.getHttpServer())
      .get(`/garments?category=top&limit=5&cursor=${id}`)
      .set('Authorization', 'Bearer a')
      .expect(200, { items: [], nextCursor: null });
    expect(repository.list).toHaveBeenCalledWith('garment', userId, {
      category: 'top',
      limit: 5,
      cursor: id,
    });
  });
});
