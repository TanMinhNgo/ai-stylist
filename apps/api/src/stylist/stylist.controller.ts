import { UseGuards } from '@nestjs/common';
import { RateLimitGuard } from '../usage/rate-limit.guard';
import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Delete,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import {
  UpdateStyleProfileRequest,
  OutfitListQuery,
  OutfitFeedbackRequest,
  SaveOutfitRequest,
  SuggestRequest,
  IdempotencyKey,
  ResourceIdParams,
} from '@stylist/shared';
import { CurrentUser } from '../auth/auth.decorators';
import type { User } from '../generated/prisma/client';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { StylistRepository } from './stylist.repository';
import { StylistService } from './stylist.service';
@Controller()
export class StylistController {
  constructor(
    private readonly repo: StylistRepository,
    private readonly service: StylistService,
  ) {}
  @Get('style-profile') profile(@CurrentUser() user: User) {
    return this.repo.profile(user.id);
  }
  @Put('style-profile') update(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(UpdateStyleProfileRequest))
    body: z.infer<typeof UpdateStyleProfileRequest>,
  ) {
    return this.repo.updateProfile(user.id, body);
  }
  @Get('outfits') list(
    @CurrentUser() user: User,
    @Query(new ZodValidationPipe(OutfitListQuery))
    query: z.infer<typeof OutfitListQuery>,
  ) {
    return this.service.list(user.id, query);
  }
  @Get('outfits/:id') get(
    @CurrentUser() user: User,
    @Param(new ZodValidationPipe(ResourceIdParams)) p: { id: string },
  ) {
    return this.service.outfit(user.id, p.id);
  }
  @Post('outfits/:id/save') async save(
    @CurrentUser() user: User,
    @Param(new ZodValidationPipe(ResourceIdParams)) p: { id: string },
    @Body(new ZodValidationPipe(SaveOutfitRequest))
    body: z.infer<typeof SaveOutfitRequest>,
  ) {
    return this.service.response(
      await this.repo.save(user.id, p.id, body.saved),
    );
  }
  @Post('outfits/:id/feedback') async feedback(
    @CurrentUser() user: User,
    @Param(new ZodValidationPipe(ResourceIdParams)) p: { id: string },
    @Body(new ZodValidationPipe(OutfitFeedbackRequest))
    body: z.infer<typeof OutfitFeedbackRequest>,
  ) {
    return this.service.response(
      await this.repo.feedback(user.id, p.id, body.liked),
    );
  }
  @Delete('outfits/:id') remove(
    @CurrentUser() user: User,
    @Param(new ZodValidationPipe(ResourceIdParams)) p: { id: string },
  ) {
    return this.service.remove(user.id, p.id);
  }
  @UseGuards(RateLimitGuard)
  @Post('outfits/:id/advice')
  advice(
    @CurrentUser() user: User,
    @Param(new ZodValidationPipe(ResourceIdParams)) p: { id: string },
    @Headers('idempotency-key') key: unknown,
  ) {
    return this.service.create(
      user.id,
      new ZodValidationPipe(IdempotencyKey).transform(key),
      { kind: 'advice', outfitId: p.id },
    );
  }
  @UseGuards(RateLimitGuard)
  @Post('stylist/suggest')
  suggest(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(SuggestRequest))
    body: z.infer<typeof SuggestRequest>,
    @Headers('idempotency-key') key: unknown,
  ) {
    return this.service.create(
      user.id,
      new ZodValidationPipe(IdempotencyKey).transform(key),
      { kind: 'suggest', request: body },
    );
  }
  @Get('stylist/jobs/:id') job(
    @CurrentUser() user: User,
    @Param(new ZodValidationPipe(ResourceIdParams)) p: { id: string },
  ) {
    return this.service.getJob(user.id, p.id);
  }
}
