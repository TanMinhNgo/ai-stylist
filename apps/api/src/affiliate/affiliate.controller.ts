import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import {
  AffiliateProductsQuery,
  PutAffiliateClickRequest,
  ResourceIdParams,
} from '@stylist/shared';
import { CurrentUser } from '../auth/auth.decorators';
import type { User } from '../generated/prisma/client';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AffiliateService } from './affiliate.service';
@Controller('affiliate')
export class AffiliateController {
  constructor(private readonly service: AffiliateService) {}
  @Get('products') products(
    @Query(new ZodValidationPipe(AffiliateProductsQuery))
    query: AffiliateProductsQuery,
  ) {
    return this.service.products(query);
  }
  @Put('clicks/:id') click(
    @CurrentUser() user: User,
    @Param(new ZodValidationPipe(ResourceIdParams)) p: { id: string },
    @Body(new ZodValidationPipe(PutAffiliateClickRequest))
    body: { productId: string },
  ) {
    return this.service.click(user.id, p.id, body.productId);
  }
}
