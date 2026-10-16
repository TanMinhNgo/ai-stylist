import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { useOutfit, useOutfits } from '@/features/stylist/hooks';
import { RequestError } from '@/lib/errors';
import { colors, radius, space } from '@/theme';

/** An outfit by id (collections, planner, insights only carry ids); images come from GET /outfits/:id. */
export function OutfitThumb({ id, size = 96, onRemove }: { id: string; size?: number; onRemove?: () => void }) {
  const { outfit } = useOutfit(id);
  const o = outfit.data;
  const gone = outfit.error instanceof RequestError && outfit.error.code === 'NOT_FOUND';
  const label = o?.occasion ?? (gone ? 'Outfit đã bị xóa' : outfit.isError ? 'Chưa tải được' : 'Đang tải…');
  return (
    <View style={{ width: size, gap: space.xs }}>
      <Pressable onPress={() => router.push({ pathname: '/outfit/[id]', params: { id } })} disabled={!o} accessibilityRole="button" accessibilityLabel={label} style={[styles.thumb, { height: (size * 4) / 3 }]}>
        {o ? (
          // Signed URLs expire; a failed load fetches fresh ones.
          <Image source={{ uri: o.thumbnailUrl }} style={StyleSheet.absoluteFill} contentFit="cover" recyclingKey={id} onError={() => void outfit.refetch()} />
        ) : (
          <Icon ios="tshirt" android="checkroom" size={20} color={colors.inkTertiary} />
        )}
      </Pressable>
      {onRemove ? (
        <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel={`Bỏ ${label} khỏi bộ sưu tập`} hitSlop={8} style={styles.remove}>
          <Icon ios="xmark" android="close" size={12} color="#FFFFFF" />
        </Pressable>
      ) : null}
      <Text variant="caption" numberOfLines={1} color={o ? colors.ink : colors.inkTertiary}>{label}</Text>
    </View>
  );
}

/** Saved outfits (Lookbook) to choose from; `selected` ids are marked. */
export function OutfitPicker({ selected, onPick }: { selected: readonly string[]; onPick: (id: string) => void }) {
  const outfits = useOutfits('all');
  const items = outfits.data?.pages.flatMap((p) => p.items) ?? [];
  if (outfits.isPending) return <ActivityIndicator color={colors.inkSecondary} />;
  if (outfits.isError) return <Text variant="callout" color={colors.inkSecondary} onPress={() => outfits.refetch()}>Chưa tải được Lookbook. Chạm để thử lại.</Text>;
  if (!items.length) return <Text variant="callout" color={colors.inkSecondary}>Lookbook chưa có outfit nào. Lưu outfit sau khi thử đồ để chọn ở đây.</Text>;
  return (
    <FlatList
      horizontal
      data={items}
      keyExtractor={(o) => o.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: space.md }}
      onEndReached={() => outfits.hasNextPage && !outfits.isFetchingNextPage && outfits.fetchNextPage()}
      renderItem={({ item }) => {
        const on = selected.includes(item.id);
        return (
          <Pressable onPress={() => onPick(item.id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={item.occasion} style={{ width: 84, gap: space.xs }}>
            <View style={[styles.thumb, { height: 112 }, on && styles.on]}>
              <Image source={{ uri: item.thumbnailUrl }} style={StyleSheet.absoluteFill} contentFit="cover" recyclingKey={item.id} />
              {on ? (
                <View style={styles.check}>
                  <Icon ios="checkmark" android="check" size={12} color="#FFFFFF" />
                </View>
              ) : null}
            </View>
            <Text variant="caption" numberOfLines={1}>{item.occasion}</Text>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  thumb: { borderRadius: radius.sm, overflow: 'hidden', backgroundColor: '#E9E4DD', alignItems: 'center', justifyContent: 'center' },
  on: { borderWidth: 3, borderColor: colors.accent },
  check: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  remove: { position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(18,18,22,0.6)', alignItems: 'center', justifyContent: 'center' },
});
