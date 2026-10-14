import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, ErrorState, Glass, Icon, LoadingState, Text } from '@/components/ui';
import { AdviceSection } from '@/features/stylist/components/Advice';
import { GarmentChip } from '@/features/stylist/components/GarmentChip';
import { shareOutfitImage, useDeleteOutfit, useOutfit, useOutfitFeedback, useSaveOutfit, type OutfitItem } from '@/features/stylist/hooks';
import { messageFor } from '@/lib/errors';
import { colors, radius, space } from '@/theme';

export default function OutfitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { outfit, stuck } = useOutfit(id);
  const o = outfit.data;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }}>
        <View style={[styles.hero, { height: 440 + insets.top }]}>
          {o ? (
            <Image
              source={{ uri: o.url }}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
              transition={150}
              // Signed URLs last 15 minutes; a fresh GET returns new ones.
              onError={() => void outfit.refetch()}
              accessibilityLabel="Ảnh outfit"
            />
          ) : null}
          {o?.isMock ? (
            <View style={[styles.mock, { top: insets.top + 64 }]}>
              <Icon ios="exclamationmark.triangle.fill" android="warning" size={13} color={colors.warning} />
              <Text variant="caption" style={{ fontWeight: '600', flex: 1 }}>Ảnh mẫu thử nghiệm, chưa phải ảnh thử đồ thật</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.sheet}>
          {outfit.isPending ? (
            <LoadingState />
          ) : outfit.isError ? (
            <ErrorState error={outfit.error} onRetry={() => outfit.refetch()} />
          ) : o ? (
            <Details outfit={o} stuck={stuck} onRecheck={() => outfit.refetch()} />
          ) : null}
        </View>
      </ScrollView>

      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Quay lại" hitSlop={8} style={[styles.back, { top: insets.top + space.sm }]}>
        <Glass interactive style={styles.round}>
          <Icon ios="chevron.left" android="arrow_back" size={20} />
        </Glass>
      </Pressable>
    </View>
  );
}

function Details({ outfit, stuck, onRecheck }: { outfit: OutfitItem; stuck: boolean; onRecheck: () => void }) {
  const feedback = useOutfitFeedback();
  const save = useSaveOutfit();
  const remove = useDeleteOutfit();
  const [sharing, setSharing] = useState(false);

  // Tapping the active reaction again goes back to neutral (null).
  const react = (liked: boolean) =>
    feedback.mutate({ id: outfit.id, liked: outfit.liked === liked ? null : liked }, { onError: (e) => Alert.alert('Chưa lưu được đánh giá', messageFor(e)) });

  const share = async () => {
    setSharing(true);
    try {
      await shareOutfitImage(outfit);
    } catch (e) {
      onRecheck(); // the signed URL may have expired: fetch a fresh one for the next try
      Alert.alert('Chưa chia sẻ được', e instanceof Error && e.message.startsWith('Thiết bị') ? e.message : 'Không tải được ảnh. Kiểm tra mạng rồi thử lại.');
    } finally {
      setSharing(false);
    }
  };

  const confirmDelete = () =>
    Alert.alert('Xóa outfit này?', 'Ảnh thử đồ và lời khuyên sẽ bị xóa vĩnh viễn. Các món trong tủ đồ vẫn giữ nguyên.', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => remove.mutate(outfit.id, { onSuccess: () => router.back(), onError: (e) => Alert.alert('Chưa xóa được', messageFor(e)) }),
      },
    ]);

  return (
    <>
      <View style={{ gap: 2 }}>
        <Text variant="title" style={{ fontSize: 26, lineHeight: 32 }}>{outfit.occasion}</Text>
        <Text variant="callout" color={colors.inkSecondary}>{new Date(outfit.createdAt).toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
      </View>

      <View style={styles.actions}>
        <Action label="Thích" on={outfit.liked === true} ios={outfit.liked === true ? 'heart.fill' : 'heart'} android="favorite" color={colors.danger} disabled={feedback.isPending} onPress={() => react(true)} />
        <Action label="Chưa hợp" on={outfit.liked === false} ios={outfit.liked === false ? 'hand.thumbsdown.fill' : 'hand.thumbsdown'} android="thumb_down" color={colors.ink} disabled={feedback.isPending} onPress={() => react(false)} />
        <Action label={sharing ? 'Đang tải…' : 'Chia sẻ'} ios="square.and.arrow.up" android="share" color={colors.ink} onPress={share} disabled={sharing} />
        <Action
          label={outfit.savedAt ? 'Đã lưu' : 'Lưu'}
          on={!!outfit.savedAt}
          ios={outfit.savedAt ? 'bookmark.fill' : 'bookmark'}
          android="bookmark"
          color={colors.accent}
          disabled={save.isPending}
          onPress={() => save.mutate({ id: outfit.id, saved: !outfit.savedAt }, { onError: (e) => Alert.alert('Chưa cập nhật lookbook', messageFor(e)) })}
        />
      </View>

      <View style={{ gap: space.sm }}>
        <Text variant="headline">Lời khuyên stylist</Text>
        <AdviceSection outfit={outfit} stuck={stuck} onRecheck={onRecheck} />
      </View>

      {outfit.garments.length ? (
        <View style={{ gap: space.sm }}>
          <Text variant="headline">Các món đã dùng</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md }}>
            {outfit.garments.map((g) => <GarmentChip key={g.id} id={g.id} />)}
          </ScrollView>
        </View>
      ) : null}

      <Button label="Xóa outfit" variant="danger" onPress={confirmDelete} loading={remove.isPending} icon={<Icon ios="trash" android="delete" size={18} color={colors.danger} />} />
    </>
  );
}

function Action({ label, on, ios, android, color, onPress, disabled }: { label: string; on?: boolean; ios: string; android: string; color: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!on, disabled: !!disabled }} style={({ pressed }) => [styles.action, on && { backgroundColor: colors.accentSoft }, (pressed || disabled) && { opacity: 0.6 }]}>
      <Icon ios={ios} android={android} size={20} color={on ? color : colors.ink} />
      <Text variant="caption" style={{ fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  hero: { backgroundColor: '#E9E4DD' },
  mock: { position: 'absolute', left: space.lg, right: space.lg, flexDirection: 'row', alignItems: 'center', gap: 6, padding: space.sm, borderRadius: radius.sm, backgroundColor: 'rgba(255,255,255,0.92)' },
  sheet: { marginTop: -28, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.surface, padding: space.xl, gap: space.xl },
  actions: { flexDirection: 'row', gap: space.sm },
  action: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: space.md, borderRadius: radius.md, backgroundColor: colors.ground },
  back: { position: 'absolute', left: space.lg },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
