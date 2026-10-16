import { BadRequestException } from '@nestjs/common';
export function addDays(date: string, count: number) {
  return new Date(new Date(date).getTime() + count * 86400000)
    .toISOString()
    .slice(0, 10);
}
export function localDate(timeZone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function checkDateWindow(
  date: string,
  timeZone: string,
  kind: 'planner' | 'wear',
) {
  const today = localDate(timeZone);
  if (
    date < addDays(today, kind === 'wear' ? -365 : 0) ||
    date > addDays(today, kind === 'wear' ? 0 : 365)
  )
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Date is outside the allowed local calendar window',
    });
}
