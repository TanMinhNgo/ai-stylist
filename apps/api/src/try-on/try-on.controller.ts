import { UseGuards } from '@nestjs/common';
import { RateLimitGuard } from '../usage/rate-limit.guard';
import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import {
  CreateTryOnRequest,
  IdempotencyKey,
  ResourceIdParams,
} from '@stylist/shared';
import { CurrentUser } from '../auth/auth.decorators';
import type { User } from '../generated/prisma/client';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { TryOnService } from './try-on.service';

@Controller('try-on')
export class TryOnController {
  constructor(private readonly service: TryOnService) {}
  @UseGuards(RateLimitGuard)
  @Post()
  create(
    @CurrentUser() user: User,
    @Headers('idempotency-key') key: unknown,
    @Body(new ZodValidationPipe(CreateTryOnRequest)) body: CreateTryOnRequest,
  ) {
    return this.service.create(
      user.id,
      new ZodValidationPipe(IdempotencyKey).transform(key),
      body,
    );
  }
  @Get(':id')
  get(
    @CurrentUser() user: User,
    @Param(new ZodValidationPipe(ResourceIdParams)) params: { id: string },
  ) {
    return this.service.get(user.id, params.id);
  }
}
