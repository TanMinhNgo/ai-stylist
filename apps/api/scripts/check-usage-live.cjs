// Real Neon/Redis/ImageKit, fake identity/billing/AI and in-memory queue dispatch. Fixture accounts only.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
require('node:process').loadEnvFile('.env');
process.env.NODE_ENV = 'test';
process.env.USAGE_FREE_LIMIT = '1';
process.env.AI_MAX_ACTIVE_JOBS = '2';
process.env.AI_COST_RATES_JSON = JSON.stringify({
  fixture: { input: 1, output: 2 },
});
const { Test } = require('@nestjs/testing');
const { getQueueToken } = require('@nestjs/bullmq');
const { AppModule } = require('../dist/app.module');
const { PrismaService } = require('../dist/database/prisma.service');
const { RedisService } = require('../dist/queue/redis.service');
const { IdentityProvider } = require('../dist/auth/identity.provider');
const { UsersRepository } = require('../dist/auth/users.repository');
const { PlanSource, PlanService } = require('../dist/usage/plan.service');
const { UsageService, month } = require('../dist/usage/usage.service');
const { JobLimitsService } = require('../dist/usage/job-limits.service');
const { RateLimitGuard } = require('../dist/usage/rate-limit.guard');
const { WorkService } = require('../dist/usage/work.service');
const { AiMeter } = require('../dist/usage/ai-meter.service');
const { PrivacyService } = require('../dist/privacy/privacy.service');
const { AccountSource } = require('../dist/privacy/account-source');
const {
  ImageStorageProvider,
} = require('../dist/uploads/image-storage.provider');
const { TryOnRepository } = require('../dist/try-on/try-on.repository');
const { StylistRepository } = require('../dist/stylist/stylist.repository');
const { FakeTryOnProvider } = require('../dist/try-on/fake-try-on.provider');
const { AnalysisProcessor } = require('../dist/media/analysis.processor');
const { TryOnProcessor } = require('../dist/try-on/try-on.processor');
const { AssetProcessor } = require('../dist/garment-assets/asset.processor');
const { StylistProcessor } = require('../dist/stylist/stylist.processor');
const { PrivacyProcessor } = require('../dist/privacy/privacy.processor');
const { UsageResponse, AccountDeletionResponse } = require('@stylist/shared');
const clerkIds = [`user_phase5_${randomUUID()}`, `user_phase5_${randomUUID()}`];
const queued = [],
  users = [],
  files = [];
let app,
  db,
  redis,
  storage,
  stage = 'bootstrap',
  release;
(async () => {
  try {
    const builder = Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(IdentityProvider)
      .useValue({
        verifyToken: async (token) =>
          token === 'own' ? clerkIds[0] : clerkIds[1],
      })
      .overrideProvider(PlanSource)
      .useValue({
        get: async (id) => ({
          plan: id === clerkIds[1] ? 'pro' : 'free',
          validUntil: Date.now() + 60000,
        }),
      })
      .overrideProvider(AccountSource)
      .useValue({ remove: async (id) => assert.ok(clerkIds.includes(id)) });
    for (const name of [
      'analysis',
      'try-on',
      'garment-assets',
      'stylist',
      'privacy',
    ])
      builder.overrideProvider(getQueueToken(name)).useValue({
        add: async (...args) => {
          queued.push({ queue: name, args });
          return {};
        },
      });
    for (const worker of [
      AnalysisProcessor,
      TryOnProcessor,
      AssetProcessor,
      StylistProcessor,
      PrivacyProcessor,
    ])
      builder.overrideProvider(worker).useValue({});
    app = (await builder.compile()).createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    db = app.get(PrismaService);
    redis = app.get(RedisService).client;
    storage = app.get(ImageStorageProvider);
    const usage = app.get(UsageService),
      limits = app.get(JobLimitsService),
      tryon = app.get(TryOnRepository),
      stylist = app.get(StylistRepository),
      privacy = app.get(PrivacyService);
    const base = await app.getUrl();
    const call = async (path, method = 'GET', body, token = 'own', key) => {
      const res = await fetch(base + path, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(key ? { 'Idempotency-Key': key } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: res.status, body: await res.json() };
    };
    for (const clerkUserId of clerkIds)
      users.push(await db.user.create({ data: { clerkUserId } }));
    const userId = users[0].id,
      otherId = users[1].id;
    const png = await new FakeTryOnProvider().generate({
      modelPhotoUrl: '',
      garmentUrls: [],
      occasion: 'fixture',
    });
    const save = async (owner) => {
      const file = await storage.saveResult(png, owner, randomUUID());
      files.push(file.fileId);
      return file;
    };
    const ownFile = await save(userId),
      otherFile = await save(otherId);
    const photo = await db.modelPhoto.create({
      data: {
        userId,
        imagekitFileId: ownFile.fileId,
        filePath: ownFile.filePath,
        status: 'ready',
        analysis: {
          allowed: true,
          fullBody: true,
          personCount: 1,
          lightingAdequate: true,
          bodyShape: 'rectangle',
          skinTone: 'medium',
          notes: 'fixture',
        },
      },
    });
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
    const garmentFile = await save(userId);
    const garment = await db.garment.create({
      data: {
        userId,
        imagekitFileId: garmentFile.fileId,
        filePath: garmentFile.filePath,
        status: 'ready',
        tags,
      },
    });
    stage = 'last-credit concurrency and idempotency';
    assert.equal(UsageResponse.parse((await call('/usage')).body).remaining, 1);
    const input = {
        modelPhotoId: photo.id,
        garmentIds: [garment.id],
        occasion: 'Đi làm',
      },
      keys = [randomUUID(), randomUUID()];
    const race = await Promise.all(
      keys.map((key) => call('/try-on', 'POST', input, 'own', key)),
    );
    assert.deepEqual(race.map((x) => x.status).sort(), [201, 429]);
    assert.equal(
      race.find((x) => x.status === 429).body.code,
      'QUOTA_EXCEEDED',
    );
    const winning = race.findIndex((x) => x.status === 201),
      jobId = race[winning].body.jobId;
    const planService = app.get(PlanService),
      readPlan = planService.getUserPlan.bind(planService);
    planService.getUserPlan = async () => {
      throw new Error('fixture billing outage');
    };
    assert.equal(
      (await call('/try-on', 'POST', input, 'own', keys[winning])).body.jobId,
      jobId,
    );
    planService.getUserPlan = readPlan;
    assert.equal(
      await db.usageLedger.count({ where: { userId, delta: -1 } }),
      1,
    );
    stage = 'refund once and original UTC month';
    await Promise.all([
      tryon.fail(userId, jobId, 'TRYON_PROVIDER_ERROR'),
      tryon.fail(userId, jobId, 'TRYON_PROVIDER_ERROR'),
    ]);
    assert.equal(
      await db.usageLedger.count({ where: { userId, jobId, delta: 1 } }),
      1,
    );
    assert.equal((await usage.get(userId)).remaining, 1);
    const currentJob = randomUUID(),
      oldJob = randomUUID(),
      oldTime = new Date(
        Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 28),
      );
    await db.$transaction(async (tx) => {
      await limits.lock(tx, userId);
      await usage.reserve(tx, userId, currentJob, 'free');
      await usage.reserve(tx, userId, oldJob, 'free', oldTime);
    });
    await db.$transaction(async (tx) => {
      await limits.lock(tx, userId);
      await usage.refund(tx, userId, oldJob);
      await usage.refund(tx, userId, oldJob);
    });
    assert.equal((await usage.get(userId)).used, 1);
    assert.equal(
      (
        await db.usageLedger.findFirst({ where: { jobId: oldJob, delta: 1 } })
      ).periodStart.getTime(),
      month(oldTime).start.getTime(),
    );
    stage = 'Pro queue priority and concurrency cap';
    const otherPhoto = await db.modelPhoto.create({
      data: {
        userId: otherId,
        imagekitFileId: otherFile.fileId,
        filePath: otherFile.filePath,
        status: 'ready',
        analysis: photo.analysis,
      },
    });
    const otherGarment = await db.garment.create({
      data: {
        userId: otherId,
        imagekitFileId: randomUUID(),
        filePath: '/fixture/no-file',
        status: 'ready',
        tags,
      },
    });
    await call(
      '/try-on',
      'POST',
      { ...input, modelPhotoId: otherPhoto.id, garmentIds: [otherGarment.id] },
      'other',
      randomUUID(),
    );
    assert.ok(
      queued.some(
        (q) =>
          q.queue === 'try-on' &&
          q.args[1].userId === otherId &&
          q.args[2].priority === 1,
      ),
    );
    for (let n = 0; n < 2; n++)
      await stylist.create(
        userId,
        randomUUID(),
        { kind: 'suggest', request: { occasion: 'casual' } },
        'fake',
        'fake',
      );
    await assert.rejects(
      stylist.create(
        userId,
        randomUUID(),
        { kind: 'suggest', request: { occasion: 'casual' } },
        'fake',
        'fake',
      ),
      (err) => err.response.code === 'RATE_LIMITED',
    );
    stage = 'atomic Redis rate limiter';
    await redis.del(`stylist:rate:${userId}`);
    const config = app.get(
        require('../dist/config/runtime-config').RuntimeConfig,
      ),
      rate = app.get(RateLimitGuard);
    config.values.AI_RATE_LIMIT_PER_MINUTE = 1;
    const ctx = {
      switchToHttp: () => ({ getRequest: () => ({ user: { id: userId } }) }),
    };
    const hits = await Promise.allSettled([
      rate.canActivate(ctx),
      rate.canActivate(ctx),
    ]);
    assert.equal(hits.filter((x) => x.status === 'fulfilled').length, 1);
    assert.equal(
      hits.find((x) => x.status === 'rejected').reason.response.code,
      'RATE_LIMITED',
    );
    stage = 'deletion waits for worker and upload grant';
    const grant = await db.uploadGrant.create({
      data: {
        token: randomUUID(),
        userId,
        folder: `/stylist/${userId}/${randomUUID()}`,
        expiresAt: new Date(Date.now() + 60000),
      },
    });
    let signal;
    const started = new Promise((resolve) => {
        signal = resolve;
      }),
      hold = new Promise((resolve) => {
        release = resolve;
      });
    const running = app.get(WorkService).run(userId, randomUUID(), async () => {
      await app.get(AiMeter).request('fixture', 'fixture', async () => ({
        usage: { input_tokens: 10, output_tokens: 20 },
      }));
      signal();
      await hold;
      await save(userId);
    });
    await started;
    assert.ok(
      (await db.aiCall.findFirst({ where: { userId } })).estimatedUsd > 0,
    );
    const requested = await call('/me', 'DELETE');
    assert.equal(requested.status, 202);
    const receipt = AccountDeletionResponse.parse(requested.body);
    assert.equal(
      (await call('/me', 'DELETE')).body.deletionId,
      receipt.deletionId,
    );
    assert.equal((await call('/usage')).status, 401);
    await privacy.purge(receipt.deletionId, userId);
    assert.equal((await privacy.status(userId)).status, 'queued');
    release();
    await running;
    await db.accountDeletion.update({
      where: { userId },
      data: { retryAt: new Date(0) },
    });
    await privacy.purge(receipt.deletionId, userId);
    assert.equal((await privacy.status(userId)).status, 'queued');
    await db.uploadGrant.update({
      where: { token: grant.token },
      data: { expiresAt: new Date(Date.now() - 180000) },
    });
    stage = 'retry after storage failure, orphan cleanup and no resurrection';
    const deleteFile = storage.delete.bind(storage);
    let failOnce = true;
    storage.delete = async (id) => {
      if (failOnce) {
        failOnce = false;
        throw new Error('fixture failure');
      }
      await deleteFile(id);
    };
    await db.accountDeletion.update({
      where: { userId },
      data: { retryAt: new Date(0) },
    });
    await privacy.purge(receipt.deletionId, userId);
    assert.equal((await privacy.status(userId)).status, 'failed');
    assert.equal(await db.modelPhoto.count({ where: { userId } }), 1);
    await db.accountDeletion.update({
      where: { userId },
      data: { retryAt: new Date(0) },
    });
    await privacy.purge(receipt.deletionId, userId);
    storage.delete = deleteFile;
    assert.equal((await privacy.status(userId)).status, 'completed');
    for (const table of [
      'tryOnJob',
      'stylistJob',
      'garment',
      'modelPhoto',
      'uploadGrant',
      'usageLedger',
      'aiCall',
      'workLease',
    ])
      assert.equal(await db[table].count({ where: { userId } }), 0);
    assert.deepEqual(await storage.listUserFiles(userId), []);
    assert.equal(
      (await storage.get(otherFile.fileId)).fileId,
      otherFile.fileId,
    );
    const resurrect = await app.get(UsersRepository).sync({
      clerkUserId: clerkIds[0],
      email: null,
      updatedAt: Date.now() + 1000000,
    });
    assert.ok(resurrect.deletedAt);
    assert.equal((await call('/me')).status, 401);
    console.log(
      'Phase5 live passed: last-credit race, idempotent refund, original UTC period, Pro priority (fake PlanSource), cap, real Redis atomic rate limit, async deletion/worker/upload wait/retry/orphans/ownership/tombstone. No AI calls or real Clerk deletion; grant time advanced only for fixtures.',
    );
  } finally {
    release?.();
    if (storage)
      for (const id of files) await storage.delete(id).catch(() => {});
    if (db)
      for (const user of users) {
        for (const table of ['stylistJob', 'outfit', 'tryOnJob'])
          await db[table].deleteMany({ where: { userId: user.id } });
        await db.garment.updateMany({
          where: { userId: user.id },
          data: { currentAssetId: null },
        });
        for (const table of [
          'assetJob',
          'garment',
          'modelPhoto',
          'uploadGrant',
          'styleProfile',
          'usageLedger',
          'aiCall',
          'workLease',
          'accountDeletion',
        ])
          await db[table].deleteMany({ where: { userId: user.id } });
        if (redis) {
          let cursor = '0';
          do {
            const reply = await redis.scan(
              cursor,
              'MATCH',
              `stylist:plan:${user.id}:*`,
              'COUNT',
              100,
            );
            cursor = reply[0];
            if (reply[1].length) await redis.del(...reply[1]);
          } while (cursor !== '0');
          await redis.del(
            `stylist:rate:${user.id}`,
            `stylist:plan-version:${user.clerkUserId}`,
          );
        }
        await db.user.deleteMany({ where: { id: user.id } });
      }
    await app?.close();
  }
})().catch((error) => {
  console.error(`Phase5 live failed at ${stage}: ${error.code ?? error.name}`);
  process.exitCode = 1;
});
