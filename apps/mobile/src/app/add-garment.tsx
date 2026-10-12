import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass, Icon, Text } from '@/components/ui';
import { AddFromIdea } from '@/features/assets/AddFromIdea';
import { AddFromPhoto } from '@/features/assets/AddFromPhoto';
import { useStudio } from '@/features/studio/store';
import { colors, radius, space } from '@/theme';

const TABS = ['Từ ảnh', 'Từ ý tưởng'] as const;

export default function AddGarmentScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState(0);
  // Default to the mannequin currently in Studio.
  const body = useStudio((s) => s.body);

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: space.xl, paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.xxl, gap: space.lg }} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Quay lại" hitSlop={8}>
            <Glass interactive style={styles.back}>
              <Icon ios="chevron.left" android="arrow_back" size={20} />
            </Glass>
          </Pressable>
          <Text variant="title" accessibilityRole="header">Thêm món</Text>
        </View>
        <View style={styles.segment} accessibilityRole="tablist">
          {TABS.map((t, i) => (
            <Pressable key={t} onPress={() => setTab(i)} accessibilityRole="tab" accessibilityState={{ selected: tab === i }} style={[styles.segmentItem, tab === i && styles.segmentOn]}>
              <Text variant="callout" style={{ fontWeight: '600' }}>{t}</Text>
            </Pressable>
          ))}
        </View>
        {/* Both stay mounted so switching tabs never loses a crop, a plan or a running job. */}
        <View style={tab === 0 ? null : styles.hidden}>
          <AddFromPhoto initialBody={body} />
        </View>
        <View style={tab === 1 ? null : styles.hidden}>
          <AddFromIdea initialBody={body} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  segment: { flexDirection: 'row', padding: 3, borderRadius: radius.pill, backgroundColor: colors.fill },
  segmentItem: { flex: 1, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  segmentOn: { backgroundColor: colors.surface },
  hidden: { display: 'none' },
});
