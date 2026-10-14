import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { useGarment } from '@/features/garments/hooks';
import { TYPE_LABEL } from '@/features/garments/labels';
import { RequestError } from '@/lib/errors';
import { colors, radius, space } from '@/theme';

/** A garment used in an outfit or suggestion: thumbnail from the wardrobe, opens the garment; a deleted one says so. */
export function GarmentChip({ id }: { id: string }) {
  const garment = useGarment(id);
  const g = garment.data;
  const deleted = garment.error instanceof RequestError && garment.error.code === 'NOT_FOUND';
  const label = g?.tags ? TYPE_LABEL[g.tags.type] : deleted ? 'Món đã bị xóa' : garment.isError ? 'Chưa tải được' : 'Đang tải…';
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/garment/[id]', params: { id } })}
      disabled={garment.isError}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}>
      <View style={styles.thumb}>
        {g ? <Image source={{ uri: g.thumbnailUrl }} style={StyleSheet.absoluteFill} contentFit="cover" recyclingKey={id} /> : <Icon ios="hanger" android="checkroom" size={18} color={colors.inkTertiary} />}
      </View>
      <Text variant="caption" numberOfLines={1} style={{ width: 64, textAlign: 'center' }} color={garment.isError ? colors.inkTertiary : colors.ink}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { alignItems: 'center', gap: space.xs },
  thumb: { width: 64, height: 64, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.fill, alignItems: 'center', justifyContent: 'center' },
});
