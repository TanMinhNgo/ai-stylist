import { EmptyState, Icon, Screen } from '@/components/ui';
import { colors } from '@/theme';

export default function LookbookScreen() {
  return (
    <Screen title="Lookbook">
      <EmptyState
        icon={<Icon ios="heart" android="favorite" size={44} color={colors.inkSecondary} />}
        title="Chưa có outfit nào"
        message="Các bộ đồ bạn thử và lưu lại sẽ nằm ở đây, kèm lời khuyên của stylist."
      />
    </Screen>
  );
}
