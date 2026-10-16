import {
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  PLANNER_DAY_LIMIT,
  WEAR_RECORDS_PER_DAY,
  PlannerDayResponse,
  PlannerWeekResponse,
  WearRecordResponse,
  WearHistoryResponse,
  type PlannerWeekQuery,
  type PutPlannerDayRequest,
  type PutWearRecordRequest,
  type WardrobePeriodQuery,
} from '@stylist/shared';
import { PrismaService } from '../database/prisma.service';
import type { Prisma, WearRecord } from '../generated/prisma/client';
import { JobLimitsService } from '../usage/job-limits.service';
import { addDays, checkDateWindow } from './calendar';
const alive = { user: { deletedAt: null } };
const conflict = () =>
  new ConflictException({
    code: 'IDEMPOTENCY_CONFLICT',
    message: 'Wear confirmation already exists or ID has different data',
  });
@Injectable()
export class PlanningRepository {
  constructor(
    private readonly db: PrismaService,
    private readonly locks: JobLimitsService,
  ) {}
  private quota(resource: string, limit: number) {
    return new HttpException(
      {
        code: 'QUOTA_EXCEEDED',
        message: 'Planning data limit reached',
        details: { resource, limit },
      },
      429,
    );
  }
  private async outfit(
    tx: Prisma.TransactionClient,
    userId: string,
    id: string,
  ) {
    const row = await tx.outfit.findFirst({
      where: { id, userId, deletedAt: null, ...alive },
      include: { tryOnJob: true },
    });
    if (!row) throw new NotFoundException();
    const ids = z.array(z.uuid()).min(1).max(4).parse(row.tryOnJob.garmentIds);
    if (
      (await tx.garment.count({
        where: {
          userId,
          id: { in: ids },
          status: 'ready',
          deletingAt: null,
          ...alive,
        },
      })) !== ids.length
    )
      throw new NotFoundException();
    return row;
  }
  async week(userId: string, query: PlannerWeekQuery) {
    const rows = await this.db.plannerDay.findMany({
      where: {
        userId,
        ...alive,
        timeZone: query.timeZone,
        date: {
          gte: new Date(query.startDate),
          lte: new Date(addDays(query.startDate, 6)),
        },
      },
      include: { outfit: { include: { tryOnJob: true } } },
    });
    const ids = [
      ...new Set(rows.flatMap((r) => r.outfit?.tryOnJob.garmentIds ?? [])),
    ];
    const available = new Set(
      (
        await this.db.garment.findMany({
          where: {
            userId,
            id: { in: ids },
            status: 'ready',
            deletingAt: null,
            ...alive,
          },
          select: { id: true },
        })
      ).map((g) => g.id),
    );
    return PlannerWeekResponse.parse({
      ...query,
      days: Array.from({ length: 7 }, (_, n) => {
        const date = addDays(query.startDate, n),
          row = rows.find((r) => r.date.toISOString().slice(0, 10) === date);
        const missing =
          !!row &&
          (row.outfitUnavailable ||
            !!row.outfit?.deletedAt ||
            (!!row.outfitId &&
              (!row.outfit?.tryOnJob.garmentIds.length ||
                row.outfit.tryOnJob.garmentIds.some(
                  (id) => !available.has(id),
                ))));
        return {
          date,
          timeZone: query.timeZone,
          isPlanned: !!row,
          occasion: row?.occasion ?? null,
          outfitId: missing ? null : (row?.outfitId ?? null),
          outfitUnavailable: missing,
        };
      }),
    });
  }
  putDay(userId: string, date: string, body: PutPlannerDayRequest) {
    checkDateWindow(date, body.timeZone, 'planner');
    return this.db.$transaction(async (tx) => {
      await this.locks.lock(tx, userId);
      if (body.outfitId) await this.outfit(tx, userId, body.outfitId);
      const key = { userId, date: new Date(date), timeZone: body.timeZone };
      if (
        !(await tx.plannerDay.findUnique({
          where: { userId_timeZone_date: key },
        })) &&
        (await tx.plannerDay.count({ where: { userId } })) >= PLANNER_DAY_LIMIT
      )
        throw this.quota('planner', PLANNER_DAY_LIMIT);
      const data = {
        occasion: body.occasion,
        outfitId: body.outfitId,
        outfitUnavailable: false,
      };
      await tx.plannerDay.upsert({
        where: { userId_timeZone_date: key },
        create: { ...key, ...data },
        update: data,
      });
      return PlannerDayResponse.parse({
        date,
        timeZone: body.timeZone,
        isPlanned: true,
        ...data,
      });
    });
  }
  removeDay(userId: string, date: string, timeZone: string) {
    return this.db.$transaction(async (tx) => {
      await this.locks.lock(tx, userId);
      await tx.plannerDay.deleteMany({
        where: { userId, date: new Date(date), timeZone },
      });
      return { deleted: true as const };
    });
  }
  private wearResponse(row: WearRecord) {
    return WearRecordResponse.parse({
      id: row.id,
      date: row.date.toISOString().slice(0, 10),
      timeZone: row.timeZone,
      outfitId: row.outfitId,
      garmentCount: row.garmentIds.length,
      createdAt: row.createdAt.toISOString(),
    });
  }
  async wear(userId: string, id: string, body: PutWearRecordRequest) {
    const requestHash = createHash('sha256')
      .update(JSON.stringify([body.date, body.timeZone, body.outfitId]))
      .digest('hex');
    try {
      return await this.db.$transaction(async (tx) => {
        await this.locks.lock(tx, userId);
        const old = await tx.wearRecord.findFirst({ where: { id, userId } });
        if (old) {
          if (old.requestHash !== requestHash) throw conflict();
          return this.wearResponse(old);
        }
        checkDateWindow(body.date, body.timeZone, 'wear');
        const outfit = await this.outfit(tx, userId, body.outfitId);
        const garmentIds = outfit.tryOnJob.garmentIds;
        if (
          (await tx.wearRecord.count({
            where: { userId, date: new Date(body.date) },
          })) >= WEAR_RECORDS_PER_DAY
        )
          throw this.quota('wear_history', WEAR_RECORDS_PER_DAY);
        const row = await tx.wearRecord.create({
          data: {
            id,
            userId,
            date: new Date(body.date),
            timeZone: body.timeZone,
            outfitId: body.outfitId,
            garmentIds,
            requestHash,
          },
        });
        return this.wearResponse(row);
      });
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      )
        throw conflict();
      throw error;
    }
  }
  async history(userId: string, query: WardrobePeriodQuery) {
    const rows = await this.db.wearRecord.findMany({
      where: {
        userId,
        ...alive,
        date: { gte: new Date(query.from), lte: new Date(query.to) },
      },
      orderBy: [{ date: 'desc' }, { id: 'asc' }],
      take: 1830,
    });
    return WearHistoryResponse.parse({
      items: rows.map((r) => this.wearResponse(r)),
    });
  }
  removeWear(userId: string, id: string) {
    return this.db.$transaction(async (tx) => {
      await this.locks.lock(tx, userId);
      await tx.wearRecord.deleteMany({ where: { id, userId } });
      return { deleted: true as const };
    });
  }
}
