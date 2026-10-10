// Run after build/migration. Every fixture write is rolled back, even on failure.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { existsSync } = require('node:fs');
const { loadEnvFile } = require('node:process');
const { PrismaClient } = require('../dist/generated/prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { UsersRepository } = require('../dist/auth/users.repository');

if (existsSync('.env')) loadEnvFile('.env');
const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  }),
});
const rollback = new Error('fixture rollback');

(async () => {
  try {
    await prisma.$transaction(
      async (tx) => {
        const repository = new UsersRepository(tx);
        const profile = {
          clerkUserId: `user_fixture_${randomUUID()}`,
          email: 'fixture@example.com',
          updatedAt: 100,
        };
        const created = await repository.sync(profile);
        assert.ok(created);
        const duplicate = await repository.sync(profile);
        assert.equal(duplicate.id, created.id);
        assert.equal(
          duplicate.createdAt.getTime(),
          created.createdAt.getTime(),
        );
        const stale = await repository.sync({
          ...profile,
          email: 'stale@example.com',
          updatedAt: 99,
        });
        assert.equal(stale.email, profile.email);
        const updated = await repository.sync({
          ...profile,
          email: 'new@example.com',
          updatedAt: 200,
        });
        assert.equal(updated.email, 'new@example.com');
        const deleted = await repository.sync(
          { ...profile, updatedAt: 300 },
          true,
        );
        assert.equal(deleted.email, null);
        assert.ok(deleted.deletedAt);
        const replayed = await repository.sync({ ...profile, updatedAt: 400 });
        assert.equal(replayed.email, null);
        assert.ok(replayed.deletedAt);
        const unknown = await repository.sync(
          {
            ...profile,
            clerkUserId: `${profile.clerkUserId}_deleted`,
            updatedAt: 300,
          },
          true,
        );
        assert.ok(unknown.deletedAt);
        const lateCreate = await repository.sync({
          ...profile,
          clerkUserId: unknown.clerkUserId,
        });
        assert.ok(lateCreate.deletedAt);
        throw rollback;
      },
      { timeout: 15000 },
    );
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    await prisma.$disconnect();
  }
  console.log(
    'Database sync checks passed: duplicate/stale/update/delete/replay; fixtures rolled back.',
  );
})().catch(() => {
  console.error(
    'Database sync check failed; inspect configuration/schema without logging credentials.',
  );
  process.exitCode = 1;
});
