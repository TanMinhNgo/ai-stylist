import { UseGuards } from '@nestjs/common';
import { RateLimitGuard } from '../usage/rate-limit.guard';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  CreateGarmentRequest,
  GarmentListQuery,
  ResourceIdParams,
  GarmentListResponse,
  DeleteMediaResponse,
} from '@stylist/shared';
import type { User } from '../generated/prisma/client';
import { CurrentUser } from '../auth/auth.decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { MediaService } from '../media/media.service';

@Controller('garments')
export class GarmentsController {
  constructor(private readonly media: MediaService) {}
  @UseGuards(RateLimitGuard)
  @Post()
  create(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(CreateGarmentRequest))
    body: CreateGarmentRequest,
  ) {
    return this.media.create('garment', user.id, body);
  }
  @Get()
  async list(
    @CurrentUser() user: User,
    @Query(new ZodValidationPipe(GarmentListQuery)) query: GarmentListQuery,
  ) {
    return GarmentListResponse.parse(
      await this.media.list('garment', user.id, query),
    );
  }
  @Get(':id')
  get(
    @CurrentUser() user: User,
    @Param(new ZodValidationPipe(ResourceIdParams)) params: { id: string },
  ) {
    return this.media.get('garment', user.id, params.id);
  }
  @Delete(':id')
  async remove(
    @CurrentUser() user: User,
    @Param(new ZodValidationPipe(ResourceIdParams)) params: { id: string },
  ) {
    return DeleteMediaResponse.parse(
      await this.media.remove('garment', user.id, params.id),
    );
  }
}
