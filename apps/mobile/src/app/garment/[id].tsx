import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, ErrorState, Glass, Icon, LoadingState, Text } from '@/components/ui';
import { useDeleteGarment, useGarment } from '@/features/garments/hooks';
import { CATEGORY_LABEL, FIT_LABEL, FORMALITY_LABEL, LENGTH_LABEL, PATTERN_LABEL, RISE_LABEL, SEASON_LABEL, SLEEVE_LABEL, TYPE_LABEL } from '@/features/garments/labels';
import { messageFor, RequestError } from '@/lib/errors';
import { colors, radius, space } from '@/theme';

export default function GarmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const garment = useGarment(id);
  const remove = useDeleteGarment();
  const g = garment.data;
  const tags = g?.tags;

  const confirmDelete = () =>
    Alert.alert('Xóa món này?', 'Món đồ và ảnh sẽ bị xóa khỏi tủ đồ, không khôi phục được.', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
          remove.mutate(id, { onError: (e) => Alert.alert('Chưa xóa được', messageFor(e)) });
          router.back();
        },
      },
    ]);

  const rows: [string, string][] = tags
    ? [
        ['Loại', `${CATEGORY_LABEL[tags.category]} · ${TYPE_LABEL[tags.type]}`],
        ['Màu', tags.colors.join(', ')],
        ['Chất liệu', tags.material],
        ['Họa tiết · Phom', `${PATTERN_LABEL[tags.pattern]} · ${FIT_LABEL[tags.fit]}`],
        ...(tags.length || tags.sleeve ? [['Độ dài · Tay', [tags.length && LENGTH_LABEL[tags.length], tags.sleeve && SLEEVE_LABEL[tags.sleeve]].filter(Boolean).join(' · ')] as [string, string]] : []),
        ...(tags.neckline ? [['Cổ áo', tags.neckline] as [string, string]] : []),
        ...(tags.rise ? [['Cạp', RISE_LABEL[tags.rise]] as [string, string]] : []),
        ['Mùa', tags.season.map((s) => SEASON_LABEL[s]).join(', ')],
        ...(tags.occasions.length ? [['Dịp', tags.occasions.join(', ')] as [string, string]] : []),
      ]
    : [];

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }}>
        <View style={[styles.hero, { height: 360 + insets.top }]}>
          {g ? <Image source={{ uri: g.url }} style={StyleSheet.absoluteFill} contentFit="contain" transition={150} accessibilityLabel={tags ? TYPE_LABEL[tags.type] : 'Ảnh món đồ'} /> : null}
        </View>

        <View style={styles.sheet}>
          {garment.isPending ? (
            <LoadingState />
          ) : garment.isError ? (
            <ErrorState error={garment.error} onRetry={() => garment.refetch()} />
          ) : g?.status === 'pending' ? (
            <LoadingState label="AI đang gắn tag cho món này…" />
          ) : g?.status === 'failed' ? (
            <View style={styles.notice}>
              <Icon ios="exclamationmark.circle.fill" android="error" size={18} color={colors.danger} />
              <Text variant="callout" color={colors.danger} style={{ flex: 1 }}>{messageFor(new RequestError(g.errorCode ?? 'MEDIA_PROCESSING_FAILED'))}</Text>
            </View>
          ) : tags ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
                <Text variant="title" style={{ flex: 1, fontSize: 26, lineHeight: 32 }}>{TYPE_LABEL[tags.type]}</Text>
                <View style={styles.aiChip}>
                  <Icon ios="sparkles" android="auto_awesome" size={12} color={colors.accent} />
                  <Text variant="caption" color={colors.accent} style={{ fontWeight: '600' }}>Tag do AI gắn</Text>
                </View>
              </View>
              <View style={styles.table}>
                {rows.map(([label, value], i) => (
                  <View key={label} style={[styles.row, i < rows.length - 1 && styles.rowLine]}>
                    <Text variant="callout" color="#4A4A52">{label}</Text>
                    <Text variant="callout" style={styles.value}>{value}</Text>
                  </View>
                ))}
                <View style={[styles.row, styles.rowLineTop]} accessibilityLabel={`Độ trang trọng ${tags.formality} trên 5, ${FORMALITY_LABEL[tags.formality]}`}>
                  <Text variant="callout" color="#4A4A52">Độ trang trọng</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <View style={{ flexDirection: 'row', gap: 3 }}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <View key={n} style={[styles.dot, { backgroundColor: n <= tags.formality ? colors.accent : 'rgba(118,118,128,0.25)' }]} />
                      ))}
                    </View>
                    <Text variant="callout" style={{ fontWeight: '600' }}>{FORMALITY_LABEL[tags.formality]}</Text>
                  </View>
                </View>
              </View>
              {g?.tryOnAllowed === false ? (
                <Text variant="footnote" color={colors.inkSecondary}>Loại trang phục này không dùng để thử lên ảnh.</Text>
              ) : null}
            </>
          ) : null}

          <Button label="Xóa khỏi tủ đồ" variant="danger" onPress={confirmDelete} icon={<Icon ios="trash" android="delete" size={18} color={colors.danger} />} />
        </View>
      </ScrollView>

      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Quay lại tủ đồ" hitSlop={8} style={[styles.back, { top: insets.top + space.sm }]}>
        <Glass interactive style={styles.backGlass}>
          <Icon ios="chevron.left" android="arrow_back" size={20} />
        </Glass>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  hero: { backgroundColor: '#F1EAE4' },
  sheet: { marginTop: -28, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.surface, padding: space.xl, gap: space.lg },
  aiChip: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: colors.accentSoft },
  table: { borderRadius: radius.md, backgroundColor: colors.ground, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, minHeight: 48, paddingHorizontal: 14, paddingVertical: space.sm },
  rowLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
  rowLineTop: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  value: { flexShrink: 1, textAlign: 'right', fontWeight: '600' },
  dot: { width: 14, height: 6, borderRadius: 3 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.sm, backgroundColor: colors.dangerSoft },
  back: { position: 'absolute', left: space.lg },
  backGlass: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
