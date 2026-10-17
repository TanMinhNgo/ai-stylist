import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { EmptyRequest } from '@stylist/shared';
import { CurrentUser, Public } from '../auth/auth.decorators';
import type { User } from '../generated/prisma/client';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { RateLimitGuard } from './rate-limit.guard';
import { BillingService } from './billing.service';
@Controller()
export class BillingController {
  constructor(private readonly billing: BillingService) {}
  @Get('billing/session')
  @Header('Cache-Control', 'private, no-store')
  session(@CurrentUser() user: User) {
    return this.billing.session(user);
  }
  @Post('billing/sync')
  @HttpCode(200)
  @UseGuards(RateLimitGuard)
  sync(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(EmptyRequest)) body: object,
  ) {
    void body;
    return this.billing.sync(user);
  }
  @Public()
  @Post('webhooks/revenuecat')
  @HttpCode(200)
  webhook(@Req() request: RawBodyRequest<Request>) {
    return this.billing.webhook(
      request.rawBody,
      request.get('x-revenuecat-webhook-signature'),
      request.body,
    );
  }
}
