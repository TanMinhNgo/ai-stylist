import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { QueueModule } from '../queue/queue.module';
import { ImageStorageModule } from '../uploads/image-storage.module';
import { SharingController } from './sharing.controller';
import { SharingRepository } from './sharing.repository';
import { PublicShareGuard } from './public-share.guard';
@Module({
  imports: [DatabaseModule, QueueModule, ImageStorageModule],
  providers: [SharingRepository, PublicShareGuard],
  controllers: [SharingController],
})
export class SharingModule {}
