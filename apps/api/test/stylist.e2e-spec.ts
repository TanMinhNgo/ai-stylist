import { Test } from '@nestjs/testing';
import { INestApplication, NotFoundException } from '@nestjs/common';
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
import { ImageStorageProvider } from '../src/uploads/image-storage.provider';
import { AnalysisProcessor } from '../src/media/analysis.processor';
import { TryOnProcessor } from '../src/try-on/try-on.processor';
import { AssetProcessor } from '../src/garment-assets/asset.processor';
import { StylistProcessor } from '../src/stylist/stylist.processor';
import { StylistProvider } from '../src/stylist/stylist.provider';
import { FakeStylistProvider } from '../src/stylist/fake-stylist.provider';
import { StylistRepository } from '../src/stylist/stylist.repository';
import {
  StyleProfile,
  Outfit,
  OutfitListResponse,
  CreateStylistJobResponse,
  StylistJobResponse,
} from '@stylist/shared';
describe('BE-04 authenticated HTTP contracts', () => {
  let app: INestApplication<App>;
  const userId = randomUUID(),
    other = randomUUID(),
    id = randomUUID();
  const profile = StyleProfile.parse({
    styles: ['basic'],
    occasions: ['đi làm'],
    budget: null,
    preferredColors: ['navy'],
    avoidedColors: [],
    bodyShape: null,
    skinTone: null,
    updatedAt: null,
  });
  const row = {
    id,
    userId,
    filePath: '/private/path.png',
    imagekitFileId: 'private-file',
    liked: null,
    savedAt: new Date(),
    createdAt: new Date(),
    garmentSnapshot: [],
    advice: null,
    adviceStatus: null,
    adviceErrorCode: null,
    advicePromptVersion: null,
    adviceKnowledgeVersion: null,
    adviceProvider: null,
    tryOnJob: { occasion: 'đi làm', provider: 'fake' },
  };
  const owned = (uid: string) => {
    if (uid !== userId) return Promise.reject(new NotFoundException());
    return Promise.resolve(row);
  };
  const repo = {
    profile: jest.fn().mockResolvedValue(profile),
    updateProfile: jest.fn().mockResolvedValue(profile),
    outfit: jest.fn(owned),
    list: jest.fn().mockResolvedValue([row]),
    save: jest.fn(owned),
    feedback: jest.fn(owned),
    create: jest.fn().mockResolvedValue({ id, status: 'queued' }),
    find: jest.fn().mockResolvedValue({
      id,
      userId,
      status: 'ready',
      kind: 'suggest',
      outfitId: null,
      errorCode: null,
      result: {
        outfits: [],
        message: 'Thiếu món',
        isMock: true,
        occasion: 'casual',
      },
      provider: 'fake',
      createdAt: new Date(),
    }),
    prepareDelete: jest.fn().mockResolvedValue('private-file'),
  };
  const queue = { add: jest.fn().mockResolvedValue({}) };
  beforeAll(async () => {
    const builder = Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RuntimeConfig)
      .useValue({ values: { STYLIST_PROVIDER: 'fake' } })
      .overrideProvider(PrismaService)
      .useValue({})
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
      .useValue({
        url: () => 'https://images.example.com/signed',
        delete: () => Promise.resolve(),
      })
      .overrideProvider(StylistRepository)
      .useValue(repo)
      .overrideProvider(StylistProvider)
      .useValue(new FakeStylistProvider());
    for (const name of ['analysis', 'try-on', 'garment-assets', 'stylist'])
      builder.overrideProvider(getQueueToken(name)).useValue(queue);
    for (const worker of [
      AnalysisProcessor,
      TryOnProcessor,
      AssetProcessor,
      StylistProcessor,
    ])
      builder.overrideProvider(worker).useValue({});
    app = (await builder.compile()).createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  it('requires a real auth guard even for profile and suggestion routes', async () => {
    await request(app.getHttpServer()).get('/style-profile').expect(401);
    await request(app.getHttpServer())
      .post('/stylist/suggest')
      .send({ occasion: 'casual' })
      .expect(401);
  });
  it('uses shared profile schemas and rejects injected ownership', async () => {
    const get = await request(app.getHttpServer())
      .get('/style-profile')
      .set('Authorization', 'Bearer a')
      .expect(200);
    StyleProfile.parse(get.body);
    const { updatedAt, ...input } = profile;
    void updatedAt;
    await request(app.getHttpServer())
      .put('/style-profile')
      .set('Authorization', 'Bearer a')
      .send({ ...input, userId: other })
      .expect(400);
    await request(app.getHttpServer())
      .put('/style-profile')
      .set('Authorization', 'Bearer a')
      .send(input)
      .expect(200);
    expect(repo.updateProfile).toHaveBeenCalledWith(userId, input);
  });
  it('lists only saved resources, correctly parses liked=false and bounds pagination', async () => {
    const response = await request(app.getHttpServer())
      .get('/outfits?liked=false&limit=1')
      .set('Authorization', 'Bearer a')
      .expect(200);
    OutfitListResponse.parse(response.body);
    expect(repo.list).toHaveBeenCalledWith(userId, { liked: false, limit: 1 });
    expect(JSON.stringify(response.body)).not.toContain('/private/path');
    await request(app.getHttpServer())
      .get('/outfits?limit=51')
      .set('Authorization', 'Bearer a')
      .expect(400);
  });
  it('returns 404 for another owner and accepts only tri-state feedback and save intent', async () => {
    await request(app.getHttpServer())
      .get(`/outfits/${id}`)
      .set('Authorization', 'Bearer b')
      .expect(404);
    await request(app.getHttpServer())
      .post(`/outfits/${id}/feedback`)
      .set('Authorization', 'Bearer a')
      .send({ liked: 'false' })
      .expect(400);
    const feedback = await request(app.getHttpServer())
      .post(`/outfits/${id}/feedback`)
      .set('Authorization', 'Bearer a')
      .send({ liked: null })
      .expect(201);
    Outfit.parse(feedback.body);
    expect(repo.feedback).toHaveBeenCalledWith(userId, id, null);
    await request(app.getHttpServer())
      .post(`/outfits/${id}/save`)
      .set('Authorization', 'Bearer a')
      .send({ saved: true })
      .expect(201);
    expect(repo.save).toHaveBeenCalledWith(userId, id, true);
  });
  it('enqueues suggestions/advice asynchronously and publishes explicit mock status', async () => {
    await request(app.getHttpServer())
      .post('/stylist/suggest')
      .set('Authorization', 'Bearer a')
      .send({ occasion: 'casual' })
      .expect(400);
    const created = await request(app.getHttpServer())
      .post('/stylist/suggest')
      .set('Authorization', 'Bearer a')
      .set('Idempotency-Key', 'suggest-123')
      .send({ occasion: 'casual' })
      .expect(201);
    CreateStylistJobResponse.parse(created.body);
    const advice = await request(app.getHttpServer())
      .post(`/outfits/${id}/advice`)
      .set('Authorization', 'Bearer a')
      .set('Idempotency-Key', 'advice-123')
      .expect(201);
    CreateStylistJobResponse.parse(advice.body);
    const result = await request(app.getHttpServer())
      .get(`/stylist/jobs/${id}`)
      .set('Authorization', 'Bearer a')
      .expect(200);
    expect(StylistJobResponse.parse(result.body).isMock).toBe(true);
  });
});
