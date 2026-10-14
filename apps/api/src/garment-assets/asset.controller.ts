import { UseGuards } from '@nestjs/common';
import { RateLimitGuard } from '../usage/rate-limit.guard';
import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import {
  CreateAssetJobsRequest,
  IdeaRequest,
  IdempotencyKey,
  ResourceIdParams,
} from '@stylist/shared';
import { CurrentUser } from '../auth/auth.decorators';
import type { User } from '../generated/prisma/client';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AssetService } from './asset.service';
import { z } from 'zod';
@Controller()
export class AssetController {
  constructor(private readonly service: AssetService) {}
  @Get('asset-generation/quota') quota(@CurrentUser() user: User) {
    return this.service.quota(user.id);
  }
  @UseGuards(RateLimitGuard)
  @Post('garment-asset-jobs')
  create(
    @CurrentUser() user: User,
    @Headers('idempotency-key') key: unknown,
    @Body(new ZodValidationPipe(CreateAssetJobsRequest))
    body: z.infer<typeof CreateAssetJobsRequest>,
  ) {
    return this.service.create(
      user.id,
      new ZodValidationPipe(IdempotencyKey).transform(key),
      body.items,
    );
  }
  @Get('garment-asset-jobs/:id') get(
    @CurrentUser() user: User,
    @Param(new ZodValidationPipe(ResourceIdParams)) p: { id: string },
  ) {
    return this.service.get(user.id, p.id);
  }
  @UseGuards(RateLimitGuard)
  @Post('garment-ideas')
  plan(
    @CurrentUser() user: User,
    @Headers('idempotency-key') key: unknown,
    @Body(new ZodValidationPipe(IdeaRequest)) body: IdeaRequest,
  ) {
    return this.service.plan(
      user.id,
      new ZodValidationPipe(IdempotencyKey).transform(key),
      body,
    );
  }
  @Get('garment-ideas/:id') getPlan(
    @CurrentUser() user: User,
    @Param(new ZodValidationPipe(ResourceIdParams)) p: { id: string },
  ) {
    return this.service.getPlan(user.id, p.id);
  }
}
