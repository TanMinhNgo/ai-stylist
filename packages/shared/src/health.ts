import { z } from 'zod';

export const HealthResponse = z.strictObject({ status: z.literal('ok') });
export type HealthResponse = z.infer<typeof HealthResponse>;
