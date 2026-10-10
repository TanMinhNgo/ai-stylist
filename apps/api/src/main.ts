import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

if (existsSync('.env')) loadEnvFile('.env');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer from 1 to 65535');
  }
  const origins = process.env.CORS_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (origins?.length) app.enableCors({ origin: origins });
  app.enableShutdownHooks();
  await app.listen(port, '0.0.0.0');
}
void bootstrap().catch(() => {
  console.error(
    'API startup failed. Check configuration and port availability.',
  );
  process.exitCode = 1;
});
