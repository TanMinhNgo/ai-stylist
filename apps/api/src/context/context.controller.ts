import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Query,
  UseGuards,
  Header,
} from '@nestjs/common';
import {
  PlannerContextQuery,
  PlannerWeekQuery,
  PutCalendarEventRequest,
  ResourceIdParams,
} from '@stylist/shared';
import { CurrentUser } from '../auth/auth.decorators';
import type { User } from '../generated/prisma/client';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { RateLimitGuard } from '../usage/rate-limit.guard';
import { ContextRepository } from './context.repository';
import { ContextService } from './context.service';
@Controller()
export class ContextController {
  constructor(
    private readonly repo: ContextRepository,
    private readonly service: ContextService,
  ) {}
  @Get('planner/context')
  @UseGuards(RateLimitGuard)
  @Header('Cache-Control', 'private, no-store')
  week(
    @CurrentUser() user: User,
    @Query(new ZodValidationPipe(PlannerContextQuery))
    query: PlannerContextQuery,
  ) {
    return this.service.week(user.id, query);
  }
  @Get('planner/calendar-export')
  @Header('Cache-Control', 'private, no-store')
  export(
    @CurrentUser() user: User,
    @Query(new ZodValidationPipe(PlannerWeekQuery)) query: PlannerWeekQuery,
  ) {
    return this.service.export(user.id, query);
  }
  @Get('calendar/events')
  @Header('Cache-Control', 'private, no-store')
  events(
    @CurrentUser() user: User,
    @Query(new ZodValidationPipe(PlannerWeekQuery)) query: PlannerWeekQuery,
  ) {
    return this.repo.events(user.id, query);
  }
  @Put('calendar/events/:id')
  put(
    @CurrentUser() user: User,
    @Param(new ZodValidationPipe(ResourceIdParams)) p: { id: string },
    @Body(new ZodValidationPipe(PutCalendarEventRequest))
    body: PutCalendarEventRequest,
  ) {
    return this.repo.put(user.id, p.id, body);
  }
  @Delete('calendar/events/:id')
  remove(
    @CurrentUser() user: User,
    @Param(new ZodValidationPipe(ResourceIdParams)) p: { id: string },
  ) {
    return this.repo.remove(user.id, p.id);
  }
}
