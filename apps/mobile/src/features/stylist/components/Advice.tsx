import type { StylistAdvice } from '@stylist/shared';
import { router } from 'expo-router';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, PanResponder, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Button, Icon, Text } from '@/components/ui';
import { shopQuery } from '@/features/integrations/logic';
import { colorHex } from '@/features/studio/looks';
import { useHeldKey, useRequestAdvice, useStylistJob, type OutfitItem } from '@/features/stylist/hooks';
import { adviceWorking, jobUnsettled } from '@/features/stylist/logic';
import { messageFor, stylistJobMessage } from '@/lib/errors';
import { colors, radius, space } from '@/theme';

/**
 * Stylist advice for one outfit, with every state: written, being written (auto after try-on or requested),
 * failed or missing ("Xin tư vấn", AI only runs on that tap). An older advice stays visible if a new request fails.
 */
export function AdviceSection({ outfit, stuck, onRecheck }: { outfit: OutfitItem; stuck: boolean; onRecheck: () => void }) {
  const requestAdvice = useRequestAdvice();
  const keys = useHeldKey();
  const [jobId, setJobId] = useState<string | null>(null);
  const { job, stuck: jobStuck } = useStylistJob(jobId);
  const jobStatus = job.data?.status;
  const jobRunning = jobUnsettled(jobId, jobStatus);
  // The job finished but the outfit refetch (triggered by useStylistJob) has not landed yet.
  const refetching = jobStatus === 'ready' && outfit.adviceStatus !== 'ready';
  const working = jobRunning || refetching || adviceWorking(outfit.adviceStatus);
  const failed = jobStatus === 'failed' || (!jobRunning && outfit.adviceStatus === 'failed');

  const ask = () =>
    requestAdvice.mutate(
      { outfitId: outfit.id, key: keys.take({ outfitId: outfit.id }) },
      {
        onSuccess: ({ jobId: id }) => {
          keys.settle();
          setJobId(id);
        },
        onError: (e) => keys.settle(e),
      },
    );

  return (
    <View style={{ gap: space.lg }}>
      {outfit.advice ? <AdviceBody advice={outfit.advice} mock={outfit.adviceIsMock} /> : null}
      {/* The stored level, which may differ from the current plan after an upgrade/downgrade. */}
      {outfit.advice && outfit.promptVersion?.endsWith('-basic') ? <Text variant="caption" color={colors.inkSecondary}>Bản tư vấn cơ bản: nhận xét chung và điểm cộng của bộ đồ.</Text> : null}
      {working ? (
        <View style={styles.status} accessibilityLiveRegion="polite">
          <ActivityIndicator color={colors.accent} />
          <Text variant="callout" style={{ flex: 1 }}>{job.isError ? messageFor(job.error) : stuck || jobStuck ? 'Stylist trả lời lâu hơn dự kiến.' : 'Stylist đang xem bộ đồ của bạn…'}</Text>
          {stuck || jobStuck || job.isError ? <Button label="Kiểm tra lại" variant="plain" onPress={() => (jobId ? job.refetch() : onRecheck())} /> : null}
        </View>
      ) : failed || !outfit.advice ? (
        <View style={{ gap: space.sm }}>
          {failed ? (
            <Text variant="callout" color={colors.inkSecondary}>
              {stylistJobMessage(job.data?.errorCode ?? outfit.adviceErrorCode) ?? (outfit.advice ? 'Lần xin tư vấn mới chưa thành công, đang giữ lời khuyên trước đó.' : 'Stylist chưa trả lời được lần này. Bạn có thể xin lại.')}
            </Text>
          ) : (
            <Text variant="callout" color={colors.inkSecondary}>Chưa có lời khuyên cho bộ đồ này.</Text>
          )}
          <Button label={failed ? 'Xin tư vấn lại' : 'Xin tư vấn'} variant="ink" onPress={ask} loading={requestAdvice.isPending} icon={<Icon ios="sparkles" android="auto_awesome" size={16} color="#FFFFFF" />} />
          {requestAdvice.isError ? <Text variant="caption" color={colors.danger}>{messageFor(requestAdvice.error)}</Text> : null}
          {job.isError ? <Text variant="caption" color={colors.danger}>{messageFor(job.error)}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

export function AdviceBody({ advice, mock }: { advice: StylistAdvice; mock: boolean }) {
  const { summary, strengths, adjustments, accessories, occasionFit } = advice;
  return (
    <View style={{ gap: space.lg }}>
      {mock ? (
        <View style={styles.mock}>
          <Icon ios="exclamationmark.triangle.fill" android="warning" size={13} color={colors.warning} />
          <Text variant="caption" style={{ flex: 1, fontWeight: '600' }}>Lời khuyên mẫu thử nghiệm, chưa phải từ AI stylist thật</Text>
        </View>
      ) : null}
      <View style={styles.summary}>
        <Text variant="headline" style={{ lineHeight: 24 }}>{summary}</Text>
      </View>

      <Section title="Điểm cộng">
        {strengths.map((s) => (
          <View key={s} style={styles.bullet}>
            <Icon ios="checkmark.circle.fill" android="check_circle" size={16} color={colors.success} />
            <Text variant="callout" style={{ flex: 1 }}>{s}</Text>
          </View>
        ))}
      </Section>

      {adjustments.length ? (
        <Section title="Có thể chỉnh thêm">
          {adjustments.map((a) => (
            <View key={a.suggestion} style={styles.bullet}>
              <Icon ios="wand.and.stars" android="auto_fix_high" size={16} color={colors.accent} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="callout" style={{ fontWeight: '600' }}>{a.suggestion}</Text>
                <Text variant="footnote" color={colors.inkSecondary}>{a.reason}</Text>
              </View>
            </View>
          ))}
        </Section>
      ) : null}

      {accessories.length ? (
        <Section title="Phụ kiện gợi ý">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            {accessories.map((a) => (
              <View key={`${a.type}${a.description}`} style={styles.accessory}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={[styles.dot, { backgroundColor: colorHex(a.color) }]} />
                  <Text variant="footnote" style={{ fontWeight: '600', flex: 1 }} numberOfLines={1}>{a.type}</Text>
                </View>
                <Text variant="callout">{a.description}</Text>
                <Text variant="caption" color={colors.inkSecondary}>{a.color}</Text>
                <Text variant="footnote" color={colors.inkSecondary}>{a.reason}</Text>
                <Pressable onPress={() => router.push({ pathname: '/shop', params: shopQuery(a.type) })} accessibilityRole="button" accessibilityLabel={`Tìm mua ${a.type}`} hitSlop={6}>
                  <Text variant="footnote" color={colors.accent} style={{ fontWeight: '600' }}>Tìm mua</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </Section>
      ) : null}

      <Section title="Hợp với dịp">
        <View style={{ flexDirection: 'row', gap: 4 }} accessibilityLabel={`${occasionFit.score} trên 5`}>
          {[1, 2, 3, 4, 5].map((n) => (
            <View key={n} style={[styles.scoreBar, n <= occasionFit.score && { backgroundColor: colors.accent }]} />
          ))}
        </View>
        <Text variant="callout">{occasionFit.reason}</Text>
      </Section>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="footnote" color={colors.inkSecondary} style={{ fontWeight: '600', letterSpacing: 0.3 }}>{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}

/** Bottom sheet that peeks over the photo and is dragged (or tapped) up to read everything. */
export function PullUpSheet({ peek, header, footer, children }: { peek: number; header: ReactNode; footer?: ReactNode; children: ReactNode }) {
  const { height } = useWindowDimensions();
  const max = Math.max(peek, height * 0.72);
  const [open, setOpen] = useState(false);
  const h = useRef(new Animated.Value(peek)).current;
  const start = useRef(peek);
  const pan = useMemo(() => {
    const snap = (toOpen: boolean) => {
      setOpen(toOpen);
      Animated.spring(h, { toValue: toOpen ? max : peek, useNativeDriver: false, bounciness: 0 }).start();
    };
    return {
      snap,
      responder: PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
        onPanResponderGrant: () => h.stopAnimation((v) => (start.current = v)),
        onPanResponderMove: (_, g) => h.setValue(Math.min(max, Math.max(peek, start.current - g.dy))),
        onPanResponderRelease: (_, g) => snap(g.vy < -0.3 || (g.vy <= 0.3 && start.current - g.dy > (peek + max) / 2)),
      }),
    };
  }, [h, peek, max]);

  return (
    <Animated.View style={[styles.sheet, { height: h }]}>
      <View {...pan.responder.panHandlers}>
        <Pressable onPress={() => pan.snap(!open)} accessibilityRole="button" accessibilityLabel={open ? 'Thu gọn lời khuyên' : 'Mở toàn bộ lời khuyên'} style={styles.handleArea}>
          <View style={styles.grip} />
        </Pressable>
        {header}
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: space.lg }} scrollEnabled={open}>
        {children}
      </ScrollView>
      {footer}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  status: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: colors.accentSoft },
  mock: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: space.sm, borderRadius: radius.sm, backgroundColor: 'rgba(178,94,9,0.1)' },
  summary: { padding: space.lg, borderRadius: radius.md, backgroundColor: colors.ground, borderLeftWidth: 3, borderLeftColor: colors.accent },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  accessory: { width: 200, padding: space.md, gap: 4, borderRadius: radius.md, backgroundColor: colors.ground },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.25)' },
  scoreBar: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.fill },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: space.lg, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 12 },
  handleArea: { alignItems: 'center', paddingVertical: space.sm },
  grip: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.separator },
});
