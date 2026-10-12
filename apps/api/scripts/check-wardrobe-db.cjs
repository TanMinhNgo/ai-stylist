// Real DB checks run in a transaction that always rolls back every fixture.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { loadEnvFile } = require('node:process');
const { PrismaClient } = require('../dist/generated/prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { MediaRepository } = require('../dist/media/media.repository');
const { EMBEDDING_DIMENSIONS } = require('@stylist/shared');
loadEnvFile('.env');
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const rollback = new Error('rollback fixtures');
const tags = {
  category: 'top',
  type: 'shirt',
  slot: 'top',
  colors: ['trắng'],
  material: 'cotton',
  formality: 3,
  pattern: 'solid',
  fit: 'regular',
  length: 'regular',
  sleeve: 'long',
  neckline: 'cổ bẻ',
  rise: null,
  season: ['all'],
  occasions: ['đi làm'],
};
(async () => {
  try {
    await prisma.$transaction(
      async (tx) => {
        const repository = new MediaRepository({
          uploadGrant: tx.uploadGrant,
          garment: tx.garment,
          modelPhoto: tx.modelPhoto,
          $executeRaw: tx.$executeRaw.bind(tx),
          $transaction: (callback) => callback(tx),
        });
        const user = await tx.user.create({
          data: { clerkUserId: `user_db_fixture_${randomUUID()}` },
        });
        const other = await tx.user.create({
          data: { clerkUserId: `user_db_fixture_${randomUUID()}` },
        });
        const token = randomUUID();
        const folder = `/stylist/${user.id}/${token}`;
        await repository.createGrant(
          token,
          user.id,
          folder,
          new Date(Date.now() + 60000),
        );
        assert.equal(await repository.grant(token, other.id), null);
        const file = {
          fileId: `fixture_${randomUUID()}`,
          filePath: `${folder}/shirt.jpg`,
        };
        const row = await repository.register('garment', token, user.id, file);
        await assert.rejects(
          repository.register('garment', token, user.id, file),
        );
        assert.equal(await repository.find('garment', other.id, row.id), null);
        await assert.rejects(
          repository.list('garment', other.id, { limit: 20, cursor: row.id }),
        );
        await repository.readyGarment(
          user.id,
          row.id,
          tags,
          Array(EMBEDDING_DIMENSIONS).fill(0.1),
        );
        const ready = await repository.find('garment', user.id, row.id);
        assert.equal(ready.status, 'ready');
        assert.equal(ready.tags.type, 'shirt');
        const vector =
          await tx.$queryRaw`SELECT vector_dims(embedding) AS dimensions FROM garments WHERE id = ${row.id}::uuid`;
        assert.equal(vector[0].dimensions, EMBEDDING_DIMENSIONS);
        assert.equal(
          (
            await repository.list('garment', user.id, {
              limit: 20,
              category: 'bag',
            })
          ).length,
          0,
        );
        assert.equal(
          (
            await repository.list('garment', user.id, {
              limit: 20,
              category: 'top',
            })
          ).length,
          1,
        );
        await repository.remove('garment', other.id, row.id);
        assert.ok(await repository.find('garment', user.id, row.id));
        await repository.remove('garment', user.id, row.id);
        await repository.readyGarment(
          user.id,
          row.id,
          tags,
          Array(EMBEDDING_DIMENSIONS).fill(0.1),
        );
        assert.equal(await repository.find('garment', user.id, row.id), null);
        throw rollback;
      },
      { timeout: 20000 },
    );
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    await prisma.$disconnect();
  }
  console.log(
    'Wardrobe DB checks passed: ownership, grant reuse, category filter, vector dimensions, deletion; fixtures rolled back.',
  );
})().catch((error) => {
  console.error(
    error.name,
    error.code || '',
    error instanceof assert.AssertionError ? error.message : '',
  );
  console.error('Wardrobe DB check failed (no credential data logged).');
  process.exitCode = 1;
});
