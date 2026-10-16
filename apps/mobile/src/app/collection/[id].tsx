import type { UpdateCollectionRequest } from '@stylist/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';

import { Button, Card, ErrorState, Icon, LoadingState, Screen, Text } from '@/components/ui';
import { OutfitPicker, OutfitThumb } from '@/features/planning/components';
import { useCollection, useDeleteCollection, useSaveCollection } from '@/features/planning/hooks';
import { featureOn, toggleOutfit } from '@/features/planning/logic';
import { useEntitlements } from '@/features/usage/hooks';
import { messageFor } from '@/lib/errors';
import { colors, radius, space, type } from '@/theme';

export default function CollectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const collection = useCollection(id);
  const canEdit = featureOn(useEntitlements().data, 'occasion_collections');
  const save = useSaveCollection();
  const remove = useDeleteCollection();
  const [picking, setPicking] = useState(false);
  const [draft, setDraft] = useState<{ name: string; occasion: string } | null>(null);
  const c = collection.data;

  if (!c)
    return (
      <Screen title="Bộ sưu tập">
        {collection.isError ? <ErrorState error={collection.error} onRetry={() => collection.refetch()} /> : <LoadingState />}
        <Button label="Quay lại" variant="plain" onPress={() => router.back()} />
      </Screen>
    );

  const patch = (body: UpdateCollectionRequest, done?: () => void) =>
    save.mutate({ id: c.id, body }, { onSuccess: done, onError: (e) => Alert.alert('Chưa lưu được', messageFor(e)) });
  // The server replaces the whole list and returns its own order; the screen shows what it returns.
  const toggle = (outfitId: string) => {
    const next = toggleOutfit(c.outfitIds, outfitId);
    if (next) patch({ outfitIds: next });
    else Alert.alert('Bộ sưu tập đã đủ 50 outfit', 'Bỏ bớt một outfit để thêm outfit khác.');
  };
  const confirmDelete = () =>
    Alert.alert('Xóa bộ sưu tập này?', 'Chỉ xóa bộ sưu tập. Các outfit vẫn nằm trong Lookbook.', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: () => remove.mutate(c.id, { onSuccess: () => router.back(), onError: (e) => Alert.alert('Chưa xóa được', messageFor(e)) }) },
    ]);

  return (
    <Screen title={c.name} subtitle={`${c.occasion} · ${c.outfitIds.length} outfit`}>
      {draft ? (
        <Card>
          <TextInput value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} maxLength={80} accessibilityLabel="Tên bộ sưu tập" style={styles.input} />
          <TextInput value={draft.occasion} onChangeText={(occasion) => setDraft({ ...draft, occasion })} maxLength={120} accessibilityLabel="Dịp" style={styles.input} />
          <View style={styles.row}>
            <Button label="Hủy" variant="plain" onPress={() => setDraft(null)} style={{ flex: 1 }} />
            <Button label="Lưu" onPress={() => patch({ name: draft.name.trim(), occasion: draft.occasion.trim() }, () => setDraft(null))} disabled={!draft.name.trim() || !draft.occasion.trim()} loading={save.isPending} style={{ flex: 1 }} />
          </View>
        </Card>
      ) : canEdit ? (
        <View style={styles.row}>
          <Button label="Đổi tên" variant="plain" onPress={() => setDraft({ name: c.name, occasion: c.occasion })} style={{ flex: 1 }} />
          <Button label={picking ? 'Xong' : 'Thêm outfit'} variant={picking ? 'ink' : 'primary'} onPress={() => setPicking(!picking)} style={{ flex: 1 }} />
        </View>
      ) : (
        <Text variant="callout" color={colors.inkSecondary}>Gói hiện tại chỉ xem và xóa bộ sưu tập, không thêm hay bỏ outfit.</Text>
      )}

      {picking && canEdit ? (
        <Card>
          <Text variant="headline">Chọn từ Lookbook</Text>
          <OutfitPicker selected={c.outfitIds} onPick={toggle} />
          {save.isPending ? <Text variant="caption" color={colors.inkSecondary}>Đang lưu…</Text> : null}
        </Card>
      ) : null}

      {c.outfitIds.length ? (
        <View style={styles.grid}>
          {c.outfitIds.map((o) => <OutfitThumb key={o} id={o} size={100} onRemove={canEdit ? () => toggle(o) : undefined} />)}
        </View>
      ) : (
        <Text variant="callout" color={colors.inkSecondary}>Chưa có outfit nào trong bộ sưu tập này.</Text>
      )}

      <Button label="Xóa bộ sưu tập" variant="danger" onPress={confirmDelete} loading={remove.isPending} icon={<Icon ios="trash" android="delete" size={18} color={colors.danger} />} />
      <Button label="Quay lại" variant="plain" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { ...type.callout, height: 44, borderRadius: radius.sm, backgroundColor: colors.ground, paddingHorizontal: space.md, color: colors.ink },
  row: { flexDirection: 'row', gap: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
});
