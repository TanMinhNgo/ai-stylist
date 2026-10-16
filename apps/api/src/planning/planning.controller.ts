import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Query,
} from '@nestjs/common';
import {
  CalendarDateParams,
  CalendarZoneQuery,
  PlannerWeekQuery,
  PutPlannerDayRequest,
  PutWearRecordRequest,
  WardrobePeriodQuery,
  ResourceIdParams,
} from '@stylist/shared';
import { CurrentUser } from '../auth/auth.decorators';
import type { User } from '../generated/prisma/client';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PlanningRepository } from './planning.repository';
import { PlanningService } from './planning.service';
@Controller()
export class PlanningController {
  constructor(
    private readonly repo: PlanningRepository,
    private readonly service: PlanningService,
  ) {}
  @Get('planner/week') week(
    @CurrentUser() user: User,
    @Query(new ZodValidationPipe(PlannerWeekQuery)) query: PlannerWeekQuery,
  ) {
    return this.repo.week(user.id, query);
  }
  @Put('planner/days/:date') put(
    @CurrentUser() user: User,
    @Param(new ZodValidationPipe(CalendarDateParams)) p: { date: string },
    @Body(new ZodValidationPipe(PutPlannerDayRequest))
    body: PutPlannerDayRequest,
  ) {
    return this.service.putDay(user.id, p.date, body);
  }
  @Delete('planner/days/:date') remove(
    @CurrentUser() user: User,
    @Param(new ZodValidationPipe(CalendarDateParams)) p: { date: string },
    @Query(new ZodValidationPipe(CalendarZoneQuery))
    query: { timeZone: string },
  ) {
    return this.repo.removeDay(user.id, p.date, query.timeZone);
  }
  @Put('wear-history/:id') wear(
    @CurrentUser() user: User,
    @Param(new ZodValidationPipe(ResourceIdParams)) p: { id: string },
    @Body(new ZodValidationPipe(PutWearRecordRequest))
    body: PutWearRecordRequest,
  ) {
    return this.repo.wear(user.id, p.id, body);
  }
  @Get('wear-history') history(
    @CurrentUser() user: User,
    @Query(new ZodValidationPipe(WardrobePeriodQuery))
    query: WardrobePeriodQuery,
  ) {
    return this.repo.history(user.id, query);
  }
  @Delete('wear-history/:id') removeWear(
    @CurrentUser() user: User,
    @Param(new ZodValidationPipe(ResourceIdParams)) p: { id: string },
  ) {
    return this.repo.removeWear(user.id, p.id);
  }
  @Get('wardrobe/insights') insights(
    @CurrentUser() user: User,
    @Query(new ZodValidationPipe(WardrobePeriodQuery))
    query: WardrobePeriodQuery,
  ) {
    return this.service.getInsights(user.id, query);
  }
}
