import {
  GarmentTags,
  EMBEDDING_DIMENSIONS,
  isTryOnAllowed,
} from '@stylist/shared';
import type { Prisma } from '../generated/prisma/client';
import { parseVector } from './taste';

export async function snapshotOutfit(
  db: Prisma.TransactionClient,
  userId: string,
  id: string,
  garmentIds: string[],
) {
  const rows = await db.$queryRaw<
    { id: string; tags: unknown; vector: string | null }[]
  >`
    SELECT id,tags,embedding::text AS vector FROM garments
    WHERE user_id=${userId}::uuid AND id=ANY(${garmentIds}::uuid[]) AND status='ready' AND deleting_at IS NULL
    ORDER BY id`;
  const valid = rows.flatMap((r) => {
    const t = GarmentTags.safeParse(r.tags);
    return t.success && isTryOnAllowed(t.data.type)
      ? [{ id: r.id, tags: t.data, vector: parseVector(r.vector) }]
      : [];
  });
  await db.outfit.updateMany({
    where: { id, userId, deletedAt: null },
    data: { garmentSnapshot: valid.map(({ id, tags }) => ({ id, tags })) },
  });
  const vectors = valid.flatMap((v) => (v.vector ? [v.vector] : []));
  if (vectors.length) {
    const mean = Array.from(
      { length: EMBEDDING_DIMENSIONS },
      (_, i) => vectors.reduce((sum, v) => sum + v[i], 0) / vectors.length,
    );
    if (mean.some((n) => Math.abs(n) > 1e-12))
      await db.$executeRaw`UPDATE outfits SET embedding=${JSON.stringify(mean)}::vector WHERE id=${id}::uuid AND user_id=${userId}::uuid AND deleted_at IS NULL`;
  }
}
