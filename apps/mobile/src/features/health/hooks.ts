import { HealthResponse } from '@stylist/shared';
import { useQuery } from '@tanstack/react-query';

import { request } from '@/lib/api';

export function useHealth() {
  return useQuery({ queryKey: ['health'], queryFn: () => request(HealthResponse, { url: '/health' }) });
}
