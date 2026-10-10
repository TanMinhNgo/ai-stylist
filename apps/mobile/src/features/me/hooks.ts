import { MeResponse } from '@stylist/shared';
import { useQuery } from '@tanstack/react-query';

import { request } from '@/lib/api';

export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: () => request(MeResponse, { url: '/me' }) });
}
