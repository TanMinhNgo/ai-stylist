import {z} from 'zod';
import {ErrorCode} from './errors';
export const BodyKey=z.enum(['m','f']);
export const AssetStatus=z.enum(['queued','processing','ready','failed']);
export const MannequinAsset = z.strictObject({
  url:z.url(),thumbnailUrl:z.url(),bodyKey:BodyKey,width:z.number().int().positive(),height:z.number().int().positive(),
  bounds:z.tuple([z.number().int().nonnegative(),z.number().int().nonnegative(),z.number().int().positive(),z.number().int().positive()]),
  isMock:z.boolean(),
});
export const AssetJobSummary = z.strictObject({id:z.uuid().nullable(),status:z.enum(['queued','processing','ready','failed','deferred']),bodyKey:BodyKey,errorCode:ErrorCode.nullable()});

export type BodyKey=z.infer<typeof BodyKey>;
export type MannequinAsset=z.infer<typeof MannequinAsset>;
