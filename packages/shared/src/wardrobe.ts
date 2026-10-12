import { z } from 'zod';
import { ErrorCode } from './errors';
import { BodyKey, MannequinAsset, AssetJobSummary } from './mannequin-asset';

export const ProcessingStatus = z.enum(['pending', 'ready', 'failed']);
export type ProcessingStatus = z.infer<typeof ProcessingStatus>;
export const GarmentCategory = z.enum(['top', 'outerwear', 'pants', 'skirt', 'dress', 'one_piece', 'traditional', 'shoes', 'bag', 'accessory']);
export const GarmentSlot = z.enum(['top', 'outer', 'bottom', 'dress', 'shoes', 'bag', 'hat', 'eyewear', 'neck', 'belt', 'jewelry', 'watch']);

export const GARMENT_TYPES = {
  shirt: ['top', 'top'], t_shirt: ['top', 'top'], blouse: ['top', 'top'], polo: ['top', 'top'], tank_top: ['top', 'top'], sweater: ['top', 'top'], hoodie: ['top', 'top'], other_top: ['top', 'top'],
  blazer: ['outerwear', 'outer'], jacket: ['outerwear', 'outer'], coat: ['outerwear', 'outer'], cardigan: ['outerwear', 'outer'], vest: ['outerwear', 'outer'], other_outerwear: ['outerwear', 'outer'],
  jeans: ['pants', 'bottom'], trousers: ['pants', 'bottom'], shorts: ['pants', 'bottom'], wide_leg: ['pants', 'bottom'], leggings: ['pants', 'bottom'], other_pants: ['pants', 'bottom'],
  mini_skirt: ['skirt', 'bottom'], midi_skirt: ['skirt', 'bottom'], maxi_skirt: ['skirt', 'bottom'], other_skirt: ['skirt', 'bottom'],
  mini_dress: ['dress', 'dress'], midi_dress: ['dress', 'dress'], maxi_dress: ['dress', 'dress'], other_dress: ['dress', 'dress'],
  jumpsuit: ['one_piece', 'dress'], romper: ['one_piece', 'dress'], underwear: ['one_piece', 'dress'], swimwear: ['one_piece', 'dress'], sleepwear: ['one_piece', 'dress'], other_one_piece: ['one_piece', 'dress'],
  ao_dai: ['traditional', 'dress'], kimono: ['traditional', 'outer'], other_traditional: ['traditional', 'dress'],
  sneakers: ['shoes', 'shoes'], boots: ['shoes', 'shoes'], sandals: ['shoes', 'shoes'], heels: ['shoes', 'shoes'], loafers: ['shoes', 'shoes'], other_shoes: ['shoes', 'shoes'],
  crossbody: ['bag', 'bag'], tote: ['bag', 'bag'], backpack: ['bag', 'bag'], clutch: ['bag', 'bag'], other_bag: ['bag', 'bag'],
  fedora: ['accessory', 'hat'], cap: ['accessory', 'hat'], beanie: ['accessory', 'hat'], sunglasses: ['accessory', 'eyewear'], glasses: ['accessory', 'eyewear'], scarf: ['accessory', 'neck'], tie: ['accessory', 'neck'], belt: ['accessory', 'belt'], necklace: ['accessory', 'jewelry'], earrings: ['accessory', 'jewelry'], bracelet: ['accessory', 'jewelry'], ring: ['accessory', 'jewelry'], watch: ['accessory', 'watch'],
} as const;
type GarmentTypeKey = keyof typeof GARMENT_TYPES;
export const GarmentType = z.enum(Object.keys(GARMENT_TYPES) as [GarmentTypeKey, ...GarmentTypeKey[]]);
export const Formality = z.number().int().min(1).max(5);
export type GarmentCategory = z.infer<typeof GarmentCategory>;
export type GarmentType = z.infer<typeof GarmentType>;
export type GarmentSlot = z.infer<typeof GarmentSlot>;

export const GarmentTagsOutput = z.strictObject({
  category: GarmentCategory, type: GarmentType, slot: GarmentSlot,
  colors: z.array(z.string().min(1).max(40)).min(1).max(8),
  material: z.string().min(1).max(120), formality: Formality,
  pattern: z.enum(['solid', 'striped', 'checked', 'floral', 'graphic', 'animal', 'other', 'unknown']),
  fit: z.enum(['slim', 'regular', 'loose', 'oversized', 'unknown']),
  length: z.enum(['cropped', 'short', 'regular', 'midi', 'long', 'maxi', 'unknown']).nullable(),
  sleeve: z.enum(['sleeveless', 'short', 'three_quarter', 'long', 'unknown']).nullable(),
  neckline: z.string().max(80).nullable(), rise: z.enum(['low', 'mid', 'high', 'unknown']).nullable(),
  season: z.array(z.enum(['spring', 'summer', 'autumn', 'winter', 'all'])).min(1).max(5),
  occasions: z.array(z.string().min(1).max(80)).max(8),
});
export const GarmentTags = GarmentTagsOutput.superRefine((tags, context) => {
  const [category, slot] = GARMENT_TYPES[tags.type];
  if (tags.category !== category || tags.slot !== slot) {
    context.addIssue({ code: 'custom', path: ['type'], message: 'Type must match category and slot' });
  }
});
export type GarmentTags = z.infer<typeof GarmentTags>;
export function isTryOnAllowed(type: GarmentType): boolean {
  return !(['underwear', 'swimwear', 'sleepwear'] as GarmentType[]).includes(type);
}

export const ModelPhotoAnalysis = z.strictObject({
  allowed: z.boolean(), fullBody: z.boolean(), personCount: z.number().int().min(0).max(100),
  lightingAdequate: z.boolean(), bodyShape: z.enum(['hourglass', 'pear', 'inverted_triangle', 'rectangle', 'oval', 'unknown']),
  skinTone: z.enum(['light', 'medium', 'dark', 'unknown']), notes: z.string().max(1200),
});
export type ModelPhotoAnalysis = z.infer<typeof ModelPhotoAnalysis>;

export const UploadAuthResponse = z.strictObject({
  token: z.uuid(), expire: z.number().int().positive(), signature: z.string().min(1),
  publicKey: z.string().min(1), urlEndpoint: z.url(), folder: z.string().startsWith('/stylist/'),
  isPrivateFile: z.literal(true),
});
export const CreateMediaRequest = z.strictObject({ imagekitFileId: z.string().min(1).max(128), url: z.url(), uploadToken: z.uuid() });
export const CreateModelPhotoRequest = CreateMediaRequest;
export const CreateGarmentRequest = CreateMediaRequest.extend({generateAsset:z.boolean().default(false),bodyKey:BodyKey.default('f'),requestedType:GarmentType.optional()});
export type CreateModelPhotoRequest = z.infer<typeof CreateModelPhotoRequest>;
export type CreateGarmentRequest = z.infer<typeof CreateGarmentRequest>;
export const ResourceIdParams = z.strictObject({ id: z.uuid() });
export const MediaListQuery = z.object({ cursor: z.uuid().optional(), limit: z.coerce.number().int().min(1).max(50).default(20) });
export const GarmentListQuery = MediaListQuery.extend({ category: GarmentCategory.optional() });
const MediaBase = z.strictObject({
  id: z.uuid(), imagekitFileId: z.string(), url: z.url(), thumbnailUrl: z.url(),
  status: ProcessingStatus, errorCode: ErrorCode.nullable(), createdAt: z.iso.datetime(),
});
export const ModelPhoto = MediaBase.extend({ analysis: ModelPhotoAnalysis.nullable() });
export const Garment = MediaBase.extend({ tags: GarmentTags.nullable(), tryOnAllowed: z.boolean().nullable(), source:z.enum(['user_photo','ai_concept']).default('user_photo'), mannequinAsset:MannequinAsset.nullable().default(null), assetJob:AssetJobSummary.nullable().default(null) });
export const ModelPhotoListResponse = z.strictObject({ items: z.array(ModelPhoto), nextCursor: z.uuid().nullable() });
export const GarmentListResponse = z.strictObject({ items: z.array(Garment), nextCursor: z.uuid().nullable() });
export const DeleteMediaResponse = z.strictObject({ deleted: z.literal(true) });
export type CreateMediaRequest = z.infer<typeof CreateMediaRequest>;
export type MediaListQuery = z.infer<typeof MediaListQuery>;
export type GarmentListQuery = z.infer<typeof GarmentListQuery>;
export type ModelPhoto = z.infer<typeof ModelPhoto>;
export type Garment = z.infer<typeof Garment>;
export const EMBEDDING_DIMENSIONS = 1024;
