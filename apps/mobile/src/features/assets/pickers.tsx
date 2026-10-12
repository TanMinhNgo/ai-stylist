import { GENERATION_MENUS, type BodyKey } from '@stylist/shared';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { typesFor, type GenType, type MenuId } from '@/features/assets/logic';
import { TYPE_LABEL } from '@/features/garments/labels';
import { colors, radius, space } from '@/theme';

export function Chips<T extends string>({ items, value, onChange, label }: { items: readonly { id: T; label: string }[]; value: T | null; onChange: (v: T) => void; label: string }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }} accessibilityLabel={label}>
      {items.map((it) => {
        const on = it.id === value;
        return (
          <Pressable key={it.id} onPress={() => onChange(it.id)} accessibilityRole="radio" accessibilityState={{ checked: on }} style={[styles.chip, on && styles.chipOn]}>
            <Text variant="callout" color={on ? '#FFFFFF' : colors.ink} style={{ fontWeight: '500' }}>{it.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export const typeChips = (types: readonly GenType[]) => types.map((t) => ({ id: t, label: TYPE_LABEL[t] }));

/** Menu then subtype, both from GENERATION_MENUS. `outfit` is only offered for ideas. */
export function TypePicker({ menu, type, onMenu, onType, outfit }: { menu: MenuId; type: GenType | null; onMenu: (m: MenuId) => void; onType: (t: GenType) => void; outfit?: boolean }) {
  const menus = GENERATION_MENUS.filter((m) => outfit || m.id !== 'outfit');
  return (
    <View style={{ gap: space.sm }}>
      <Chips label="Nhóm món" items={menus} value={menu} onChange={onMenu} />
      {menu !== 'outfit' ? <Chips label="Loại món" items={typeChips(typesFor(menu))} value={type} onChange={onType} /> : null}
    </View>
  );
}

export function BodySwitch({ value, onChange }: { value: BodyKey; onChange: (b: BodyKey) => void }) {
  return (
    <View style={styles.segment} accessibilityRole="radiogroup" accessibilityLabel="Dáng người mẫu">
      {(['f', 'm'] as const).map((b) => (
        <Pressable key={b} onPress={() => onChange(b)} accessibilityRole="radio" accessibilityState={{ checked: value === b }} style={[styles.segmentItem, value === b && styles.segmentOn]}>
          <Text variant="footnote" style={{ fontWeight: '600' }}>{b === 'f' ? 'Ma nơ canh nữ' : 'Ma nơ canh nam'}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function QuotaLine({ quota }: { quota: { enabled: boolean; remaining: number; limit: number; resetAt: string } | undefined }) {
  if (!quota) return null;
  if (!quota.enabled)
    return <Text variant="footnote" color={colors.warning}>Tạo hình cho ma nơ canh đang thử nghiệm và chưa bật cho tài khoản của bạn.</Text>;
  const reset = new Date(quota.resetAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  return (
    <Text variant="footnote" color={quota.remaining ? colors.inkSecondary : colors.warning}>
      Còn {quota.remaining}/{quota.limit} lượt tạo hình hôm nay · lượt mới lúc {reset}
    </Text>
  );
}

const styles = StyleSheet.create({
  chip: { height: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center', backgroundColor: colors.fill },
  chipOn: { backgroundColor: colors.ink },
  segment: { flexDirection: 'row', padding: 3, borderRadius: radius.pill, backgroundColor: colors.fill, alignSelf: 'flex-start' },
  segmentItem: { height: 32, paddingHorizontal: 14, borderRadius: radius.pill, justifyContent: 'center' },
  segmentOn: { backgroundColor: colors.surface },
});
