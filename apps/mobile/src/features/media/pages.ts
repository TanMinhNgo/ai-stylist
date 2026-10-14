// Pure helpers for paginated media lists (kept free of React Native imports so node can test them).

type Item = { id: string; status: 'pending' | 'ready' | 'failed'; assetJob?: { status: string } | null };
type Pages<T> = { pages: { items: T[]; nextCursor: string | null }[]; pageParams: unknown[] };

/** Stop polling a pending item after this many fetches (~3 minutes at 3 s); the contract forbids endless polling. */
export const MAX_POLLS = 60;

/** Still being analysed, or its mannequin PNG is still being generated (deferred waits for quota, so no polling). */
export function hasPending(items: readonly Item[] | undefined): boolean {
  return !!items?.some((item) => item.status === 'pending' || item.assetJob?.status === 'queued' || item.assetJob?.status === 'processing');
}

/** Drop one item from every page, for optimistic deletes. */
export function removeFromPages<T extends { id: string }>(data: Pages<T> | undefined, id: string): Pages<T> | undefined {
  if (!data) return data;
  return { ...data, pages: data.pages.map((page) => ({ ...page, items: page.items.filter((item) => item.id !== id) })) };
}
