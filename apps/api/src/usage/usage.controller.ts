import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../auth/auth.decorators';
import type { User } from '../generated/prisma/client';
import { UsageService } from './usage.service';
@Controller('usage')
export class UsageController {
  constructor(private readonly usage: UsageService) {}
  @Get() get(@CurrentUser() user: User) {
    return this.usage.get(user.id);
  }
}
