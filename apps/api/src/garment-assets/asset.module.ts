import { AiMeter } from '../usage/ai-meter.service';
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from '../database/database.module';
import { QueueModule } from '../queue/queue.module';
import { ImageStorageModule } from '../uploads/image-storage.module';
import { RuntimeConfig } from '../config/runtime-config';
import { VisionProvider } from '../media/vision.provider';
import { OpenAiVisionProvider } from '../media/openai-vision.provider';
import { MediaRepository } from '../media/media.repository';
import { AssetRepository } from './asset.repository';
import { AssetService } from './asset.service';
import { AssetProvider } from './asset.provider';
import { FakeAssetProvider } from './fake-asset.provider';
import { OpenAiAssetProvider } from './openai-asset.provider';
import { AssetProcessor } from './asset.processor';
import { AssetController } from './asset.controller';
import { AssetImage } from './asset-image';
@Module({
  imports: [
    DatabaseModule,
    QueueModule,
    ImageStorageModule,
    BullModule.registerQueue({ name: 'garment-assets', prefix: 'stylist' }),
  ],
  controllers: [AssetController],
  providers: [
    AssetRepository,
    AssetService,
    AssetProcessor,
    AssetImage,
    MediaRepository,
    { provide: VisionProvider, useClass: OpenAiVisionProvider },
    {
      provide: AssetProvider,
      inject: [RuntimeConfig, AiMeter],
      useFactory: (config: RuntimeConfig, meter: AiMeter) =>
        config.values.ASSET_PROVIDER === 'fake'
          ? new FakeAssetProvider()
          : new OpenAiAssetProvider(config, meter),
    },
  ],
  exports: [AssetService],
})
export class AssetModule {}
