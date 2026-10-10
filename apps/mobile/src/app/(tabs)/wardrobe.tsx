import { EmptyState, Icon, Screen } from '@/components/ui';
import { colors } from '@/theme';

export default function WardrobeScreen() {
  return (
    <Screen title="Tủ đồ">
      <EmptyState
        icon={<Icon ios="hanger" android="checkroom" size={44} color={colors.inkSecondary} />}
        title="Tủ đồ còn trống"
        message="Chụp hoặc chọn ảnh món đồ, AI sẽ tự gắn loại, màu, chất liệu và độ trang trọng."
      />
    </Screen>
  );
}
