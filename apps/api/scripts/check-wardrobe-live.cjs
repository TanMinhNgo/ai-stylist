// Explicit live smoke test: one synthetic garment, paid AI calls, fixture cleanup.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { loadEnvFile } = require('node:process');
const { setTimeout: delay } = require('node:timers/promises');
const { Test } = require('@nestjs/testing');
const { ExpressAdapter } = require('@nestjs/platform-express');
const ImageKit = require('@imagekit/nodejs').default;
const { AppModule } = require('../dist/app.module');
const { IdentityProvider } = require('../dist/auth/identity.provider');
const { PrismaService } = require('../dist/database/prisma.service');
const { UploadAuthResponse, Garment } = require('@stylist/shared');
loadEnvFile('.env');
let stage = 'bootstrap';

(async () => {
  let app, prisma, user, fileId, garmentId, uploadToken;
  const clerkId = `user_smoke_${randomUUID()}`;
  const bearer = randomUUID();
  const imagekit = new ImageKit({
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
    maxRetries: 0,
    timeout: 20000,
  });
  try {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(IdentityProvider)
      .useValue({
        verifyToken: async (token) => {
          if (token !== bearer) throw new Error('Invalid test token');
          return clerkId;
        },
      })
      .compile();
    app = module.createNestApplication(new ExpressAdapter(), { logger: false });
    prisma = app.get(PrismaService);
    user = await prisma.user.create({ data: { clerkUserId: clerkId } });
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    const headers = { Authorization: `Bearer ${bearer}` };
    const authResponse = await fetch(`${base}/uploads/auth`, { headers });
    assert.equal(authResponse.status, 200);
    const auth = UploadAuthResponse.parse(await authResponse.json());
    stage = 'private upload';
    uploadToken = auth.token;
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="white"/><path d="M170 90L80 155L125 235L165 215L165 440L347 440L347 215L387 235L432 155L342 90L300 90Q256 145 212 90Z" fill="#2878bc" stroke="#153b65" stroke-width="5"/></svg>';
    const uploaded = await imagekit.files.upload({
      file: Buffer.from(svg).toString('base64'),
      fileName: 'synthetic-shirt.svg',
      folder: auth.folder,
      isPrivateFile: true,
      useUniqueFileName: true,
    });
    fileId = uploaded.fileId;
    assert.ok(fileId && uploaded.url);
    stage = 'register garment';
    const created = await fetch(`${base}/garments`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imagekitFileId: fileId,
        url: uploaded.url,
        uploadToken,
      }),
    });
    assert.equal(created.status, 201);
    const pending = Garment.parse(await created.json());
    garmentId = pending.id;
    stage = 'worker analysis';
    console.log('Live private upload registered; waiting for BullMQ analysis.');
    const deadline = Date.now() + 150000;
    let garment;
    while (Date.now() < deadline) {
      const result = await fetch(`${base}/garments/${garmentId}`, { headers });
      assert.equal(result.status, 200);
      garment = Garment.parse(await result.json());
      if (garment.status !== 'pending') break;
      await delay(1500);
    }
    assert.equal(
      garment.status,
      'ready',
      garment.errorCode || 'analysis timed out',
    );
    assert.ok(garment.tags);
    stage = 'signed thumbnail';
    const thumbnail = await fetch(garment.thumbnailUrl);
    assert.equal(thumbnail.status, 200);
    await thumbnail.arrayBuffer();
    stage = 'delete garment';
    const deleted = await fetch(`${base}/garments/${garmentId}`, {
      method: 'DELETE',
      headers,
    });
    assert.equal(deleted.status, 200);
    garmentId = undefined;
    await assert.rejects(
      imagekit.files.get(fileId),
      (error) => error.status === 404,
    );
    fileId = undefined;
    console.log(
      'Live smoke passed: private ImageKit upload, BullMQ, OpenAI vision+embedding, signed thumbnail, deletion.',
    );
  } finally {
    if (app) await app.close();
    if (fileId) {
      try {
        await imagekit.files.delete(fileId);
      } catch {
        console.error('Fixture ImageKit cleanup needs review.');
      }
    }
    if (prisma && user) {
      const { PrismaClient } = require('../dist/generated/prisma/client');
      const { PrismaPg } = require('@prisma/adapter-pg');
      const cleanup = new PrismaClient({
        adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
      });
      try {
        await cleanup.garment.deleteMany({ where: { userId: user.id } });
        await cleanup.uploadGrant.deleteMany({ where: { userId: user.id } });
        await cleanup.user.delete({ where: { id: user.id } });
      } finally {
        await cleanup.$disconnect();
      }
    }
  }
})().catch(() => {
  console.error(
    `Live wardrobe smoke failed at ${stage}; no provider messages or private URLs logged.`,
  );
  process.exitCode = 1;
});
