import { NestFactory } from '@nestjs/core';
import { ConsoleLogger } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

if (existsSync('.env')) loadEnvFile('.env');

async function bootstrap() {
  // Resolve the HTTP driver from the API workspace when npm hoists Nest core separately.
  const app = await NestFactory.create(AppModule, new ExpressAdapter(), {
    rawBody: true,
    abortOnError: false,
    logger: new ConsoleLogger({ json: true }),
  });
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer from 1 to 65535');
  }
  const origins = process.env.CORS_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (origins?.length) app.enableCors({ origin: origins });
  app.enableShutdownHooks();
  try {
    await app.listen(port, '0.0.0.0');
  } catch {
    await app.close();
    throw new Error('API initialization failed');
  }
}
void bootstrap().catch(() => {
  console.error(
    'API startup failed. Check configuration and port availability.',
  );
  process.exitCode = 1;
});
