import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { Request } from 'express';
import type { User } from '../generated/prisma/client';

export const PUBLIC_ROUTE = 'publicRoute';
export const Public = () => SetMetadata(PUBLIC_ROUTE, true);
export const ALLOW_DELETED_USER = 'allowDeletedUser';
export const AllowDeletedUser = () => SetMetadata(ALLOW_DELETED_USER, true);
export type UserRequest = Request & { user: User; requestId?: string };
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): User =>
    context.switchToHttp().getRequest<UserRequest>().user,
);
