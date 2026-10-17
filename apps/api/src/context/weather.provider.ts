import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { WeatherDay, type PlannerContextQuery } from '@stylist/shared';
import { RuntimeConfig } from '../config/runtime-config';
import { addDays, localDate } from '../planning/calendar';

export abstract class WeatherProvider {
  abstract week(query: PlannerContextQuery): Promise<WeatherDay[]>;
}
const dailyResponse = z.object({
  daily: z.object({
    time: z.array(z.string()).max(16),
    temperature_2m_min: z.array(z.number()).max(16),
    temperature_2m_max: z.array(z.number()).max(16),
    precipitation_probability_max: z.array(z.number()).max(16),
    weather_code: z.array(z.number()).max(16),
  }),
});
@Injectable()
export class OpenMeteoWeatherProvider extends WeatherProvider {
  constructor(private readonly config: RuntimeConfig) {
    super();
  }
  async week(query: PlannerContextQuery) {
    if (query.latitude === undefined || query.longitude === undefined)
      return [];
    const today = localDate(query.timeZone);
    const start = query.startDate < today ? today : query.startDate;
    const end = [addDays(query.startDate, 6), addDays(today, 15)].sort()[0];
    if (start > end) return [];
    const key = this.config.values.OPEN_METEO_API_KEY;
    const url = new URL(
      `https://${key ? 'customer-api' : 'api'}.open-meteo.com/v1/forecast`,
    );
    url.search = new URLSearchParams({
      latitude: String(query.latitude),
      longitude: String(query.longitude),
      timezone: query.timeZone,
      start_date: start,
      end_date: end,
      daily:
        'temperature_2m_min,temperature_2m_max,precipitation_probability_max,weather_code',
      ...(key ? { apikey: key } : {}),
    }).toString();
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      redirect: 'error',
    });
    if (!response.ok) throw new Error('Weather unavailable');
    const { daily } = dailyResponse.parse(await response.json());
    const count =
      Math.round(
        (new Date(end).getTime() - new Date(start).getTime()) / 86400000,
      ) + 1;
    if (Object.values(daily).some((values) => values.length !== count))
      throw new Error('Incomplete forecast');
    return daily.time.map((date, i) => {
      if (date !== addDays(start, i))
        throw new Error('Unexpected forecast date');
      return WeatherDay.parse({
        date,
        minC: daily.temperature_2m_min[i],
        maxC: daily.temperature_2m_max[i],
        rainProbability: daily.precipitation_probability_max[i],
        code: daily.weather_code[i],
      });
    });
  }
}
