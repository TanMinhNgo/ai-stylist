import { z } from 'zod';
import { ErrorCode } from './errors';

export const TryOnStatus = z.enum(['queued', 'processing', 'done', 'failed']);
export const IdempotencyKey = z.string().min(8).max(128).regex(/^[A-Za-z0-9_-]+$/);
export const CreateTryOnRequest = z.strictObject({
  modelPhotoId: z.uuid(),
  garmentIds: z.array(z.uuid()).min(1).max(4).refine(ids => new Set(ids).size === ids.length),
  occasion: z.string().trim().min(1).max(120),
});
export const CreateTryOnResponse = z.strictObject({ jobId: z.uuid() });
export const TryOnJobResponse = z.strictObject({
  id: z.uuid(), status: TryOnStatus,
  resultUrl: z.url().nullable(), errorCode: ErrorCode.nullable(), outfitId: z.uuid().nullable(),
  provider: z.enum(['openai', 'fake']), createdAt: z.iso.datetime(),
});
export type CreateTryOnRequest = z.infer<typeof CreateTryOnRequest>;
export type CreateTryOnResponse = z.infer<typeof CreateTryOnResponse>;
export type TryOnStatus = z.infer<typeof TryOnStatus>;
export type TryOnJobResponse = z.infer<typeof TryOnJobResponse>;
