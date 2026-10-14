import { router } from 'expo-router';
import { Button, Screen, Text } from '@/components/ui';
import { UsageNotice } from '@/features/usage/UsageNotice';
import { useUsage } from '@/features/usage/hooks';

export default function QuotaScreen() {
  const usage = useUsage();
  return <Screen title="Hạn mức thử đồ"><Text variant="title">{usage.data?.remaining === 0 ? 'Bạn đã dùng hết lượt tháng này' : 'Lượt thử đồ của bạn'}</Text><Text variant="body">Khi hết lượt tháng này, bạn vẫn xem tủ đồ và Lookbook. Lượt mới được cấp đầu tháng theo giờ UTC; giờ hiển thị bên dưới theo điện thoại.</Text><UsageNotice /><Button label="Quay lại" variant="plain" onPress={() => router.back()} /></Screen>;
}
