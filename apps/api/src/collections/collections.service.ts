import { Injectable } from '@nestjs/common';
import type {
  CreateCollectionRequest,
  UpdateCollectionRequest,
} from '@stylist/shared';
import { UsageService } from '../usage/usage.service';
import { CollectionsRepository } from './collections.repository';
@Injectable()
export class CollectionsService {
  constructor(
    private readonly repo: CollectionsRepository,
    private readonly usage: UsageService,
  ) {}
  async create(userId: string, body: CreateCollectionRequest) {
    await this.usage.requireFeature(userId, 'occasion_collections');
    return this.repo.create(userId, body);
  }
  async update(userId: string, id: string, body: UpdateCollectionRequest) {
    await this.usage.requireFeature(userId, 'occasion_collections');
    return this.repo.update(userId, id, body);
  }
}
