import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  CreateLookbookShareRequest,
  ResourceIdParams,
  ShareTokenParams,
} from '@stylist/shared';
import { CurrentUser, Public } from '../auth/auth.decorators';
import type { User } from '../generated/prisma/client';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { UsageService } from '../usage/usage.service';
import { RateLimitGuard } from '../usage/rate-limit.guard';
import { SharingRepository } from './sharing.repository';
import { PublicShareGuard } from './public-share.guard';
@Controller()
export class SharingController {
  constructor(
    private readonly repo: SharingRepository,
    private readonly usage: UsageService,
  ) {}
  @Post('collections/:id/shares')
  @UseGuards(RateLimitGuard)
  @Header('Cache-Control', 'private, no-store')
  async create(
    @CurrentUser() user: User,
    @Param(new ZodValidationPipe(ResourceIdParams)) p: { id: string },
    @Body(new ZodValidationPipe(CreateLookbookShareRequest))
    body: CreateLookbookShareRequest,
  ) {
    await this.usage.requireFeature(user.id, 'occasion_collections');
    return this.repo.create(user.id, p.id, body);
  }
  @Get('collections/:id/shares')
  @Header('Cache-Control', 'private, no-store')
  list(
    @CurrentUser() user: User,
    @Param(new ZodValidationPipe(ResourceIdParams)) p: { id: string },
  ) {
    return this.repo.list(user.id, p.id);
  }
  @Delete('lookbook-shares/:id')
  remove(
    @CurrentUser() user: User,
    @Param(new ZodValidationPipe(ResourceIdParams)) p: { id: string },
  ) {
    return this.repo.remove(user.id, p.id);
  }
  @Public()
  @Get('shared-lookbooks/:token')
  @UseGuards(PublicShareGuard)
  @Header('Cache-Control', 'private, no-store')
  @Header('Referrer-Policy', 'no-referrer')
  @Header('X-Robots-Tag', 'noindex, nofollow, noarchive')
  publicView(
    @Param(new ZodValidationPipe(ShareTokenParams)) p: { token: string },
  ) {
    return this.repo.publicView(p.token);
  }
}
