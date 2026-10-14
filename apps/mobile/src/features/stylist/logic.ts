// Pure rules for lookbook, advice, suggestions and the style profile (no React Native imports, tested in test/stylist.test.mjs).
import type { Garment, StyleProfile } from '@stylist/shared';

import { RequestError } from '../../lib/errors.ts';
import { garmentWearable, togglePick, type Picks, type Wearable } from '../studio/outfit.ts';

export type LookbookFilter = 'all' | 'liked' | 'disliked';
export const likedParam = (f: LookbookFilter) => (f === 'liked' ? 'true' : f === 'disliked' ? 'false' : undefined);
const belongs = (f: LookbookFilter, liked: boolean | null) => f === 'all' || liked === (f === 'liked');

type Pages<T> = { pages: { items: T[]; nextCursor: string | null }[]; pageParams: unknown[] };

/** Optimistic feedback on one cached list: patch the outfit, or drop it when it no longer matches that list's filter. */
export function applyFeedback<T extends { id: string; liked: boolean | null }>(data: Pages<T> | undefined, filter: LookbookFilter, id: string, liked: boolean | null): Pages<T> | undefined {
  if (!data) return data;
  const items = (list: T[]) => list.flatMap((o) => (o.id !== id ? [o] : belongs(filter, liked) ? [{ ...o, liked }] : []));
  return { ...data, pages: data.pages.map((p) => ({ ...p, items: items(p.items) })) };
}

/** A failed POST that may still have created the job (network/5xx): the next tap resends the same Idempotency-Key. */
export const keepKeyAfter = (error: unknown) => error instanceof RequestError && error.retryable;

/** Advice is being written (auto after try-on, or requested): poll the outfit until it settles. */
export const adviceWorking = (status: string | null | undefined) => status === 'queued' || status === 'processing';
// A failed GET leaves the accepted job unresolved; only a terminal status permits another AI request.
export const jobUnsettled = (id: string | null, status: string | undefined) => !!id && status !== 'ready' && status !== 'failed';

/**
 * "Thử ngay": the suggested garments, fetched again right before applying (null = deleted or not found).
 * One unusable piece (deleted, still analysing, not allowed for try-on) blocks the whole outfit; nothing half-applied.
 */
export function suggestionPicks(garments: (Garment | null)[]): { picks: Picks } | { problem: string } {
  const wearables = garments.map((g) => (g && g.tryOnAllowed !== false ? garmentWearable(g) : null));
  if (!wearables.length || wearables.some((w) => !w))
    return { problem: 'Có món trong gợi ý đã bị xóa, chưa phân tích xong hoặc không dùng để thử được. Hãy xin gợi ý mới.' };
  return { picks: (wearables as Wearable[]).reduce(togglePick, {}) };
}

/** First run: no saved profile yet (updatedAt null) and this user has not skipped on this device. */
export const needsOnboarding = (profile: StyleProfile | undefined, skipped: boolean) => !!profile && profile.updatedAt === null && !skipped;

/** Budget field → integer VND; '' clears it (null), anything unparseable or above 1 tỷ is undefined (invalid). */
export function parseBudget(text: string): number | null | undefined {
  const digits = text.replace(/[\s.,₫đ]/gi, '');
  if (!digits) return null;
  if (!/^\d+$/.test(digits)) return undefined;
  const n = Number(digits);
  return n <= 1_000_000_000 ? n : undefined;
}

export const formatBudget = (n: number | null) => (n === null ? '' : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'));

/** Toggle a label (max 12 per the contract); picking a colour on one side removes it from the other. */
export function toggleLabel(list: string[], value: string, other: string[] = []): [string[], string[]] {
  if (list.includes(value)) return [list.filter((v) => v !== value), other];
  if (list.length >= 12) return [list, other];
  return [[...list, value], other.filter((v) => v !== value)];
}
