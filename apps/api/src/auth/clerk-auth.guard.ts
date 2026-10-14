import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';
import {
  PUBLIC_ROUTE,
  ALLOW_DELETED_USER,
  UserRequest,
} from './auth.decorators';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const request = context.switchToHttp().getRequest<UserRequest>();
    const match = request.headers.authorization?.match(/^Bearer ([^\s]+)$/i);
    if (!match) throw new UnauthorizedException();
    request.user = await this.auth.currentUser(
      match[1],
      this.reflector.getAllAndOverride<boolean>(ALLOW_DELETED_USER, [
        context.getHandler(),
        context.getClass(),
      ]) === true,
    );
    return true;
  }
}
