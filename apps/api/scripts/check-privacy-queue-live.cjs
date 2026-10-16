// Real Neon/Redis/BullMQ/ImageKit; fake identity and Clerk deletion, fixture users only.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
require('node:process').loadEnvFile('.env');
process.env.NODE_ENV = 'test';
const { Test } = require('@nestjs/testing');
const { getQueueToken } = require('@nestjs/bullmq');
const { Queue } = require('bullmq');
const Redis = require('ioredis');
const { RuntimeConfigModule } = require('../dist/config/runtime-config');
const { AuthModule } = require('../dist/auth/auth.module');
const { IdentityProvider } = require('../dist/auth/identity.provider');
const { UsersRepository } = require('../dist/auth/users.repository');
const { UsageModule } = require('../dist/usage/usage.module');
const { PlanSource } = require('../dist/usage/plan.service');
const { PrismaService } = require('../dist/database/prisma.service');
const { RedisService } = require('../dist/queue/redis.service');
const { PrivacyService } = require('../dist/privacy/privacy.service');
const { PrivacyProcessor } = require('../dist/privacy/privacy.processor');
const { AccountSource } = require('../dist/privacy/account-source');
const {
  ImageStorageProvider,
} = require('../dist/uploads/image-storage.provider');
const { FakeTryOnProvider } = require('../dist/try-on/fake-try-on.provider');
const { AccountDeletionResponse } = require('@stylist/shared');

const prefix = `stylist-privacy-smoke-${randomUUID()}`;
const clerkIds = [0, 1].map(() => `user_privacy_smoke_${randomUUID()}`);
const users = [],
  files = new Set(),
  completed = [],
  failed = [],
  removedAccounts = [];
const tables = [
  'stylistJob',
  'collectionOutfit',
  'outfitCollection',
  'plannerDay',
  'wearRecord',
  'outfit',
  'tryOnJob',
  'assetJob',
  'garment',
  'modelPhoto',
  'uploadGrant',
  'styleProfile',
  'usageLedger',
  'aiCall',
  'workLease',
];
let app,
  db,
  redis,
  storage,
  queue,
  processor,
  worker,
  queueConnection,
  privacy,
  stage = 'bootstrap';
let failStorage = false,
  storageFailures = 0;

async function until(predicate) {
  const deadline = Date.now() + 45000;
  while (!(await predicate())) {
    assert.ok(Date.now() < deadline, `Timeout at ${stage}`);
    await delay(200);
  }
}

async function start() {
  queueConnection = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    connectTimeout: 5000,
  });
  queueConnection.on('error', () => {});
  queue = new Queue('privacy', { prefix, connection: queueConnection });
  const module = await Test.createTestingModule({
    imports: [RuntimeConfigModule, UsageModule, AuthModule],
  })
    .overrideProvider(IdentityProvider)
    .useValue({
      verifyToken: async (token) => {
        assert.ok(['own', 'other'].includes(token));
        return clerkIds[token === 'own' ? 0 : 1];
      },
    })
    .overrideProvider(PlanSource)
    .useValue({
      get: async () => ({ plan: 'free', validUntil: Date.now() + 60000 }),
    })
    .overrideProvider(AccountSource)
    .useValue({
      remove: async (id) => {
        assert.ok(clerkIds.includes(id));
        removedAccounts.push(id);
      },
    })
    .overrideProvider(getQueueToken('privacy'))
    .useValue(queue)
    .compile();
  app = module.createNestApplication({ logger: false });
  db = app.get(PrismaService);
  redis = app.get(RedisService).client;
  storage = app.get(ImageStorageProvider);
  queue = app.get(getQueueToken('privacy'));
  privacy = app.get(PrivacyService);
  processor = app.get(PrivacyProcessor);
  // Keep the production sweep/claim/enqueue paths, restrict discovery to this run's fixtures.
  const due = privacy.due.bind(privacy);
  privacy.due = async () =>
    (await due()).filter((row) => users.some((u) => u.id === row.userId));
  const remove = storage.delete.bind(storage);
  storage.delete = async (id) => {
    assert.ok(files.has(id), 'Refuse deleting a non-fixture image');
    if (failStorage) {
      storageFailures++;
      throw new Error('Fixture storage outage');
    }
    await remove(id);
  };
  await app.listen(0, '127.0.0.1');
  worker = processor.worker;
  assert.equal(worker.opts.prefix, prefix);
  worker.on('completed', (job) => completed.push(job.data));
  worker.on('failed', (job) => failed.push(job?.id));
  await worker.waitUntilReady();
  // Exercise startup recovery once; drive later sweeps explicitly to avoid clock races.
  await until(() => !processor.sweeping);
  processor.onModuleDestroy();
}

async function idle() {
  await until(async () => {
    const counts = await queue.getJobCounts('active', 'wait', 'paused');
    return Object.values(counts).every((count) => count === 0);
  });
}

async function stop() {
  await worker?.close();
  worker = undefined;
  await queue?.close();
  queueConnection?.disconnect();
  await app?.close();
  app = undefined;
}

async function call(path, method = 'GET', token = 'own') {
  const res = await fetch((await app.getUrl()) + path, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10000),
  });
  return { status: res.status, body: await res.json() };
}

async function recover(userId, deletionId) {
  await idle();
  const count = completed.length;
  // Advance only the fixture's recovery timestamp, never production retry settings.
  await db.accountDeletion.update({
    where: { userId },
    data: { retryAt: new Date(0) },
  });
  await processor.sweep();
  await until(() =>
    completed.slice(count).some((data) => data.id === deletionId),
  );
  await idle();
}

(async () => {
  try {
    await start();
    for (const clerkUserId of clerkIds)
      users.push(await db.user.create({ data: { clerkUserId } }));
    const [owner, other] = users;
    const png = await new FakeTryOnProvider().generate({
      modelPhotoUrl: '',
      garmentUrls: [],
      occasion: 'fixture',
    });
    const save = async (userId) => {
      assert.ok(users.some((u) => u.id === userId));
      const file = await storage.saveResult(png, userId, randomUUID());
      assert.ok(
        !files.has(file.fileId),
        'Fixture uploads must have distinct IDs',
      );
      assert.ok(file.filePath.startsWith(`/stylist/${userId}/`));
      files.add(file.fileId);
      return file;
    };
    const image = await save(owner.id),
      orphan = await save(owner.id),
      untouched = await save(other.id);
    stage = 'fixture images visible in scoped ImageKit inventory';
    await until(async () => {
      const inventory = await storage.listUserFiles(owner.id);
      return (
        inventory.length === 2 &&
        [image.fileId, orphan.fileId].every((id) => inventory.includes(id))
      );
    });
    const photo = await db.modelPhoto.create({
      data: {
        userId: owner.id,
        imagekitFileId: image.fileId,
        filePath: image.filePath,
        status: 'ready',
      },
    });
    stage = 'collection membership privacy fixtures';
    const tryOn = await db.tryOnJob.create({ data: {
      userId: owner.id, idempotencyKey: randomUUID(), requestHash: 'privacy-collection-fixture',
      modelPhotoId: photo.id, garmentIds: [], occasion: 'Fixture', status: 'done', provider: 'fake', imageModel: 'fake',
      deadlineAt: new Date(Date.now() + 60000),
    } });
    const outfit = await db.outfit.create({ data: { userId: owner.id, tryOnJobId: tryOn.id, imagekitFileId: image.fileId, filePath: image.filePath } });
    const collection = await db.outfitCollection.create({ data: { userId: owner.id, name: 'Purge fixture', occasion: 'Test' } });
    await db.collectionOutfit.create({ data: { userId: owner.id, collectionId: collection.id, outfitId: outfit.id } });
    const otherCollection = await db.outfitCollection.create({ data: { userId: other.id, name: 'Retain fixture', occasion: 'Test' } });
    await db.plannerDay.create({ data: { userId: owner.id, date: new Date('2026-10-17'), timeZone: 'UTC', occasion: 'Purge fixture', outfitId: outfit.id } });
    await db.wearRecord.create({ data: { id: randomUUID(), userId: owner.id, date: new Date('2026-10-17'), timeZone: 'UTC', outfitId: outfit.id, garmentIds: [randomUUID()], requestHash: 'purge-fixture' } });
    const otherPlanner = await db.plannerDay.create({ data: { userId: other.id, date: new Date('2026-10-17'), timeZone: 'UTC', occasion: 'Retain fixture' } });
    const lease = await db.workLease.create({
      data: {
        id: randomUUID(),
        userId: owner.id,
        jobId: randomUUID(),
        expiresAt: new Date(Date.now() + 120000),
      },
    });
    const grant = await db.uploadGrant.create({
      data: {
        token: randomUUID(),
        userId: owner.id,
        folder: `/stylist/${owner.id}/${randomUUID()}`,
        expiresAt: new Date(Date.now() + 60000),
      },
    });

    stage = 'HTTP receipt and persisted isolated queue';
    await queue.pause();
    const requested = await call('/me', 'DELETE');
    assert.equal(requested.status, 202);
    const receipt = AccountDeletionResponse.parse(requested.body);
    assert.equal(
      (await call('/me', 'DELETE')).body.deletionId,
      receipt.deletionId,
    );
    assert.equal((await call('/usage')).status, 401);
    const pending = await queue.getJobs(['wait', 'paused']);
    assert.equal(pending.length, 1);
    assert.deepEqual(pending[0].data, {
      id: receipt.deletionId,
      userId: owner.id,
    });
    assert.ok(
      (await db.user.findUnique({ where: { id: owner.id } })).deletedAt,
    );

    stage = 'worker restart consumes persisted job and waits for lease';
    await stop();
    await start();
    // Fixture DB timestamps can be ahead of the local clock; make the initial claim deterministic too.
    await db.accountDeletion.update({ where: { userId: owner.id }, data: { retryAt: new Date(0) } });
    await queue.resume();
    await until(() => completed.some((data) => data.id === receipt.deletionId));
    assert.equal((await privacy.status(owner.id)).status, 'queued');
    assert.equal(await db.modelPhoto.count({ where: { userId: owner.id } }), 1);
    assert.ok(removedAccounts.includes(clerkIds[0]));
    await idle();
    console.log('Passed: persisted HTTP receipt, worker restart, lease wait.');

    stage = 'recovery respects outstanding upload grant';
    await db.workLease.delete({ where: { id: lease.id } });
    await recover(owner.id, receipt.deletionId);
    assert.equal((await privacy.status(owner.id)).status, 'queued');
    assert.equal(storageFailures, 0);
    console.log('Passed: upload grant wait.');

    stage = 'storage failure keeps receipt and data for retry';
    await db.uploadGrant.update({
      where: { token: grant.token },
      data: { expiresAt: new Date(Date.now() - 180000) },
    });
    failStorage = true;
    await recover(owner.id, receipt.deletionId);
    assert.equal((await privacy.status(owner.id)).status, 'failed');
    assert.equal(storageFailures, 1);
    assert.equal(await db.modelPhoto.count({ where: { userId: owner.id } }), 1);
    console.log('Passed: storage failure preserves data.');

    stage =
      'sweep recovers through BullMQ and purges referenced and orphan files';
    failStorage = false;
    await until(async () => {
      await recover(owner.id, receipt.deletionId);
      return (await privacy.status(owner.id)).status === 'completed';
    });
    console.log('Recovered job completed.');
    assert.equal((await privacy.status(owner.id)).status, 'completed');
    for (const table of tables)
      assert.equal(await db[table].count({ where: { userId: owner.id } }), 0);
    assert.deepEqual(await storage.listUserFiles(owner.id), []);
    assert.ok(await db.outfitCollection.findUnique({ where: { id: otherCollection.id } }));
    assert.ok(await db.plannerDay.findUnique({ where: { id: otherPlanner.id } }));
    for (const id of [image.fileId, orphan.fileId]) {
      stage = 'verify deleted ImageKit file returns 404';
      await until(async () => {
        try {
          await storage.get(id);
          return false;
        } catch (error) {
          if (error.status === 404) return true;
          throw error;
        }
      });
    }
    console.log('Passed: referenced/orphan images return 404.');
    assert.equal(
      (await storage.get(untouched.fileId)).fileId,
      untouched.fileId,
    );
    assert.equal((await call('/me', 'GET', 'other')).status, 200);
    assert.equal((await call('/me/deletion')).body.status, 'completed');
    const tombstone = await app.get(UsersRepository).sync({
      clerkUserId: clerkIds[0],
      email: null,
      updatedAt: Date.now() + 1000000,
    });
    assert.ok(tombstone.deletedAt);
    assert.equal((await call('/me')).status, 401);

    stage = 'completed receipt replay and invalid queue payload';
    const count = completed.length,
      removals = removedAccounts.length;
    await privacy.enqueue(receipt.deletionId, owner.id);
    await until(() => completed.length > count);
    assert.equal(removedAccounts.length, removals);
    const invalid = await queue.add(
      'purge',
      { id: randomUUID(), userId: owner.id, url: 'forbidden' },
      { attempts: 3 },
    );
    await until(() => failed.includes(invalid.id));
    const invalidJob = await queue.getJob(invalid.id);
    assert.equal(await invalidJob.getState(), 'failed');
    assert.equal(invalidJob.attemptsMade, 1);
    assert.equal(invalidJob.failedReason, 'Invalid deletion job');
    console.log(
      'Privacy queue live passed: HTTP 202/idempotency, real BullMQ persisted job/worker restart, lease/upload waits, storage failure/recovery sweep, collections/planner/wear history and referenced/orphan purge, other-owner collection/planner retained, tombstone, replay and invalid payload. Real Neon/Redis/ImageKit; fake identity/Clerk deletion, no AI calls. Fixture claim/retry/grant timestamps advanced.',
    );
  } finally {
    failStorage = false;
    if (app) {
      await worker?.close();
      // A unique namespace contains only this run's jobs; never obliterate the app queue.
      assert.match(queue.opts.prefix, /^stylist-privacy-smoke-[0-9a-f-]{36}$/);
      await queue.obliterate({ force: true });
      const cleanupErrors = [];
      for (const id of files) {
        try {
          await storage.delete(id);
        } catch {
          cleanupErrors.push('image');
        }
      }
      for (const user of users) {
        try {
          await db.garment.updateMany({
            where: { userId: user.id },
            data: { currentAssetId: null },
          });
          for (const table of [...tables, 'accountDeletion'])
            await db[table].deleteMany({ where: { userId: user.id } });
          await redis.del(`stylist:plan-version:${user.clerkUserId}`);
          await until(
            async () => (await storage.listUserFiles(user.id)).length === 0,
          );
          await db.user.delete({ where: { id: user.id } });
        } catch {
          cleanupErrors.push('user');
        }
      }
      await stop();
      assert.deepEqual(cleanupErrors, [], 'Fixture cleanup incomplete');
      console.log(
        'Fixture cleanup passed: user rows/images and isolated BullMQ namespace removed.',
      );
    }
  }
})().catch((error) => {
  console.error(
    `Privacy queue live failed at ${stage}: ${error.code ?? error.name}`,
  );
  let message = error.message;
  for (const [key, value] of Object.entries(process.env))
    if (/secret|key|url|token/i.test(key) && value)
      message = message.replaceAll(value, '[redacted]');
  console.error(message.replace(/https?:\/\/\S+/g, '[url]'));
  process.exitCode = 1;
});
