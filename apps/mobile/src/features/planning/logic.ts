// Collections, planner and wear history: pure helpers, tested in test/planning.test.mjs.
import { COLLECTION_OUTFIT_LIMIT, type EntitlementsResponse, type SubscriptionFeature } from '@stylist/shared';

export const deviceTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

/** Calendar date (YYYY-MM-DD) as the clock reads in `timeZone`; never the server's or UTC's day. */
export function localDate(timeZone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Pure calendar arithmetic on YYYY-MM-DD (UTC midnight, so no DST shifts). */
export const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

export const dayLabel = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('vi-VN', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'numeric' });

/** The API accepts planner writes from today to 365 days ahead; past days stay readable and deletable. */
export const plannerWritable = (date: string, today: string) => date >= today && date <= addDays(today, 365);

/** Usable now = availableFeatures only; included-but-unavailable or unknown entitlements never unlock editing. */
export const featureOn = (e: EntitlementsResponse | undefined, feature: SubscriptionFeature) => !!e?.availableFeatures.includes(feature);

/** Add or remove one outfit; PATCH always sends the whole list. null when adding would pass the cap. */
export function toggleOutfit(ids: readonly string[], id: string): string[] | null {
  if (ids.includes(id)) return ids.filter((x) => x !== id);
  return ids.length >= COLLECTION_OUTFIT_LIMIT ? null : [...ids, id];
}
