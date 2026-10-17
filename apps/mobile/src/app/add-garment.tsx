import { router } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass, Icon, Text } from '@/components/ui';
import { AddFromPhoto } from '@/features/assets/AddFromPhoto';
import { colors, space } from '@/theme';

export default function AddGarmentScreen() {
  const insets = useSafeAreaInsets();

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
        <AddFromPhoto />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
