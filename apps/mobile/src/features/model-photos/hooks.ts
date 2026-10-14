import { DeleteMediaResponse, ModelPhoto, ModelPhotoListResponse } from '@stylist/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { hasPending, MAX_POLLS } from '@/features/media/pages';
import { request } from '@/lib/api';
import { secureStorage } from '@/lib/secure-storage';

const KEY = ['model-photos'] as const;

// ponytail: one page of 50 is plenty for personal model photos; add infinite scroll if users keep more.
export function useModelPhotos() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => request(ModelPhotoListResponse, { url: '/model-photos', params: { limit: 50 } }),
    refetchInterval: (q) => (hasPending(q.state.data?.items) && q.state.dataUpdateCount < MAX_POLLS ? 3000 : false),
  });
}

/** Polls one photo until the worker marks it ready or failed. */
export function useModelPhoto(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => request(ModelPhoto, { url: `/model-photos/${id}` }),
    enabled: !!id,
    refetchInterval: (q) => (q.state.data?.status === 'pending' && q.state.dataUpdateCount < MAX_POLLS ? 3000 : false),
  });
}

export function useDeleteModelPhoto() {
  const client = useQueryClient();
  const clearDefault = useDefaultModelPhoto((s) => s.clearIf);
  return useMutation({
    mutationFn: (id: string) => request(DeleteMediaResponse, { url: `/model-photos/${id}`, method: 'DELETE' }),
    onSuccess: (_, id) => clearDefault(id),
    onSettled: () => client.invalidateQueries({ queryKey: KEY }),
  });
}

// The default photo is a device preference (per the wardrobe contract), kept across launches.
type DefaultPhoto = { id: string | null; set: (id: string) => void; clearIf: (id: string) => void };
export const useDefaultModelPhoto = create<DefaultPhoto>()(
  persist(
    (set, get) => ({
      id: null,
      set: (id) => set({ id }),
      clearIf: (id) => {
        if (get().id === id) set({ id: null });
      },
    }),
    {
      name: 'default-model-photo',
      storage: secureStorage,
      partialize: (s) => ({ id: s.id }) as DefaultPhoto,
    },
  ),
);
