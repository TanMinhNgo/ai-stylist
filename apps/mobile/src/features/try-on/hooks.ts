import { CreateTryOnResponse, TryOnJobResponse, type CreateTryOnRequest } from '@stylist/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';

import { request } from '@/lib/api';
import { RequestError } from '@/lib/errors';

export type TryOnInput = CreateTryOnRequest;

/** A fresh key per user action; retries of that same action reuse it so the API returns the same job. */
export const newIdempotencyKey = () => randomUUID();

export function useCreateTryOn() {
  return useMutation({
    mutationFn: ({ input, key }: { input: TryOnInput; key: string }) =>
      request(CreateTryOnResponse, { url: '/try-on', method: 'POST', data: input, headers: { 'Idempotency-Key': key } }),
    // Network blips retry with the same key, so a lost response can never create a second job.
    retry: (count, error) => count < 2 && error instanceof RequestError && error.retryable,
  });
}

const FINAL = new Set(['done', 'failed']);

/** Polls a job, backing off from 2 s to 8 s; pauses while the app is in the background (focusManager). */
export function useTryOnJob(id: string) {
  return useQuery({
    queryKey: ['try-on', id],
    queryFn: () => request(TryOnJobResponse, { url: `/try-on/${id}` }),
    refetchInterval: (q) => (q.state.data && FINAL.has(q.state.data.status) ? false : Math.min(2000 * 1.3 ** q.state.dataUpdateCount, 8000)),
  });
}
