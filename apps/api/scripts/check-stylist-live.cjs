// Real Neon/ImageKit with fake AI and in-memory dispatch; does not require Redis.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { loadEnvFile } = require('node:process');
loadEnvFile('.env');
process.env.NODE_ENV = 'test';
process.env.STYLIST_PROVIDER = 'fake';
const { Test } = require('@nestjs/testing');
const { getQueueToken } = require('@nestjs/bullmq');
const { AppModule } = require('../dist/app.module');
const { RedisService } = require('../dist/queue/redis.service');
const { IdentityProvider } = require('../dist/auth/identity.provider');
const { PrismaService } = require('../dist/database/prisma.service');
const { AnalysisProcessor } = require('../dist/media/analysis.processor');
const { TryOnProcessor } = require('../dist/try-on/try-on.processor');
const { AssetProcessor } = require('../dist/garment-assets/asset.processor');
const { StylistProcessor } = require('../dist/stylist/stylist.processor');
const { StylistRepository } = require('../dist/stylist/stylist.repository');
const { StylistService } = require('../dist/stylist/stylist.service');
const { StylistProvider } = require('../dist/stylist/stylist.provider');
const {
  ImageStorageProvider,
} = require('../dist/uploads/image-storage.provider');
const { FakeTryOnProvider } = require('../dist/try-on/fake-try-on.provider');
const { snapshotOutfit } = require('../dist/stylist/snapshot');
const {
  StyleProfile,
  Outfit,
  OutfitListResponse,
  StylistJobResponse,
} = require('@stylist/shared');
const { PrismaClient } = require('../dist/generated/prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const tags = {
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
};
let stage = 'bootstrap';
(async () => {
  let app, db, storage;
  const users = [],
    files = [],
    outfits = [],
    clerkIds = [
      `user_stylist_fixture_${randomUUID()}`,
      `user_stylist_fixture_${randomUUID()}`,
    ];
  const queue = { add: async () => ({}) };
  try {
    const builder = Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RedisService)
      .useValue({
        client: {},
        onModuleInit: async () => {},
        onModuleDestroy: () => {},
      })
      .overrideProvider(IdentityProvider)
      .useValue({
        verifyToken: async (token) =>
          token === 'own' ? clerkIds[0] : clerkIds[1],
      });
    for (const name of ['analysis', 'try-on', 'garment-assets', 'stylist'])
      builder.overrideProvider(getQueueToken(name)).useValue(queue);
    for (const worker of [
      AnalysisProcessor,
      TryOnProcessor,
      AssetProcessor,
      StylistProcessor,
    ])
      builder.overrideProvider(worker).useValue({});
    app = (await builder.compile()).createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    db = app.get(PrismaService);
    storage = app.get(ImageStorageProvider);
    const repo = app.get(StylistRepository),
      service = app.get(StylistService),
      provider = app.get(StylistProvider);
    const worker = new StylistProcessor(repo, provider, service, storage);
    const base = await app.getUrl();
    const call = async (path, method = 'GET', body, token = 'own', key) => {
      const r = await fetch(base + path, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(key ? { 'Idempotency-Key': key } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: r.status, body: await r.json() };
    };
    for (const clerkUserId of clerkIds)
      users.push(await db.user.create({ data: { clerkUserId } }));
    const userId = users[0].id;
    const photo = await db.modelPhoto.create({
      data: {
        userId,
        imagekitFileId: randomUUID(),
        filePath: `/stylist/${userId}/synthetic-photo.png`,
        status: 'ready',
        analysis: {
          allowed: true,
          fullBody: true,
          personCount: 1,
          lightingAdequate: true,
          bodyShape: 'rectangle',
          skinTone: 'medium',
          notes: 'Synthetic fixture',
        },
      },
    });
    const garments = [];
    for (let n = 0; n < 4; n++) {
      const g = await db.garment.create({
        data: {
          userId,
          imagekitFileId: randomUUID(),
          filePath: `/stylist/${userId}/fixture-${n}.png`,
          status: 'ready',
          category: n < 2 ? 'top' : 'pants',
          tags:
            n < 2
              ? tags
              : {
                  ...tags,
                  type: 'trousers',
                  category: 'pants',
                  slot: 'bottom',
                },
        },
      });
      const vector = [
        n % 2 === 0 ? 1 : 0,
        n % 2 === 0 ? 0 : 1,
        ...Array(1022).fill(0),
      ];
      await db.$executeRaw`UPDATE garments SET embedding=${JSON.stringify(vector)}::vector WHERE id=${g.id}::uuid`;
      garments.push(g);
    }
    const foreign = await db.garment.create({
      data: {
        userId: users[1].id,
        imagekitFileId: randomUUID(),
        filePath: '/synthetic/foreign.png',
        status: 'ready',
        tags,
        category: 'top',
      },
    });
    for (const ids of [
      [garments[0].id, garments[2].id],
      [garments[1].id, garments[3].id],
      [garments[0].id, garments[3].id],
    ]) {
      const file = await storage.saveResult(
        await new FakeTryOnProvider().generate(),
        userId,
        randomUUID(),
      );
      files.push(file.fileId);
      const job = await db.tryOnJob.create({
        data: {
          userId,
          idempotencyKey: randomUUID(),
          requestHash: 'fixture',
          modelPhotoId: photo.id,
          garmentIds: ids,
          occasion: 'casual',
          status: 'done',
          provider: 'fake',
          imageModel: 'fake',
          resultFileId: file.fileId,
          resultFilePath: file.filePath,
          deadlineAt: new Date(Date.now() + 60000),
        },
      });
      const o = await db.outfit.create({
        data: {
          userId,
          tryOnJobId: job.id,
          imagekitFileId: file.fileId,
          filePath: file.filePath,
        },
      });
      outfits.push(o);
      await snapshotOutfit(db, userId, o.id, ids);
    }
    stage = 'profile';
    let r = await call('/style-profile');
    assert.equal(r.status, 200);
    assert.equal(StyleProfile.parse(r.body).bodyShape, 'rectangle');
    const prefs = {
      styles: ['basic'],
      occasions: ['casual'],
      budget: 1000000,
      preferredColors: ['navy'],
      avoidedColors: ['red'],
      bodyShape: 'pear',
    };
    r = await call('/style-profile', 'PUT', prefs);
    assert.equal(r.status, 200);
    assert.equal(r.body.bodyShape, 'pear');
    assert.equal(r.body.skinTone, 'medium');
    stage = 'save/pagination/ownership';
    await call(`/outfits/${outfits[0].id}/save`, 'POST', { saved: true });
    await call(`/outfits/${outfits[1].id}/save`, 'POST', { saved: true });
    r = await call('/outfits?limit=1');
    const page = OutfitListResponse.parse(r.body);
    assert.equal(page.items.length, 1);
    assert.ok(page.nextCursor);
    const next = await call(`/outfits?limit=1&cursor=${page.nextCursor}`);
    assert.notEqual(next.body.items[0].id, page.items[0].id);
    assert.equal(
      (await call(`/outfits/${outfits[0].id}`, 'GET', undefined, 'other'))
        .status,
      404,
    );
    stage = 'taste/ranking';
    const before = (await repo.candidates(userId, 'casual')).map((g) => g.id);
    assert.ok(!before.includes(foreign.id));
    await call(`/outfits/${outfits[0].id}/feedback`, 'POST', { liked: true });
    const ranked = await repo.candidates(userId, 'casual');
    assert.ok([garments[0].id, garments[2].id].includes(ranked[0].id));
    const taste = async () =>
      JSON.parse(
        (
          await db.$queryRaw`SELECT taste_vector::text AS value FROM style_profiles WHERE user_id=${userId}::uuid`
        )[0].value || 'null',
      );
    let v = await taste();
    assert.ok(v[0] > 0.99);
    await call(`/outfits/${outfits[1].id}/feedback`, 'POST', { liked: false });
    v = await taste();
    assert.ok(v[0] > 0.7 && v[1] < 0);
    for (const liked of [true, false, null, true, false, null, true, true])
      await call(`/outfits/${outfits[1].id}/feedback`, 'POST', { liked });
    const repeated = await taste();
    await call(`/outfits/${outfits[1].id}/feedback`, 'POST', { liked: true });
    const repeated2 = await taste();
    assert.ok(repeated.every((n, i) => Math.abs(n - repeated2[i]) < 1e-6));
    stage = 'advice/idempotency';
    const key = randomUUID();
    const [a, b] = await Promise.all([
      call(`/outfits/${outfits[0].id}/advice`, 'POST', undefined, 'own', key),
      call(`/outfits/${outfits[0].id}/advice`, 'POST', undefined, 'own', key),
    ]);
    assert.equal(a.body.jobId, b.body.jobId);
    const busy = await call(
      `/outfits/${outfits[0].id}/advice`,
      'POST',
      undefined,
      'own',
      randomUUID(),
    );
    assert.equal(busy.status, 409);
    assert.equal(busy.body.code, 'IDEMPOTENCY_CONFLICT');
    await worker.process({ data: { userId, id: a.body.jobId } });
    const advised = Outfit.parse(
      (await call(`/outfits/${outfits[0].id}`)).body,
    );
    assert.ok(advised.advice);
    assert.equal(advised.adviceIsMock, true);
    assert.equal(advised.knowledgeVersion, 'knowledge-v1');
    stage = 'suggest/ownership';
    const suggestion = await call(
      '/stylist/suggest',
      'POST',
      { occasion: 'casual' },
      'own',
      'suggest-fixture',
    );
    assert.equal(suggestion.status, 201);
    await worker.process({ data: { userId, id: suggestion.body.jobId } });
    const done = StylistJobResponse.parse(
      (await call(`/stylist/jobs/${suggestion.body.jobId}`)).body,
    );
    assert.equal(done.status, 'ready');
    assert.equal(done.result.outfits.length, 3);
    assert.ok(
      done.result.outfits.every((o) =>
        o.garmentIds.every((id) => garments.some((g) => g.id === id)),
      ),
    );
    assert.equal(
      (
        await call(
          '/stylist/suggest',
          'POST',
          { occasion: 'wedding' },
          'own',
          'suggest-fixture',
        )
      ).status,
      409,
    );
    stage = 'deletion/race';
    const late = await call(
      `/outfits/${outfits[0].id}/advice`,
      'POST',
      undefined,
      'own',
      randomUUID(),
    );
    await call(`/outfits/${outfits[0].id}`, 'DELETE');
    await worker.process({ data: { userId, id: late.body.jobId } });
    assert.equal((await call(`/outfits/${outfits[0].id}`)).status, 404);
    assert.equal((await call(`/stylist/jobs/${late.body.jobId}`)).status, 404);
    assert.equal(
      (await db.outfit.findUnique({ where: { id: outfits[0].id } }))
        .adviceStatus,
      null,
    );
    await call(`/outfits/${outfits[1].id}/feedback`, 'POST', { liked: null });
    assert.equal(await taste(), null);
    console.log(
      'Stylist live checks passed: real Neon/ImageKit, inferred/editable profile, saved pagination, owner filters, tri-state/repeated feedback, taste/ranking change, 3 fake suggestions, advice/idempotency, deletion race. No Redis or AI calls.',
    );
  } finally {
    if (storage) for (const fileId of files) await storage.delete(fileId);
    if (app) await app.close();
    if (users.length) {
      const cleanup = new PrismaClient({
        adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
      });
      try {
        const userIds = users.map((u) => u.id);
        const where = { userId: { in: userIds } };
        await cleanup.stylistJob.deleteMany({ where });
        await cleanup.outfit.deleteMany({ where });
        await cleanup.tryOnJob.deleteMany({ where });
        await cleanup.styleProfile.deleteMany({ where });
        await cleanup.garment.deleteMany({ where });
        await cleanup.modelPhoto.deleteMany({ where });
        await cleanup.user.deleteMany({ where: { id: { in: userIds } } });
      } finally {
        await cleanup.$disconnect();
      }
    }
  }
})().catch(() => {
  console.error(
    `Stylist live check failed at ${stage}; no credentials or private URLs logged.`,
  );
  process.exitCode = 1;
});
