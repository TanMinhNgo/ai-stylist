import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AffiliateController } from './affiliate.controller';
import { AffiliateService } from './affiliate.service';
import { AffiliateRepository } from './affiliate.repository';
@Module({
  imports: [DatabaseModule],
  providers: [AffiliateService, AffiliateRepository],
  controllers: [AffiliateController],
})
export class AffiliateModule {}
