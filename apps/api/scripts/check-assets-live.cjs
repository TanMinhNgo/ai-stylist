const { PrivacyProcessor } = require('../dist/privacy/privacy.processor');
const { RateLimitGuard } = require('../dist/usage/rate-limit.guard');
const { JobLimitsService } = require('../dist/usage/job-limits.service');
const { StylistService } = require('../dist/stylist/stylist.service');
const { StylistProcessor } = require('../dist/stylist/stylist.processor');
const { getQueueToken: stylistQueueToken } = require('@nestjs/bullmq');
// Real Neon/Redis/ImageKit, fake AI; all fixture data is scoped and cleaned.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { loadEnvFile } = require('node:process');
const { setTimeout: delay } = require('node:timers/promises');
const { readFileSync } = require('node:fs');
loadEnvFile('.env');
process.env.ASSET_GENERATION_ENABLED = 'true';
process.env.ASSET_PROVIDER = 'fake';
process.env.ASSET_GENERATION_USER_IDS = '';
const { Test } = require('@nestjs/testing');
const { ExpressAdapter } = require('@nestjs/platform-express');
const { getQueueToken } = require('@nestjs/bullmq');
const { AppModule } = require('../dist/app.module');
const { IdentityProvider } = require('../dist/auth/identity.provider');
const { PrismaService } = require('../dist/database/prisma.service');
const { VisionProvider } = require('../dist/media/vision.provider');
const {
  AssetProvider,
  AssetProviderError,
} = require('../dist/garment-assets/asset.provider');
const {
  FakeAssetProvider,
} = require('../dist/garment-assets/fake-asset.provider');
const { PrismaClient } = require('../dist/generated/prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const ImageKit = require('@imagekit/nodejs').default;
const sharp = require('sharp');
const {
  Garment,
  UploadAuthResponse,
  AssetJobResponse,
  IdeaJobResponse,
  AssetQuotaResponse,
} = require('@stylist/shared');
const tags = {
  category: 'top',
  type: 'shirt',
  slot: 'top',
  colors: ['white'],
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
let stage = 'bootstrap';
(async () => {
  let app,
    prisma,
    users = [],
    jobs = [],
    files = new Set(),
    releaseGate;
  const tokens = [randomUUID(), randomUUID(), randomUUID()],
    clerkIds = tokens.map(() => `user_asset_fixture_${randomUUID()}`);
  const fake = new FakeAssetProvider();
  const imagekit = new ImageKit({
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
    maxRetries: 0,
    timeout: 20000,
  });
  try {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrivacyProcessor)
      .useValue({})
      .overrideProvider(getQueueToken('privacy'))
      .useValue({ add: async () => ({}) })
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: () => true })
      .overrideProvider(JobLimitsService)
      .useValue({ lock: async () => {}, check: async () => {} })
      .overrideProvider(IdentityProvider)
      .useValue({
        verifyToken: async (token) => {
          const index = tokens.indexOf(token);
          assert.ok(index >= 0);
          return clerkIds[index];
        },
      })
      .overrideProvider(VisionProvider)
      .useValue({
        garment: async () => tags,
        embedding: async () => Array(1024).fill(0.1),
      })
      .overrideProvider(AssetProvider)
      .useValue({
        name: 'fake',
        model: 'fake',
        plan: (input) => fake.plan(input),
        checkPhoto: () => Promise.resolve(),
        generate: async (input) => {
          if (input.prompt === 'SAFE_FAIL')
            throw new AssetProviderError('ASSET_INPUT_INVALID', true);
          if (input.prompt === 'AMBIGUOUS')
            throw new Error('private provider URL must not be logged');
          if (input.prompt.includes('GATED'))
            await new Promise((resolve) => {
              releaseGate = resolve;
            });
          return fake.generate();
        },
      })
      .overrideProvider(StylistService)
      .useValue({ auto: () => Promise.resolve() })
      .overrideProvider(StylistProcessor)
      .useValue({})
      .overrideProvider(stylistQueueToken('stylist'))
      .useValue({})
      .compile();
    app = module.createNestApplication(new ExpressAdapter(), { logger: false });
    prisma = app.get(PrismaService);
    for (const clerkUserId of clerkIds)
      users.push(await prisma.user.create({ data: { clerkUserId } }));
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    const headers = (index = 0) => ({
      Authorization: `Bearer ${tokens[index]}`,
      'Content-Type': 'application/json',
    });
    async function request(path, method = 'GET', body, index = 0, key) {
      const response = await fetch(base + path, {
        method,
        headers: {
          ...headers(index),
          ...(key ? { 'Idempotency-Key': key } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: response.status, body: await response.json() };
    }
    async function submit(items, index = 0, key = randomUUID()) {
      const result = await request(
        '/garment-asset-jobs',
        'POST',
        { items },
        index,
        key,
      );
      assert.equal(result.status, 201);
      jobs.push(...result.body.jobIds);
      return result.body.jobIds;
    }
    async function poll(path, schema, index = 0) {
      for (let i = 0; i < 100; i++) {
        const r = await request(path, 'GET', undefined, index);
        assert.equal(r.status, 200);
        const data = schema.parse(r.body);
        if (['ready', 'failed'].includes(data.status)) return data;
        await delay(500);
      }
      throw new Error('Fixture job timeout');
    }
    async function upload(index = 0) {
      const r = await request('/uploads/auth', 'GET', undefined, index);
      assert.equal(r.status, 200);
      const auth = UploadAuthResponse.parse(r.body);
      const file = await imagekit.files.upload({
        file: readFileSync(
          '../../packages/shared/assets/wardrobe/white-shirt.png',
        ).toString('base64'),
        fileName: 'fixture-shirt.png',
        folder: auth.folder,
        isPrivateFile: true,
        useUniqueFileName: true,
      });
      files.add(file.fileId);
      return {
        imagekitFileId: file.fileId,
        url: file.url,
        uploadToken: auth.token,
      };
    }
    stage = 'automatic photo asset';
    const original = await request('/garments', 'POST', {
      ...(await upload()),
      generateAsset: true,
      bodyKey: 'm',
      requestedType: 'shirt',
    });
    assert.equal(original.status, 201);
    let garment;
    for (let i = 0; i < 100; i++) {
      const r = await request(`/garments/${original.body.id}`);
      garment = Garment.parse(r.body);
      if (garment.mannequinAsset) break;
      await delay(500);
    }
    assert.ok(garment.mannequinAsset);
    assert.equal(garment.status, 'ready');
    assert.equal(garment.source, 'user_photo');
    assert.ok(garment.assetJob.id);
    jobs.push(garment.assetJob.id);
    const image = await fetch(garment.mannequinAsset.url);
    assert.equal(image.status, 200);
    const decoded = await sharp(Buffer.from(await image.arrayBuffer()))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    assert.equal(decoded.data[3], 0);
    assert.equal(
      (
        await request(
          `/garment-asset-jobs/${garment.assetJob.id}`,
          'GET',
          undefined,
          1,
        )
      ).status,
      404,
    );
    stage = 'ideas and batch idempotency';
    const proposal = await request(
      '/garment-ideas',
      'POST',
      { menu: 'outfit', prompt: 'bộ công sở navy', bodyKey: 'm' },
      0,
      randomUUID(),
    );
    assert.equal(proposal.status, 201);
    jobs.push(proposal.body.jobId);
    assert.equal(
      (await poll(`/garment-ideas/${proposal.body.jobId}`, IdeaJobResponse))
        .items.length,
      4,
    );
    const idea = {
        source: 'idea',
        type: 'shirt',
        prompt: 'áo trắng',
        bodyKey: 'm',
      },
      key = randomUUID();
    const pair = await Promise.all([
      submit([idea, { ...idea, prompt: 'áo linen' }], 0, key),
      submit([idea, { ...idea, prompt: 'áo linen' }], 0, key),
    ]);
    assert.deepEqual(pair[0], pair[1]);
    const conflict = await request(
      '/garment-asset-jobs',
      'POST',
      { items: [{ ...idea, prompt: 'khác' }] },
      0,
      key,
    );
    assert.equal(conflict.status, 409);
    const first = await poll(
      `/garment-asset-jobs/${pair[0][0]}`,
      AssetJobResponse,
    );
    assert.equal(first.status, 'ready');
    const concept = await request(`/garments/${first.garmentId}`);
    assert.equal(Garment.parse(concept.body).source, 'ai_concept');
    const quota = AssetQuotaResponse.parse(
      (await request('/asset-generation/quota')).body,
    );
    assert.equal(quota.remaining, 2);
    stage = 'atomic last quota slots';
    const raced = await Promise.all(
      [1, 2].map(() =>
        request(
          '/garment-asset-jobs',
          'POST',
          { items: [idea, { ...idea, prompt: 'áo cotton' }] },
          0,
          randomUUID(),
        ),
      ),
    );
    assert.deepEqual(raced.map((r) => r.status).sort(), [201, 429]);
    for (const r of raced) if (r.status === 201) jobs.push(...r.body.jobIds);
    assert.equal(
      AssetQuotaResponse.parse((await request('/asset-generation/quota')).body)
        .remaining,
      0,
    );
    assert.equal(
      await prisma.assetJob.count({
        where: {
          userId: users[0].id,
          kind: { in: ['photo', 'idea'] },
          refundedAt: null,
        },
      }),
      5,
    );
    stage = 'safe refund versus ambiguous receipt';
    const [safe] = await submit([{ ...idea, prompt: 'SAFE_FAIL' }], 1);
    assert.equal(
      (await poll(`/garment-asset-jobs/${safe}`, AssetJobResponse, 1)).status,
      'failed',
    );
    assert.equal(
      AssetQuotaResponse.parse(
        (await request('/asset-generation/quota', 'GET', undefined, 1)).body,
      ).remaining,
      5,
    );
    const ambiguousKey = randomUUID();
    const [ambiguous] = await submit(
      [{ ...idea, prompt: 'AMBIGUOUS' }],
      1,
      ambiguousKey,
    );
    assert.equal(
      (await poll(`/garment-asset-jobs/${ambiguous}`, AssetJobResponse, 1))
        .status,
      'failed',
    );
    assert.equal(
      AssetQuotaResponse.parse(
        (await request('/asset-generation/quota', 'GET', undefined, 1)).body,
      ).remaining,
      4,
    );
    assert.deepEqual(
      await submit([{ ...idea, prompt: 'AMBIGUOUS' }], 1, ambiguousKey),
      [ambiguous],
    );
    const queue = app.get(getQueueToken('garment-assets'));
    const failedJob = await queue.getJob(`asset-${ambiguous}`);
    assert.ok(!failedJob.failedReason.includes('private'));
    stage = 'delete during worker generation';
    const gatedPhoto = await request(
      '/garments',
      'POST',
      { ...(await upload(2)) },
      2,
    );
    assert.equal(gatedPhoto.status, 201);
    let gatedGarment;
    for (let i = 0; i < 100; i++) {
      gatedGarment = Garment.parse(
        (await request(`/garments/${gatedPhoto.body.id}`, 'GET', undefined, 2))
          .body,
      );
      if (gatedGarment.status === 'ready') break;
      await delay(500);
    }
    await prisma.garment.update({
      where: { id: gatedGarment.id },
      data: { tags: { ...tags, material: 'GATED' } },
    });
    const [gated] = await submit(
      [{ source: 'photo', garmentId: gatedGarment.id, bodyKey: 'm' }],
      2,
    );
    for (let i = 0; i < 100 && !releaseGate; i++) await delay(100);
    assert.ok(releaseGate);
    const deleted = await request(
      `/garments/${gatedGarment.id}`,
      'DELETE',
      undefined,
      2,
    );
    assert.equal(deleted.status, 200);
    releaseGate();
    releaseGate = undefined;
    await delay(1000);
    assert.equal(
      await prisma.garment.count({ where: { id: gatedGarment.id } }),
      0,
    );
    assert.equal(
      (await request(`/garment-asset-jobs/${gated}`, 'GET', undefined, 2))
        .status,
      404,
    );
    assert.equal(
      (await prisma.assetJob.findUnique({ where: { id: gated } })).resultFileId,
      null,
    );
    console.log(
      'Asset live fake checks passed: auto photo, alpha PNG, ideas, concept wardrobe, batch idempotency, concurrency cap 5, safe refunds, ambiguous receipts, ownership, deletion race. No AI calls.',
    );
  } finally {
    if (releaseGate) releaseGate();
    if (app) {
      try {
        const queue = app.get(getQueueToken('garment-assets'));
        for (const id of new Set(jobs)) await queue.remove(`asset-${id}`);
      } finally {
        await app.close();
      }
    }
    if (users.length) {
      const cleanup = new PrismaClient({
        adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
      });
      try {
        const userIds = users.map((u) => u.id);
        for (const row of await cleanup.assetJob.findMany({
          where: { userId: { in: userIds } },
        }))
          if (row.resultFileId) files.add(row.resultFileId);
        for (const id of files) {
          try {
            await imagekit.files.delete(id);
          } catch (error) {
            if (error.status !== 404)
              throw new Error('Fixture file cleanup failed');
          }
        }
        await cleanup.garment.updateMany({
          where: { userId: { in: userIds } },
          data: { currentAssetId: null },
        });
        await cleanup.assetJob.deleteMany({
          where: { userId: { in: userIds } },
        });
        await cleanup.garment.deleteMany({
          where: { userId: { in: userIds } },
        });
        await cleanup.uploadGrant.deleteMany({
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
    `Asset live fake check failed at ${stage}; no credentials/private URLs logged.`,
  );
  process.exitCode = 1;
});
