import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Response, NextFunction } from 'express';
import type { UserRequest } from '../auth/auth.decorators';

@Injectable()
export class RequestLogMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestLogMiddleware.name);

  use(request: UserRequest, response: Response, next: NextFunction) {
    const supplied = request.get('x-request-id');
    const requestId =
      supplied && /^[a-zA-Z0-9_-]{1,64}$/.test(supplied)
        ? supplied
        : randomUUID();
    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);
    const start = Date.now();
    response.on('finish', () =>
      this.logger.log({
        event: 'http_request',
        requestId,
        method: request.method,
        status: response.statusCode,
        durationMs: Date.now() - start,
      }),
    );
    next();
  }
}
