import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from '../database/database.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ClerkAuthGuard } from './clerk-auth.guard';
import { IdentityProvider } from './identity.provider';
import { ClerkIdentityProvider } from './clerk-identity.provider';
import { UsersRepository } from './users.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    UsersRepository,
    { provide: IdentityProvider, useClass: ClerkIdentityProvider },
    { provide: APP_GUARD, useClass: ClerkAuthGuard },
  ],
})
export class AuthModule {}
