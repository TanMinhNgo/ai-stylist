import type { PlannerContextResponse } from '@stylist/shared';
import * as Calendar from 'expo-calendar';
import { File, Paths } from 'expo-file-system';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button, Icon, Text } from '@/components/ui';
import { fetchCalendarExport, useDeleteCalendarEvent, usePutCalendarEvent } from '@/features/integrations/hooks';
import { coarse, deviceEventBody, HINT_LABEL, WEATHER_STATUS, weatherLine } from '@/features/integrations/logic';
import { OCCASION_OPTIONS } from '@/features/stylist/components/ProfileFields';
import { useStudio } from '@/features/studio/store';
import { newIdempotencyKey } from '@/features/try-on/hooks';
import { messageFor, RequestError } from '@/lib/errors';
import { colors, radius, space, type } from '@/theme';

type Context = ReturnType<typeof PlannerContextResponse.parse>;
export type DayContext = Context['days'][number];
type Coords = { latitude: number; longitude: number };

const denied = (what: string) =>
  Alert.alert(`Chưa có quyền ${what}`, `Bật quyền ${what} trong Cài đặt để dùng tính năng này.`, [
    { text: 'Để sau', style: 'cancel' },
    { text: 'Mở Cài đặt', onPress: () => Linking.openSettings() },
  ]);

/** Week-level tools: weather by location (asked only on tap, kept in memory) and the .ics export. */
export function WeekTools({ context, coords, onCoords, startDate, timeZone }: { context: Context | undefined; coords: Coords | null; onCoords: (c: Coords) => void; startDate: string; timeZone: string }) {
  const [locating, setLocating] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function locate() {
    setLocating(true);
    try {
      if ((await Location.requestForegroundPermissionsAsync()).status !== 'granted') return denied('vị trí');
      const pos = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
      onCoords(coarse(pos.coords));
    } catch {
      Alert.alert('Chưa lấy được vị trí', 'Kiểm tra định vị trên điện thoại rồi thử lại.');
    } finally {
      setLocating(false);
    }
  }

  async function exportWeek() {
    setExporting(true);
    try {
      if (!(await Sharing.isAvailableAsync())) throw new Error('Thiết bị này không hỗ trợ chia sẻ tệp.');
      const ics = await fetchCalendarExport(startDate, timeZone);
      const file = new File(Paths.cache, ics.fileName);
      file.write(ics.content);
      await Sharing.shareAsync(file.uri, { mimeType: 'text/calendar', UTI: 'com.apple.ical.ics', dialogTitle: 'Xuất kế hoạch tuần' });
    } catch (e) {
      Alert.alert('Chưa xuất được lịch', e instanceof RequestError || !(e instanceof Error) ? messageFor(e) : e.message);
    } finally {
      setExporting(false);
    }
  }

  const status = context ? WEATHER_STATUS[context.weatherStatus] : null;
  return (
    <View style={{ gap: space.sm }}>
      {status && context?.weatherStatus !== 'not_requested' ? <Text variant="caption" color={colors.inkSecondary}>{status}</Text> : null}
      {context?.weatherAttribution ? <Text variant="caption" color={colors.inkTertiary}>Thời tiết: {context.weatherAttribution}</Text> : null}
      <View style={styles.row}>
        <Button label={coords ? 'Cập nhật vị trí' : 'Xem thời tiết'} variant="plain" onPress={locate} loading={locating} style={{ flex: 1 }} icon={<Icon ios="cloud.sun" android="partly_cloudy_day" size={16} />} />
        <Button label="Xuất lịch .ics" variant="plain" onPress={exportWeek} loading={exporting} style={{ flex: 1 }} icon={<Icon ios="calendar" android="calendar_month" size={16} />} />
      </View>
      <Text variant="caption" color={colors.inkTertiary}>Tệp .ics là bản chụp tuần này để nhập vào ứng dụng lịch, không tự đồng bộ.</Text>
    </View>
  );
}

/** Weather, clothing hints and the user's own events for one planner day. */
export function DayExtras({ day, timeZone }: { day: DayContext | undefined; timeZone: string }) {
  const [adding, setAdding] = useState(false);
  const remove = useDeleteCalendarEvent();
  if (!day) return null;
  const suggestFor = (occasion: string) => {
    useStudio.getState().setOccasion(occasion);
    router.push('/suggest');
  };
  return (
    <View style={{ gap: space.sm }}>
      {day.weather ? (
        <Text variant="callout">{weatherLine(day.weather)}{day.clothingHints.length ? ` · ${day.clothingHints.map((h) => HINT_LABEL[h]).join(', ')}` : ''}</Text>
      ) : null}
      {day.events.map((e) => (
        <View key={e.id} style={styles.event}>
          <Icon ios="calendar" android="event" size={14} color={colors.inkSecondary} />
          <Text variant="callout" style={{ flex: 1 }} numberOfLines={1}>{e.title}{e.occasion !== e.title ? ` · ${e.occasion}` : ''}</Text>
          <Pressable onPress={() => remove.mutate(e.id, { onError: (err) => Alert.alert('Chưa xóa được', messageFor(err)) })} accessibilityRole="button" accessibilityLabel={`Xóa sự kiện ${e.title}`} hitSlop={8}>
            <Icon ios="xmark.circle.fill" android="cancel" size={18} color={colors.inkTertiary} />
          </Pressable>
        </View>
      ))}
      {day.suggestedOccasion ? <Button label={`Gợi ý bộ phối cho "${day.suggestedOccasion}"`} variant="plain" onPress={() => suggestFor(day.suggestedOccasion!)} /> : null}
      {adding ? <EventEditor date={day.date} timeZone={timeZone} onDone={() => setAdding(false)} /> : <Button label="Thêm sự kiện" variant="plain" onPress={() => setAdding(true)} icon={<Icon ios="plus" android="add" size={16} />} />}
    </View>
  );
}

function EventEditor({ date, timeZone, onDone }: { date: string; timeZone: string; onDone: () => void }) {
  const put = usePutCalendarEvent();
  // One id per opened editor: a retry after a lost response updates the same event.
  const [id] = useState(newIdempotencyKey);
  const [title, setTitle] = useState('');
  const [occasion, setOccasion] = useState('');
  const [device, setDevice] = useState<Calendar.ExpoCalendarEvent[] | null>(null);
  const [loading, setLoading] = useState(false);

  const save = (body = { date, timeZone, title: title.trim(), occasion: (occasion || title).trim() }) =>
    put.mutate({ id, body }, { onSuccess: onDone, onError: (e) => Alert.alert('Chưa lưu được sự kiện', messageFor(e)) });

  // Reads this day from the phone's calendars only after a tap; nothing is sent until one event is picked.
  async function fromPhone() {
    setLoading(true);
    try {
      if ((await Calendar.requestCalendarPermissions()).status !== 'granted') return denied('lịch');
      const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
      // Local midnight to midnight: the planner day is the phone's day.
      setDevice(await Calendar.listEvents(calendars, new Date(`${date}T00:00:00`), new Date(`${date}T23:59:59`)));
    } catch {
      Alert.alert('Chưa đọc được lịch', 'Thử lại sau hoặc nhập sự kiện bằng tay.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.editor}>
      <TextInput value={title} onChangeText={setTitle} placeholder="Tên sự kiện, ví dụ: Họp khách hàng" placeholderTextColor={colors.inkTertiary} maxLength={120} accessibilityLabel="Tên sự kiện" style={styles.input} />
      <View style={styles.wrap}>
        {OCCASION_OPTIONS.map((o) => (
          <Pressable key={o} onPress={() => setOccasion(o)} accessibilityRole="radio" accessibilityState={{ checked: occasion === o }} style={[styles.chip, occasion === o && { backgroundColor: colors.accent }]}>
            <Text variant="footnote" color={occasion === o ? '#FFFFFF' : colors.ink}>{o}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.row}>
        <Button label="Hủy" variant="plain" onPress={onDone} style={{ flex: 1 }} />
        <Button label="Lưu" onPress={() => save()} disabled={!title.trim()} loading={put.isPending} style={{ flex: 1 }} />
      </View>
      {device === null ? (
        <Button label="Chọn từ lịch điện thoại" variant="plain" onPress={fromPhone} loading={loading} />
      ) : device.length ? (
        device.map((e) => (
          <Pressable key={e.id} onPress={() => save(deviceEventBody(e, timeZone))} accessibilityRole="button" style={styles.event}>
            <Icon ios="calendar.badge.plus" android="event_available" size={14} color={colors.accent} />
            <Text variant="callout" style={{ flex: 1 }} numberOfLines={1}>{e.title || 'Sự kiện'}</Text>
          </Pressable>
        ))
      ) : (
        <Text variant="caption" color={colors.inkSecondary}>Lịch điện thoại không có sự kiện nào ngày này.</Text>
      )}
      {put.isPending ? <ActivityIndicator color={colors.inkSecondary} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  event: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 36, paddingHorizontal: space.sm, borderRadius: radius.sm, backgroundColor: colors.ground },
  editor: { gap: space.sm, padding: space.sm, borderRadius: radius.md, backgroundColor: colors.ground },
  input: { ...type.callout, height: 44, borderRadius: radius.sm, backgroundColor: colors.surface, paddingHorizontal: space.md, color: colors.ink },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { height: 32, paddingHorizontal: 12, borderRadius: 16, justifyContent: 'center', backgroundColor: colors.fill },
});
