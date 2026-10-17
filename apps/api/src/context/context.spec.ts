import { randomUUID } from 'node:crypto';
import {
  ContextService,
  calendarText,
  foldCalendarLine,
  clothingHints,
} from './context.service';
import { ContextRepository } from './context.repository';
import { WeatherProvider, OpenMeteoWeatherProvider } from './weather.provider';
import { RuntimeConfig } from '../config/runtime-config';
import { PlanningRepository } from '../planning/planning.repository';
import { PrismaService } from '../database/prisma.service';
import { JobLimitsService } from '../usage/job-limits.service';
import { localDate } from '../planning/calendar';

it('exports all-day planner dates without UTC drift, with stable private UIDs and escaped/folded UTF-8', async () => {
  const week = {
    days: [
      {
        date: '2026-12-31',
        isPlanned: true,
        occasion: 'Đi làm, họp;\\\nBEGIN:VEVENT',
      },
      { date: '2027-01-01', isPlanned: false },
    ],
  };
  const service = new ContextService(
    {} as ContextRepository,
    {
      week: jest.fn().mockResolvedValue(week),
    } as unknown as PlanningRepository,
    {} as WeatherProvider,
    {} as RuntimeConfig,
  );
  const query = { startDate: '2026-12-31', timeZone: 'Asia/Saigon' };
  const result = await service.export('private-user', query);
  expect(result.content).toContain(
    'DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101',
  );
  expect(result.content).toContain(
    'SUMMARY:Đi làm\\, họp\\;\\\\\\nBEGIN:VEVENT',
  );
  expect(result.content).not.toContain('private-user');
  expect(result.content.match(/^BEGIN:VEVENT$/gm)).toHaveLength(1);
  const again = await service.export('private-user', query);
  expect(result.content.match(/UID:[^\r]+/)).toEqual(
    again.content.match(/UID:[^\r]+/),
  );
  const text = 'SUMMARY:' + 'Đầm dự tiệc '.repeat(30);
  const folded = foldCalendarLine(text);
  expect(folded.replaceAll('\r\n ', '')).toBe(text);
  expect(
    folded.split('\r\n').every((line) => Buffer.byteLength(line) <= 75),
  ).toBe(true);
  expect(calendarText('a\r\nb')).toBe('a\\nb');
});
it('keeps user calendar usable when weather fails, and never fetches weather without coordinates', async () => {
  const event = {
    id: randomUUID(),
    date: '2026-10-17',
    timeZone: 'UTC',
    title: 'Work',
    occasion: 'work',
  };
  const repo = { events: jest.fn().mockResolvedValue({ items: [event] }) },
    weather = { week: jest.fn().mockRejectedValue(new Error('provider')) };
  const service = new ContextService(
    repo as unknown as ContextRepository,
    {} as PlanningRepository,
    weather,
    { values: { WEATHER_ENABLED: 'true' } } as RuntimeConfig,
  );
  const query = { startDate: '2026-10-17', timeZone: 'UTC' };
  expect((await service.week('owner', query)).weatherStatus).toBe(
    'not_requested',
  );
  expect(weather.week).not.toHaveBeenCalled();
  const result = await service.week('owner', {
    ...query,
    latitude: 10,
    longitude: 106,
  });
  expect(result.weatherStatus).toBe('unavailable');
  expect(result.days[0].suggestedOccasion).toBe('work');
  expect(result.days).toHaveLength(7);
  expect(
    clothingHints({
      date: event.date,
      minC: 15,
      maxC: 30,
      rainProbability: 50,
      code: 3,
    }),
  ).toEqual(['warm_layers', 'light_layers', 'rain_protection']);
  expect(clothingHints(null)).toEqual([]);
});
it('calendar upserts preserve owner scope, allow edits at cap, reject new entries and tombstones', async () => {
  const events = {
    findUnique: jest.fn(),
    count: jest.fn().mockResolvedValue(730),
    upsert: jest.fn(),
    deleteMany: jest.fn(),
  };
  const tx = { calendarEvent: events },
    lock = jest.fn();
  const repo = new ContextRepository(
    {
      $transaction: (fn: (tx: unknown) => unknown) => fn(tx),
    } as unknown as PrismaService,
    { lock } as unknown as JobLimitsService,
  );
  const id = randomUUID(),
    body = {
      date: localDate('UTC'),
      timeZone: 'UTC',
      title: 'Work',
      occasion: 'work',
    };
  events.findUnique.mockResolvedValue(null);
  await expect(repo.put('owner', id, body)).rejects.toMatchObject({
    status: 429,
  });
  expect(events.upsert).not.toHaveBeenCalled();
  events.findUnique.mockResolvedValue({ id });
  await expect(repo.put('owner', id, body)).resolves.toMatchObject({ id });
  expect(events.upsert).toHaveBeenCalledWith(
    expect.objectContaining({ where: { userId_id: { userId: 'owner', id } } }),
  );
  await repo.remove('owner', id);
  expect(events.deleteMany).toHaveBeenCalledWith({
    where: { userId: 'owner', id },
  });
  lock.mockRejectedValue(new Error('tombstone'));
  await expect(repo.remove('owner', id)).rejects.toThrow('tombstone');
  expect(() => repo.put('owner', id, { ...body, date: '1900-01-01' })).toThrow(
    'Bad Request',
  );
});
describe('Open-Meteo boundary', () => {
  const provider = new OpenMeteoWeatherProvider({
    values: {},
  } as RuntimeConfig);
  afterEach(() => jest.restoreAllMocks());
  it('validates the complete local-day series and fixed HTTPS destination, with commercial key on customer endpoint', async () => {
    const startDate = localDate('UTC');
    const date = (i: number) =>
      new Date(new Date(startDate).getTime() + i * 86400000)
        .toISOString()
        .slice(0, 10);
    const daily = {
      time: Array.from({ length: 7 }, (_, i) => date(i)),
      temperature_2m_min: Array(7).fill(20) as number[],
      temperature_2m_max: Array(7).fill(30) as number[],
      precipitation_probability_max: Array(7).fill(80) as number[],
      weather_code: Array(7).fill(61) as number[],
    };
    const fetcher = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ daily })));
    const result = await provider.week({
      startDate,
      timeZone: 'UTC',
      latitude: 10,
      longitude: 106,
    });
    expect(result).toHaveLength(7);
    expect((fetcher.mock.calls[0][0] as URL).toString()).toContain(
      'https://api.open-meteo.com/v1/forecast?',
    );
    const paid = new OpenMeteoWeatherProvider({
      values: { OPEN_METEO_API_KEY: 'fixture' },
    } as RuntimeConfig);
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ daily })));
    await paid.week({
      startDate,
      timeZone: 'UTC',
      latitude: 10,
      longitude: 106,
    });
    expect((fetcher.mock.calls[1][0] as URL).toString()).toContain(
      'https://customer-api.open-meteo.com/',
    );
    fetcher.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ daily: { ...daily, time: daily.time.slice(0, 2) } }),
      ),
    );
    await expect(
      provider.week({
        startDate,
        timeZone: 'UTC',
        latitude: 10,
        longitude: 106,
      }),
    ).rejects.toThrow('Incomplete forecast');
  });
});
