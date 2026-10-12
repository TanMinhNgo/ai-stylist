import type { AssetInput, Garment } from '@stylist/shared';
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Icon, Text } from '@/components/ui';
import { JobRow } from '@/features/assets/AddFromIdea';
import { useAssetJobStatus, useAssetQuota, useCreateAssetJobs } from '@/features/assets/hooks';
import { done, keyFor, quotaProblem, type HeldKey } from '@/features/assets/logic';
import { BodySwitch, QuotaLine } from '@/features/assets/pickers';
import { useStudio } from '@/features/studio/store';
import { newIdempotencyKey } from '@/features/try-on/hooks';
import { messageFor, RequestError } from '@/lib/errors';
import { colors, radius, space } from '@/theme';

const BODY = { f: 'nữ', m: 'nam' } as const;

/** Front-view PNG of a garment and the "Tạo hình cho ma nơ canh" action. Only a tap here spends a generation. */
export function MannequinAssetSection({ garment: g }: { garment: Garment }) {
  const studioBody = useStudio((s) => s.body);
  const [body, setBody] = useState(studioBody);
  const [held, setHeld] = useState<HeldKey | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const quota = useAssetQuota();
  const create = useCreateAssetJobs();
  const jobEnded = done(useAssetJobStatus(jobId));

  const asset = g.mannequinAsset;
  const inFlight = g.assetJob?.status === 'queued' || g.assetJob?.status === 'processing';
  // Backend takes source 'photo' for any ready, try-on-allowed garment, AI concepts included (body variants).
  const canMake = g.status === 'ready' && g.tryOnAllowed !== false;
  const problem = quotaProblem(quota.data, 1);
  const same = asset?.bodyKey === body;

  function make() {
    const items: AssetInput[] = [{ source: 'photo', garmentId: g.id, bodyKey: body }];
    // A lost/unclear response keeps its key; a new tap after the last job ended is a new generation.
    const key = keyFor(jobEnded ? null : held, items, newIdempotencyKey);
    setHeld(key);
    setJobId(null); // so a failed request here retries with this same key
    create.mutate({ items, key: key.key }, { onSuccess: ({ jobIds }) => setJobId(jobIds[0]) });
  }

  return (
    <View style={styles.box}>
      <Text variant="headline">Hình cho ma nơ canh</Text>
      {asset ? (
        <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
          <View style={styles.thumb}>
            <Image source={{ uri: asset.thumbnailUrl }} style={StyleSheet.absoluteFill} contentFit="contain" accessibilityLabel={`Hình chính diện cho ma nơ canh ${BODY[asset.bodyKey]}`} />
          </View>
          <Text variant="footnote" color={colors.inkSecondary} style={{ flex: 1 }}>
            Dùng ở góc nhìn chính diện cho ma nơ canh {BODY[asset.bodyKey]}{asset.isMock ? ' (hình thử nghiệm)' : ''}. Khi xoay, Studio hiện mô phỏng 3D.
          </Text>
        </View>
      ) : (
        <Text variant="footnote" color={colors.inkSecondary}>Chưa có hình; Studio đang hiện món này bằng mô phỏng 3D.</Text>
      )}
      {g.assetJob && !jobId ? (
        <Text variant="footnote" color={g.assetJob.status === 'failed' ? colors.danger : colors.inkSecondary}>
          {g.assetJob.status === 'deferred'
            ? `${messageFor(new RequestError(g.assetJob.errorCode ?? 'ASSET_QUOTA_EXCEEDED'))} Hình không tự tạo khi có lượt mới, hãy bấm tạo hình.`
            : g.assetJob.status === 'failed'
              ? messageFor(new RequestError(g.assetJob.errorCode ?? 'ASSET_PROVIDER_ERROR'))
              : inFlight
                ? `Đang tạo hình cho ma nơ canh ${BODY[g.assetJob.bodyKey]}…`
                : null}
        </Text>
      ) : null}
      {jobId ? <JobRow id={jobId} /> : null}
      {canMake && (!jobId || jobEnded) ? (
        <>
          <BodySwitch value={body} onChange={setBody} />
          <QuotaLine quota={quota.data} />
          <Button
            label={asset && !same ? `Tạo biến thể cho dáng ${BODY[body]}` : asset ? 'Tạo lại hình' : 'Tạo hình cho ma nơ canh'}
            variant="ink"
            onPress={make}
            loading={create.isPending}
            disabled={inFlight || !!problem}
            icon={<Icon ios="sparkles" android="auto_awesome" size={18} color="#FFFFFF" />}
          />
          {asset && !same ? (
            <Text variant="footnote" color={colors.inkSecondary}>Mỗi món chỉ giữ một hình: hình dáng {BODY[asset.bodyKey]} hiện tại sẽ được thay.</Text>
          ) : null}
          {problem && quota.data ?<Text variant="footnote" color={colors.warning}>{problem}</Text> : null}
          {create.isError ? <Text variant="footnote" color={colors.danger}>{messageFor(create.error)}</Text> : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: space.md, padding: space.lg, borderRadius: radius.md, backgroundColor: colors.ground },
  thumb: { width: 72, height: 108, borderRadius: radius.sm, backgroundColor: '#ECE9E4', overflow: 'hidden' },
});
