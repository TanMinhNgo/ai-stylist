import { AssetJobResponse, AssetQuotaResponse, CreateAssetJobsResponse, CreateIdeaResponse, IdeaJobResponse, type AssetInput, type IdeaRequest } from '@stylist/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { pollDelay, pollGaveUp } from '@/features/assets/logic';
import { request } from '@/lib/api';
import { RequestError } from '@/lib/errors';

const QUOTA = ['asset-quota'] as const;
// Network blips retry with the same key, so a lost response never spends a second generation.
const retry = (count: number, error: unknown) => count < 2 && error instanceof RequestError && error.retryable;

export function useAssetQuota() {
  return useQuery({ queryKey: QUOTA, queryFn: () => request(AssetQuotaResponse, { url: '/asset-generation/quota' }), staleTime: 30_000 });
}

/** Asks the LLM for proposals only; no image is generated (that is useCreateAssetJobs after the user confirms). */
export function useCreateIdea() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ input, key }: { input: IdeaRequest; key: string }) =>
      request(CreateIdeaResponse, { url: '/garment-ideas', method: 'POST', data: input, headers: { 'Idempotency-Key': key } }),
    retry,
    onSettled: () => client.invalidateQueries({ queryKey: QUOTA }),
  });
}

export function useIdeaJob(id: string | null) {
  const client = useQueryClient();
  const queryKey = ['garment-idea', id];
  const query = useQuery({
    queryKey,
    queryFn: () => request(IdeaJobResponse, { url: `/garment-ideas/${id}` }),
    enabled: !!id,
    refetchInterval: (q) => pollDelay(q.state.data?.status, q.state.dataUpdateCount),
  });
  return { query, stuck: pollGaveUp(query.data?.status, client.getQueryState(queryKey)?.dataUpdateCount ?? 0) };
}

/** The whole batch is accepted or refused (429 ASSET_QUOTA_EXCEEDED); never half of it. */
export function useCreateAssetJobs() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ items, key }: { items: AssetInput[]; key: string }) =>
      request(CreateAssetJobsResponse, { url: '/garment-asset-jobs', method: 'POST', data: { items }, headers: { 'Idempotency-Key': key } }),
    retry,
    onSettled: () => {
      void client.invalidateQueries({ queryKey: QUOTA });
      void client.invalidateQueries({ queryKey: ['garments'] });
    },
  });
}

/** Reads a job's cached state without polling (JobRow's useAssetJob owns the polling for that id). */
export function useAssetJobStatus(id: string | null) {
  return useQuery({ queryKey: ['garment-asset-job', id], queryFn: () => request(AssetJobResponse, { url: `/garment-asset-jobs/${id}` }), enabled: false }).data?.status;
}

/** Polls one generation; when it ends, the wardrobe and quota are refetched so the new PNG shows everywhere. */
export function useAssetJob(id: string) {
  const client = useQueryClient();
  const queryKey = ['garment-asset-job', id];
  const job = useQuery({
    queryKey,
    queryFn: () => request(AssetJobResponse, { url: `/garment-asset-jobs/${id}` }),
    refetchInterval: (q) => pollDelay(q.state.data?.status, q.state.dataUpdateCount),
  });
  const status = job.data?.status;
  useEffect(() => {
    if (status !== 'ready' && status !== 'failed') return;
    void client.invalidateQueries({ queryKey: ['garments'] });
    void client.invalidateQueries({ queryKey: QUOTA });
  }, [status, client]);
  return { job, stuck: pollGaveUp(status, client.getQueryState(queryKey)?.dataUpdateCount ?? 0) };
}
