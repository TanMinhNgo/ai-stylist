import { GarmentCategory, type Garment } from '@stylist/shared';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { Button, EmptyState, ErrorState, Glass, Icon, LoadingState, ScreenHeader, TabScreenFrame, Text, useTabScreenPadding } from '@/components/ui';
import { useAddGarments, useGarments, type AddState } from '@/features/garments/hooks';
import { CATEGORY_LABEL, FORMALITY_LABEL, TYPE_LABEL } from '@/features/garments/labels';
import { pickImages } from '@/lib/image';
import { colors, radius, space } from '@/theme';

const FILTERS = [undefined, ...GarmentCategory.options] as const;

export default function WardrobeScreen() {
  const padding = useTabScreenPadding();
  const [category, setCategory] = useState<GarmentCategory | undefined>();
  const garments = useGarments(category);
  const adder = useAddGarments();
  const items = garments.data?.pages.flatMap((p) => p.items) ?? [];

  async function choose(camera: boolean) {
    const picked = await pickImages({ camera, multiple: true });
    if ('denied' in picked) {
      Alert.alert('Chưa có quyền dùng camera', 'Bật quyền camera trong Cài đặt để chụp món đồ.', [
        { text: 'Để sau', style: 'cancel' },
        { text: 'Mở Cài đặt', onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    void adder.add(picked.images);
  }

  const addMenu = () =>
    Alert.alert('Thêm món đồ', 'Chụp từng món trên nền gọn, đủ sáng để AI gắn tag chính xác.', [
      { text: 'Chụp ảnh', onPress: () => choose(true) },
      { text: 'Chọn từ thư viện', onPress: () => choose(false) },
      { text: 'Hủy', style: 'cancel' },
    ]);

  const busy = !!adder.state && adder.state.done < adder.state.total;

  return (
    <TabScreenFrame background={colors.ground}>
      <FlatList
        style={{ flex: 1, backgroundColor: colors.ground }}
        contentContainerStyle={[padding, { gap: space.md }]}
        columnWrapperStyle={{ gap: space.md }}
        numColumns={2}
        data={items}
        keyExtractor={(g) => g.id}
        renderItem={({ item }) => <GarmentCard garment={item} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => garments.hasNextPage && !garments.isFetchingNextPage && garments.fetchNextPage()}
        refreshControl={<RefreshControl refreshing={garments.isRefetching && !garments.isFetchingNextPage} onRefresh={() => garments.refetch()} />}
        ListHeaderComponent={
          <View style={{ gap: space.md }}>
            <ScreenHeader
              title="Tủ đồ"
              right={
                <Pressable onPress={addMenu} disabled={busy} accessibilityRole="button" accessibilityLabel="Thêm món đồ" hitSlop={6}>
                  <Glass interactive style={styles.addButton}>
                    <Icon ios="plus" android="add" size={22} color={colors.accent} />
                  </Glass>
                </Pressable>
              }
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.xl }} contentContainerStyle={{ paddingHorizontal: space.xl, gap: space.sm }}>
              {FILTERS.map((c) => {
                const on = c === category;
                return (
                  <Pressable key={c ?? 'all'} onPress={() => setCategory(c)} accessibilityRole="radio" accessibilityState={{ checked: on }} style={[styles.chip, on && styles.chipOn]}>
                    <Text variant="callout" color={on ? '#FFFFFF' : colors.ink} style={{ fontWeight: '500' }}>{c ? CATEGORY_LABEL[c] : 'Tất cả'}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {adder.state ? <UploadBanner state={adder.state} onCancel={adder.cancel} onRetry={() => adder.add(adder.state?.failed ?? [])} onClose={adder.dismiss} /> : null}
          </View>
        }
        ListEmptyComponent={
          garments.isPending ? (
            <LoadingState label="Đang tải tủ đồ…" />
          ) : garments.isError ? (
            <ErrorState error={garments.error} onRetry={() => garments.refetch()} />
          ) : (
            <EmptyState
              icon={<Icon ios="hanger" android="checkroom" size={44} color={colors.inkSecondary} />}
              title={category ? `Chưa có ${CATEGORY_LABEL[category].toLowerCase()}` : 'Tủ đồ còn trống'}
              message="Chụp hoặc chọn ảnh món đồ, AI sẽ tự gắn loại, màu, chất liệu và độ trang trọng."
              action={<Button label="Thêm món đầu tiên" onPress={addMenu} disabled={busy} />}
            />
          )
        }
        ListFooterComponent={garments.isFetchingNextPage ? <ActivityIndicator style={{ margin: space.lg }} color={colors.inkSecondary} /> : null}
      />
    </TabScreenFrame>
  );
}

function GarmentCard({ garment }: { garment: Garment }) {
  const tags = garment.tags;
  const title = tags ? TYPE_LABEL[tags.type] : garment.status === 'failed' ? 'Không phân tích được' : 'Món đồ mới';
  const detail = tags ? [tags.colors[0], tags.material, FORMALITY_LABEL[tags.formality]].filter(Boolean).join(' · ') : garment.status === 'pending' ? 'Đang gắn tag tự động' : 'Mở để xóa hoặc thử ảnh khác';
  return (
    <Pressable onPress={() => router.push({ pathname: '/garment/[id]', params: { id: garment.id } })} accessibilityRole="button" accessibilityLabel={title} style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}>
      <View style={styles.thumb}>
        <Image source={{ uri: garment.thumbnailUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={garment.id} />
        {garment.status === 'pending' ? (
          <Glass style={styles.badge}>
            <ActivityIndicator size="small" color={colors.ink} />
            <Text variant="caption" style={{ fontWeight: '600' }}>Đang phân tích…</Text>
          </Glass>
        ) : garment.status === 'failed' ? (
          <View style={[styles.badge, { backgroundColor: colors.dangerSoft }]}>
            <Icon ios="exclamationmark.circle.fill" android="error" size={14} color={colors.danger} />
            <Text variant="caption" color={colors.danger} style={{ fontWeight: '600' }}>Lỗi</Text>
          </View>
        ) : null}
      </View>
      <View style={{ padding: space.md, gap: 2 }}>
        <Text variant="callout" style={{ fontWeight: '600' }} numberOfLines={1}>{title}</Text>
        <Text variant="caption" color={colors.inkSecondary} numberOfLines={2}>{detail}</Text>
      </View>
    </Pressable>
  );
}

function UploadBanner({ state, onCancel, onRetry, onClose }: { state: AddState; onCancel: () => void; onRetry: () => void; onClose: () => void }) {
  const running = state.done < state.total;
  const fraction = running ? (state.done + state.progress) / state.total : 1;
  return (
    <View style={styles.banner} accessibilityLiveRegion="polite">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Text variant="callout" style={{ flex: 1, fontWeight: '600' }}>
          {running ? `Đang tải lên ${state.done + 1}/${state.total}` : state.canceled ? 'Đã hủy tải lên' : `${state.failed.length}/${state.total} ảnh chưa tải được`}
        </Text>
        {running ? <Button label="Hủy" variant="plain" onPress={onCancel} style={{ minWidth: 72 }} /> : null}
      </View>
      {running ? (
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(fraction * 100)}%` }]} />
        </View>
      ) : (
        <>
          {state.error && !state.canceled ? <Text variant="footnote" color={colors.danger}>{state.error}</Text> : null}
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {state.failed.length ? <Button label="Thử lại" onPress={onRetry} style={{ flex: 1 }} /> : null}
            <Button label="Đóng" variant="plain" onPress={onClose} style={{ flex: 1 }} />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  addButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center', backgroundColor: colors.fill },
  chipOn: { backgroundColor: colors.ink },
  card: { flex: 1, maxWidth: '50%', borderRadius: radius.lg - 2, backgroundColor: colors.surface, overflow: 'hidden' },
  thumb: { height: 180, backgroundColor: '#ECE9E4' },
  badge: { position: 'absolute', left: 8, bottom: 8, height: 28, paddingHorizontal: 10, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
  banner: { borderRadius: radius.md, backgroundColor: colors.surface, padding: space.md, gap: space.sm },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.fill, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.accent },
});
