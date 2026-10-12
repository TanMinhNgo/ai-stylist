import { z } from 'zod';

export const ErrorCode = z.enum([
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
