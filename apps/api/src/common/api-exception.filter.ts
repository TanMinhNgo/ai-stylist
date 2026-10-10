import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { ApiError, ErrorCode } from '@stylist/shared';
import type { Response } from 'express';

const errors: Record<number, { code: ErrorCode; message: string }> = {
  400: { code: 'VALIDATION_ERROR', message: 'Invalid request data' },
  401: { code: 'UNAUTHORIZED', message: 'Authentication required' },
  403: { code: 'FORBIDDEN', message: 'Access denied' },
  404: { code: 'NOT_FOUND', message: 'Resource not found' },
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;
    let body: ApiError;
    if (status >= 500) {
      this.logger.error('Unhandled API error');
      body = { code: 'INTERNAL_ERROR', message: 'Internal server error' };
    } else {
      const parsed = ApiError.safeParse(
        exception instanceof HttpException
          ? exception.getResponse()
          : undefined,
      );
      body = parsed.success
        ? parsed.data
        : (errors[status] ?? {
            code: 'VALIDATION_ERROR',
            message: 'Request rejected',
          });
    }
    host.switchToHttp().getResponse<Response>().status(status).json(body);
  }
}
