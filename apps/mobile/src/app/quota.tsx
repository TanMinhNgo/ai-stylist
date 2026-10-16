import { router } from 'expo-router';
import { Button, Card, ErrorState, LoadingState, Screen, Text } from '@/components/ui';
import { UsageNotice } from '@/features/usage/UsageNotice';
import { useEntitlements, useStylistUsage, useUsage } from '@/features/usage/hooks';
import { PLAN_LABEL, planBenefits, resetLabel } from '@/features/usage/logic';
import { colors } from '@/theme';

function PlanBenefits() {
  const ent = useEntitlements();
  if (ent.isPending) return <LoadingState label="Đang tải quyền lợi gói…" />;
  if (ent.isError) return <ErrorState error={ent.error} onRetry={() => ent.refetch()} />;
  const { available, upcoming } = planBenefits(ent.data);
  return (
    <Card>
      <Text variant="headline">Quyền lợi gói {PLAN_LABEL[ent.data.plan]}</Text>
      {available.map((l) => <Text key={l} variant="body">✓ {l}</Text>)}
      {upcoming.length ? <Text variant="caption" color={colors.inkSecondary}>Sắp có: {upcoming.join(', ')}</Text> : null}
    </Card>
  );
}

function StylistQuota() {
  const q = useStylistUsage();
  if (q.isPending) return <LoadingState label="Đang tải lượt tư vấn…" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const s = q.data;
  return (
    <Card>
      <Text variant="headline" color={s.remaining === 0 ? colors.warning : colors.ink}>{s.remaining}/{s.limit} lượt tư vấn stylist còn lại</Text>
      <Text variant="caption" color={colors.inkSecondary}>{s.adviceLevel === 'advanced' ? 'Tư vấn chi tiết kèm gợi ý phụ kiện' : 'Tư vấn cơ bản'} · gồm tư vấn tự động sau khi thử đồ, xin tư vấn và gợi ý bộ phối. Làm mới lúc {resetLabel(s.resetsAt)}.</Text>
    </Card>
  );
}

export default function QuotaScreen() {
  const usage = useUsage();
  return <Screen title="Hạn mức và gói"><Text variant="title">{usage.data?.remaining === 0 ? 'Bạn đã dùng hết lượt tháng này' : 'Lượt thử đồ của bạn'}</Text><Text variant="body">Khi hết lượt tháng này, bạn vẫn xem tủ đồ và Lookbook. Lượt mới được cấp đầu tháng theo giờ UTC; giờ hiển thị bên dưới theo điện thoại.</Text><UsageNotice /><StylistQuota /><PlanBenefits /><Button label="Quay lại" variant="plain" onPress={() => router.back()} /></Screen>;
}
