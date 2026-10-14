import { PrivacyProcessor } from '../src/privacy/privacy.processor';
import { PrivacyService } from '../src/privacy/privacy.service';
import { RateLimitGuard } from '../src/usage/rate-limit.guard';
import { StylistProcessor } from '../src/stylist/stylist.processor';
import { AssetProcessor } from '../src/garment-assets/asset.processor';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import request from 'supertest';
import type { App } from 'supertest/types';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { RuntimeConfig } from '../src/config/runtime-config';
import { PrismaService } from '../src/database/prisma.service';
import { RedisService } from '../src/queue/redis.service';
import { IdentityProvider } from '../src/auth/identity.provider';
import { UsersRepository } from '../src/auth/users.repository';
import { AnalysisProcessor } from '../src/media/analysis.processor';
import { TryOnProcessor } from '../src/try-on/try-on.processor';
import { TryOnRepository } from '../src/try-on/try-on.repository';
import { ImageStorageProvider } from '../src/uploads/image-storage.provider';
import { CreateTryOnResponse, TryOnJobResponse } from '@stylist/shared';

describe('Try-on HTTP contract', () => {
  let app: INestApplication<App>;
  const userId = randomUUID(),
    other = randomUUID(),
    id = randomUUID();
  const input = {
    modelPhotoId: randomUUID(),
    garmentIds: [randomUUID()],
    occasion: 'đi làm',
  };
  const repository = { create: jest.fn(), find: jest.fn() };
  const queue = { add: jest.fn() };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RuntimeConfig)
      .useValue({ values: { TRYON_PROVIDER: 'fake' } })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(PrivacyProcessor)
      .useValue({})
      .overrideProvider(getQueueToken('privacy'))
      .useValue({ add: jest.fn() })
      .overrideProvider(PrivacyService)
      .useValue({ request: jest.fn().mockResolvedValue({}), status: jest.fn() })
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: () => true })
      .overrideProvider(RedisService)
      .useValue({
        client: {},
        onModuleInit: async () => {},
        onModuleDestroy: () => {},
      })
      .overrideProvider(IdentityProvider)
      .useValue({ verifyToken: (token: string) => Promise.resolve(token) })
      .overrideProvider(UsersRepository)
      .useValue({
        find: (token: string) =>
          Promise.resolve({
            id: token === 'a' ? userId : other,
            deletedAt: null,
          }),
      })
      .overrideProvider(ImageStorageProvider)
      .useValue({ url: () => 'https://images.example.com/signed' })
      .overrideProvider(getQueueToken('analysis'))
      .useValue({})
      .overrideProvider(AnalysisProcessor)
      .useValue({})
      .overrideProvider(getQueueToken('try-on'))
      .useValue(queue)
      .overrideProvider(TryOnProcessor)
      .useValue({})
      .overrideProvider(TryOnRepository)
      .useValue(repository)
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
    repository.create.mockResolvedValue({ id, status: 'queued' });
    repository.find.mockImplementation((owner: string) =>
      Promise.resolve(
        owner === userId
          ? {
              id,
              status: 'done',
              provider: 'fake',
              createdAt: new Date(),
              deadlineAt: new Date(),
              errorCode: null,
              resultFilePath: '/result',
              outfit: { id },
            }
          : null,
      ),
    );
  });
  it('requires Bearer auth before submission', async () => {
    await request(app.getHttpServer()).post('/try-on').send(input).expect(401);
    expect(repository.create).not.toHaveBeenCalled();
  });
  it('requires a valid key and rejects invalid input before persistence', async () => {
    for (const [key, body] of [
      ['', input],
      ['tiny', input],
      [randomUUID(), { ...input, garmentIds: [] }],
      [randomUUID(), { ...input, userId: other }],
    ]) {
      await request(app.getHttpServer())
        .post('/try-on')
        .set('Authorization', 'Bearer a')
        .set('Idempotency-Key', key as string)
        .send(body)
        .expect(400);
    }
    expect(repository.create).not.toHaveBeenCalled();
  });
  it('creates a job with the token user ID and schema-compatible response', async () => {
    const key = randomUUID();
    const result = await request(app.getHttpServer())
      .post('/try-on')
      .set('Authorization', 'Bearer a')
      .set('Idempotency-Key', key)
      .send(input)
      .expect(201);
    expect(CreateTryOnResponse.parse(result.body)).toEqual({ jobId: id });
    expect(repository.create).toHaveBeenCalledWith(
      userId,
      key,
      input,
      'fake',
      'fake',
    );
  });
  it('returns signed output only to its owner', async () => {
    const result = await request(app.getHttpServer())
      .get(`/try-on/${id}`)
      .set('Authorization', 'Bearer a')
      .expect(200);
    expect(TryOnJobResponse.parse(result.body).outfitId).toBe(id);
    await request(app.getHttpServer())
      .get(`/try-on/${id}`)
      .set('Authorization', 'Bearer b')
      .expect(404);
    await request(app.getHttpServer())
      .get('/try-on/invalid')
      .set('Authorization', 'Bearer a')
      .expect(400);
  });
});
