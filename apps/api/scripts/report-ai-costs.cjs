// Internal read-only report. Never prints prompt/URL/email/token; missing receipts/prices stay unknown.
require('node:process').loadEnvFile('.env');
const { z } = require('zod');
const { PrismaClient } = require('../dist/generated/prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
(async () => {
  try {
    const start = new Date(
      z.iso
        .date()
        .parse(process.argv[2] ?? new Date().toISOString().slice(0, 10)),
    );
    const end = new Date(start.getTime() + 86400000);
    const userId = process.argv[3] ? z.uuid().parse(process.argv[3]) : null;
    const rows =
      await db.$queryRaw`SELECT user_id,job_id,kind,model,status,count(*)::int AS calls,sum(input_tokens)::float8 AS input_tokens,sum(output_tokens)::float8 AS output_tokens,sum(estimated_usd)::float8 AS estimated_usd,count(*) FILTER (WHERE estimated_usd IS NULL)::int AS unknown_cost_calls FROM ai_calls WHERE created_at >= ${start} AND created_at < ${end} AND (${userId}::uuid IS NULL OR user_id=${userId}::uuid) GROUP BY user_id,job_id,kind,model,status ORDER BY user_id,job_id LIMIT 1000`;
    console.log(
      JSON.stringify(
        { date: start.toISOString().slice(0, 10), maxRows: 1000, rows },
        null,
        2,
      ),
    );
  } finally {
    await db.$disconnect();
  }
})().catch(() => {
  console.error(
    'AI cost report failed; check date, user ID and database access.',
  );
  process.exitCode = 1;
});
