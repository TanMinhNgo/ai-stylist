import { z } from 'zod';
import { ErrorCode } from './errors';
import { GarmentTags, ModelPhotoAnalysis } from './wardrobe';

const labels = z.array(z.string().trim().min(1).max(80)).max(12);
export const UpdateStyleProfileRequest = z.strictObject({
  styles: labels, occasions: labels, budget: z.number().int().min(0).max(1000000000).nullable(),
  preferredColors: labels, avoidedColors: labels,
  bodyShape: ModelPhotoAnalysis.shape.bodyShape.nullable().optional(),
  skinTone: ModelPhotoAnalysis.shape.skinTone.nullable().optional(),
});
export const StyleProfile = UpdateStyleProfileRequest.extend({
  bodyShape: ModelPhotoAnalysis.shape.bodyShape.nullable(),
  skinTone: ModelPhotoAnalysis.shape.skinTone.nullable(), updatedAt: z.iso.datetime().nullable(),
});
export const StylistAdvice = z.strictObject({
  summary: z.string().min(1).max(800), strengths: z.array(z.string().min(1).max(400)).min(1).max(6),
  adjustments: z.array(z.strictObject({suggestion:z.string().min(1).max(400),reason:z.string().min(1).max(400)})).max(6),
  accessories: z.array(z.strictObject({type:z.string().min(1).max(80),description:z.string().min(1).max(300),color:z.string().min(1).max(80),reason:z.string().min(1).max(400)})).max(4),
  occasionFit: z.strictObject({score:z.number().int().min(1).max(5),reason:z.string().min(1).max(600)}),
});
export const StylistJobStatus = z.enum(['queued','processing','ready','failed']);
export const OutfitFeedbackRequest = z.strictObject({liked:z.boolean().nullable()});
export const SaveOutfitRequest = z.strictObject({saved:z.boolean()});
export const Outfit = z.strictObject({
  id:z.uuid(),url:z.url(),thumbnailUrl:z.url(),occasion:z.string(),
  garments:z.array(z.strictObject({id:z.uuid(),tags:GarmentTags})).max(4),
  liked:z.boolean().nullable(),savedAt:z.iso.datetime().nullable(),createdAt:z.iso.datetime(),
  advice:StylistAdvice.nullable(),adviceStatus:StylistJobStatus.nullable(),adviceErrorCode:ErrorCode.nullable(),
  promptVersion:z.string().nullable(),knowledgeVersion:z.string().nullable(),isMock:z.boolean(),adviceIsMock:z.boolean(),
});
export const OutfitListQuery = z.object({cursor:z.uuid().optional(),limit:z.coerce.number().int().min(1).max(50).default(20),liked:z.enum(['true','false']).transform(v=>v==='true').optional()});
export const OutfitListResponse = z.strictObject({items:z.array(Outfit),nextCursor:z.uuid().nullable()});
export const SuggestRequest = z.strictObject({occasion:z.string().trim().min(1).max(120)});
export const SuggestedOutfit = z.strictObject({garmentIds:z.array(z.uuid()).min(1).max(4).refine(ids=>new Set(ids).size===ids.length),reason:z.string().min(1).max(1000)});
export const SuggestOutput = z.strictObject({outfits:z.array(SuggestedOutfit).max(3),message:z.string().max(600).nullable()});
export const SuggestResponse = SuggestOutput.extend({isMock:z.boolean(),occasion:z.string().min(1).max(120)});
export const CreateStylistJobResponse = z.strictObject({jobId:z.uuid()});
export const StylistJobResponse = z.strictObject({id:z.uuid(),kind:z.enum(['advice','suggest']),status:StylistJobStatus,outfitId:z.uuid().nullable(),errorCode:ErrorCode.nullable(),result:SuggestResponse.nullable(),isMock:z.boolean(),createdAt:z.iso.datetime()});
export type StyleProfile = z.infer<typeof StyleProfile>;
export type UpdateStyleProfileRequest = z.infer<typeof UpdateStyleProfileRequest>;
export type StylistAdvice = z.infer<typeof StylistAdvice>;
export type OutfitListQuery = z.infer<typeof OutfitListQuery>;
export type SuggestRequest = z.infer<typeof SuggestRequest>;
export type SuggestOutput = z.infer<typeof SuggestOutput>;
