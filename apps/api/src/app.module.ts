import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { APP_FILTER } from '@nestjs/core';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { RuntimeConfigModule } from './config/runtime-config';
import { AuthModule } from './auth/auth.module';
import { QueueModule } from './queue/queue.module';
import { RequestLogMiddleware } from './common/request-log.middleware';

@Module({
  imports: [RuntimeConfigModule, AuthModule, QueueModule],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLogMiddleware).forRoutes('*');
  }
}
