import {
  AffiliateClickResponse,
  AffiliateProductsResponse,
  BillingSessionResponse,
  BillingSyncResponse,
  CalendarEventResponse,
  CalendarExportResponse,
  CreateLookbookShareResponse,
  LookbookSharesResponse,
  PlannerContextResponse,
  PlanningDeleteResponse,
  PublicLookbookResponse,
  type AffiliateProductsQuery,
  type CreateLookbookShareRequest,
  type PutCalendarEventRequest,
} from '@stylist/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { USAGE_KEY } from '@/features/usage/hooks';
import { request } from '@/lib/api';

const BILLING = ['billing'] as const;
const CONTEXT = ['planner-context'] as const;
const SHARES = ['shares'] as const;

export const useBillingSession = () => useQuery({ queryKey: BILLING, queryFn: () => request(BillingSessionResponse, { url: '/billing/session' }), staleTime: 0 });

/** After a store purchase/restore: the server re-verifies with RevenueCat; plan, quota and benefits are refetched. */
export function useBillingSync() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => request(BillingSyncResponse, { url: '/billing/sync', method: 'POST', data: {} }),
    onSettled: () => {
      for (const queryKey of [BILLING, USAGE_KEY, ['entitlements']]) void client.invalidateQueries({ queryKey });
    },
  });
}

type Coords = { latitude: number; longitude: number } | null;
export const usePlannerContext = (startDate: string, timeZone: string, coords: Coords) =>
  useQuery({
    queryKey: [...CONTEXT, timeZone, startDate, coords?.latitude, coords?.longitude],
    queryFn: () => request(PlannerContextResponse, { url: '/planner/context', params: { startDate, timeZone, ...coords } }),
  });

/** `id` is a client UUID: retrying the same event upserts it instead of adding a second one. */
export function usePutCalendarEvent() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: PutCalendarEventRequest }) => request(CalendarEventResponse, { url: `/calendar/events/${id}`, method: 'PUT', data: body }),
    onSettled: () => client.invalidateQueries({ queryKey: CONTEXT }),
  });
}

export function useDeleteCalendarEvent() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request(PlanningDeleteResponse, { url: `/calendar/events/${id}`, method: 'DELETE' }),
    onSettled: () => client.invalidateQueries({ queryKey: CONTEXT }),
  });
}

export const fetchCalendarExport = (startDate: string, timeZone: string) =>
  request(CalendarExportResponse, { url: '/planner/calendar-export', params: { startDate, timeZone } });

export const useAffiliateProducts = (query: AffiliateProductsQuery) =>
  useQuery({ queryKey: ['affiliate', query.type, query.q], queryFn: () => request(AffiliateProductsResponse, { url: '/affiliate/products', params: query }) });

export const recordAffiliateClick = (id: string, productId: string) =>
  request(AffiliateClickResponse, { url: `/affiliate/clicks/${id}`, method: 'PUT', data: { productId } });

export const useShares = (collectionId: string) =>
  useQuery({ queryKey: [...SHARES, collectionId], queryFn: () => request(LookbookSharesResponse, { url: `/collections/${collectionId}/shares` }) });

/** Each POST makes a new link; mutations are never retried, so a lost response is checked in the list instead. */
export function useCreateShare(collectionId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateLookbookShareRequest) => request(CreateLookbookShareResponse, { url: `/collections/${collectionId}/shares`, method: 'POST', data: body }),
    onSettled: () => client.invalidateQueries({ queryKey: [...SHARES, collectionId] }),
  });
}

export function useRevokeShare(collectionId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request(PlanningDeleteResponse, { url: `/lookbook-shares/${id}`, method: 'DELETE' }),
    onSettled: () => client.invalidateQueries({ queryKey: [...SHARES, collectionId] }),
  });
}

export const usePublicLookbook = (token: string) =>
  useQuery({ queryKey: ['shared-lookbook', token], queryFn: () => request(PublicLookbookResponse, { url: `/shared-lookbooks/${token}` }), staleTime: 0, gcTime: 0 });
