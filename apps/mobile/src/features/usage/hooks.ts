import { AccountDeletionResponse, EntitlementsResponse, StylistUsageResponse, UsageResponse } from '@stylist/shared';
import { useQuery } from '@tanstack/react-query';
import { request } from '@/lib/api';
import { resetDelay } from './logic';

export const USAGE_KEY = ['usage'] as const;
export function useUsage() {
  return useQuery({ queryKey: USAGE_KEY, queryFn: () => request(UsageResponse, { url: '/usage' }), staleTime: 0, refetchInterval: (q) => resetDelay(q.state.data) });
}
// Under USAGE_KEY so every existing usage refresh (try-on create/terminal also starts auto advice) refreshes it too.
export function useStylistUsage() {
  return useQuery({ queryKey: [...USAGE_KEY, 'stylist'], queryFn: () => request(StylistUsageResponse, { url: '/stylist/usage' }), staleTime: 0, refetchInterval: (q) => resetDelay(q.state.data) });
}
export const useEntitlements = () => useQuery({ queryKey: ['entitlements'], queryFn: () => request(EntitlementsResponse, { url: '/usage/entitlements' }) });
export const requestDeletion = () => request(AccountDeletionResponse, { url: '/me', method: 'DELETE', validateStatus: (status) => status === 202 });
export const getDeletion = () => request(AccountDeletionResponse, { url: '/me/deletion' });
