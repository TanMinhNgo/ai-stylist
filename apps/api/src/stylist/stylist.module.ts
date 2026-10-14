import { AiMeter } from '../usage/ai-meter.service';
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from '../database/database.module';
import { QueueModule } from '../queue/queue.module';
import { ImageStorageModule } from '../uploads/image-storage.module';
import { RuntimeConfig } from '../config/runtime-config';
import { StylistRepository } from './stylist.repository';
import { StylistService } from './stylist.service';
import { StylistController } from './stylist.controller';
import { StylistProcessor } from './stylist.processor';
import { StylistProvider } from './stylist.provider';
import { FakeStylistProvider } from './fake-stylist.provider';
import { OpenAiStylistProvider } from './openai-stylist.provider';
@Module({
  imports: [
    DatabaseModule,
    QueueModule,
    ImageStorageModule,
    BullModule.registerQueue({ name: 'stylist', prefix: 'stylist' }),
  ],
  controllers: [StylistController],
  providers: [
    StylistRepository,
    StylistService,
    StylistProcessor,
    {
      provide: StylistProvider,
      inject: [RuntimeConfig, AiMeter],
      useFactory: (config: RuntimeConfig, meter: AiMeter) =>
        config.values.STYLIST_PROVIDER === 'fake'
          ? new FakeStylistProvider()
          : new OpenAiStylistProvider(config, meter),
    },
  ],
  exports: [StylistService],
})
export class StylistModule {}
