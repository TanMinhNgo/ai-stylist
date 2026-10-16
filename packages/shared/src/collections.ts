import { z } from 'zod';

export const COLLECTION_LIMIT = 50;
export const COLLECTION_OUTFIT_LIMIT = 50;
const name = z.string().trim().min(1).max(80);
const occasion = z.string().trim().min(1).max(120);
const outfitIds = z.array(z.uuid()).max(COLLECTION_OUTFIT_LIMIT)
  .refine(ids => new Set(ids).size === ids.length);
export const CreateCollectionRequest = z.strictObject({ name, occasion, outfitIds: outfitIds.default([]) });
export const UpdateCollectionRequest = z.strictObject({ name: name.optional(), occasion: occasion.optional(), outfitIds: outfitIds.optional() })
  .refine(value => Object.values(value).some(v => v !== undefined));
export const CollectionResponse = z.strictObject({ id: z.uuid(), name, occasion, outfitIds,
  createdAt: z.iso.datetime(), updatedAt: z.iso.datetime() });
export const CollectionListQuery = z.strictObject({ cursor: z.uuid().optional(), limit: z.coerce.number().int().min(1).max(50).default(20) });
export const CollectionListResponse = z.strictObject({ items: z.array(CollectionResponse).max(50), nextCursor: z.uuid().nullable() });
export const DeleteCollectionResponse = z.strictObject({ deleted: z.literal(true) });
export type CreateCollectionRequest = z.infer<typeof CreateCollectionRequest>;
export type UpdateCollectionRequest = z.infer<typeof UpdateCollectionRequest>;
export type CollectionListQuery = z.infer<typeof CollectionListQuery>;
