import { useAuth } from '@clerk/expo';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Text } from '@/components/ui';
import { useOnboardingSkip, useSaveStyleProfile } from '@/features/stylist/hooks';
import { BudgetField, ChipGroup, ColorPicker, OCCASION_OPTIONS, StylePicker } from '@/features/stylist/components/ProfileFields';
import { parseBudget } from '@/features/stylist/logic';
import { messageFor } from '@/lib/errors';
import { colors, radius, space } from '@/theme';

const STEPS = [
  { title: 'Gu của bạn là gì?', hint: 'Chọn những phong cách bạn thấy giống mình, bao nhiêu cũng được.' },
  { title: 'Bạn hay mặc đồ cho dịp nào?', hint: 'Stylist sẽ ưu tiên gợi ý cho những dịp này.' },
  { title: 'Màu bạn thích và màu muốn tránh', hint: 'Một màu chỉ nằm ở một bên.' },
  { title: 'Ngân sách mua sắm', hint: 'Giúp stylist gợi ý món nên bổ sung vừa túi tiền.' },
];

/** First-run style survey; "Bỏ qua" is remembered for this user and never blocks the app. */
export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const skip = useOnboardingSkip((s) => s.skip);
  const save = useSaveStyleProfile();
  const [step, setStep] = useState(0);
  const [styleList, setStyles] = useState<string[]>([]);
  const [occasions, setOccasions] = useState<string[]>([]);
  const [preferred, setPreferred] = useState<string[]>([]);
  const [avoided, setAvoided] = useState<string[]>([]);
  const [budgetText, setBudgetText] = useState('');
  const budget = parseBudget(budgetText);
  const last = step === STEPS.length - 1;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const onSkip = () => {
    if (userId) skip(userId);
    close();
  };
  // No bodyShape/skinTone: the API keeps the values analysed from the model photo.
  const finish = () =>
    save.mutate({ styles: styleList, occasions, preferredColors: preferred, avoidedColors: avoided, budget: budget ?? null }, { onSuccess: close });

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.root, { paddingTop: insets.top + space.sm }]}>
      <View style={styles.top}>
        <View style={styles.dots} accessibilityLabel={`Bước ${step + 1} trên ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <View key={s.title} style={[styles.dot, i <= step && { backgroundColor: colors.accent }]} />
          ))}
        </View>
        <Pressable onPress={onSkip} accessibilityRole="button" hitSlop={8}>
          <Text variant="callout" color={colors.inkSecondary} style={{ fontWeight: '600' }}>Bỏ qua</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text variant="largeTitle" accessibilityRole="header" style={{ fontSize: 28, lineHeight: 34 }}>{STEPS[step].title}</Text>
        <Text variant="callout" color={colors.inkSecondary}>{STEPS[step].hint}</Text>
        {step === 0 ? (
          <StylePicker value={styleList} onChange={setStyles} />
        ) : step === 1 ? (
          <ChipGroup options={OCCASION_OPTIONS} value={occasions} onChange={setOccasions} />
        ) : step === 2 ? (
          <View style={{ gap: space.lg }}>
            <Text variant="headline">Màu ưa thích</Text>
            <ColorPicker value={preferred} other={avoided} onChange={(v, o) => (setPreferred(v), setAvoided(o))} />
            <Text variant="headline">Màu muốn tránh</Text>
            <ColorPicker value={avoided} other={preferred} onChange={(v, o) => (setAvoided(v), setPreferred(o))} />
          </View>
        ) : (
          <BudgetField value={budgetText} onChange={setBudgetText} invalid={budget === undefined} />
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
        {save.isError ? <Text variant="caption" color={colors.danger} style={{ textAlign: 'center' }}>{messageFor(save.error)}</Text> : null}
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {step > 0 ? <Button label="Quay lại" variant="plain" onPress={() => setStep(step - 1)} style={{ flex: 1 }} /> : null}
          <Button
            label={last ? 'Hoàn tất' : 'Tiếp'}
            onPress={last ? finish : () => setStep(step + 1)}
            loading={save.isPending}
            disabled={last && budget === undefined}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xl, minHeight: 44 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 28, height: 5, borderRadius: radius.pill, backgroundColor: colors.fill },
  body: { padding: space.xl, gap: space.lg },
  footer: { paddingHorizontal: space.xl, paddingTop: space.sm, gap: space.sm },
});
