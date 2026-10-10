import { EmptyState, Icon, Screen } from '@/components/ui';
import { colors } from '@/theme';

export default function StudioScreen() {
  return (
    <Screen title="Studio" subtitle="Phối đồ trên người mẫu 3D" background={colors.studio}>
      <EmptyState
        icon={<Icon ios="figure.stand" android="accessibility_new" size={44} color={colors.inkSecondary} />}
        title="Người mẫu 3D đang được chuẩn bị"
        message="Bạn sẽ chọn đồ từ tủ đồ, xem trên người mẫu 3D rồi thử lên ảnh của mình tại đây."
      />
    </Screen>
  );
}
