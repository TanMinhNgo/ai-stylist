import { z } from 'zod';

export const ErrorCode = z.enum([
  'QUOTA_EXCEEDED', 'RATE_LIMITED',
  'ASSET_QUOTA_EXCEEDED','ASSET_INPUT_INVALID','ASSET_PROVIDER_ERROR','ASSET_TIMEOUT','ASSET_CONTENT_REJECTED','ASSET_DISABLED',
  'TRYON_CONTENT_REJECTED', 'TRYON_TIMEOUT', 'TRYON_PROVIDER_ERROR',
  'TRYON_INPUT_NOT_READY', 'TRYON_GARMENT_NOT_ALLOWED', 'IDEMPOTENCY_CONFLICT',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'VALIDATION_ERROR',
  'INTERNAL_ERROR',
  'UPLOAD_INVALID',
  'UPLOAD_EXPIRED',
  'PHOTO_NOT_FULL_BODY',
  'PHOTO_MULTIPLE_PEOPLE',
  'PHOTO_NOT_ALLOWED',
  'PHOTO_NOT_USABLE',
  'MEDIA_PROCESSING_FAILED',
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ApiError = z.strictObject({
  code: ErrorCode,
  message: z.string().min(1),
  details: z.unknown().optional(),
});
export type ApiError = z.infer<typeof ApiError>;
