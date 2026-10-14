import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { Button, EmptyState, ErrorState, Icon, LoadingState, ScreenHeader, TabScreenFrame, Text, useTabScreenPadding } from '@/components/ui';
import { useOutfits, type OutfitItem } from '@/features/stylist/hooks';
import type { LookbookFilter } from '@/features/stylist/logic';
import { colors, radius, space } from '@/theme';

const FILTERS: [LookbookFilter, string][] = [['all', 'Tất cả'], ['liked', 'Đã thích'], ['disliked', 'Chưa hợp']];

export default function LookbookScreen() {
  const padding = useTabScreenPadding();
  const [filter, setFilter] = useState<LookbookFilter>('all');
  const outfits = useOutfits(filter);
  const items = outfits.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <TabScreenFrame background={colors.ground}>
      <FlatList
        style={{ flex: 1, backgroundColor: colors.ground }}
        contentContainerStyle={[padding, { gap: space.md }]}
        columnWrapperStyle={{ gap: space.md }}
        numColumns={2}
        data={items}
        keyExtractor={(o) => o.id}
        renderItem={({ item }) => <OutfitCard outfit={item} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => outfits.hasNextPage && !outfits.isFetchingNextPage && outfits.fetchNextPage()}
        refreshControl={<RefreshControl refreshing={outfits.isRefetching && !outfits.isFetchingNextPage} onRefresh={() => outfits.refetch()} />}
        ListHeaderComponent={
          <View style={{ gap: space.md }}>
            <ScreenHeader title="Lookbook" subtitle="Những bộ đồ bạn đã lưu" />
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              {FILTERS.map(([f, label]) => {
                const on = f === filter;
                return (
                  <Pressable key={f} onPress={() => setFilter(f)} accessibilityRole="radio" accessibilityState={{ checked: on }} style={[styles.chip, on && styles.chipOn]}>
                    <Text variant="callout" color={on ? '#FFFFFF' : colors.ink} style={{ fontWeight: '500' }}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
        ListEmptyComponent={
          outfits.isPending ? (
            <LoadingState label="Đang tải lookbook…" />
          ) : outfits.isError ? (
            <ErrorState error={outfits.error} onRetry={() => outfits.refetch()} />
          ) : (
            <EmptyState
              icon={<Icon ios="heart" android="favorite" size={44} color={colors.inkSecondary} />}
              title={filter === 'all' ? 'Chưa có outfit nào' : filter === 'liked' ? 'Chưa thích outfit nào' : 'Không có outfit nào bị đánh dấu chưa hợp'}
              message={filter === 'all' ? 'Thử đồ ở Studio rồi bấm "Lưu vào lookbook", bộ đồ sẽ nằm ở đây kèm lời khuyên của stylist.' : undefined}
              action={filter === 'all' ? <Button label="Mở Studio" onPress={() => router.navigate('/')} /> : null}
            />
          )
        }
        ListFooterComponent={outfits.isFetchingNextPage ? <ActivityIndicator style={{ margin: space.lg }} color={colors.inkSecondary} /> : null}
      />
    </TabScreenFrame>
  );
}

function OutfitCard({ outfit }: { outfit: OutfitItem }) {
  return (
    <Pressable onPress={() => router.push({ pathname: '/outfit/[id]', params: { id: outfit.id } })} accessibilityRole="button" accessibilityLabel={`Outfit ${outfit.occasion}`} style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}>
      <View style={styles.thumb}>
        <Image source={{ uri: outfit.thumbnailUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={outfit.id} />
        {outfit.liked !== null ? (
          <View style={styles.like}>
            <Icon ios={outfit.liked ? 'heart.fill' : 'hand.thumbsdown.fill'} android={outfit.liked ? 'favorite' : 'thumb_down'} size={14} color={outfit.liked ? colors.danger : colors.inkSecondary} />
          </View>
        ) : null}
        {outfit.isMock ? (
          <View style={styles.mock}>
            <Text variant="caption" style={{ fontWeight: '600', fontSize: 11 }}>Ảnh mẫu</Text>
          </View>
        ) : null}
      </View>
      <View style={{ padding: space.md, gap: 2 }}>
        <Text variant="callout" style={{ fontWeight: '600' }} numberOfLines={1}>{outfit.occasion}</Text>
        <Text variant="caption" color={colors.inkSecondary} numberOfLines={1}>{new Date(outfit.createdAt).toLocaleDateString('vi-VN')} · {outfit.garments.length} món</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { height: 36, paddingHorizontal: 16, borderRadius: 18, justifyContent: 'center', backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.ink },
  card: { flex: 1, maxWidth: '50%', borderRadius: radius.lg, backgroundColor: colors.surface, overflow: 'hidden' },
  thumb: { aspectRatio: 3 / 4, backgroundColor: '#E9E4DD' },
  like: { position: 'absolute', top: space.sm, right: space.sm, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  mock: { position: 'absolute', left: space.sm, bottom: space.sm, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, backgroundColor: 'rgba(255,255,255,0.92)' },
});
