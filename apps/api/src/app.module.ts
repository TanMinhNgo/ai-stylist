import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { APP_FILTER } from '@nestjs/core';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { RuntimeConfigModule } from './config/runtime-config';
import { AuthModule } from './auth/auth.module';
import { QueueModule } from './queue/queue.module';
import { RequestLogMiddleware } from './common/request-log.middleware';
import { MediaModule } from './media/media.module';
import { TryOnModule } from './try-on/try-on.module';
import { UsageModule } from './usage/usage.module';

@Module({
  imports: [
    RuntimeConfigModule,
    UsageModule,
    AuthModule,
    QueueModule,
    MediaModule,
    TryOnModule,
  ],
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
