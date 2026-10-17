import { GENERATION_MENUS } from '@stylist/shared';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { typesFor, type GenType, type MenuId } from '@/features/assets/logic';
import { TYPE_LABEL } from '@/features/garments/labels';
import { colors, space } from '@/theme';

function Chips<T extends string>({ items, value, onChange, label }: { items: readonly { id: T; label: string }[]; value: T | null; onChange: (v: T) => void; label: string }) {
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

const typeChips = (types: readonly GenType[]) => types.map((t) => ({ id: t, label: TYPE_LABEL[t] }));

/** Menu then subtype, both from GENERATION_MENUS (a whole outfit is not one garment). */
export function TypePicker({ menu, type, onMenu, onType }: { menu: MenuId; type: GenType | null; onMenu: (m: MenuId) => void; onType: (t: GenType) => void }) {
  const menus = GENERATION_MENUS.filter((m) => m.id !== 'outfit');
  return (
    <View style={{ gap: space.sm }}>
      <Chips label="Nhóm món" items={menus} value={menu} onChange={onMenu} />
      {menu !== 'outfit' ? <Chips label="Loại món" items={typeChips(typesFor(menu))} value={type} onChange={onType} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { height: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center', backgroundColor: colors.fill },
  chipOn: { backgroundColor: colors.ink },
});
