import { onlineManager } from '@tanstack/react-query';
import { useNetworkState } from 'expo-network';
import { useEffect } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui';
import { offline } from '@/features/usage/logic';
import { colors, space } from '@/theme';

// Foreground refetch (usage included) is handled by focusManager in the root layout.
export function Connectivity() {
  const down = offline(useNetworkState());
  const insets = useSafeAreaInsets();
  useEffect(() => { onlineManager.setOnline(!down); }, [down]);
  return down ? <View accessibilityLiveRegion="polite" style={{ paddingTop: insets.top, paddingHorizontal: space.md, paddingBottom: space.sm, backgroundColor: colors.warning }}><Text variant="footnote" color="#FFFFFF">Đang mất kết nối. Nội dung đã tải vẫn có thể xem; ứng dụng sẽ tải lại khi có mạng.</Text></View> : null;
}
