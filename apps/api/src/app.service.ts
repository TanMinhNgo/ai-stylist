import { Injectable } from '@nestjs/common';
import { HealthResponse } from '@stylist/shared';

@Injectable()
export class AppService {
  getHealth(): HealthResponse {
    return HealthResponse.parse({ status: 'ok' });
  }
}
