import { z } from "zod";
import { Plan } from "./usage";

export const SubscriptionFeature = z.enum([
  "digital_wardrobe",
  "ai_styling",
  "personal_lookbook",
  "monthly_try_on_5",
  "monthly_try_on_20",
  "monthly_try_on_60",
  "advanced_outfit_advice",
  "accessory_recommendations",
  "occasion_collections",
  "weekly_outfit_planner",
  "wardrobe_insights",
  "priority_queue",
]);
export type SubscriptionFeature = z.infer<typeof SubscriptionFeature>;

const common = ["digital_wardrobe", "ai_styling", "personal_lookbook"] as const;
const advanced = [
  "advanced_outfit_advice",
  "accessory_recommendations",
  "occasion_collections",
] as const;
export const PLAN_FEATURES: Record<Plan, readonly SubscriptionFeature[]> = {
  free: [...common, "monthly_try_on_5"],
  plus: [...common, "monthly_try_on_20", ...advanced],
  pro: [
    ...common,
    "monthly_try_on_60",
    ...advanced,
    "weekly_outfit_planner",
    "wardrobe_insights",
    "priority_queue",
  ],
};
export const PLAN_TRY_ON_LIMITS: Record<Plan, number> = {
  free: 5,
  plus: 20,
  pro: 60,
};

// Clerk generated these slugs from the Vietnamese names; API feature IDs remain stable.
export const CLERK_FEATURE_SLUGS: Record<SubscriptionFeature, string> = {
  digital_wardrobe: "tu_do_so",
  ai_styling: "tu_van_phoi_do_ai",
  personal_lookbook: "lookbook_ca_nhan",
  monthly_try_on_5: "5_luot_thu_do_ai_moi_thang",
  monthly_try_on_20: "20_luot_thu_do_ai_moi_thang",
  monthly_try_on_60: "60_luot_thu_do_ai_moi_thang",
  advanced_outfit_advice: "phan_tich_bo_phoi_chi_tiet",
  accessory_recommendations: "goi_y_phu_kien",
  occasion_collections: "bo_suu_tap_theo_dip",
  weekly_outfit_planner: "ke_hoach_trang_phuc_tuan",
  wardrobe_insights: "phan_tich_tu_do",
  priority_queue: "uu_tien_hang_cho",
};

export const AVAILABLE_SUBSCRIPTION_FEATURES: readonly SubscriptionFeature[] = [
  ...common,
  "monthly_try_on_5",
  "monthly_try_on_20",
  "monthly_try_on_60",
  "priority_queue",
  "advanced_outfit_advice",
  "accessory_recommendations",
  "occasion_collections",
  "weekly_outfit_planner",
  "wardrobe_insights",
];
const features = z
  .array(SubscriptionFeature)
  .refine((items) => new Set(items).size === items.length);
export const EntitlementsResponse = z
  .strictObject({
    plan: Plan,
    includedFeatures: features,
    availableFeatures: features,
    tryOn: z.strictObject({
      limit: z.number().int().nonnegative(),
      period: z.literal("calendar_month_utc"),
      resetsAt: z.iso.datetime(),
    }),
  })
  .refine(
    (value) =>
      value.includedFeatures.length === PLAN_FEATURES[value.plan].length &&
      value.includedFeatures.every((feature) =>
        PLAN_FEATURES[value.plan].includes(feature),
      ) &&
      value.availableFeatures.every(
        (feature) =>
          value.includedFeatures.includes(feature) &&
          AVAILABLE_SUBSCRIPTION_FEATURES.includes(feature) &&
          (!feature.startsWith("monthly_try_on_") ||
            value.tryOn.limit === PLAN_TRY_ON_LIMITS[value.plan]),
      ),
  );
export type EntitlementsResponse = z.infer<typeof EntitlementsResponse>;
