import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Glass, Icon, Text } from '@/components/ui';
import { useStudio } from '@/features/studio/store';
import { GarmentChip } from '@/features/stylist/components/GarmentChip';
import { OCCASION_OPTIONS } from '@/features/stylist/components/ProfileFields';
import { fetchGarments, useHeldKey, useStylistJob, useSuggest } from '@/features/stylist/hooks';
import { jobUnsettled, suggestionPicks } from '@/features/stylist/logic';
import { messageFor, stylistJobMessage } from '@/lib/errors';
import { colors, radius, space, type } from '@/theme';

/** "Gợi ý cho tôi": up to 3 outfits from the user's wardrobe for an occasion; "Thử ngay" fills Studio (no try-on, no AI call). */
export default function SuggestScreen() {
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const applySuggestion = useStudio((s) => s.applySuggestion);
  const [occasion, setOccasion] = useState(useStudio.getState().occasion);
  const suggest = useSuggest();
  const keys = useHeldKey();
  const [jobId, setJobId] = useState<string | null>(null);
  const { job, stuck } = useStylistJob(jobId);
  const status = job.data?.status;
  const running = jobUnsettled(jobId, status);
  const result = status === 'ready' ? job.data?.result : null;
  const [applying, setApplying] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  // AI runs only on this tap; a network retry resends the same key, a new tap after an answer gets a new one.
  const ask = () => {
    const input = occasion.trim();
    setProblem(null);
    suggest.mutate(
      { occasion: input, key: keys.take({ occasion: input }) },
      {
        onSuccess: ({ jobId: id }) => {
          keys.settle();
          setJobId(id);
        },
        onError: (e) => keys.settle(e),
      },
    );
  };

  const tryNow = async (index: number, garmentIds: string[], forOccasion: string) => {
    setApplying(index);
    setProblem(null);
    try {
      const picked = suggestionPicks(await fetchGarments(client, garmentIds));
      if ('problem' in picked) return setProblem(picked.problem);
      applySuggestion(picked.picks, forOccasion);
      router.back();
    } catch (e) {
      setProblem(messageFor(e));
    } finally {
      setApplying(null);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.root, { paddingTop: insets.top + space.sm }]}>
      <View style={styles.top}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Về Studio" hitSlop={8}>
          <Glass interactive style={styles.round}>
            <Icon ios="xmark" android="close" size={18} />
          </Glass>
        </Pressable>
        <Text variant="title" accessibilityRole="header">Gợi ý cho tôi</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.xxl }]} keyboardShouldPersistTaps="handled">
        <Text variant="callout" color={colors.inkSecondary}>Chọn dịp, stylist sẽ phối tối đa 3 bộ từ tủ đồ của bạn.</Text>
        <View style={styles.wrap}>
          {OCCASION_OPTIONS.map((o) => {
            const on = occasion === o;
            return (
              <Pressable key={o} onPress={() => setOccasion(o)} accessibilityRole="radio" accessibilityState={{ checked: on }} style={[styles.chip, on && { backgroundColor: colors.accent }]}>
                <Text variant="callout" color={on ? '#FFFFFF' : colors.ink}>{o}</Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput value={occasion} onChangeText={setOccasion} placeholder="Hoặc nhập dịp: đám cưới bạn thân, phỏng vấn…" placeholderTextColor={colors.inkTertiary} maxLength={120} accessibilityLabel="Dịp" style={styles.input} />
        <Button
          label={result ? 'Gợi ý lại' : 'Gợi ý cho tôi'}
          onPress={ask}
          loading={suggest.isPending}
          disabled={!occasion.trim() || running}
          icon={<Icon ios="sparkles" android="auto_awesome" size={18} color="#FFFFFF" />}
        />
        {suggest.isError ? <Text variant="caption" color={colors.danger} style={styles.center}>{messageFor(suggest.error)}</Text> : null}

        {running ? (
          <View style={styles.status} accessibilityLiveRegion="polite">
            <ActivityIndicator color={colors.accent} />
            <Text variant="callout" style={{ flex: 1 }}>{job.isError ? messageFor(job.error) : stuck ? 'Stylist trả lời lâu hơn dự kiến.' : 'Stylist đang chọn đồ từ tủ của bạn…'}</Text>
            {stuck || job.isError ? <Button label="Kiểm tra lại" variant="plain" onPress={() => job.refetch()} /> : null}
          </View>
        ) : job.isError ? (
          <Text variant="callout" color={colors.danger}>{messageFor(job.error)}</Text>
        ) : status === 'failed' ? (
          <Text variant="callout" color={colors.inkSecondary}>{stylistJobMessage(job.data?.errorCode) ?? 'Stylist chưa gợi ý được lần này. Bấm "Gợi ý cho tôi" để thử lại.'}</Text>
        ) : null}

        {result ? (
          <View style={{ gap: space.lg }}>
            {result.isMock ? (
              <View style={styles.mock}>
                <Icon ios="exclamationmark.triangle.fill" android="warning" size={13} color={colors.warning} />
                <Text variant="caption" style={{ flex: 1, fontWeight: '600' }}>Gợi ý mẫu thử nghiệm, chưa phải từ AI stylist thật</Text>
              </View>
            ) : null}
            {result.message || result.outfits.length < 3 ? (
              <View style={styles.note}>
                <Text variant="callout">{result.message ?? 'Tủ đồ còn ít món nên stylist chỉ phối được chừng này bộ.'}</Text>
                <Button label="Thêm món vào tủ đồ" variant="plain" onPress={() => router.push('/add-garment')} icon={<Icon ios="plus" android="add" size={16} />} />
              </View>
            ) : null}
            {problem ? <Text variant="callout" color={colors.danger}>{problem}</Text> : null}
            {result.outfits.map((o, i) => (
              <View key={o.garmentIds.join()} style={styles.card}>
                <Text variant="headline">Phương án {i + 1}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md }}>
                  {o.garmentIds.map((id) => <GarmentChip key={id} id={id} />)}
                </ScrollView>
                <Text variant="callout" color="#3A3A40">{o.reason}</Text>
                <Button label="Thử ngay" onPress={() => tryNow(i, o.garmentIds, result.occasion)} loading={applying === i} disabled={applying !== null} />
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  body: { padding: space.xl, gap: space.lg },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { minHeight: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center', backgroundColor: colors.surface },
  input: { ...type.callout, height: 44, borderRadius: radius.sm, backgroundColor: colors.surface, paddingHorizontal: space.md, color: colors.ink },
  status: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: colors.accentSoft },
  mock: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: space.sm, borderRadius: radius.sm, backgroundColor: 'rgba(178,94,9,0.1)' },
  note: { gap: space.sm, padding: space.lg, borderRadius: radius.md, backgroundColor: colors.surface },
  card: { gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface },
  center: { textAlign: 'center' },
});
