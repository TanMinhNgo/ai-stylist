import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { CASUAL_OUTFITS, DEMO_ITEMS, DEMO_OUTFITS } from '@/features/studio/catalog';
import { GarmentIcon } from '@/features/studio/GarmentIcon';
import { colorHex, lookFor, type Look } from '@/features/studio/looks';
import { toggleLabel } from '@/features/stylist/logic';
import { colors, radius, space, type } from '@/theme';

type Pic = Look | null;

// Style examples are cartoon icons of up to four demo pieces, like the Studio tray.
const outfitPics = (id: string): Pic[] => [...DEMO_OUTFITS, ...CASUAL_OUTFITS].find((x) => x.id === id)!.members.slice(0, 4).map((m) => lookFor(m.tags));
const itemPics = (...ids: string[]): Pic[] => ids.map((id) => lookFor(DEMO_ITEMS.find((w) => w.id === `demo:${id}`)!.tags));

export const STYLE_OPTIONS: { label: string; pics: Pic[] }[] = [
  { label: 'Thanh lịch', pics: outfitPics('navy-business') },
  { label: 'Basic', pics: outfitPics('casual-basic') },
  { label: 'Năng động', pics: outfitPics('casual-school') },
  { label: 'Streetwear', pics: outfitPics('casual-street') },
  { label: 'Thoải mái', pics: outfitPics('casual-weekend') },
  { label: 'Nữ tính', pics: itemPics('champagne-blouse', 'pleated-skirt', 'pearl-earrings', 'tan-crossbody') },
  { label: 'Tối giản', pics: itemPics('white-shirt', 'black-midi-dress', 'black-loafers', 'silver-ring') },
  { label: 'Dạ tiệc', pics: outfitPics('black-tuxedo') },
];
export const OCCASION_OPTIONS = ['Đi làm', 'Đi học', 'Đi chơi', 'Hẹn hò', 'Tiệc', 'Du lịch', 'Thể thao', 'Ở nhà'];
export const COLOR_OPTIONS = ['trắng', 'đen', 'xám', 'be', 'kem', 'nâu', 'xanh navy', 'xanh dương', 'xanh lá', 'ô liu', 'đỏ', 'đỏ đô', 'hồng', 'vàng', 'cam', 'tím'];

export function StylePicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <View style={styles.grid}>
      {STYLE_OPTIONS.map((s) => {
        const on = value.includes(s.label);
        return (
          <Pressable key={s.label} onPress={() => onChange(toggleLabel(value, s.label)[0])} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={s.label} style={[styles.styleCard, on && styles.cardOn]}>
            <View style={styles.pics}>
              {s.pics.map((p, i) => (
                <View key={i} style={styles.pic}>
                  <GarmentIcon look={p} size={46} />
                </View>
              ))}
            </View>
            <View style={styles.styleLabel}>
              <Text variant="callout" style={{ fontWeight: '600', flex: 1 }}>{s.label}</Text>
              {on ? <Icon ios="checkmark.circle.fill" android="check_circle" size={18} color={colors.accent} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Multi-select chips; saved values outside `options` stay visible so they can be removed. */
export function ChipGroup({ options, value, onChange }: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const all = [...options, ...value.filter((v) => !options.includes(v))];
  return (
    <View style={styles.wrap}>
      {all.map((o) => {
        const on = value.includes(o);
        return (
          <Pressable key={o} onPress={() => onChange(toggleLabel(value, o)[0])} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={[styles.chip, on && styles.chipOn]}>
            <Text variant="callout" color={on ? '#FFFFFF' : colors.ink}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Liked and avoided colours; a colour sits on one side only. */
export function ColorPicker({ value, other, onChange }: { value: string[]; other: string[]; onChange: (value: string[], other: string[]) => void }) {
  return (
    <View style={styles.wrap}>
      {COLOR_OPTIONS.map((c) => {
        const on = value.includes(c);
        return (
          <Pressable key={c} onPress={() => onChange(...toggleLabel(value, c, other))} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={c} style={[styles.chip, styles.colorChip, on && styles.chipOn]}>
            <View style={[styles.swatch, { backgroundColor: colorHex(c) }]} />
            <Text variant="callout" color={on ? '#FFFFFF' : other.includes(c) ? colors.inkTertiary : colors.ink}>{c}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function BudgetField({ value, onChange, invalid }: { value: string; onChange: (v: string) => void; invalid: boolean }) {
  return (
    <View style={{ gap: space.xs }}>
      <View style={[styles.input, invalid && { borderColor: colors.danger }]}>
        <TextInput value={value} onChangeText={onChange} keyboardType="number-pad" placeholder="Ví dụ: 500.000" placeholderTextColor={colors.inkTertiary} accessibilityLabel="Ngân sách, đồng" style={styles.inputText} />
        <Text variant="callout" color={colors.inkSecondary}>đ</Text>
      </View>
      <Text variant="caption" color={invalid ? colors.danger : colors.inkSecondary}>{invalid ? 'Nhập số tiền hợp lệ, tối đa 1 tỷ đồng.' : 'Để trống nếu bạn không muốn đặt ngân sách.'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  styleCard: { width: '47%', flexGrow: 1, borderRadius: radius.md, backgroundColor: colors.surface, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  cardOn: { borderColor: colors.accent },
  pics: { height: 120, flexDirection: 'row', flexWrap: 'wrap', padding: 6, backgroundColor: colors.studio },
  pic: { width: '50%', height: '50%', alignItems: 'center', justifyContent: 'center' },
  styleLabel: { flexDirection: 'row', alignItems: 'center', padding: space.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { minHeight: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center', backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.accent },
  colorChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 14, height: 14, borderRadius: 7, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.25)' },
  input: { flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 48, paddingHorizontal: space.md, borderRadius: radius.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: 'transparent' },
  inputText: { ...type.body, flex: 1, color: colors.ink },
});
