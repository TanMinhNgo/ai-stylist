import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, View } from 'react-native';

import { Button, Card, ErrorState, LoadingState, Screen, Text } from '@/components/ui';
import { useCreateShare, useRevokeShare, useShares } from '@/features/integrations/hooks';
import { SHARE_EXPIRY } from '@/features/integrations/logic';
import { OutfitThumb } from '@/features/planning/components';
import { useCollection } from '@/features/planning/hooks';
import { featureOn } from '@/features/planning/logic';
import { useEntitlements } from '@/features/usage/hooks';
import { messageFor } from '@/lib/errors';
import { colors, radius, space } from '@/theme';

const when = (iso: string) => new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'numeric' });

/** Public link to chosen outfits of one collection: pick, confirm what becomes public, share; list and revoke. */
export default function ShareCollectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const collection = useCollection(id);
  const shares = useShares(id);
  const create = useCreateShare(id);
  const revoke = useRevokeShare(id);
  const canCreate = featureOn(useEntitlements().data, 'occasion_collections');
  const [picked, setPicked] = useState<string[]>([]);
  const [hours, setHours] = useState<number>(24);
  // The token exists only here, right after creation; the API never returns it again.
  const [link, setLink] = useState<string | null>(null);
  const c = collection.data;

  const confirmCreate = () =>
    Alert.alert('Công khai các ảnh này?', `Ai có link đều xem được ảnh kết quả của ${picked.length} outfit cho tới khi link hết hạn hoặc bạn thu hồi.`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Tạo link',
        onPress: () =>
          create.mutate(
            { outfitIds: picked, expiresInHours: hours },
            {
              onSuccess: (r) => {
                setLink(Linking.createURL(`shared/${r.token}`));
                setPicked([]);
              },
              // Not retried: the request may have gone through, so the list below is checked first.
              onError: (e) => Alert.alert('Chưa tạo được link', `${messageFor(e)} Kiểm tra danh sách link bên dưới trước khi thử lại.`),
            },
          ),
      },
    ]);
  const confirmRevoke = (shareId: string) =>
    Alert.alert('Thu hồi link này?', 'Link ngừng hoạt động ngay. Ảnh người nhận đã mở có thể còn xem được thêm tối đa 60 giây, và ảnh họ đã lưu thì không thu hồi được.', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Thu hồi', style: 'destructive', onPress: () => revoke.mutate(shareId, { onError: (e) => Alert.alert('Chưa thu hồi được', messageFor(e)) }) },
    ]);

  return (
    <Screen title="Chia sẻ lookbook" subtitle={c?.name}>
      {link ? (
        <Card>
          <Text variant="headline">Link đã sẵn sàng</Text>
          <Text variant="caption" color={colors.inkSecondary}>Link chỉ hiện một lần. Người nhận cần cài AI Stylist để mở.</Text>
          <Button label="Gửi link" onPress={() => void Share.share({ message: link })} />
          <Button label="Xong" variant="plain" onPress={() => setLink(null)} />
        </Card>
      ) : null}

      {!c ? (
        collection.isError ? <ErrorState error={collection.error} onRetry={() => collection.refetch()} /> : <LoadingState />
      ) : canCreate ? (
        <Card>
          <Text variant="headline">Chọn outfit để chia sẻ</Text>
          {c.outfitIds.length ? (
            <View style={styles.grid}>
              {c.outfitIds.map((o) => {
                const on = picked.includes(o);
                return (
                  <View key={o} style={{ gap: space.xs }}>
                    <OutfitThumb id={o} size={92} />
                    <Pressable onPress={() => setPicked(on ? picked.filter((x) => x !== o) : [...picked, o])} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={[styles.chip, on && styles.on]}>
                      <Text variant="footnote" color={on ? '#FFFFFF' : colors.ink}>{on ? 'Đã chọn' : 'Chọn'}</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text variant="callout" color={colors.inkSecondary}>Bộ sưu tập chưa có outfit nào.</Text>
          )}
          <Text variant="footnote" color={colors.inkSecondary}>Link hết hạn sau</Text>
          <View style={styles.row}>
            {SHARE_EXPIRY.map((e) => (
              <Pressable key={e.hours} onPress={() => setHours(e.hours)} accessibilityRole="radio" accessibilityState={{ checked: hours === e.hours }} style={[styles.chip, hours === e.hours && styles.on]}>
                <Text variant="footnote" color={hours === e.hours ? '#FFFFFF' : colors.ink}>{e.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text variant="caption" color={colors.inkSecondary}>Chỉ ảnh kết quả được công khai: không có tên, ảnh gốc hay lời tư vấn. Outfit thêm vào bộ sưu tập sau này không tự xuất hiện trong link.</Text>
          <Button label="Tạo link chia sẻ" onPress={confirmCreate} disabled={!picked.length} loading={create.isPending} />
        </Card>
      ) : (
        <Text variant="callout" color={colors.inkSecondary}>Tạo link chia sẻ có trong gói Plus và Pro. Bạn vẫn xem và thu hồi các link đã tạo.</Text>
      )}

      <Text variant="headline">Link đang hoạt động</Text>
      {shares.isPending ? (
        <LoadingState />
      ) : shares.isError ? (
        <ErrorState error={shares.error} onRetry={() => shares.refetch()} />
      ) : shares.data.items.length ? (
        shares.data.items.map((s) => (
          <Card key={s.id} style={styles.share}>
            <View style={{ flex: 1 }}>
              <Text variant="callout">Tạo lúc {when(s.createdAt)}</Text>
              <Text variant="caption" color={colors.inkSecondary}>Hết hạn {when(s.expiresAt)}</Text>
            </View>
            <Button label="Thu hồi" variant="danger" onPress={() => confirmRevoke(s.id)} />
          </Card>
        ))
      ) : (
        <Text variant="callout" color={colors.inkSecondary}>Chưa có link nào còn hạn.</Text>
      )}
      <Button label="Quay lại" variant="plain" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { height: 32, paddingHorizontal: 12, borderRadius: radius.pill, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.fill },
  on: { backgroundColor: colors.accent },
  share: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
