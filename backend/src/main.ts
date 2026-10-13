import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  if (!process.env.JWT_SECRET) {
    throw new Error('A variável de ambiente JWT_SECRET é obrigatória');
  }

  const app = await NestFactory.create(AppModule);
  const configuredOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => {
      const url = new URL(origin);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.pathname !== '/' ||
        url.search ||
        url.hash
      ) {
        throw new Error('CORS_ORIGINS deve conter apenas origens HTTP ou HTTPS');
      }
      return url.origin;
    });
  const developmentOrigins =
    process.env.NODE_ENV === 'production'
      ? []
      : [
          'http://localhost:3000',
          'http://localhost:5173',
          'http://localhost:5174',
        ];
  app.enableCors({
    origin: [...new Set([...configuredOrigins, ...developmentOrigins])],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    credentials: false,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
