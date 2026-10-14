import type { StyleProfile } from '@stylist/shared';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, ErrorState, Glass, Icon, LoadingState, Text } from '@/components/ui';
import { BODY_SHAPE_LABEL, SKIN_TONE_LABEL } from '@/features/garments/labels';
import { useSaveStyleProfile, useStyleProfile } from '@/features/stylist/hooks';
import { BudgetField, ChipGroup, ColorPicker, OCCASION_OPTIONS, StylePicker } from '@/features/stylist/components/ProfileFields';
import { formatBudget, parseBudget } from '@/features/stylist/logic';
import { messageFor } from '@/lib/errors';
import { colors, space } from '@/theme';

export default function StyleProfileScreen() {
  const insets = useSafeAreaInsets();
  const profile = useStyleProfile();
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.root, { paddingTop: insets.top + space.sm }]}>
      <View style={styles.top}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Quay lại" hitSlop={8}>
          <Glass interactive style={styles.back}>
            <Icon ios="chevron.left" android="arrow_back" size={20} />
          </Glass>
        </Pressable>
        <Text variant="title" accessibilityRole="header">Hồ sơ style</Text>
      </View>
      {profile.isPending ? (
        <LoadingState />
      ) : profile.isError ? (
        <ErrorState error={profile.error} onRetry={() => profile.refetch()} />
      ) : (
        <Form profile={profile.data} bottom={insets.bottom} />
      )}
    </KeyboardAvoidingView>
  );
}

function Form({ profile, bottom }: { profile: StyleProfile; bottom: number }) {
  const save = useSaveStyleProfile();
  const [styleList, setStyles] = useState(profile.styles);
  const [occasions, setOccasions] = useState(profile.occasions);
  const [preferred, setPreferred] = useState(profile.preferredColors);
  const [avoided, setAvoided] = useState(profile.avoidedColors);
  const [budgetText, setBudgetText] = useState(formatBudget(profile.budget));
  const [bodyShape, setBodyShape] = useState(profile.bodyShape);
  const [skinTone, setSkinTone] = useState(profile.skinTone);
  const budget = parseBudget(budgetText);

  const submit = () =>
    save.mutate(
      { styles: styleList, occasions, preferredColors: preferred, avoidedColors: avoided, budget: budget ?? null, bodyShape, skinTone },
      { onSuccess: () => router.back() },
    );

  return (
    <>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Section title="Dáng người & tông da">
          <Text variant="footnote" color={colors.inkSecondary}>
            {profile.updatedAt ? 'Bạn có thể sửa nếu chưa đúng.' : 'AI phân tích từ ảnh người mẫu, bạn có thể sửa nếu chưa đúng.'} Chỉ dùng để chọn kiểu dáng và màu hợp với bạn.
          </Text>
          <Options labels={BODY_SHAPE_LABEL} value={bodyShape} onChange={setBodyShape} />
          <Options labels={SKIN_TONE_LABEL} value={skinTone} onChange={setSkinTone} />
        </Section>
        <Section title="Gu">
          <StylePicker value={styleList} onChange={setStyles} />
        </Section>
        <Section title="Dịp hay mặc">
          <ChipGroup options={OCCASION_OPTIONS} value={occasions} onChange={setOccasions} />
        </Section>
        <Section title="Màu ưa thích">
          <ColorPicker value={preferred} other={avoided} onChange={(v, o) => (setPreferred(v), setAvoided(o))} />
        </Section>
        <Section title="Màu muốn tránh">
          <ColorPicker value={avoided} other={preferred} onChange={(v, o) => (setAvoided(v), setPreferred(o))} />
        </Section>
        <Section title="Ngân sách">
          <BudgetField value={budgetText} onChange={setBudgetText} invalid={budget === undefined} />
        </Section>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: bottom + space.md }]}>
        {save.isError ? <Text variant="caption" color={colors.danger} style={{ textAlign: 'center' }}>{messageFor(save.error)}</Text> : null}
        <Button label="Lưu hồ sơ" onPress={submit} loading={save.isPending} disabled={budget === undefined} />
      </View>
    </>
  );
}

/** Single choice among an AI enum; tapping the chosen one again clears it (sent as null). */
function Options<K extends string>({ labels, value, onChange }: { labels: Record<K, string>; value: K | null; onChange: (v: K | null) => void }) {
  return (
    <View style={styles.wrap}>
      {(Object.keys(labels) as K[]).map((k) => {
        const on = value === k;
        return (
          <Pressable key={k} onPress={() => onChange(on ? null : k)} accessibilityRole="radio" accessibilityState={{ checked: on }} style={[styles.chip, on && { backgroundColor: colors.accent }]}>
            <Text variant="callout" color={on ? '#FFFFFF' : colors.ink}>{labels[k]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.md }}>
      <Text variant="headline">{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  body: { padding: space.xl, gap: space.xxl },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { minHeight: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center', backgroundColor: colors.surface },
  footer: { paddingHorizontal: space.xl, paddingTop: space.sm, gap: space.sm },
});
