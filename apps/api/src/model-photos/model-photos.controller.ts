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
  CreateModelPhotoRequest,
  MediaListQuery,
  ResourceIdParams,
  ModelPhotoListResponse,
  DeleteMediaResponse,
} from '@stylist/shared';
import type { User } from '../generated/prisma/client';
import { CurrentUser } from '../auth/auth.decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { MediaService } from '../media/media.service';

@Controller('model-photos')
export class ModelPhotosController {
  constructor(private readonly media: MediaService) {}
  @UseGuards(RateLimitGuard)
  @Post()
  create(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(CreateModelPhotoRequest))
    body: CreateModelPhotoRequest,
  ) {
    return this.media.create('model-photo', user.id, body);
  }
  @Get()
  async list(
    @CurrentUser() user: User,
    @Query(new ZodValidationPipe(MediaListQuery)) query: MediaListQuery,
  ) {
    return ModelPhotoListResponse.parse(
      await this.media.list('model-photo', user.id, query),
    );
  }
  @Get(':id')
  get(
    @CurrentUser() user: User,
    @Param(new ZodValidationPipe(ResourceIdParams)) params: { id: string },
  ) {
    return this.media.get('model-photo', user.id, params.id);
  }
  @Delete(':id')
  async remove(
    @CurrentUser() user: User,
    @Param(new ZodValidationPipe(ResourceIdParams)) params: { id: string },
  ) {
    return DeleteMediaResponse.parse(
      await this.media.remove('model-photo', user.id, params.id),
    );
  }
}
