import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from '../database/database.module';
import { QueueModule } from '../queue/queue.module';
import { ImageStorageModule } from '../uploads/image-storage.module';
import { PrivacyService } from './privacy.service';
import { PrivacyProcessor } from './privacy.processor';
import { AccountSource, ClerkAccountSource } from './account-source';
@Module({
  imports: [
    DatabaseModule,
    QueueModule,
    ImageStorageModule,
    BullModule.registerQueue({ name: 'privacy', prefix: 'stylist' }),
  ],
  providers: [
    PrivacyService,
    PrivacyProcessor,
    { provide: AccountSource, useClass: ClerkAccountSource },
  ],
  exports: [PrivacyService],
})
export class PrivacyModule {}
