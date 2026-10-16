import {
  CreateStylistJobResponse,
  DeleteMediaResponse,
  Garment,
  Outfit,
  OutfitListResponse,
  StyleProfile,
  StylistJobResponse,
  type UpdateStyleProfileRequest,
} from '@stylist/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { keyFor, pollDelay, pollGaveUp, type HeldKey } from '@/features/assets/logic';
import { removeFromPages } from '@/features/media/pages';
import { invalidatePlanning } from '@/features/planning/hooks';
import { adviceWorking, applyFeedback, keepKeyAfter, likedParam, type LookbookFilter } from '@/features/stylist/logic';
import { newIdempotencyKey } from '@/features/try-on/hooks';
import { USAGE_KEY } from '@/features/usage/hooks';
import { request } from '@/lib/api';
import { RequestError } from '@/lib/errors';
import { secureStorage } from '@/lib/secure-storage';

type Parsed<S> = S extends { parse(data: unknown): infer T } ? T : never;
export type OutfitItem = Parsed<typeof Outfit>;
export type StylistJob = Parsed<typeof StylistJobResponse>;
type OutfitPages = InfiniteData<Parsed<typeof OutfitListResponse>>;

const PROFILE = ['style-profile'] as const;
const OUTFITS = ['outfits'] as const;
const LISTS = { queryKey: [...OUTFITS, 'list'] };
const oneKey = (id: string | undefined) => [...OUTFITS, 'one', id];
// Network blips retry with the same key, so a lost response never starts a second AI job.
const retry = (count: number, error: unknown) => count < 2 && error instanceof RequestError && error.retryable;

export function useStyleProfile() {
  return useQuery({ queryKey: PROFILE, queryFn: () => request(StyleProfile, { url: '/style-profile' }) });
}

/** PUT without bodyShape/skinTone keeps the stored (or AI) values; null clears them. */
export function useSaveStyleProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateStyleProfileRequest) => request(StyleProfile, { url: '/style-profile', method: 'PUT', data: input }),
    onSuccess: (profile) => client.setQueryData(PROFILE, profile),
  });
}

/** Skipping onboarding is remembered per user on this device; it never blocks the app. */
type Skipped = { users: Record<string, true>; skip: (userId: string) => void };
export const useOnboardingSkip = create<Skipped>()(
  persist((set) => ({ users: {}, skip: (id) => set((s) => ({ users: { ...s.users, [id]: true } })) }), {
    name: 'onboarding-skipped',
    storage: secureStorage,
    partialize: (s) => ({ users: s.users }) as Skipped,
  }),
);

export function useOnboardingHydrated() {
  const [hydrated, setHydrated] = useState(useOnboardingSkip.persist.hasHydrated());
  useEffect(() => useOnboardingSkip.persist.onFinishHydration(() => setHydrated(true)), []);
  return hydrated;
}

/** Saved outfits only (the API never lists unsaved try-on results). */
export function useOutfits(filter: LookbookFilter) {
  return useInfiniteQuery({
    queryKey: [...OUTFITS, 'list', filter],
    queryFn: ({ pageParam }) => request(OutfitListResponse, { url: '/outfits', params: { limit: 20, cursor: pageParam, liked: likedParam(filter) } }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

/** One outfit; polls (bounded) while its advice is queued/processing, `stuck` offers a manual re-check after that. */
export function useOutfit(id: string | undefined) {
  const client = useQueryClient();
  const outfit = useQuery({
    queryKey: oneKey(id),
    queryFn: () => request(Outfit, { url: `/outfits/${id}` }),
    enabled: !!id,
    refetchInterval: (q) => (adviceWorking(q.state.data?.adviceStatus) ? pollDelay(q.state.data?.adviceStatus ?? undefined, q.state.dataUpdateCount + q.state.errorUpdateCount) : false),
  });
  const status = outfit.data?.adviceStatus;
  const state = client.getQueryState(oneKey(id));
  return { outfit, stuck: adviceWorking(status) && pollGaveUp(status ?? undefined, (state?.dataUpdateCount ?? 0) + (state?.errorUpdateCount ?? 0)) };
}

const putOne = (client: QueryClient, o: OutfitItem) => client.setQueryData(oneKey(o.id), o);

export function useSaveOutfit() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, saved }: { id: string; saved: boolean }) => request(Outfit, { url: `/outfits/${id}/save`, method: 'POST', data: { saved } }),
    onSuccess: (o) => {
      putOne(client, o);
      if (!o.savedAt) client.setQueriesData<OutfitPages>(LISTS, (d) => removeFromPages(d, o.id) as OutfitPages | undefined);
      void client.invalidateQueries(LISTS);
    },
  });
}

/** Like / dislike / neutral (null), applied at once everywhere and rolled back if the API refuses. */
export function useOutfitFeedback() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, liked }: { id: string; liked: boolean | null }) => request(Outfit, { url: `/outfits/${id}/feedback`, method: 'POST', data: { liked } }),
    onMutate: async ({ id, liked }) => {
      await client.cancelQueries({ queryKey: OUTFITS });
      const snapshot = client.getQueriesData({ queryKey: OUTFITS });
      for (const [key, data] of client.getQueriesData<OutfitPages>(LISTS))
        client.setQueryData(key, applyFeedback(data, key[2] as LookbookFilter, id, liked));
      client.setQueryData<OutfitItem>(oneKey(id), (o) => o && { ...o, liked });
      return { snapshot };
    },
    onError: (_, __, context) => context?.snapshot.forEach(([key, data]) => client.setQueryData(key, data)),
    onSuccess: (o) => putOne(client, o),
    onSettled: () => client.invalidateQueries(LISTS),
  });
}

export function useDeleteOutfit() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request(DeleteMediaResponse, { url: `/outfits/${id}`, method: 'DELETE' }),
    onSuccess: (_, id) => {
      client.setQueriesData<OutfitPages>(LISTS, (d) => removeFromPages(d, id) as OutfitPages | undefined);
      client.removeQueries({ queryKey: oneKey(id) });
      invalidatePlanning(client);
    },
    onSettled: () => client.invalidateQueries(LISTS),
  });
}

/**
 * One Idempotency-Key per user action: kept while the same payload is resent after a failure that may have
 * reached the API, replaced when the payload changes or once the action got its answer (a new tap = a new job).
 */
export function useHeldKey() {
  const held = useRef<HeldKey | null>(null);
  return {
    take: (payload: unknown) => (held.current = keyFor(held.current, payload, newIdempotencyKey)).key,
    settle: (error?: unknown) => {
      if (!error || !keepKeyAfter(error)) held.current = null;
    },
  };
}

export function useRequestAdvice() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ outfitId, key }: { outfitId: string; key: string }) =>
      request(CreateStylistJobResponse, { url: `/outfits/${outfitId}/advice`, method: 'POST', headers: { 'Idempotency-Key': key } }),
    retry,
    onSettled: () => client.invalidateQueries({ queryKey: USAGE_KEY }),
  });
}

export function useSuggest() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ occasion, key }: { occasion: string; key: string }) =>
      request(CreateStylistJobResponse, { url: '/stylist/suggest', method: 'POST', data: { occasion }, headers: { 'Idempotency-Key': key } }),
    retry,
    onSettled: () => client.invalidateQueries({ queryKey: USAGE_KEY }),
  });
}

/** Polls an advice/suggest job with bounded backoff; when an advice job ends, its outfit is refetched. */
export function useStylistJob(id: string | null) {
  const client = useQueryClient();
  const queryKey = ['stylist-job', id];
  const job = useQuery({
    queryKey,
    queryFn: () => request(StylistJobResponse, { url: `/stylist/jobs/${id}` }),
    enabled: !!id,
    refetchInterval: (q) => pollDelay(q.state.data?.status, q.state.dataUpdateCount + q.state.errorUpdateCount),
  });
  const { status, outfitId } = job.data ?? {};
  useEffect(() => {
    if (status !== 'ready' && status !== 'failed') return;
    void client.invalidateQueries({ queryKey: USAGE_KEY });
    if (outfitId) void client.invalidateQueries({ queryKey: oneKey(outfitId) });
  }, [status, outfitId, client]);
  const state = client.getQueryState(queryKey);
  return { job, stuck: pollGaveUp(status, (state?.dataUpdateCount ?? 0) + (state?.errorUpdateCount ?? 0)) };
}

/** "Thử ngay" re-reads every garment (never trusts the cached list): null when it is gone. */
export async function fetchGarments(client: QueryClient, ids: string[]) {
  return Promise.all(
    ids.map((id) =>
      client.fetchQuery({ queryKey: ['garments', 'one', id], queryFn: () => request(Garment, { url: `/garments/${id}` }), staleTime: 0 }).catch((e) => {
        if (e instanceof RequestError && e.code === 'NOT_FOUND') return null;
        throw e;
      }),
    ),
  );
}

/** Download to the app cache and open the OS share sheet. */
export async function shareOutfitImage(outfit: OutfitItem) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Thiết bị này không hỗ trợ chia sẻ.');
  const file = new File(Paths.cache, `outfit-${outfit.id}.jpg`);
  let shared = false;
  try {
    await File.downloadFileAsync(outfit.url, file, { idempotent: true });
    await Sharing.shareAsync(file.uri, { mimeType: 'image/jpeg', UTI: 'public.jpeg', dialogTitle: 'Chia sẻ outfit' });
    shared = true;
  } finally {
    // shortcut: Android chooser can finish before the receiver reads; defer cleanup until device validation.
    if ((!shared || Platform.OS === 'ios') && file.exists) file.delete();
  }
}
