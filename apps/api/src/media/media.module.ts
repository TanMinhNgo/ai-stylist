import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from '../database/database.module';
import { QueueModule } from '../queue/queue.module';
import { ImageStorageModule } from '../uploads/image-storage.module';
import { AssetModule } from '../garment-assets/asset.module';
import { UploadsController } from '../uploads/uploads.controller';
import { ModelPhotosController } from '../model-photos/model-photos.controller';
import { GarmentsController } from '../garments/garments.controller';
import { MediaRepository } from './media.repository';
import { MediaService } from './media.service';
import { VisionProvider } from './vision.provider';
import { OpenAiVisionProvider } from './openai-vision.provider';
import { AnalysisProcessor } from './analysis.processor';

@Module({
  imports: [
    DatabaseModule,
    QueueModule,
    ImageStorageModule,
    AssetModule,
    BullModule.registerQueue({ name: 'analysis', prefix: 'stylist' }),
  ],
  controllers: [UploadsController, ModelPhotosController, GarmentsController],
  exports: [ImageStorageModule, MediaRepository],
  providers: [
    MediaRepository,
    MediaService,
    AnalysisProcessor,
    { provide: VisionProvider, useClass: OpenAiVisionProvider },
  ],
})
export class MediaModule {}
