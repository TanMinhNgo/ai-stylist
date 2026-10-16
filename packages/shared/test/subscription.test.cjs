const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  PLAN_FEATURES,
  PLAN_TRY_ON_LIMITS,
  CLERK_FEATURE_SLUGS,
  AVAILABLE_SUBSCRIPTION_FEATURES,
  SubscriptionFeature,
  EntitlementsResponse,
} = require("../dist");

test("each plan has one quota feature and inherits only its intended benefits", () => {
  assert.deepEqual(PLAN_TRY_ON_LIMITS, { free: 5, plus: 20, pro: 60 });
  for (const [plan, count] of [
    ["free", 4],
    ["plus", 7],
    ["pro", 10],
  ]) {
    assert.equal(PLAN_FEATURES[plan].length, count);
    assert.equal(new Set(PLAN_FEATURES[plan]).size, count);
    assert.deepEqual(
      PLAN_FEATURES[plan].filter((f) => f.startsWith("monthly_try_on_")),
      [`monthly_try_on_${PLAN_TRY_ON_LIMITS[plan]}`],
    );
  }
  assert.equal(PLAN_FEATURES.free.includes("advanced_outfit_advice"), false);
  assert.equal(PLAN_FEATURES.plus.includes("weekly_outfit_planner"), false);
  assert.equal(PLAN_FEATURES.pro.includes("priority_queue"), true);
  assert.equal(new Set(Object.values(CLERK_FEATURE_SLUGS)).size, 12);
  assert.deepEqual(
    Object.keys(CLERK_FEATURE_SLUGS).sort(),
    [...SubscriptionFeature.options].sort(),
  );
});

test("entitlements distinguish purchased benefits from implemented capabilities", () => {
  const value = {
    plan: "pro",
    includedFeatures: PLAN_FEATURES.pro,
    availableFeatures: PLAN_FEATURES.pro.filter((f) =>
      AVAILABLE_SUBSCRIPTION_FEATURES.includes(f),
    ),
    tryOn: {
      limit: 60,
      period: "calendar_month_utc",
      resetsAt: "2026-11-01T00:00:00Z",
    },
  };
  assert.ok(EntitlementsResponse.safeParse(value).success);
  assert.equal(
    EntitlementsResponse.safeParse({
      ...value,
      availableFeatures: [...value.availableFeatures, "weekly_outfit_planner"],
    }).success,
    false,
  );
  assert.equal(
    EntitlementsResponse.safeParse({ ...value, plan: "free" }).success,
    false,
  );
  assert.equal(
    EntitlementsResponse.safeParse({ ...value, price: 16.99 }).success,
    false,
  );
  assert.equal(
    EntitlementsResponse.safeParse({
      ...value,
      availableFeatures: [...value.availableFeatures, "priority_queue"],
    }).success,
    false,
  );
  assert.equal(
    EntitlementsResponse.safeParse({
      ...value,
      tryOn: { ...value.tryOn, limit: 200 },
    }).success,
    false,
  );
  assert.ok(
    EntitlementsResponse.safeParse({
      ...value,
      tryOn: { ...value.tryOn, limit: 200 },
      availableFeatures: value.availableFeatures.filter(
        (f) => f !== "monthly_try_on_60",
      ),
    }).success,
  );
});
