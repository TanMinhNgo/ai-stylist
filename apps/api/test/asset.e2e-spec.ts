import { PrivacyProcessor } from '../src/privacy/privacy.processor';
import { PrivacyService } from '../src/privacy/privacy.service';
import { RateLimitGuard } from '../src/usage/rate-limit.guard';
import { StylistProcessor } from '../src/stylist/stylist.processor';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { randomUUID } from 'node:crypto';
import { getQueueToken } from '@nestjs/bullmq';
import { AppModule } from '../src/app.module';
import { RuntimeConfig } from '../src/config/runtime-config';
import { PrismaService } from '../src/database/prisma.service';
import { RedisService } from '../src/queue/redis.service';
import { IdentityProvider } from '../src/auth/identity.provider';
import { UsersRepository } from '../src/auth/users.repository';
import { ImageStorageProvider } from '../src/uploads/image-storage.provider';
import { AnalysisProcessor } from '../src/media/analysis.processor';
import { TryOnProcessor } from '../src/try-on/try-on.processor';
import { AssetProcessor } from '../src/garment-assets/asset.processor';
import { AssetRepository } from '../src/garment-assets/asset.repository';
import {
  AssetQuotaResponse,
  CreateAssetJobsResponse,
  CreateIdeaResponse,
  AssetJobResponse,
} from '@stylist/shared';
describe('Mannequin asset HTTP contract', () => {
  let app: INestApplication<App>;
  const userId = randomUUID(),
    otherId = randomUUID(),
    id = randomUUID();
  const input = {
    items: [
      { source: 'idea', type: 'shirt', prompt: 'sơ mi trắng', bodyKey: 'm' },
    ],
  };
  const repo = { usage: jest.fn(), create: jest.fn(), find: jest.fn() };
  const queue = { add: jest.fn() };
  const config = {
    values: {
      ASSET_GENERATION_ENABLED: 'true',
      ASSET_PROVIDER: 'fake',
      ASSET_GENERATION_USER_IDS: '',
    },
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RuntimeConfig)
      .useValue(config)
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
            id: token === 'a' ? userId : otherId,
            deletedAt: null,
          }),
      })
      .overrideProvider(ImageStorageProvider)
      .useValue({ url: () => 'https://images.example.com/signed.png' })
      .overrideProvider(AssetRepository)
      .useValue(repo)
      .overrideProvider(getQueueToken('analysis'))
      .useValue({})
      .overrideProvider(getQueueToken('try-on'))
      .useValue({})
      .overrideProvider(getQueueToken('garment-assets'))
      .useValue(queue)
      .overrideProvider(AnalysisProcessor)
      .useValue({})
      .overrideProvider(TryOnProcessor)
      .useValue({})
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
    config.values.ASSET_GENERATION_ENABLED = 'true';
    repo.usage.mockResolvedValue({
      limit: 5,
      remaining: 3,
      ideaPlansRemaining: 9,
      resetAt: new Date().toISOString(),
    });
    repo.create.mockResolvedValue([{ id, userId, status: 'queued' }]);
    repo.find.mockImplementation((owner: string) =>
      Promise.resolve(
        owner === userId
          ? {
              id,
              status: 'ready',
              kind: 'idea',
              bodyKey: 'm',
              errorCode: null,
              garmentId: id,
              createdAt: new Date(),
              deadlineAt: new Date(Date.now() + 60000),
              deletedAt: null,
              resultFilePath: '/fixture.png',
              renderMeta: {
                width: 1024,
                height: 1536,
                bounds: [64, 64, 896, 1408],
              },
              provider: 'fake',
            }
          : null,
      ),
    );
  });
  it('requires authentication and returns only current user quota', async () => {
    await request(app.getHttpServer())
      .get('/asset-generation/quota')
      .expect(401);
    const result = await request(app.getHttpServer())
      .get(`/asset-generation/quota?userId=${otherId}`)
      .set('Authorization', 'Bearer a')
      .expect(200);
    expect(AssetQuotaResponse.parse(result.body).remaining).toBe(3);
    expect(repo.usage).toHaveBeenCalledWith(userId);
  });
  it('validates menu/subtype, restricted types, batch bounds and keys', async () => {
    await request(app.getHttpServer())
      .post('/garment-asset-jobs')
      .set('Authorization', 'Bearer a')
      .send(input)
      .expect(400);
    await request(app.getHttpServer())
      .post('/garment-asset-jobs')
      .set('Authorization', 'Bearer a')
      .set('Idempotency-Key', randomUUID())
      .send({ items: [{ ...input.items[0], type: 'underwear' }] })
      .expect(400);
    await request(app.getHttpServer())
      .post('/garment-ideas')
      .set('Authorization', 'Bearer a')
      .set('Idempotency-Key', randomUUID())
      .send({
        menu: 'jewelry',
        type: 'shirt',
        prompt: 'áo trắng',
        bodyKey: 'm',
      })
      .expect(400);
    expect(repo.create).not.toHaveBeenCalled();
  });
  it('accepts a bounded batch and a separate asynchronous idea proposal', async () => {
    const result = await request(app.getHttpServer())
      .post('/garment-asset-jobs')
      .set('Authorization', 'Bearer a')
      .set('Idempotency-Key', 'key12345')
      .send(input)
      .expect(201);
    expect(CreateAssetJobsResponse.parse(result.body)).toEqual({
      jobIds: [id],
    });
    expect(repo.create).toHaveBeenCalledWith(
      userId,
      'assets:key12345',
      input.items,
      'fake',
      'fake',
    );
    const idea = await request(app.getHttpServer())
      .post('/garment-ideas')
      .set('Authorization', 'Bearer a')
      .set('Idempotency-Key', 'idea12345')
      .send({ menu: 'outfit', prompt: 'bộ công sở navy', bodyKey: 'f' })
      .expect(201);
    expect(CreateIdeaResponse.parse(idea.body).jobId).toBe(id);
  });
  it('keeps private asset results scoped to the authenticated owner', async () => {
    const result = await request(app.getHttpServer())
      .get(`/garment-asset-jobs/${id}`)
      .set('Authorization', 'Bearer a')
      .expect(200);
    expect(AssetJobResponse.parse(result.body).asset?.isMock).toBe(true);
    await request(app.getHttpServer())
      .get(`/garment-asset-jobs/${id}`)
      .set('Authorization', 'Bearer b')
      .expect(404);
    await request(app.getHttpServer())
      .get('/garment-ideas/not-a-uuid')
      .set('Authorization', 'Bearer a')
      .expect(400);
  });
  it('enforces feature gate without contacting the provider', async () => {
    config.values.ASSET_GENERATION_ENABLED = 'false';
    await request(app.getHttpServer())
      .post('/garment-asset-jobs')
      .set('Authorization', 'Bearer a')
      .set('Idempotency-Key', 'key12345')
      .send(input)
      .expect(403);
    expect(repo.create).not.toHaveBeenCalled();
  });
});
