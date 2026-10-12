import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from '../database/database.module';
import { QueueModule } from '../queue/queue.module';
import { ImageStorageProvider } from '../uploads/image-storage.provider';
import { ImageKitProvider } from '../uploads/imagekit.provider';
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
    BullModule.registerQueue({ name: 'analysis', prefix: 'stylist' }),
  ],
  controllers: [UploadsController, ModelPhotosController, GarmentsController],
  providers: [
    MediaRepository,
    MediaService,
    AnalysisProcessor,
    { provide: ImageStorageProvider, useClass: ImageKitProvider },
    { provide: VisionProvider, useClass: OpenAiVisionProvider },
  ],
})
export class MediaModule {}
