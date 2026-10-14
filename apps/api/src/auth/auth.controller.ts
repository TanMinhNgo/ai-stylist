import {
  Controller,
  Get,
  Delete,
  HttpCode,
  Post,
  Req,
  BadRequestException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import type { MeResponse } from '@stylist/shared';
import type { User } from '../generated/prisma/client';
import { AuthService } from './auth.service';
import { CurrentUser, Public, AllowDeletedUser } from './auth.decorators';
import { PrivacyService } from '../privacy/privacy.service';

@Controller()
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly privacy: PrivacyService,
  ) {}

  @Delete('me')
  @AllowDeletedUser()
  @HttpCode(202)
  remove(@CurrentUser() user: User) {
    return this.privacy.request(user.id);
  }

  @Get('me/deletion')
  @AllowDeletedUser()
  deletion(@CurrentUser() user: User) {
    return this.privacy.status(user.id);
  }

  @Get('me')
  me(@CurrentUser() user: User): MeResponse {
    return this.auth.me(user);
  }

  @Public()
  @Post('webhooks/clerk')
  @HttpCode(200)
  webhook(@Req() request: RawBodyRequest<ExpressRequest>) {
    if (!request.rawBody) throw new BadRequestException();
    const headers = new Headers();
    for (const name of ['svix-id', 'svix-timestamp', 'svix-signature']) {
      const value = request.get(name);
      if (value) headers.set(name, value);
    }
    return this.auth.webhook(
      new Request('http://localhost/webhooks/clerk', {
        method: 'POST',
        headers,
        body: request.rawBody.toString('utf8'),
      }),
    );
  }
}
