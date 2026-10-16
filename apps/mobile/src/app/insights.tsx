import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Card, ErrorState, Icon, LoadingState, Screen, Text } from '@/components/ui';
import { OutfitThumb } from '@/features/planning/components';
import { useDeleteWear, useInsights, useWearHistory } from '@/features/planning/hooks';
import { addDays, dayLabel, deviceTimeZone, featureOn, localDate } from '@/features/planning/logic';
import { GarmentChip } from '@/features/stylist/components/GarmentChip';
import { useEntitlements } from '@/features/usage/hooks';
import { messageFor } from '@/lib/errors';
import { colors, space } from '@/theme';

const PERIODS = [30, 90, 365] as const;

/** Counts come only from "Đã mặc" confirmations; try-on, save and like are never counted as worn. */
export default function InsightsScreen() {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const to = localDate(deviceTimeZone());
  const from = addDays(to, -(days - 1));
  const canSee = featureOn(useEntitlements().data, 'wardrobe_insights');

  return (
    <Screen title="Đã mặc và thống kê" subtitle="Chỉ tính những lần bạn bấm “Đã mặc” ở outfit">
      <View style={styles.row}>
        {PERIODS.map((p) => (
          <Pressable key={p} onPress={() => setDays(p)} accessibilityRole="radio" accessibilityState={{ checked: p === days }} style={[styles.chip, p === days && { backgroundColor: colors.ink }]}>
            <Text variant="callout" color={p === days ? '#FFFFFF' : colors.ink}>{p} ngày</Text>
          </Pressable>
        ))}
      </View>
      {canSee ? <Insights from={from} to={to} /> : <Text variant="callout" color={colors.inkSecondary}>Phân tích tủ đồ có trong gói Pro. Bạn vẫn ghi và xem lịch sử đã mặc bên dưới.</Text>}
      <History from={from} to={to} />
      <Button label="Quay lại" variant="plain" onPress={() => router.back()} />
    </Screen>
  );
}

function Insights({ from, to }: { from: string; to: string }) {
  const q = useInsights(from, to, true);
  if (q.isPending) return <LoadingState label="Đang tính thống kê…" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const s = q.data;
  if (s.status === 'insufficient_data')
    return (
      <Card>
        <Text variant="headline">Chưa đủ dữ liệu</Text>
        <Text variant="callout" color={colors.inkSecondary}>Trong kỳ này chưa có lần “Đã mặc” nào. Mở một outfit trong Lookbook và bấm “Đã mặc hôm nay” để bắt đầu thống kê.</Text>
      </Card>
    );
  return (
    <>
      <Card>
        <Text variant="headline">{s.confirmedRecords} lần đã mặc trong {s.recordedDays} ngày</Text>
        <Text variant="callout" color={colors.inkSecondary}>{s.garmentsWithoutRecords}/{s.wardrobeGarments} món chưa có lần mặc nào được ghi trong kỳ (không có nghĩa là chưa từng mặc).</Text>
      </Card>
      <Garments title="Mặc nhiều nhất" items={s.mostWorn} />
      <Garments title="Ít được ghi nhận" items={s.leastWorn} />
      {s.revisitOutfitIds.length ? (
        <Card>
          <Text variant="headline">Thử phối lại</Text>
          <Text variant="caption" color={colors.inkSecondary}>Outfit đã lưu có món ít được mặc.</Text>
          <View style={styles.row}>{s.revisitOutfitIds.map((id) => <OutfitThumb key={id} id={id} size={96} />)}</View>
        </Card>
      ) : null}
    </>
  );
}

function Garments({ title, items }: { title: string; items: { garmentId: string; wearCount: number; lastWornOn: string | null }[] }) {
  if (!items.length) return null;
  return (
    <Card>
      <Text variant="headline">{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md }}>
        {items.map((g) => (
          <View key={g.garmentId} style={{ alignItems: 'center', gap: 2 }}>
            <GarmentChip id={g.garmentId} />
            <Text variant="caption" color={colors.inkSecondary}>{g.wearCount} lần</Text>
          </View>
        ))}
      </ScrollView>
    </Card>
  );
}

function History({ from, to }: { from: string; to: string }) {
  const q = useWearHistory(from, to);
  const remove = useDeleteWear();
  const confirmDelete = (id: string) =>
    Alert.alert('Xóa lần đã mặc này?', 'Thống kê sẽ tính lại không có lần này.', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: () => remove.mutate(id, { onError: (e) => Alert.alert('Chưa xóa được', messageFor(e)) }) },
    ]);
  return (
    <Card>
      <Text variant="headline">Lịch sử đã mặc</Text>
      {q.isPending ? (
        <LoadingState />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data.items.length ? (
        <Text variant="callout" color={colors.inkSecondary}>Chưa ghi lần nào trong kỳ này.</Text>
      ) : (
        q.data.items.map((r) => (
          <View key={r.id} style={styles.record}>
            {r.outfitId ? <OutfitThumb id={r.outfitId} size={48} /> : <Icon ios="tshirt" android="checkroom" size={20} color={colors.inkTertiary} />}
            <View style={{ flex: 1 }}>
              <Text variant="callout">{dayLabel(r.date)}</Text>
              <Text variant="caption" color={colors.inkSecondary}>{r.garmentCount} món{r.outfitId ? '' : ' · outfit đã bị xóa'}</Text>
            </View>
            <Pressable onPress={() => confirmDelete(r.id)} accessibilityRole="button" accessibilityLabel={`Xóa lần mặc ngày ${dayLabel(r.date)}`} hitSlop={8}>
              <Icon ios="trash" android="delete" size={18} color={colors.danger} />
            </Pressable>
          </View>
        ))
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { height: 36, paddingHorizontal: 16, borderRadius: 18, justifyContent: 'center', backgroundColor: '#FFFFFF' },
  record: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
