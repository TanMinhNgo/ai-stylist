import { AiMeter } from '../usage/ai-meter.service';
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from '../database/database.module';
import { QueueModule } from '../queue/queue.module';
import { MediaModule } from '../media/media.module';
import { RuntimeConfig } from '../config/runtime-config';
import { TryOnProvider } from './try-on.provider';
import { OpenAiTryOnProvider } from './openai-try-on.provider';
import { FakeTryOnProvider } from './fake-try-on.provider';
import { TryOnRepository } from './try-on.repository';
import { TryOnService } from './try-on.service';
import { TryOnController } from './try-on.controller';
import { TryOnProcessor } from './try-on.processor';
import { StylistModule } from '../stylist/stylist.module';

@Module({
  imports: [
    DatabaseModule,
    QueueModule,
    MediaModule,
    StylistModule,
    BullModule.registerQueue({ name: 'try-on', prefix: 'stylist' }),
  ],
  controllers: [TryOnController],
  providers: [
    TryOnRepository,
    TryOnService,
    TryOnProcessor,
    {
      provide: TryOnProvider,
      inject: [RuntimeConfig, AiMeter],
      useFactory: (config: RuntimeConfig, meter: AiMeter) =>
        config.values.TRYON_PROVIDER === 'fake'
          ? new FakeTryOnProvider()
          : new OpenAiTryOnProvider(config, meter),
    },
  ],
})
export class TryOnModule {}
