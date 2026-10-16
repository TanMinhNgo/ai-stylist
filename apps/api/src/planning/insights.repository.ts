import { Injectable } from '@nestjs/common';
import {
  WardrobeInsightsResponse,
  type WardrobePeriodQuery,
} from '@stylist/shared';
import { PrismaService } from '../database/prisma.service';
@Injectable()
export class InsightsRepository {
  constructor(private readonly db: PrismaService) {}
  async get(userId: string, query: WardrobePeriodQuery) {
    const from = new Date(query.from),
      to = new Date(query.to);
    const [row] = await this.db.$queryRaw<{ result: unknown }[]>`
      WITH history AS (
        SELECT * FROM wear_records WHERE user_id=${userId}::uuid AND date >= ${from}::date AND date <= ${to}::date
          AND EXISTS (SELECT 1 FROM users WHERE id=${userId}::uuid AND deleted_at IS NULL)
      ), counts AS (
        SELECT g.id, count(h.id)::int AS worn, max(h.date)::text AS last
        FROM garments g LEFT JOIN history h ON g.id=ANY(h.garment_ids)
        WHERE g.user_id=${userId}::uuid AND g.status='ready' AND g.deleting_at IS NULL
          AND EXISTS (SELECT 1 FROM users WHERE id=${userId}::uuid AND deleted_at IS NULL)
        GROUP BY g.id
      ) SELECT jsonb_build_object(
        'from',${query.from}::text,'to',${query.to}::text,
        'status',CASE WHEN EXISTS(SELECT 1 FROM history) THEN 'available' ELSE 'insufficient_data' END,
        'confirmedRecords',(SELECT count(*)::int FROM history), 'recordedDays',(SELECT count(DISTINCT date)::int FROM history),
        'wardrobeGarments',(SELECT count(*)::int FROM counts),'garmentsWithoutRecords',(SELECT count(*)::int FROM counts WHERE worn=0),
        'mostWorn',COALESCE((SELECT jsonb_agg(jsonb_build_object('garmentId',id,'wearCount',worn,'lastWornOn',last) ORDER BY worn DESC,id) FROM (SELECT * FROM counts WHERE worn>0 ORDER BY worn DESC,id LIMIT 10) q),'[]'::jsonb),
        'leastWorn',COALESCE((SELECT jsonb_agg(jsonb_build_object('garmentId',id,'wearCount',worn,'lastWornOn',last) ORDER BY worn,id) FROM (SELECT * FROM counts ORDER BY worn,id LIMIT 10) q),'[]'::jsonb),
        'revisitOutfitIds','[]'::jsonb
      ) AS result`;
    const result = WardrobeInsightsResponse.parse(row.result);
    if (result.status === 'insufficient_data') return result;
    const least = new Set(result.leastWorn.slice(0, 3).map((g) => g.garmentId));
    // shortcut: suggest only from the 200 most recent saved outfits, widen search when measured usage needs it.
    const outfits = await this.db.outfit.findMany({
      where: {
        userId,
        deletedAt: null,
        savedAt: { not: null },
        user: { deletedAt: null },
      },
      include: { tryOnJob: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 200,
    });
    const ids = [...new Set(outfits.flatMap((o) => o.tryOnJob.garmentIds))];
    const current = new Set(
      (
        await this.db.garment.findMany({
          where: {
            userId,
            id: { in: ids },
            status: 'ready',
            deletingAt: null,
            user: { deletedAt: null },
          },
          select: { id: true },
        })
      ).map((g) => g.id),
    );
    result.revisitOutfitIds = outfits
      .filter(
        (o) =>
          o.tryOnJob.garmentIds.length > 0 &&
          o.tryOnJob.garmentIds.every((id) => current.has(id)) &&
          o.tryOnJob.garmentIds.some((id) => least.has(id)),
      )
      .slice(0, 3)
      .map((o) => o.id);
    return WardrobeInsightsResponse.parse(result);
  }
}
