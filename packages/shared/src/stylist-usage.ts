import { z } from 'zod';
import { Plan } from './usage';
import { StylistAdvice } from './stylist';

export const AdviceLevel = z.enum(['basic', 'advanced']);
export type AdviceLevel = z.infer<typeof AdviceLevel>;
// shortcut: provisional safety caps, calibrate against measured AI cost before paid release.
export const PLAN_STYLIST_LIMITS: Record<z.infer<typeof Plan>, number> = {
  free: 10,
  plus: 60,
  pro: 180,
};
export const BasicStylistAdvice = StylistAdvice.extend({
  strengths: StylistAdvice.shape.strengths.max(2),
  adjustments: StylistAdvice.shape.adjustments.max(0),
  accessories: StylistAdvice.shape.accessories.max(0),
});
export const StylistUsageResponse = z.strictObject({
  plan: Plan,
  adviceLevel: AdviceLevel,
  limit: z.number().int().nonnegative(),
  used: z.number().int().nonnegative(),
  remaining: z.number().int().nonnegative(),
  period: z.literal('calendar_month_utc'),
  resetsAt: z.iso.datetime(),
}).refine(v => v.limit === PLAN_STYLIST_LIMITS[v.plan] &&
  v.remaining === Math.max(0, v.limit - v.used) &&
  v.adviceLevel === (v.plan === 'free' ? 'basic' : 'advanced'));
export type StylistUsageResponse = z.infer<typeof StylistUsageResponse>;
