import type { PlannerDayResponse } from '@stylist/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button, Card, ErrorState, Icon, LoadingState, Screen, Text } from '@/components/ui';
import { usePlannerContext } from '@/features/integrations/hooks';
import { weatherLine } from '@/features/integrations/logic';
import { DayExtras, WeekTools, type DayContext } from '@/features/integrations/PlannerExtras';
import { OutfitPicker, OutfitThumb } from '@/features/planning/components';
import { useDeletePlannerDay, usePlannerWeek, usePutPlannerDay } from '@/features/planning/hooks';
import { addDays, dayLabel, deviceTimeZone, featureOn, localDate, plannerWritable } from '@/features/planning/logic';
import { OCCASION_OPTIONS } from '@/features/stylist/components/ProfileFields';
import { useEntitlements } from '@/features/usage/hooks';
import { messageFor } from '@/lib/errors';
import { colors, radius, space, type } from '@/theme';

type Day = ReturnType<typeof PlannerDayResponse.parse>;

/** 7 days from today (not forced to Monday), in the phone's time zone; outfits are picked by hand, no AI. */
export default function PlannerScreen() {
  const [timeZone] = useState(deviceTimeZone);
  const today = localDate(timeZone);
  const [week, setWeek] = useState(0);
  const startDate = addDays(today, week * 7);
  const planner = usePlannerWeek(startDate, timeZone);
  const canEdit = featureOn(useEntitlements().data, 'weekly_outfit_planner');
  const [open, setOpen] = useState<string | null>(null);
  // Rounded coordinates live only in memory for this screen; the API does not store them either.
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const context = usePlannerContext(startDate, timeZone, coords);

  return (
    <Screen title="Kế hoạch tuần" subtitle={`${dayLabel(startDate)} – ${dayLabel(addDays(startDate, 6))} · ${timeZone}`}>
      {!canEdit ? <Text variant="callout" color={colors.inkSecondary}>Lên kế hoạch mới có trong gói Pro. Bạn vẫn xem và xóa các ngày đã lưu.</Text> : null}
      <View style={styles.row}>
        <Button label="Tuần trước" variant="plain" onPress={() => setWeek(week - 1)} style={{ flex: 1 }} />
        <Button label="Tuần sau" variant="plain" onPress={() => setWeek(week + 1)} style={{ flex: 1 }} />
      </View>
      <WeekTools context={context.data} coords={coords} onCoords={setCoords} startDate={startDate} timeZone={timeZone} />
      {planner.isPending ? (
        <LoadingState label="Đang tải kế hoạch…" />
      ) : planner.isError ? (
        <ErrorState error={planner.error} onRetry={() => planner.refetch()} />
      ) : (
        planner.data.days.map((d) => (
          <DayCard key={d.date} day={d} ctx={context.data?.days.find((c) => c.date === d.date)} today={today} canEdit={canEdit} open={open === d.date} onToggle={() => setOpen(open === d.date ? null : d.date)} />
        ))
      )}
      <Button label="Quay lại" variant="plain" onPress={() => router.back()} />
    </Screen>
  );
}

function DayCard({ day, ctx, today, canEdit, open, onToggle }: { day: Day; ctx: DayContext | undefined; today: string; canEdit: boolean; open: boolean; onToggle: () => void }) {
  const writable = canEdit && plannerWritable(day.date, today);
  return (
    <Card>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.head}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="headline" color={day.date === today ? colors.accent : colors.ink}>{dayLabel(day.date)}{day.date === today ? ' · Hôm nay' : ''}</Text>
          <Text variant="callout" color={day.isPlanned ? colors.ink : colors.inkTertiary} numberOfLines={1}>{day.occasion ?? 'Chưa lên kế hoạch'}</Text>
          {ctx?.weather || ctx?.events.length ? (
            <Text variant="caption" color={colors.inkSecondary} numberOfLines={1}>{[ctx.weather && weatherLine(ctx.weather), ctx.events.length ? `${ctx.events.length} sự kiện` : null].filter(Boolean).join(' · ')}</Text>
          ) : null}
          {day.outfitUnavailable ? <Text variant="caption" color={colors.warning}>Outfit đã chọn không còn dùng được (đã xóa hoặc thiếu món). Hãy chọn lại.</Text> : null}
        </View>
        {day.outfitId ? <OutfitThumb id={day.outfitId} size={56} /> : null}
        <Icon ios={open ? 'chevron.up' : 'chevron.down'} android={open ? 'expand_less' : 'expand_more'} size={14} color={colors.inkTertiary} />
      </Pressable>
      {open ? <DayExtras day={ctx} timeZone={day.timeZone} /> : null}
      {open ? writable ? <Editor day={day} suggested={ctx?.suggestedOccasion ?? null} onDone={onToggle} /> : <ReadOnly day={day} canEdit={canEdit} onDone={onToggle} /> : null}
    </Card>
  );
}

function Editor({ day, suggested, onDone }: { day: Day; suggested: string | null; onDone: () => void }) {
  const put = usePutPlannerDay();
  // An empty day starts from its first calendar event's occasion; the user can change it.
  const [occasion, setOccasion] = useState(day.occasion ?? suggested ?? '');
  const [outfitId, setOutfitId] = useState<string | null>(day.outfitId);
  const save = () =>
    put.mutate(
      { date: day.date, body: { timeZone: day.timeZone, occasion: occasion.trim(), outfitId } },
      { onSuccess: onDone, onError: (e) => Alert.alert('Chưa lưu được ngày này', messageFor(e)) },
    );
  return (
    <View style={{ gap: space.md }}>
      <TextInput value={occasion} onChangeText={setOccasion} placeholder="Dịp, ví dụ: Họp khách hàng" placeholderTextColor={colors.inkTertiary} maxLength={120} accessibilityLabel="Dịp" style={styles.input} />
      <View style={styles.wrap}>
        {OCCASION_OPTIONS.map((o) => (
          <Pressable key={o} onPress={() => setOccasion(o)} accessibilityRole="radio" accessibilityState={{ checked: occasion === o }} style={[styles.chip, occasion === o && { backgroundColor: colors.accent }]}>
            <Text variant="footnote" color={occasion === o ? '#FFFFFF' : colors.ink}>{o}</Text>
          </Pressable>
        ))}
      </View>
      <Text variant="footnote" color={colors.inkSecondary}>Outfit (không bắt buộc, chạm lần nữa để bỏ chọn)</Text>
      <OutfitPicker selected={outfitId ? [outfitId] : []} onPick={(id) => setOutfitId(id === outfitId ? null : id)} />
      <Button label="Lưu ngày này" onPress={save} disabled={!occasion.trim()} loading={put.isPending} />
      {day.isPlanned ? <RemoveDay day={day} onDone={onDone} /> : null}
    </View>
  );
}

function ReadOnly({ day, canEdit, onDone }: { day: Day; canEdit: boolean; onDone: () => void }) {
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="caption" color={colors.inkSecondary}>{canEdit ? 'Chỉ sửa được từ hôm nay đến 365 ngày tới.' : 'Gói hiện tại chỉ xem và xóa kế hoạch đã lưu.'}</Text>
      {day.isPlanned ? <RemoveDay day={day} onDone={onDone} /> : null}
    </View>
  );
}

function RemoveDay({ day, onDone }: { day: Day; onDone: () => void }) {
  const remove = useDeletePlannerDay();
  return (
    <Button
      label="Xóa kế hoạch ngày này"
      variant="danger"
      loading={remove.isPending}
      onPress={() => remove.mutate({ date: day.date, timeZone: day.timeZone }, { onSuccess: onDone, onError: (e) => Alert.alert('Chưa xóa được', messageFor(e)) })}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  input: { ...type.callout, height: 44, borderRadius: radius.sm, backgroundColor: colors.ground, paddingHorizontal: space.md, color: colors.ink },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { height: 32, paddingHorizontal: 12, borderRadius: 16, justifyContent: 'center', backgroundColor: colors.fill },
});
