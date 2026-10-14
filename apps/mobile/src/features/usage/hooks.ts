import { AccountDeletionResponse, UsageResponse } from '@stylist/shared';
import { useQuery } from '@tanstack/react-query';
import { request } from '@/lib/api';
import { resetDelay } from './logic';

export const USAGE_KEY = ['usage'] as const;
export function useUsage() {
  return useQuery({ queryKey: USAGE_KEY, queryFn: () => request(UsageResponse, { url: '/usage' }), staleTime: 0, refetchInterval: (q) => resetDelay(q.state.data) });
}
export const requestDeletion = () => request(AccountDeletionResponse, { url: '/me', method: 'DELETE', validateStatus: (status) => status === 202 });
export const getDeletion = () => request(AccountDeletionResponse, { url: '/me/deletion' });
