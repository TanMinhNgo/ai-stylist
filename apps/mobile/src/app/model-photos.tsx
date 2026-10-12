import type { ModelPhoto } from '@stylist/shared';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, EmptyState, ErrorState, Glass, Icon, LoadingState, Text } from '@/components/ui';
import { BODY_SHAPE_LABEL } from '@/features/garments/labels';
import { useDefaultModelPhoto, useDeleteModelPhoto, useModelPhotos } from '@/features/model-photos/hooks';
import { messageFor, RequestError } from '@/lib/errors';
import { colors, radius, space } from '@/theme';

export default function ModelPhotosScreen() {
  const insets = useSafeAreaInsets();
  const photos = useModelPhotos();
  const defaultId = useDefaultModelPhoto((s) => s.id);

  return (
    <View style={styles.root}>
      <FlatList
        data={photos.data?.items ?? []}
        keyExtractor={(p) => p.id}
        numColumns={2}
        columnWrapperStyle={{ gap: space.md }}
        contentContainerStyle={{ paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + 120, paddingHorizontal: space.xl, gap: space.md, flexGrow: 1 }}
        renderItem={({ item }) => <PhotoCard photo={item} isDefault={item.id === defaultId} />}
        ListHeaderComponent={
          <View style={{ gap: space.md, marginBottom: space.xs }}>
            <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Quay lại" hitSlop={8} style={{ alignSelf: 'flex-start' }}>
              <Glass interactive style={styles.back}>
                <Icon ios="chevron.left" android="arrow_back" size={20} />
              </Glass>
            </Pressable>
            <Text variant="largeTitle" accessibilityRole="header" style={{ fontSize: 30, lineHeight: 36 }}>Ảnh người mẫu</Text>
            <Text variant="callout" color={colors.inkSecondary}>Chạm vào một ảnh đã sẵn sàng để dùng làm ảnh thử đồ mặc định.</Text>
          </View>
        }
        ListEmptyComponent={
          photos.isPending ? (
            <LoadingState />
          ) : photos.isError ? (
            <ErrorState error={photos.error} onRetry={() => photos.refetch()} />
          ) : (
            <EmptyState
              icon={<Icon ios="person.crop.rectangle" android="portrait" size={44} color={colors.inkSecondary} />}
              title="Chưa có ảnh người mẫu"
              message="Thêm một ảnh toàn thân để thử đồ lên chính bạn."
            />
          )
        }
      />
      <View style={[styles.footer, { bottom: insets.bottom + space.md }]}>
        <Button label="Thêm ảnh người mẫu" onPress={() => router.push('/photo-guide')} icon={<Icon ios="camera" android="photo_camera" size={18} color="#FFFFFF" />} />
      </View>
    </View>
  );
}

function PhotoCard({ photo, isDefault }: { photo: ModelPhoto; isDefault: boolean }) {
  const setDefault = useDefaultModelPhoto((s) => s.set);
  const remove = useDeleteModelPhoto();
  const ready = photo.status === 'ready';

  const confirmDelete = () =>
    Alert.alert('Xóa ảnh này?', 'Ảnh sẽ bị xóa hẳn khỏi máy chủ, không khôi phục được.', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: () => remove.mutate(photo.id, { onError: (e) => Alert.alert('Chưa xóa được', messageFor(e)) }) },
    ]);

  return (
    <Pressable
      onPress={() => ready && setDefault(photo.id)}
      accessibilityRole="button"
      accessibilityState={{ selected: isDefault, disabled: !ready }}
      accessibilityLabel={isDefault ? 'Ảnh mặc định' : ready ? 'Đặt làm ảnh mặc định' : 'Ảnh đang xử lý'}
      style={[styles.card, isDefault && styles.cardDefault, remove.isPending && { opacity: 0.4 }]}>
      <Image source={{ uri: photo.thumbnailUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={photo.id} />
      <Pressable onPress={confirmDelete} accessibilityRole="button" accessibilityLabel="Xóa ảnh" hitSlop={6} style={styles.trash}>
        <Glass interactive style={styles.trashGlass}>
          <Icon ios="trash" android="delete" size={15} color={colors.danger} />
        </Glass>
      </Pressable>
      <View style={styles.caption}>
        {photo.status === 'pending' ? (
          <View style={styles.pill}>
            <ActivityIndicator size="small" color={colors.ink} />
            <Text variant="caption" style={{ fontWeight: '600' }}>Đang phân tích…</Text>
          </View>
        ) : photo.status === 'failed' ? (
          <View style={[styles.pill, { backgroundColor: '#FBE9E9' }]}>
            <Text variant="caption" color={colors.danger} numberOfLines={2} style={{ fontWeight: '600' }}>{messageFor(new RequestError(photo.errorCode ?? 'MEDIA_PROCESSING_FAILED'))}</Text>
          </View>
        ) : (
          <View style={styles.pill}>
            {isDefault ? <Icon ios="star.fill" android="star" size={12} color={colors.accent} /> : null}
            <Text variant="caption" style={{ fontWeight: '600' }}>{isDefault ? 'Mặc định' : photo.analysis ? BODY_SHAPE_LABEL[photo.analysis.bodyShape] : 'Sẵn sàng'}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  card: { flex: 1, maxWidth: '50%', aspectRatio: 3 / 4, borderRadius: radius.lg - 2, overflow: 'hidden', backgroundColor: '#E2DED7', borderWidth: 2.5, borderColor: 'transparent' },
  cardDefault: { borderColor: colors.accent },
  trash: { position: 'absolute', right: 8, top: 8 },
  trashGlass: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  caption: { position: 'absolute', left: 8, right: 8, bottom: 8 },
  pill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.92)' },
  footer: { position: 'absolute', left: space.xl, right: space.xl },
});
