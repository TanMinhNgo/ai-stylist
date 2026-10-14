import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, ErrorState, Glass, Icon, LoadingState, Text } from '@/components/ui';
import { useModelPhotos } from '@/features/model-photos/hooks';
import { useStudio } from '@/features/studio/store';
import { AdviceSection, PullUpSheet } from '@/features/stylist/components/Advice';
import { useOutfit, useSaveOutfit } from '@/features/stylist/hooks';
import { adviceWorking } from '@/features/stylist/logic';
import { newIdempotencyKey, useCreateTryOn, useTryOnJob } from '@/features/try-on/hooks';
import { messageFor, RequestError } from '@/lib/errors';
import { colors, radius, space } from '@/theme';

const STEPS = ['Đã nhận yêu cầu', 'Đang mặc đồ lên ảnh của bạn', 'Hoàn tất ảnh thử đồ'];

export default function TryOnScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const insets = useSafeAreaInsets();
  const job = useTryOnJob(jobId);
  const activeJob = useStudio((s) => s.activeJob);
  const setActiveJob = useStudio((s) => s.setActiveJob);
  const create = useCreateTryOn();
  const photos = useModelPhotos();
  const [view, setView] = useState<'after' | 'before'>('after');

  // Inputs of this job are only known when it was started from Studio in this session.
  const inputs = activeJob?.id === jobId ? activeJob : null;
  const before = photos.data?.items.find((p) => p.id === inputs?.modelPhotoId);
  const data = job.data;
  const step = !data ? 0 : data.status === 'queued' ? 0 : data.status === 'processing' ? 1 : 2;

  // "Tạo lại" is a new action: new idempotency key, same model photo, garments and occasion.
  const again = () => {
    if (!inputs) return router.back();
    const { modelPhotoId, garmentIds, occasion } = inputs;
    create.mutate(
      { input: { modelPhotoId, garmentIds, occasion }, key: newIdempotencyKey() },
      {
        onSuccess: ({ jobId: id }) => {
          setActiveJob({ ...inputs, id });
          router.replace({ pathname: '/try-on/[jobId]', params: { jobId: id } });
        },
      },
    );
  };

  const actions = (
    <View style={{ flexDirection: 'row', gap: space.sm }}>
      <Button label="Tạo lại" variant="plain" onPress={again} loading={create.isPending} disabled={!inputs} style={{ flex: 1 }} />
      <Button label="Thử đồ khác" onPress={() => router.back()} style={{ flex: 1 }} />
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top + space.sm }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Về Studio" hitSlop={8}>
          <Glass interactive style={styles.round}>
            <Icon ios="xmark" android="close" size={18} />
          </Glass>
        </Pressable>
        {data?.status === 'done' && before ? (
          <Glass style={styles.segment}>
            {(['before', 'after'] as const).map((v) => (
              <Pressable key={v} onPress={() => setView(v)} accessibilityRole="tab" accessibilityState={{ selected: view === v }} style={[styles.segmentItem, view === v && styles.segmentOn]}>
                <Text variant="footnote" style={{ fontWeight: '600' }}>{v === 'before' ? 'Trước' : 'Sau'}</Text>
              </Pressable>
            ))}
          </Glass>
        ) : (
          <View />
        )}
        <View style={styles.round} />
      </View>

      {job.isPending ? (
        <LoadingState />
      ) : job.isError ? (
        <ErrorState error={job.error} onRetry={() => job.refetch()} />
      ) : data?.status === 'done' && data.resultUrl ? (
        <View style={{ flex: 1 }}>
          <View style={[styles.result, data.outfitId ? { marginBottom: SHEET_PEEK + insets.bottom } : null]}>
            <Image
              source={{ uri: view === 'before' && before ? before.url : data.resultUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
              transition={200}
              // Signed URLs last 15 minutes; a fresh GET of the matching resource returns new ones.
              onError={() => void (view === 'before' ? photos.refetch() : job.refetch())}
              accessibilityLabel={view === 'before' ? 'Ảnh người mẫu gốc' : 'Ảnh thử đồ'}
            />
            {data.provider === 'fake' ? (
              <View style={styles.fakeBadge}>
                <Icon ios="exclamationmark.triangle.fill" android="warning" size={13} color={colors.warning} />
                <Text variant="caption" style={{ fontWeight: '600' }}>Ảnh mẫu thử nghiệm, chưa phải ảnh thử đồ thật</Text>
              </View>
            ) : null}
          </View>
          {data.outfitId ? (
            <ResultSheet outfitId={data.outfitId} bottom={insets.bottom} actions={actions} />
          ) : (
            <View style={[styles.actions, { paddingBottom: insets.bottom + space.md }]}>{actions}</View>
          )}
        </View>
      ) : data?.status === 'failed' ? (
        <View style={[styles.waiting, { paddingBottom: insets.bottom + space.lg }]}>
          <View style={styles.failIcon}>
            <Icon ios="exclamationmark.triangle.fill" android="warning" size={30} color={colors.warning} />
          </View>
          <Text variant="title" style={styles.center}>Chưa thử đồ được</Text>
          <Text variant="callout" color="#4A4A52" style={styles.center}>{messageFor(new RequestError(data.errorCode ?? 'TRYON_PROVIDER_ERROR'))}</Text>
          {create.isError ? <Text variant="footnote" color={colors.danger} style={styles.center}>{messageFor(create.error)}</Text> : null}
          <View style={{ alignSelf: 'stretch', gap: space.sm, marginTop: space.lg }}>
            {inputs ? <Button label="Thử lại" onPress={again} loading={create.isPending} /> : null}
            <Button label="Chọn lại đồ" variant="plain" onPress={() => router.back()} />
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.waiting, { paddingBottom: insets.bottom + space.lg }]}>
          <ScanCard uri={before?.thumbnailUrl} />
          <Text variant="title" accessibilityLiveRegion="polite" style={styles.center}>
            {step === 0 ? 'Đang xếp hàng…' : 'Đang may đo lên ảnh của bạn…'}
          </Text>
          <Text variant="callout" color="#4A4A52" style={styles.center}>Thường mất khoảng 20–60 giây. Giữ khuôn mặt, dáng và nền như ảnh gốc.</Text>
          <View style={styles.steps}>
            {STEPS.map((label, i) => (
              <View key={label} style={styles.stepRow}>
                <View style={[styles.stepDot, i < step && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
                  {i < step ? <Icon ios="checkmark" android="check" size={12} color="#FFFFFF" /> : i === step ? <ActivityIndicator size="small" color={colors.accent} /> : null}
                </View>
                <Text variant="callout" color={i <= step ? colors.ink : colors.inkSecondary} style={{ fontWeight: i === step ? '600' : '400' }}>{label}</Text>
              </View>
            ))}
          </View>
          <Text variant="footnote" color={colors.inkSecondary} style={styles.center}>Bạn có thể rời màn hình này, Studio sẽ giữ lượt thử đang chạy.</Text>
          <Button label="Về Studio" variant="plain" onPress={() => router.back()} style={{ alignSelf: 'stretch' }} />
        </ScrollView>
      )}
    </View>
  );
}

const SHEET_PEEK = 240;

/** Advice for the finished try-on, peeking over the photo; "Lưu vào lookbook" saves the outfit the job created. */
function ResultSheet({ outfitId, bottom, actions }: { outfitId: string; bottom: number; actions: ReactNode }) {
  const { outfit, stuck } = useOutfit(outfitId);
  const save = useSaveOutfit();
  const o = outfit.data;
  const preview = o?.advice?.summary ?? (adviceWorking(o?.adviceStatus) ? 'Stylist đang xem bộ đồ của bạn…' : 'Kéo lên để xem hoặc xin lời khuyên');
  return (
    <PullUpSheet
      peek={SHEET_PEEK + bottom}
      header={
        <View style={{ gap: 2, paddingBottom: space.sm }}>
          <Text variant="headline">Lời khuyên stylist</Text>
          <Text variant="footnote" color={colors.inkSecondary} numberOfLines={2}>{preview}</Text>
        </View>
      }
      footer={
        <View style={{ gap: space.sm, paddingTop: space.sm, paddingBottom: bottom + space.md }}>
          {save.isError ? <Text variant="caption" color={colors.danger} style={styles.center}>{messageFor(save.error)}</Text> : null}
          {o?.savedAt ? (
            <Button label="Đã lưu · Xem trong lookbook" variant="plain" onPress={() => router.push({ pathname: '/outfit/[id]', params: { id: outfitId } })} icon={<Icon ios="bookmark.fill" android="bookmark" size={16} color={colors.accent} />} />
          ) : (
            <Button label="Lưu vào lookbook" variant="ink" disabled={!o} loading={save.isPending} onPress={() => save.mutate({ id: outfitId, saved: true })} icon={<Icon ios="bookmark" android="bookmark" size={16} color="#FFFFFF" />} />
          )}
          {actions}
        </View>
      }>
      {outfit.isPending ? <LoadingState /> : outfit.isError ? <ErrorState error={outfit.error} onRetry={() => outfit.refetch()} /> : o ? <AdviceSection outfit={o} stuck={stuck} onRecheck={() => outfit.refetch()} /> : null}
    </PullUpSheet>
  );
}

/** Model photo with a soft light band sweeping over it while the job runs. */
function ScanCard({ uri }: { uri?: string }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [t]);
  const band = useAnimatedStyle(() => ({ transform: [{ translateY: -40 + t.get() * 330 }] }));
  return (
    <View style={styles.scan}>
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Icon ios="person.crop.rectangle" android="portrait" size={44} color={colors.inkSecondary} />}
      <Animated.View pointerEvents="none" style={[styles.band, band]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.studio },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  segment: { flexDirection: 'row', padding: 3, borderRadius: radius.pill },
  segmentItem: { height: 32, paddingHorizontal: 16, borderRadius: radius.pill, justifyContent: 'center' },
  segmentOn: { backgroundColor: colors.surface },
  result: { flex: 1, margin: space.md, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#D9D3CA' },
  fakeBadge: { position: 'absolute', left: space.md, right: space.md, top: space.md, flexDirection: 'row', alignItems: 'center', gap: 6, padding: space.sm, borderRadius: radius.sm, backgroundColor: 'rgba(255,255,255,0.92)' },
  actions: { paddingHorizontal: space.lg, gap: space.sm },
  waiting: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl, gap: space.md },
  scan: { width: 220, height: 300, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: '#D9D3CA', alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
  band: { position: 'absolute', left: 0, right: 0, top: 0, height: 40, backgroundColor: 'rgba(255,255,255,0.55)' },
  steps: { alignSelf: 'stretch', borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.75)', padding: space.lg, gap: space.md },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  stepDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.2)', alignItems: 'center', justifyContent: 'center' },
  failIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(178,94,9,0.12)', alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
});
