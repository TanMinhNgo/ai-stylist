import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import {
  CalendarEventResponse,
  CalendarEventsResponse,
  type PlannerWeekQuery,
  type PutCalendarEventRequest,
} from '@stylist/shared';
import { PrismaService } from '../database/prisma.service';
import { JobLimitsService } from '../usage/job-limits.service';
import { addDays, localDate } from '../planning/calendar';
@Injectable()
export class ContextRepository {
  constructor(
    private readonly db: PrismaService,
    private readonly locks: JobLimitsService,
  ) {}
  async events(userId: string, query: PlannerWeekQuery) {
    const rows = await this.db.calendarEvent.findMany({
      where: {
        userId,
        user: { deletedAt: null },
        timeZone: query.timeZone,
        date: {
          gte: new Date(query.startDate),
          lte: new Date(addDays(query.startDate, 6)),
        },
      },
      orderBy: [{ date: 'asc' }, { id: 'asc' }],
      take: 730,
    });
    return CalendarEventsResponse.parse({
      items: rows.map((row) => ({
        id: row.id,
        date: row.date.toISOString().slice(0, 10),
        timeZone: row.timeZone,
        title: row.title,
        occasion: row.occasion,
      })),
    });
  }
  put(userId: string, id: string, body: PutCalendarEventRequest) {
    const today = localDate(body.timeZone);
    if (body.date < addDays(today, -365) || body.date > addDays(today, 365))
      throw new BadRequestException();
    return this.db.$transaction(async (tx) => {
      await this.locks.lock(tx, userId);
      const key = { userId, id };
      if (
        !(await tx.calendarEvent.findUnique({ where: { userId_id: key } })) &&
        (await tx.calendarEvent.count({ where: { userId } })) >= 730
      )
        throw new HttpException(
          {
            code: 'QUOTA_EXCEEDED',
            message: 'Calendar event limit reached',
            details: { resource: 'calendar_events', limit: 730 },
          },
          429,
        );
      await tx.calendarEvent.upsert({
        where: { userId_id: key },
        create: { ...key, ...body, date: new Date(body.date) },
        update: { ...body, date: new Date(body.date) },
      });
      return CalendarEventResponse.parse({ id, ...body });
    });
  }
  remove(userId: string, id: string) {
    return this.db.$transaction(async (tx) => {
      await this.locks.lock(tx, userId);
      await tx.calendarEvent.deleteMany({ where: { userId, id } });
      return { deleted: true as const };
    });
  }
}
