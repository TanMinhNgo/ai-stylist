import { Test } from '@nestjs/testing';
import {
  Body,
  Controller,
  Get,
  HttpException,
  INestApplication,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiError, HealthResponse } from '@stylist/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ZodValidationPipe } from '../src/common/zod-validation.pipe';

// Test-only routes exercise production validation and error handling over HTTP.
@Controller('probe')
class ProbeController {
  @Post()
  validate(@Body(new ZodValidationPipe(HealthResponse)) body: HealthResponse) {
    return body;
  }
  @Get('unauthorized')
  unauthorized() {
    throw new UnauthorizedException('private token');
  }
  @Get('crash')
  crash() {
    throw new Error('private database URL');
  }
  @Get('internal')
  internal() {
    throw new HttpException(
      { code: 'INTERNAL_ERROR', message: 'private key', details: 'secret' },
      503,
    );
  }
}

describe('API foundation (HTTP)', () => {
  let app: INestApplication<App>;
  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProbeController],
    }).compile();
    app = fixture.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });

  it('GET /health follows the shared contract', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);
    expect(HealthResponse.parse(response.body)).toEqual({ status: 'ok' });
  });
  it('unknown routes do not echo URLs in errors', async () => {
    const response = await request(app.getHttpServer())
      .get('/missing?secret=private')
      .expect(404);
    expect(ApiError.parse(response.body)).toEqual({
      code: 'NOT_FOUND',
      message: 'Resource not found',
    });
  });
  it('validates data without exposing submitted values', async () => {
    await request(app.getHttpServer())
      .post('/probe')
      .send({ status: 'ok' })
      .expect(201, { status: 'ok' });
    const response = await request(app.getHttpServer())
      .post('/probe')
      .send({ status: 'private' })
      .expect(400);
    const error = ApiError.parse(response.body);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details).toEqual([
      { path: ['status'], code: 'invalid_value' },
    ]);
    expect(JSON.stringify(error)).not.toContain('private');
  });
  it('malformed JSON follows the error contract', async () => {
    const response = await request(app.getHttpServer())
      .post('/probe')
      .set('Content-Type', 'application/json')
      .send('{')
      .expect(400);
    expect(ApiError.parse(response.body).code).toBe('VALIDATION_ERROR');
  });
  it('authentication errors retain status and hide raw messages', async () => {
    const response = await request(app.getHttpServer())
      .get('/probe/unauthorized')
      .expect(401);
    expect(ApiError.parse(response.body)).toEqual({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    });
  });
  it.each([
    ['/probe/crash', 500],
    ['/probe/internal', 503],
  ])('server errors hide secrets at %s', async (path, status) => {
    const response = await request(app.getHttpServer())
      .get(path)
      .expect(status);
    expect(ApiError.parse(response.body)).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
  });
});
