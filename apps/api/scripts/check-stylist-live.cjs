const { PrivacyProcessor } = require('../dist/privacy/privacy.processor');
const { RateLimitGuard } = require('../dist/usage/rate-limit.guard');
const { JobLimitsService } = require('../dist/usage/job-limits.service');
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
const { PlanService } = require('../dist/usage/plan.service');
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
  StylistUsageResponse,
  CollectionResponse,
  CollectionListResponse,
  PlannerWeekResponse,
  WearRecordResponse,
  WearHistoryResponse,
  WardrobeInsightsResponse,
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
  let plan = 'free';
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
      .overrideProvider(PlanService)
      .useValue({ getUserPlan: async () => plan })
      .overrideProvider(RedisService)
      .useValue({
        client: {},
        onModuleInit: async () => {},
        onModuleDestroy: () => {},
      })
      .overrideProvider(PrivacyProcessor)
      .useValue({})
      .overrideProvider(getQueueToken('privacy'))
      .useValue({ add: async () => ({}) })
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: () => true })
      .overrideProvider(JobLimitsService)
      .useValue({ lock: JobLimitsService.prototype.lock, check: async () => {} })
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
    stage = 'collections/ownership/atomicity';
    const collectionBody = { name: 'Đi làm', occasion: 'Văn phòng', outfitIds: [outfits[0].id, outfits[1].id] };
    assert.equal((await call('/collections', 'POST', collectionBody)).status, 403);
    plan = 'plus';
    const created = await call('/collections', 'POST', collectionBody);
    assert.equal(created.status, 201);
    const collection = CollectionResponse.parse(created.body);
    assert.equal(collection.outfitIds.length, 2);
    assert.equal((await call(`/collections/${collection.id}`, 'GET', undefined, 'other')).status, 404);
    assert.equal((await call(`/collections/${collection.id}`, 'PATCH', { name: 'Intrusion' }, 'other')).status, 404);
    assert.equal((await call(`/collections/${collection.id}`, 'DELETE', undefined, 'other')).status, 404);
    const foreignCollection = await call('/collections', 'POST', { name: 'Other', occasion: 'Casual' }, 'other');
    assert.equal(foreignCollection.status, 201);
    assert.equal((await call(`/collections/${foreignCollection.body.id}`, 'PATCH', { outfitIds: [outfits[0].id] }, 'other')).status, 404);
    // Composite foreign keys reject cross-user links even if a caller bypasses the repository.
    await assert.rejects(db.collectionOutfit.create({ data: { userId: users[1].id, collectionId: foreignCollection.body.id, outfitId: outfits[0].id } }), error => error.code === 'P2003');
    assert.equal((await call(`/collections/${collection.id}`, 'PATCH', { name: 'Must roll back', outfitIds: [randomUUID()] })).status, 404);
    assert.equal((await call(`/collections/${collection.id}`)).body.name, collectionBody.name);
    assert.deepEqual((await call(`/collections/${collection.id}`)).body.outfitIds.sort(), collection.outfitIds.sort());
    assert.equal((await call('/collections', 'POST', { ...collectionBody, userId: users[1].id })).status, 400);
    assert.equal((await call('/collections?userId=attacker')).status, 400);
    const empty = await call('/collections', 'POST', { name: 'Trống', occasion: 'Cuối tuần' });
    const firstPage = CollectionListResponse.parse((await call('/collections?limit=1')).body);
    assert.equal(firstPage.items.length, 1);
    assert.ok(firstPage.nextCursor);
    const secondPage = CollectionListResponse.parse((await call(`/collections?limit=1&cursor=${firstPage.nextCursor}`)).body);
    assert.notEqual(firstPage.items[0].id, secondPage.items[0].id);
    assert.equal((await call(`/collections?cursor=${foreignCollection.body.id}`)).status, 404);
    plan = 'free';
    assert.equal((await call(`/collections/${collection.id}`)).status, 200);
    assert.equal((await call(`/collections/${collection.id}`, 'PATCH', { name: 'Blocked' })).status, 403);
    assert.equal((await call(`/collections/${empty.body.id}`, 'DELETE')).status, 200);
    assert.ok(await db.outfit.findUnique({ where: { id: outfits[0].id } }));
    plan = 'pro';
    assert.equal((await call(`/collections/${collection.id}`, 'PATCH', { occasion: 'Đi họp' })).status, 200);
    // Forty-nine owned collections leave one slot; real User row lock admits one race winner.
    await db.outfitCollection.createMany({ data: Array.from({ length: 48 }, () => ({ id: randomUUID(), userId, name: 'Cap fixture', occasion: 'Test' })) });
    const collectionRace = await Promise.all([0, 1].map(n => call('/collections', 'POST', { name: `Race ${n}`, occasion: 'Test' })));
    assert.equal(collectionRace.filter(r => r.status === 201).length, 1);
    assert.equal(collectionRace.filter(r => r.status === 429 && r.body.details.resource === 'collections').length, 1);
    await db.outfitCollection.deleteMany({ where: { userId, id: { not: collection.id } } });
    plan = 'free';
    stage = 'planner/week/wear/insights';
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const weekPath = `/planner/week?startDate=${today}&timeZone=UTC`;
    const periodPath = `from=${yesterday}&to=${today}`;
    const dayBody = { timeZone: 'UTC', occasion: 'Đi làm', outfitId: outfits[0].id };
    assert.equal((await call(`/planner/days/${today}`, 'PUT', dayBody)).status, 403);
    assert.equal((await call(`/wardrobe/insights?${periodPath}`)).status, 403);
    plan = 'pro';
    let stats = WardrobeInsightsResponse.parse((await call(`/wardrobe/insights?${periodPath}`)).body);
    assert.equal(stats.status, 'insufficient_data');
    assert.equal(stats.confirmedRecords, 0);
    for (let n = 0; n < 7; n++) {
      const date = new Date(new Date(today).getTime() + n * 86400000).toISOString().slice(0, 10);
      assert.equal((await call(`/planner/days/${date}`, 'PUT', { ...dayBody, outfitId: n === 6 ? null : outfits[n % 3].id })).status, 200);
    }
    let week = PlannerWeekResponse.parse((await call(weekPath)).body);
    assert.equal(week.days.filter(d => d.isPlanned).length, 7);
    assert.equal(week.days[6].outfitId, null);
    assert.equal((await call(weekPath, 'GET', undefined, 'other')).body.days.some(d => d.isPlanned), false);
    assert.equal((await call(`/planner/days/${today}`, 'PUT', dayBody, 'other')).status, 404);
    assert.equal((await call(`/planner/days/${yesterday}`, 'PUT', dayBody)).status, 400);
    plan = 'free';
    assert.equal((await call(weekPath)).status, 200);
    assert.equal((await call(`/planner/days/${today}`, 'PUT', dayBody)).status, 403);
    assert.equal((await call(`/planner/days/${today}?timeZone=UTC`, 'DELETE')).status, 200);
    const wearId = randomUUID(), wearBody = { date: yesterday, timeZone: 'UTC', outfitId: outfits[0].id };
    const confirmations = await Promise.all([0, 1].map(() => call(`/wear-history/${wearId}`, 'PUT', wearBody)));
    assert.ok(confirmations.every(r => r.status === 200 && WearRecordResponse.parse(r.body).id === wearId));
    assert.equal(await db.wearRecord.count({ where: { userId } }), 1);
    assert.equal((await call(`/wear-history/${wearId}`, 'PUT', { ...wearBody, date: today })).status, 409);
    assert.equal((await call(`/wear-history/${randomUUID()}`, 'PUT', wearBody)).status, 409);
    assert.equal((await call(`/wear-history/${randomUUID()}`, 'PUT', wearBody, 'other')).status, 404);
    assert.equal((await call(`/wear-history/${randomUUID()}`, 'PUT', { ...wearBody, date: new Date(Date.now() + 86400000).toISOString().slice(0, 10) })).status, 400);
    for (const o of [outfits[0], outfits[1]]) assert.equal((await call(`/wear-history/${randomUUID()}`, 'PUT', { ...wearBody, date: today, outfitId: o.id })).status, 200);
    assert.equal(WearHistoryResponse.parse((await call(`/wear-history?${periodPath}`)).body).items.length, 3);
    assert.equal((await call(`/wear-history/${wearId}`, 'DELETE', undefined, 'other')).status, 200);
    assert.equal(await db.wearRecord.count({ where: { userId } }), 3);
    const seeded = Array.from({ length: 3 }, () => randomUUID());
    await db.wearRecord.createMany({ data: seeded.map(id => ({ id, userId, date: new Date(today), timeZone: 'UTC', outfitId: null, garmentIds: [garments[0].id], requestHash: 'cap-fixture' })) });
    assert.equal((await call(`/wear-history/${randomUUID()}`, 'PUT', { ...wearBody, date: today, outfitId: outfits[2].id })).status, 429);
    await db.wearRecord.deleteMany({ where: { userId, id: { in: seeded } } });
    plan = 'pro';
    await call(`/planner/days/${today}`, 'PUT', dayBody);
    await call(`/outfits/${outfits[0].id}/save`, 'POST', { saved: true });
    stats = WardrobeInsightsResponse.parse((await call(`/wardrobe/insights?${periodPath}`)).body);
    assert.equal(stats.status, 'available'); assert.equal(stats.confirmedRecords, 3); assert.equal(stats.recordedDays, 2);
    assert.equal(stats.wardrobeGarments, 4); assert.equal(stats.garmentsWithoutRecords, 0);
    assert.equal(stats.mostWorn.find(g => g.garmentId === garments[0].id).wearCount, 2);
    assert.equal(stats.mostWorn.find(g => g.garmentId === garments[1].id).wearCount, 1);
    assert.ok(stats.revisitOutfitIds.includes(outfits[0].id));
    await call(`/wear-history/${wearId}`, 'DELETE');
    assert.equal((await call(`/wardrobe/insights?${periodPath}`)).body.confirmedRecords, 2);
    assert.equal((await call(`/wear-history/${wearId}`, 'PUT', wearBody)).status, 200);
    await db.garment.update({ where: { id: garments[0].id }, data: { deletingAt: new Date() } });
    assert.equal((await call(weekPath)).body.days[0].outfitUnavailable, true);
    assert.equal((await call(`/wardrobe/insights?${periodPath}`)).body.wardrobeGarments, 3);
    await db.garment.update({ where: { id: garments[0].id }, data: { deletingAt: null } });
    assert.equal(await db.usageLedger.count({ where: { userId } }), 0);
    assert.equal(await db.stylistJob.count({ where: { userId } }), 0);
    plan = 'free';
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
    assert.deepEqual(advised.advice.adjustments, []);
    assert.deepEqual(advised.advice.accessories, []);
    assert.equal(advised.promptVersion, 'stylist-v2-basic');
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
    assert.deepEqual((await call(`/collections/${collection.id}`)).body.outfitIds, [outfits[1].id]);
    assert.equal(await db.collectionOutfit.count({ where: { userId, outfitId: outfits[0].id } }), 0);
    assert.equal((await call(weekPath)).body.days[0].outfitUnavailable, true);
    assert.equal((await call(weekPath)).body.days[0].outfitId, null);
    assert.equal((await call(`/wear-history?${periodPath}`)).body.items.find(w => w.id === wearId).outfitId, null);
    assert.equal((await call(`/wear-history/${wearId}`, 'PUT', wearBody)).status, 200);
    assert.equal((await call(`/stylist/jobs/${late.body.jobId}`)).status, 404);
    assert.equal(
      (await db.outfit.findUnique({ where: { id: outfits[0].id } }))
        .adviceStatus,
      null,
    );
    await call(`/outfits/${outfits[1].id}/feedback`, 'POST', { liked: null });
    assert.equal(await taste(), null);
    stage = 'tiered-advice/downgrade';
    for (const value of ['plus', 'pro']) {
      plan = value;
      const paid = await call(`/outfits/${outfits[1].id}/advice`, 'POST', undefined, 'own', randomUUID());
      assert.equal(paid.status, 201);
      await worker.process({ data: { userId, id: paid.body.jobId } });
      const result = Outfit.parse((await call(`/outfits/${outfits[1].id}`)).body);
      assert.ok(result.advice.adjustments.length);
      assert.ok(result.advice.accessories.length);
      assert.equal(result.promptVersion, 'stylist-v2-advanced');
    }
    const pending = await call(`/outfits/${outfits[2].id}/advice`, 'POST', undefined, 'own', randomUUID());
    plan = 'free';
    // Archived paid advice stays readable after downgrade; queued work loses paid privileges.
    assert.ok((await call(`/outfits/${outfits[1].id}`)).body.advice.accessories.length);
    await worker.process({ data: { userId, id: pending.body.jobId } });
    assert.deepEqual((await call(`/outfits/${outfits[2].id}`)).body.advice.accessories, []);
    let usage = StylistUsageResponse.parse((await call('/stylist/usage?plan=pro&userId=foreign')).body);
    assert.equal(usage.plan, 'free');
    assert.equal(usage.used, 5);
    assert.equal(StylistUsageResponse.parse((await call('/stylist/usage', 'GET', undefined, 'other')).body).used, 0);
    const released = await service.create(userId, randomUUID(), { kind: 'suggest', request: { occasion: 'casual' } });
    await repo.fail(userId, released.jobId, 'INTERNAL_ERROR');
    assert.equal((await repo.usage(userId)).used, 5);
    stage = 'concurrent-stylist-cap/uncertain-receipt';
    const queued = [];
    for (let n = usage.used; n < 9; n++)
      queued.push(await service.create(userId, randomUUID(), { kind: 'suggest', request: { occasion: 'casual' } }));
    const concurrentKeys = [randomUUID(), randomUUID(), randomUUID()];
    const burst = await Promise.all(concurrentKeys.map(key => call('/stylist/suggest', 'POST', { occasion: 'casual' }, 'own', key)));
    assert.equal(burst.filter(r => r.status === 201).length, 1);
    assert.equal(burst.filter(r => r.status === 429 && r.body.code === 'QUOTA_EXCEEDED').length, 2);
    const accepted = burst.findIndex(r => r.status === 201);
    queued.push(burst[accepted].body);
    const suggest = provider.suggest.bind(provider);
    provider.suggest = async () => { throw new Error('synthetic ambiguous receipt'); };
    await assert.rejects(worker.process({ data: { userId, id: queued[0].jobId } }));
    provider.suggest = suggest;
    assert.equal((await repo.usage(userId)).used, 10);
    // A started failure is terminal; replay never calls the restored provider.
    await worker.process({ data: { userId, id: queued[0].jobId } });
    assert.equal((await db.stylistJob.findUnique({ where: { id: queued[0].jobId } })).status, 'failed');
    for (const item of queued.slice(1)) await worker.process({ data: { userId, id: item.jobId } });
    const replay = await call('/stylist/suggest', 'POST', { occasion: 'casual' }, 'own', concurrentKeys[accepted]);
    assert.equal(replay.body.jobId, burst[accepted].body.jobId);
    assert.equal((await repo.usage(userId)).used, 10);
    plan = 'plus';
    const over = await service.create(userId, randomUUID(), { kind: 'suggest', request: { occasion: 'casual' } });
    plan = 'free';
    await assert.rejects(worker.process({ data: { userId, id: over.jobId } }));
    const blocked = await db.stylistJob.findUnique({ where: { id: over.jobId } });
    assert.equal(blocked.errorCode, 'QUOTA_EXCEEDED');
    assert.equal(blocked.startedAt, null);
    assert.equal((await repo.usage(userId)).used, 10);
    console.log(
      'Phase6 live passed: real Neon/ImageKit; collections ownership/cap race; 7-day manual planner, timezone/date validation, Pro gates/downgrade archive, explicit idempotent wear confirmations, daily cap, insufficient-data/confirmed counts, deterministic outfit suggestions, deletion recalculation, missing garments/outfit handling; stylist quota/replay regression. Identity/plans/AI fake, in-memory dispatch, no paid AI calls.',
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
        await cleanup.outfitCollection.deleteMany({ where });
        await cleanup.plannerDay.deleteMany({ where });
        await cleanup.wearRecord.deleteMany({ where });
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
