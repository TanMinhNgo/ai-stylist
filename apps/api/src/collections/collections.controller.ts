import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  CreateCollectionRequest,
  UpdateCollectionRequest,
  CollectionListQuery,
  ResourceIdParams,
} from '@stylist/shared';
import { CurrentUser } from '../auth/auth.decorators';
import type { User } from '../generated/prisma/client';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CollectionsRepository } from './collections.repository';
import { CollectionsService } from './collections.service';
@Controller('collections')
export class CollectionsController {
  constructor(
    private readonly repo: CollectionsRepository,
    private readonly service: CollectionsService,
  ) {}
  @Get() list(
    @CurrentUser() user: User,
    @Query(new ZodValidationPipe(CollectionListQuery))
    query: CollectionListQuery,
  ) {
    return this.repo.list(user.id, query);
  }
  @Get(':id') get(
    @CurrentUser() user: User,
    @Param(new ZodValidationPipe(ResourceIdParams)) p: { id: string },
  ) {
    return this.repo.get(user.id, p.id);
  }
  @Post() create(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(CreateCollectionRequest))
    body: CreateCollectionRequest,
  ) {
    return this.service.create(user.id, body);
  }
  @Patch(':id') update(
    @CurrentUser() user: User,
    @Param(new ZodValidationPipe(ResourceIdParams)) p: { id: string },
    @Body(new ZodValidationPipe(UpdateCollectionRequest))
    body: UpdateCollectionRequest,
  ) {
    return this.service.update(user.id, p.id, body);
  }
  @Delete(':id') remove(
    @CurrentUser() user: User,
    @Param(new ZodValidationPipe(ResourceIdParams)) p: { id: string },
  ) {
    return this.repo.remove(user.id, p.id);
  }
}
