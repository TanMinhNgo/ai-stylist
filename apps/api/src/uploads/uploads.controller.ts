import { Controller, Get } from '@nestjs/common';
import type { User } from '../generated/prisma/client';
import { CurrentUser } from '../auth/auth.decorators';
import { MediaService } from '../media/media.service';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly media: MediaService) {}
  @Get('auth')
  authentication(@CurrentUser() user: User) {
    return this.media.uploadAuth(user.id);
  }
}
