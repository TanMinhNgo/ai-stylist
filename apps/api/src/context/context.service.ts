import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  CalendarExportResponse,
  PlannerContextResponse,
  type PlannerContextQuery,
  type PlannerWeekQuery,
  type WeatherDay,
} from '@stylist/shared';
import { RuntimeConfig } from '../config/runtime-config';
import { PlanningRepository } from '../planning/planning.repository';
import { addDays } from '../planning/calendar';
import { ContextRepository } from './context.repository';
import { WeatherProvider } from './weather.provider';
export function clothingHints(weather: WeatherDay | null) {
  const hints: ('warm_layers' | 'light_layers' | 'rain_protection')[] = [];
  if (weather) {
    if (weather.minC < 18) hints.push('warm_layers');
    if (weather.maxC >= 28) hints.push('light_layers');
    if (weather.rainProbability >= 50 || weather.code >= 51)
      hints.push('rain_protection');
  }
  return hints;
}
export function calendarText(value: string) {
  return value
    .replaceAll('\\', '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,');
}
export function foldCalendarLine(line: string) {
  let result = '',
    bytes = 0;
  for (const character of line) {
    const size = Buffer.byteLength(character);
    if (bytes + size > 75) {
      result += '\r\n ';
      bytes = 1;
    }
    result += character;
    bytes += size;
  }
  return result;
}
@Injectable()
export class ContextService {
  constructor(
    private readonly repo: ContextRepository,
    private readonly planning: PlanningRepository,
    private readonly weather: WeatherProvider,
    private readonly config: RuntimeConfig,
  ) {}
  async week(userId: string, query: PlannerContextQuery) {
    const events = await this.repo.events(userId, {
      startDate: query.startDate,
      timeZone: query.timeZone,
    });
    let status: 'not_requested' | 'disabled' | 'available' | 'unavailable' =
      query.latitude === undefined ? 'not_requested' : 'disabled';
    let forecast: WeatherDay[] = [];
    if (
      query.latitude !== undefined &&
      this.config.values.WEATHER_ENABLED === 'true'
    ) {
      try {
        forecast = await this.weather.week(query);
      } catch {
        /* A weather outage must not hide the user's calendar. */
      }
      status = forecast.length ? 'available' : 'unavailable';
    }
    return PlannerContextResponse.parse({
      startDate: query.startDate,
      timeZone: query.timeZone,
      weatherStatus: status,
      weatherAttribution:
        status === 'available'
          ? 'Weather data by Open-Meteo (https://open-meteo.com/), CC BY 4.0'
          : null,
      days: Array.from({ length: 7 }, (_, n) => {
        const date = addDays(query.startDate, n),
          items = events.items.filter((e) => e.date === date);
        const weather = forecast.find((day) => day.date === date) ?? null;
        return {
          date,
          events: items,
          weather,
          clothingHints: clothingHints(weather),
          suggestedOccasion: items[0]?.occasion ?? null,
        };
      }),
    });
  }
  async export(userId: string, query: PlannerWeekQuery) {
    const week = await this.planning.week(userId, query);
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//AI Stylist//Planner//VI',
      'CALSCALE:GREGORIAN',
    ];
    for (const day of week.days.filter((day) => day.isPlanned)) {
      const uid = createHash('sha256')
        .update(JSON.stringify([userId, query.timeZone, day.date]))
        .digest('hex');
      lines.push(
        'BEGIN:VEVENT',
        `UID:${uid}@ai-stylist`,
        `DTSTAMP:${new Date()
          .toISOString()
          .replace(/[-:]/g, '')
          .replace(/\.\d{3}/, '')}`,
        `DTSTART;VALUE=DATE:${day.date.replaceAll('-', '')}`,
        `DTEND;VALUE=DATE:${addDays(day.date, 1).replaceAll('-', '')}`,
        `SUMMARY:${calendarText(day.occasion ?? 'Trang phục')}`,
        'END:VEVENT',
      );
    }
    lines.push('END:VCALENDAR');
    return CalendarExportResponse.parse({
      fileName: `stylist-${query.startDate}.ics`,
      contentType: 'text/calendar',
      content: lines.map(foldCalendarLine).join('\r\n') + '\r\n',
    });
  }
}
