import { StyleSheet, View } from 'react-native';

import { Card, ErrorState, Icon, LoadingState, Screen, Text } from '@/components/ui';
import { useHealth } from '@/features/health/hooks';
import { colors, radius, space } from '@/theme';

export default function ProfileScreen() {
  const health = useHealth();

  return (
    <Screen title="Hồ sơ">
      <View style={styles.identity}>
        <View style={styles.avatar}>
          <Icon ios="person.fill" android="person" size={30} color={colors.inkSecondary} />
        </View>
        <View style={{ gap: 2, flex: 1 }}>
          <Text variant="title">Chưa đăng nhập</Text>
          <Text variant="callout" color={colors.inkSecondary}>Đăng nhập sẽ có ở bước tiếp theo</Text>
        </View>
      </View>

      <Text variant="footnote" color={colors.inkSecondary} style={styles.sectionLabel}>KẾT NỐI MÁY CHỦ</Text>
      <Card>
        {health.isPending ? (
          <LoadingState label="Đang kiểm tra máy chủ…" />
        ) : health.isError ? (
          <ErrorState error={health.error} onRetry={() => health.refetch()} />
        ) : (
          <View style={styles.row} accessibilityLabel="Máy chủ đang hoạt động">
            <View style={styles.okDot}>
              <Icon ios="checkmark" android="check" size={14} color="#FFFFFF" />
            </View>
            <Text variant="headline" style={{ flex: 1 }}>Máy chủ đang hoạt động</Text>
          </View>
        )}
        <Text variant="caption" color={colors.inkSecondary}>{process.env.EXPO_PUBLIC_API_URL ?? 'Chưa cấu hình EXPO_PUBLIC_API_URL'}</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#DCD6CC', alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { marginLeft: space.lg, marginBottom: -space.sm, letterSpacing: 0.3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44 },
  okDot: { width: 26, height: 26, borderRadius: radius.pill, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
});
