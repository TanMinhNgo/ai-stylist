// Read-only acceptance evidence. No purchases, provider calls for AI, config changes or user identifiers in output.
require('node:process').loadEnvFile('.env');
const assert = require('node:assert/strict');
const { createClerkClient } = require('@clerk/backend');
const { PrismaClient } = require('../dist/generated/prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PLAN_FEATURES, CLERK_FEATURE_SLUGS, PLAN_STYLIST_LIMITS } = require('@stylist/shared');
const { subscriptionPlan } = require('../dist/usage/plan.service');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
(async () => {
  try {
    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    const catalog = await clerk.billing.getPlanList({ payerType: 'user', limit: 100 });
    assert.equal(catalog.totalCount, catalog.data.length, 'Catalog must fit the inspected page');
    const plans = ['free', 'plus', 'pro'].map(plan => {
      const slug = plan === 'free' ? 'free' : process.env[`CLERK_${plan.toUpperCase()}_PLAN_SLUG`] || plan;
      const actual = catalog.data.find(p => p.slug === slug);
      assert.ok(actual, `Missing ${plan} plan`);
      assert.deepEqual(new Set(actual.features.map(f => f.slug)), new Set(PLAN_FEATURES[plan].map(f => CLERK_FEATURE_SLUGS[f])));
      return { plan, monthlyFee: actual.fee ?? null, features: actual.features.length };
    });
    const users = await db.user.findMany({ where: { deletedAt: null }, select: { clerkUserId: true }, take: 21 });
    assert.ok(users.length <= 20, 'Explicitly scope subscription sampling before inspecting more than 20 accounts');
    const observed = { free: 0, plus: 0, pro: 0, errors: 0 };
    const lookupErrors = {};
    for (const user of users) {
      try {
        const sub = await clerk.billing.getUserBillingSubscription(user.clerkUserId);
        observed[subscriptionPlan(sub.subscriptionItems, process.env.CLERK_PLUS_PLAN_SLUG || 'plus', process.env.CLERK_PRO_PLAN_SLUG || 'pro').plan]++;
      } catch (error) {
        observed.errors++;
        const status = String(error.status ?? error.code ?? error.name);
        lookupErrors[status] = (lookupErrors[status] ?? 0) + 1;
      }
    }
    const costs = await db.$queryRaw`SELECT count(*)::int AS calls, count(*) FILTER(WHERE estimated_usd IS NULL)::int AS unknown_cost_calls, sum(estimated_usd)::float8 AS estimated_usd FROM ai_calls`;
    const [inventory] = await db.$queryRaw`SELECT (SELECT count(*)::int FROM users) users,(SELECT count(*)::int FROM garments) garments,(SELECT count(*)::int FROM outfits) outfits,(SELECT count(*)::int FROM planner_days) planner_days,(SELECT count(*)::int FROM wear_records) wear_records`;
    console.log(JSON.stringify({ generatedAt: new Date().toISOString(), catalogMatched: true, plans,
      localBillingEnabled: process.env.CLERK_BILLING_ENABLED === 'true', observedSubscriptions: observed, subscriptionLookupErrors: lookupErrors,
      stylistSafetyCaps: PLAN_STYLIST_LIMITS, costs: costs[0], inventory, paidReleaseAccepted: false,
      pendingAcceptance: ['Real paid upgrade/downgrade/cancel and signed webhook delivery', 'Measured total AI/storage/payment unit cost by plan; unknown and ambiguous receipts included', 'Authenticated mobile flows and device acceptance; purchase channel decision'],
    }, null, 2));
  } finally { await db.$disconnect(); }
})().catch(error => {
  console.error('Phase6 read-only evidence report failed', error.status ?? error.code ?? error.name);
  process.exitCode = 1;
});
