import {
  CollectionListResponse,
  CollectionResponse,
  DeleteCollectionResponse,
  PlannerDayResponse,
  PlannerWeekResponse,
  PlanningDeleteResponse,
  WardrobeInsightsResponse,
  WearHistoryResponse,
  WearRecordResponse,
  type CreateCollectionRequest,
  type PutPlannerDayRequest,
  type PutWearRecordRequest,
  type UpdateCollectionRequest,
} from '@stylist/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { request } from '@/lib/api';

const COLLECTIONS = ['collections'] as const;
const PLANNER = ['planner'] as const;
// Insights live under the wear key: confirming or deleting a wear refreshes the counts too.
const WEAR = ['wear'] as const;

/** Outfit or garment deleted: collections drop the link, planner days turn unavailable, counts change. */
export function invalidatePlanning(client: QueryClient) {
  for (const queryKey of [COLLECTIONS, PLANNER, WEAR]) void client.invalidateQueries({ queryKey });
}

export function useCollections() {
  return useInfiniteQuery({
    queryKey: [...COLLECTIONS, 'list'],
    queryFn: ({ pageParam }) => request(CollectionListResponse, { url: '/collections', params: { limit: 20, cursor: pageParam } }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export const useCollection = (id: string | undefined) =>
  useQuery({ queryKey: [...COLLECTIONS, 'one', id], queryFn: () => request(CollectionResponse, { url: `/collections/${id}` }), enabled: !!id });

/** POST (no id) or PATCH; never retried automatically, a lost POST response could otherwise create two. */
export function useSaveCollection() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: CreateCollectionRequest | UpdateCollectionRequest }) =>
      request(CollectionResponse, id ? { url: `/collections/${id}`, method: 'PATCH', data: body } : { url: '/collections', method: 'POST', data: body }),
    onSuccess: (c) => client.setQueryData([...COLLECTIONS, 'one', c.id], c),
    onSettled: () => client.invalidateQueries({ queryKey: [...COLLECTIONS, 'list'] }),
  });
}

export function useDeleteCollection() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request(DeleteCollectionResponse, { url: `/collections/${id}`, method: 'DELETE' }),
    onSuccess: (_, id) => client.removeQueries({ queryKey: [...COLLECTIONS, 'one', id] }),
    onSettled: () => client.invalidateQueries({ queryKey: [...COLLECTIONS, 'list'] }),
  });
}

export const usePlannerWeek = (startDate: string, timeZone: string) =>
  useQuery({ queryKey: [...PLANNER, timeZone, startDate], queryFn: () => request(PlannerWeekResponse, { url: '/planner/week', params: { startDate, timeZone } }) });

export function usePutPlannerDay() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ date, body }: { date: string; body: PutPlannerDayRequest }) => request(PlannerDayResponse, { url: `/planner/days/${date}`, method: 'PUT', data: body }),
    onSettled: () => client.invalidateQueries({ queryKey: PLANNER }),
  });
}

export function useDeletePlannerDay() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ date, timeZone }: { date: string; timeZone: string }) => request(PlanningDeleteResponse, { url: `/planner/days/${date}`, method: 'DELETE', params: { timeZone } }),
    onSettled: () => client.invalidateQueries({ queryKey: PLANNER }),
  });
}

export const useWearHistory = (from: string, to: string) =>
  useQuery({ queryKey: [...WEAR, 'history', from, to], queryFn: () => request(WearHistoryResponse, { url: '/wear-history', params: { from, to } }) });

export const useInsights = (from: string, to: string, enabled: boolean) =>
  useQuery({ queryKey: [...WEAR, 'insights', from, to], queryFn: () => request(WardrobeInsightsResponse, { url: '/wardrobe/insights', params: { from, to } }), enabled });

/** `id` is a client UUID kept for the same body across ambiguous retries, so one tap is counted once. */
export function usePutWear() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: PutWearRecordRequest }) => request(WearRecordResponse, { url: `/wear-history/${id}`, method: 'PUT', data: body }),
    onSettled: () => client.invalidateQueries({ queryKey: WEAR }),
  });
}

export function useDeleteWear() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request(PlanningDeleteResponse, { url: `/wear-history/${id}`, method: 'DELETE' }),
    onSettled: () => client.invalidateQueries({ queryKey: WEAR }),
  });
}
