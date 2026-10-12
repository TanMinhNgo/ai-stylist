import { router } from 'expo-router';

import { Button, EmptyState, Icon, Screen } from '@/components/ui';
import { colors } from '@/theme';

export default function StudioScreen() {
  return (
    <Screen title="Studio" subtitle="Phối đồ trên người mẫu 3D" background={colors.studio}>
      <EmptyState
        icon={<Icon ios="figure.stand" android="accessibility_new" size={44} color={colors.inkSecondary} />}
        title="Bắt đầu với ảnh của bạn"
        message="Thêm một ảnh toàn thân để thử đồ lên chính bạn. Người mẫu 3D và phối đồ sẽ có ở bước tiếp theo."
        action={<Button label="Chụp ảnh người mẫu" onPress={() => router.push('/photo-guide')} icon={<Icon ios="camera" android="photo_camera" size={18} color="#FFFFFF" />} />}
      />
    </Screen>
  );
}
