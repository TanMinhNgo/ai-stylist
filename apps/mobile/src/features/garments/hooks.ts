import { DeleteMediaResponse, Garment, GarmentListResponse, type CreateGarmentRequest, type GarmentCategory } from '@stylist/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useRef, useState } from 'react';

import { hasPending, MAX_POLLS, removeFromPages } from '@/features/media/pages';
import { uploadFlowMessage, uploadMedia } from '@/features/media/upload-flow';
import { invalidatePlanning } from '@/features/planning/hooks';
import { request } from '@/lib/api';
import type { LocalImage } from '@/lib/image';

type GarmentPage = { items: Garment[]; nextCursor: string | null };
const KEY = ['garments'] as const;

export function useGarments(category: GarmentCategory | undefined) {
  return useInfiniteQuery({
    queryKey: [...KEY, 'list', category ?? 'all'],
    queryFn: ({ pageParam }) => request(GarmentListResponse, { url: '/garments', params: { limit: 20, cursor: pageParam, category } }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    // Re-fetch while AI is still tagging new items, so "Đang phân tích…" turns into tags by itself.
    refetchInterval: (q) => (hasPending(q.state.data?.pages.flatMap((p) => p.items)) && q.state.dataUpdateCount < MAX_POLLS ? 4000 : false),
  });
}

export function useGarment(id: string) {
  return useQuery({
    queryKey: [...KEY, 'one', id],
    queryFn: () => request(Garment, { url: `/garments/${id}` }),
    refetchInterval: (q) => (hasPending(q.state.data ? [q.state.data] : undefined) && q.state.dataUpdateCount < MAX_POLLS ? 3000 : false),
  });
}

export type AddState = { total: number; done: number; progress: number; failed: LocalImage[]; error: string | null; canceled: boolean };

/** Uploads several photos one after another; failed ones are kept so the user can retry just those. */
export function useAddGarments() {
  const client = useQueryClient();
  const [state, setState] = useState<AddState | null>(null);
  const abort = useRef<AbortController | null>(null);

  async function add(images: LocalImage[]) {
    if (!images.length) return;
    const controller = new AbortController();
    abort.current = controller;
    const failed: LocalImage[] = [];
    let error: string | null = null;
    setState({ total: images.length, done: 0, progress: 0, failed, error, canceled: false });
    for (const [i, image] of images.entries()) {
      if (controller.signal.aborted) break;
      try {
        await uploadMedia('garments', Garment, image, {
          signal: controller.signal,
          onProgress: (progress) => setState((s) => s && { ...s, progress }),
        });
        void client.invalidateQueries({ queryKey: [...KEY, 'list'] });
      } catch (e) {
        if (controller.signal.aborted) break;
        failed.push(image);
        error = uploadFlowMessage(e);
      }
      setState((s) => s && { ...s, done: i + 1, progress: 0, failed: [...failed], error });
    }
    const canceled = controller.signal.aborted;
    // A clean run clears the banner; failures or a cancel stay visible with retry/close.
    setState(failed.length || canceled ? { total: images.length, done: images.length, progress: 0, failed, error, canceled } : null);
  }

  return { state, add, cancel: () => abort.current?.abort(), dismiss: () => setState(null) };
}

type UploadOne = { image: LocalImage; extra: Pick<CreateGarmentRequest, 'generateAsset' | 'bodyKey' | 'requestedType'>; signal: AbortSignal; onProgress: (f: number) => void };

/** One cropped garment photo; with generateAsset the API makes its mannequin PNG after analysis (or defers it without quota). */
export function useUploadGarment() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ image, extra, signal, onProgress }: UploadOne) => uploadMedia('garments', Garment, image, { extra, signal, onProgress }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: [...KEY, 'list'] });
      void client.invalidateQueries({ queryKey: ['asset-quota'] });
    },
  });
}

/** Optimistic delete: the item disappears from every list at once and comes back if the API refuses. */
export function useDeleteGarment() {
  const client = useQueryClient();
  const lists = { queryKey: [...KEY, 'list'] };
  return useMutation({
    mutationFn: (id: string) => request(DeleteMediaResponse, { url: `/garments/${id}`, method: 'DELETE' }),
    onMutate: async (id) => {
      await client.cancelQueries(lists);
      const snapshot = client.getQueriesData<InfiniteData<GarmentPage>>(lists);
      client.setQueriesData<InfiniteData<GarmentPage>>(lists, (data) => removeFromPages(data, id) as InfiniteData<GarmentPage> | undefined);
      return { snapshot };
    },
    onError: (_, __, context) => context?.snapshot.forEach(([key, data]) => client.setQueryData(key, data)),
    onSuccess: () => invalidatePlanning(client),
    onSettled: () => client.invalidateQueries({ queryKey: KEY }),
  });
}
