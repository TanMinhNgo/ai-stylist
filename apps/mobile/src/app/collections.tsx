import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button, Card, EmptyState, ErrorState, Icon, LoadingState, Screen, Text } from '@/components/ui';
import { useCollections, useSaveCollection } from '@/features/planning/hooks';
import { featureOn } from '@/features/planning/logic';
import { OCCASION_OPTIONS } from '@/features/stylist/components/ProfileFields';
import { useEntitlements } from '@/features/usage/hooks';
import { messageFor } from '@/lib/errors';
import { colors, radius, space, type } from '@/theme';

export default function CollectionsScreen() {
  const collections = useCollections();
  const canEdit = featureOn(useEntitlements().data, 'occasion_collections');
  const items = collections.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <Screen title="Bộ sưu tập" subtitle="Nhóm outfit theo dịp: đi làm, hẹn hò, sự kiện…">
      {canEdit ? <CreateForm /> : <Text variant="callout" color={colors.inkSecondary}>Gói hiện tại không tạo hoặc sửa bộ sưu tập. Bộ đã có vẫn xem và xóa được.</Text>}
      {collections.isPending ? (
        <LoadingState label="Đang tải bộ sưu tập…" />
      ) : collections.isError ? (
        <ErrorState error={collections.error} onRetry={() => collections.refetch()} />
      ) : !items.length ? (
        <EmptyState icon={<Icon ios="square.stack" android="collections_bookmark" size={40} color={colors.inkSecondary} />} title="Chưa có bộ sưu tập" />
      ) : (
        items.map((c) => (
          <Pressable key={c.id} onPress={() => router.push({ pathname: '/collection/[id]', params: { id: c.id } })} accessibilityRole="button" style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="headline" numberOfLines={1}>{c.name}</Text>
              <Text variant="caption" color={colors.inkSecondary} numberOfLines={1}>{c.occasion} · {c.outfitIds.length} outfit</Text>
            </View>
            <Icon ios="chevron.right" android="chevron_right" size={14} color={colors.inkTertiary} />
          </Pressable>
        ))
      )}
      {collections.hasNextPage ? (
        collections.isFetchingNextPage ? <ActivityIndicator color={colors.inkSecondary} /> : <Button label="Xem thêm" variant="plain" onPress={() => collections.fetchNextPage()} />
      ) : null}
      <Button label="Quay lại" variant="plain" onPress={() => router.back()} />
    </Screen>
  );
}

function CreateForm() {
  const save = useSaveCollection();
  const [name, setName] = useState('');
  const [occasion, setOccasion] = useState('');
  const ready = !!name.trim() && !!occasion.trim();
  const create = () =>
    save.mutate(
      { body: { name: name.trim(), occasion: occasion.trim(), outfitIds: [] } },
      {
        onSuccess: (c) => {
          setName('');
          setOccasion('');
          router.push({ pathname: '/collection/[id]', params: { id: c.id } });
        },
        // Not retried: the list refresh shows whether a lost response still created it.
        onError: (e) => Alert.alert('Chưa tạo được bộ sưu tập', messageFor(e)),
      },
    );
  return (
    <Card>
      <Text variant="headline">Tạo bộ sưu tập</Text>
      <TextInput value={name} onChangeText={setName} placeholder="Tên, ví dụ: Tuần đầu đi làm" placeholderTextColor={colors.inkTertiary} maxLength={80} accessibilityLabel="Tên bộ sưu tập" style={styles.input} />
      <TextInput value={occasion} onChangeText={setOccasion} placeholder="Dịp" placeholderTextColor={colors.inkTertiary} maxLength={120} accessibilityLabel="Dịp" style={styles.input} />
      <View style={styles.wrap}>
        {OCCASION_OPTIONS.map((o) => (
          <Pressable key={o} onPress={() => setOccasion(o)} accessibilityRole="radio" accessibilityState={{ checked: occasion === o }} style={[styles.chip, occasion === o && { backgroundColor: colors.accent }]}>
            <Text variant="footnote" color={occasion === o ? '#FFFFFF' : colors.ink}>{o}</Text>
          </Pressable>
        ))}
      </View>
      <Button label="Tạo" onPress={create} disabled={!ready} loading={save.isPending} />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 60, paddingHorizontal: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface },
  input: { ...type.callout, height: 44, borderRadius: radius.sm, backgroundColor: colors.ground, paddingHorizontal: space.md, color: colors.ink },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { height: 32, paddingHorizontal: 12, borderRadius: 16, justifyContent: 'center', backgroundColor: colors.fill },
});
