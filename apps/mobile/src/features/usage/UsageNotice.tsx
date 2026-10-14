import { router } from 'expo-router';
import { View } from 'react-native';
import { Button, Text } from '@/components/ui';
import { useUsage } from './hooks';
import { PLAN_LABEL, resetLabel } from './logic';
import { colors } from '@/theme';

export function UsageNotice({ compact = false }: { compact?: boolean }) {
  const usage = useUsage();
  const u = usage.data;
  return (
    <View style={{ gap: 4 }} accessibilityLiveRegion="polite">
      <Text variant={compact ? 'caption' : 'headline'} color={u?.remaining === 0 ? colors.warning : colors.inkSecondary}>
        {u ? `${PLAN_LABEL[u.plan]} · ${u.remaining}/${u.limit} lượt thử đồ còn lại${compact ? '' : ` · đã dùng ${u.used}`}` : usage.isError ? 'Chưa tải được hạn mức' : 'Đang kiểm tra hạn mức…'}
      </Text>
      {u && (!compact || u.remaining <= 2) ? <Text variant="caption" color={colors.inkSecondary}>Làm mới lúc {resetLabel(u.resetsAt)}. Lượt tạo PNG hằng ngày tính riêng.</Text> : null}
      {usage.isError ? <Button label="Kiểm tra lại" variant="plain" onPress={() => usage.refetch()} /> : null}
      {compact && u?.remaining === 0 ? <Button label="Xem hạn mức" variant="plain" onPress={() => router.push('/quota')} /> : null}
    </View>
  );
}
