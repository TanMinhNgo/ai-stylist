import { z } from 'zod';

export const Plan = z.enum(['free', 'plus', 'pro']);
export type Plan = z.infer<typeof Plan>;
export const UsageResponse = z.strictObject({
  plan: Plan,
  limit: z.number().int().nonnegative(),
  used: z.number().int().nonnegative(),
  remaining: z.number().int().nonnegative(),
  resetsAt: z.iso.datetime(),
});
export type UsageResponse = z.infer<typeof UsageResponse>;
export const AccountDeletionResponse = z.strictObject({
  deletionId: z.uuid(),
  status: z.enum(['queued', 'processing', 'failed', 'completed']),
});
export type AccountDeletionResponse = z.infer<typeof AccountDeletionResponse>;
