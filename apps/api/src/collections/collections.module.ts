import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CollectionsController } from './collections.controller';
import { CollectionsRepository } from './collections.repository';
import { CollectionsService } from './collections.service';
@Module({
  imports: [DatabaseModule],
  controllers: [CollectionsController],
  providers: [CollectionsRepository, CollectionsService],
})
export class CollectionsModule {}
