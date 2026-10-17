// Phase 7 pure helpers (billing, calendar/weather, affiliate, sharing), tested in test/integrations.test.mjs.
import { GarmentType, type WeatherDay } from '@stylist/shared';

import { localDate } from '../planning/logic.ts';

export const HINT_LABEL = {
  warm_layers: 'Thêm lớp ấm',
  light_layers: 'Mặc lớp nhẹ, thoáng',
  rain_protection: 'Mang áo khoác chống mưa hoặc ô',
} as const;

export const WEATHER_STATUS = {
  not_requested: 'Bật vị trí để xem thời tiết cho kế hoạch tuần.',
  disabled: 'Thời tiết chưa được bật trên máy chủ.',
  unavailable: 'Chưa lấy được thời tiết. Lịch vẫn hiển thị bình thường.',
  available: null,
} as const;

export const weatherLine = (w: WeatherDay) => `${Math.round(w.minC)}–${Math.round(w.maxC)}°C · mưa ${Math.round(w.rainProbability)}%`;

/** Coordinates rounded to ~1 km: enough for a forecast, less precise than the phone's fix. Never stored. */
export const coarse = (c: { latitude: number; longitude: number }) => ({ latitude: Math.round(c.latitude * 100) / 100, longitude: Math.round(c.longitude * 100) / 100 });

/** A device calendar event the user picked → PUT body; only its title and local day leave the phone. */
export function deviceEventBody(e: { title?: string | null; startDate: string | Date }, timeZone: string) {
  const title = (e.title ?? '').trim().slice(0, 120) || 'Sự kiện';
  return { date: localDate(timeZone, new Date(e.startDate)), timeZone, title, occasion: title };
}

/** An advice accessory (free text) → shop filters: its text as `q`, plus `type` when it names a known garment type. */
export function shopQuery(accessoryType: string) {
  const q = accessoryType.trim().slice(0, 80);
  const type = GarmentType.safeParse(q.toLowerCase().replace(/\s+/g, '_'));
  return type.success ? { q, type: type.data } : { q };
}

export const SHARE_EXPIRY = [
  { hours: 24, label: '1 ngày' },
  { hours: 72, label: '3 ngày' },
  { hours: 168, label: '7 ngày' },
] as const;

/** Store management page for this platform, if the API gave one. */
export const manageUrl = (urls: { ios: string; android: string } | null | undefined, os: string) => (urls ? (os === 'ios' ? urls.ios : urls.android) : null);
