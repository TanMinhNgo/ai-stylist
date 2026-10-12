// Real Neon/Redis/ImageKit, fake AI only. Creates and removes scoped fixtures.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { loadEnvFile } = require('node:process');
const { setTimeout: delay } = require('node:timers/promises');
loadEnvFile('.env');
process.env.TRYON_PROVIDER = 'fake';
const { Test } = require('@nestjs/testing');
const { ExpressAdapter } = require('@nestjs/platform-express');
const { getQueueToken } = require('@nestjs/bullmq');
const { AppModule } = require('../dist/app.module');
const { IdentityProvider } = require('../dist/auth/identity.provider');
const { PrismaService } = require('../dist/database/prisma.service');
const { TryOnRepository } = require('../dist/try-on/try-on.repository');
const { TryOnProcessor } = require('../dist/try-on/try-on.processor');
const { UsageService } = require('../dist/usage/usage.service');
const {
  ImageStorageProvider,
} = require('../dist/uploads/image-storage.provider');
const { PrismaClient } = require('../dist/generated/prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { CreateTryOnResponse, TryOnJobResponse } = require('@stylist/shared');
const ImageKit = require('@imagekit/nodejs').default;
const tags = {
  category: 'top',
  type: 'shirt',
  slot: 'top',
  colors: ['blue'],
  material: 'cotton',
  formality: 3,
  pattern: 'solid',
  fit: 'regular',
  length: 'regular',
  sleeve: 'long',
  neckline: 'collar',
  rise: null,
  season: ['all'],
  occasions: ['work'],
};
const analysis = {
  allowed: true,
  fullBody: true,
  personCount: 1,
  lightingAdequate: true,
  bodyShape: 'unknown',
  skinTone: 'unknown',
  notes: 'Synthetic fixture only',
};
let stage = 'bootstrap';
let reservations = 0,
  refunds = 0;
(async () => {
  let app,
    prisma,
    users = [],
    jobs = [];
  const bearer = randomUUID(),
    otherBearer = randomUUID();
  const clerkIds = [
    `user_tryon_fixture_${randomUUID()}`,
    `user_tryon_fixture_${randomUUID()}`,
  ];
  const imagekit = new ImageKit({
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
    maxRetries: 0,
    timeout: 20000,
  });
  try {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(UsageService)
      .useValue({
        reserve: () => {
          reservations++;
        },
        refund: () => {
          refunds++;
        },
      })
      .overrideProvider(IdentityProvider)
      .useValue({
        verifyToken: async (token) => {
          assert.ok([bearer, otherBearer].includes(token));
          return clerkIds[token === bearer ? 0 : 1];
        },
      })
      .compile();
    app = module.createNestApplication(new ExpressAdapter(), { logger: false });
    prisma = app.get(PrismaService);
    for (const clerkUserId of clerkIds)
      users.push(await prisma.user.create({ data: { clerkUserId } }));
    const userId = users[0].id;
    const photo = await prisma.modelPhoto.create({
      data: {
        userId,
        imagekitFileId: `fixture_${randomUUID()}`,
        filePath: '/fixture/photo.jpg',
        status: 'ready',
        analysis,
      },
    });
    const garment = await prisma.garment.create({
      data: {
        userId,
        imagekitFileId: `fixture_${randomUUID()}`,
        filePath: '/fixture/shirt.jpg',
        status: 'ready',
        category: 'top',
        tags,
      },
    });
    const input = {
      modelPhotoId: photo.id,
      garmentIds: [garment.id],
      occasion: 'work',
    };
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    const headers = {
      Authorization: `Bearer ${bearer}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': randomUUID(),
    };
    stage = 'concurrent idempotency';
    const responses = await Promise.all(
      [1, 2].map(() =>
        fetch(`${base}/try-on`, {
          method: 'POST',
          headers,
          body: JSON.stringify(input),
        }),
      ),
    );
    const ids = [];
    for (const response of responses) {
      assert.equal(response.status, 201);
      ids.push(CreateTryOnResponse.parse(await response.json()).jobId);
    }
    assert.equal(ids[0], ids[1]);
    const id = ids[0];
    jobs.push(id);
    assert.equal(await prisma.tryOnJob.count({ where: { userId } }), 1);
    assert.equal(reservations, 1);
    const conflict = await fetch(`${base}/try-on`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...input, occasion: 'another occasion' }),
    });
    assert.equal(conflict.status, 409);
    const foreign = await fetch(`${base}/try-on`, {
      method: 'POST',
      headers: { ...headers, Authorization: `Bearer ${otherBearer}` },
      body: JSON.stringify(input),
    });
    assert.equal(foreign.status, 404);
    stage = 'fake worker and private result';
    let result;
    for (let i = 0; i < 40; i++) {
      const response = await fetch(`${base}/try-on/${id}`, { headers });
      assert.equal(response.status, 200);
      result = TryOnJobResponse.parse(await response.json());
      if (['done', 'failed'].includes(result.status)) break;
      await delay(1000);
    }
    assert.equal(result.status, 'done');
    assert.equal(result.provider, 'fake');
    assert.ok(result.outfitId && result.resultUrl);
    assert.equal((await fetch(result.resultUrl)).status, 200);
    assert.equal(await prisma.outfit.count({ where: { tryOnJobId: id } }), 1);
    const record = await prisma.tryOnJob.findUnique({ where: { id } });
    const asset = await app.get(ImageStorageProvider).get(record.resultFileId);
    assert.equal(asset.isPrivate, true);
    assert.ok((await fetch(asset.url)).status >= 400);
    assert.equal(
      (
        await fetch(`${base}/try-on/${id}`, {
          headers: { Authorization: `Bearer ${otherBearer}` },
        })
      ).status,
      404,
    );
    await app.get(TryOnProcessor).process({
      data: { id, userId },
      opts: { attempts: 3 },
      attemptsMade: 1,
    });
    assert.equal(await prisma.outfit.count({ where: { tryOnJobId: id } }), 1);
    stage = 'restrictions and expiry';
    await prisma.garment.update({
      where: { id: garment.id },
      data: {
        tags: {
          ...tags,
          category: 'one_piece',
          type: 'underwear',
          slot: 'dress',
        },
      },
    });
    const restricted = await fetch(`${base}/try-on`, {
      method: 'POST',
      headers: { ...headers, 'Idempotency-Key': randomUUID() },
      body: JSON.stringify(input),
    });
    assert.equal(restricted.status, 400);
    assert.equal((await restricted.json()).code, 'TRYON_GARMENT_NOT_ALLOWED');
    await prisma.garment.update({ where: { id: garment.id }, data: { tags } });
    await prisma.garment.update({
      where: { id: garment.id },
      data: { status: 'pending' },
    });
    const notReady = await fetch(`${base}/try-on`, {
      method: 'POST',
      headers: { ...headers, 'Idempotency-Key': randomUUID() },
      body: JSON.stringify(input),
    });
    assert.equal(notReady.status, 400);
    assert.equal((await notReady.json()).code, 'TRYON_INPUT_NOT_READY');
    await prisma.garment.update({
      where: { id: garment.id },
      data: { status: 'ready' },
    });
    await prisma.modelPhoto.update({
      where: { id: photo.id },
      data: { analysis: { ...analysis, allowed: false } },
    });
    const unsafe = await fetch(`${base}/try-on`, {
      method: 'POST',
      headers: { ...headers, 'Idempotency-Key': randomUUID() },
      body: JSON.stringify(input),
    });
    assert.equal(unsafe.status, 400);
    await prisma.modelPhoto.update({
      where: { id: photo.id },
      data: { analysis },
    });
    assert.equal(reservations, 1);
    const repository = app.get(TryOnRepository);
    const abandoned = await repository.create(
      userId,
      randomUUID(),
      input,
      'fake',
      'fake',
    );
    jobs.push(abandoned.id);
    await prisma.tryOnJob.update({
      where: { id: abandoned.id },
      data: { deadlineAt: new Date(0), status: 'processing' },
    });
    await app.get(TryOnProcessor).sweep();
    const timedOut = await prisma.tryOnJob.findUnique({
      where: { id: abandoned.id },
    });
    assert.equal(timedOut.status, 'failed');
    assert.equal(timedOut.errorCode, 'TRYON_TIMEOUT');
    assert.ok(timedOut.refundedAt);
    const refund = timedOut.refundedAt.getTime();
    await repository.fail(userId, abandoned.id, 'TRYON_PROVIDER_ERROR');
    assert.equal(
      (
        await prisma.tryOnJob.findUnique({ where: { id: abandoned.id } })
      ).refundedAt.getTime(),
      refund,
    );
    assert.equal(reservations, 2);
    assert.equal(refunds, 1);
    console.log(
      'Try-on live fake checks passed: concurrent idempotency, ownership, private signed result, one outfit, restricted apparel, abandoned-job expiry, refund once. No AI calls.',
    );
  } finally {
    if (app) {
      const queue = app.get(getQueueToken('try-on'));
      for (const id of jobs) {
        try {
          await queue.remove(id);
        } catch {}
      }
      await app.close();
    }
    if (users.length) {
      const cleanup = new PrismaClient({
        adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
      });
      try {
        const userIds = users.map((u) => u.id);
        const rows = await cleanup.tryOnJob.findMany({
          where: { userId: { in: userIds } },
        });
        for (const row of rows)
          if (row.resultFileId) {
            try {
              await imagekit.files.delete(row.resultFileId);
            } catch (error) {
              if (error.status !== 404)
                throw new Error('Fixture file cleanup failed');
            }
          }
        await cleanup.outfit.deleteMany({ where: { userId: { in: userIds } } });
        await cleanup.tryOnJob.deleteMany({
          where: { userId: { in: userIds } },
        });
        await cleanup.modelPhoto.deleteMany({
          where: { userId: { in: userIds } },
        });
        await cleanup.garment.deleteMany({
          where: { userId: { in: userIds } },
        });
        await cleanup.user.deleteMany({ where: { id: { in: userIds } } });
      } finally {
        await cleanup.$disconnect();
      }
    }
  }
})().catch(() => {
  console.error(
    `Try-on live fake check failed at ${stage}; no credentials or private URLs logged.`,
  );
  process.exitCode = 1;
});
