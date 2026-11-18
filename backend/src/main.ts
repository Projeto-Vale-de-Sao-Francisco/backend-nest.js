import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module.js';
import { hasAllowedSessionOrigin } from './common/session-origin.js';

async function bootstrap() {
  const positiveInteger = (
    name: string,
    fallback: number,
    maximum: number,
  ): number => {
    const raw = process.env[name];
    const value = raw === undefined ? fallback : Number(raw);
    if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
      throw new Error(`${name} deve ser um inteiro entre 1 e ${maximum}`);
    }
    return value;
  };
  const jwtSecret = process.env.JWT_SECRET;
  const deviceApiKey = process.env.DEVICE_API_KEY;
  const legacyDeviceAuthEnabled =
    process.env.DEVICE_API_KEY_LEGACY_ENABLED === 'true';
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET deve conter pelo menos 32 caracteres');
  }
  if (
    legacyDeviceAuthEnabled &&
    (!deviceApiKey || deviceApiKey.length < 32)
  ) {
    throw new Error('DEVICE_API_KEY deve conter pelo menos 32 caracteres');
  }
  if (legacyDeviceAuthEnabled) {
    positiveInteger('DEVICE_API_KEY_LEGACY_DEVICE_ID', 0, 2_147_483_647);
  }
  positiveInteger('LOGIN_RATE_MAX_ATTEMPTS', 5, 100);
  positiveInteger('LOGIN_RATE_WINDOW_MS', 900_000, 86_400_000);
  positiveInteger('LOGIN_RATE_BLOCK_MS', 900_000, 86_400_000);

  const app = await NestFactory.create(AppModule);
  const trustedProxyHops = Number.parseInt(
    process.env.TRUST_PROXY_HOPS ?? '0',
    10,
  );
  if (
    !Number.isInteger(trustedProxyHops) ||
    trustedProxyHops < 0 ||
    trustedProxyHops > 5
  ) {
    throw new Error('TRUST_PROXY_HOPS deve ser um inteiro entre 0 e 5');
  }
  app.getHttpAdapter().getInstance().set('trust proxy', trustedProxyHops);

  const configuredOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => {
      const url = new URL(origin);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') ||
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
  const allowedOrigins = new Set([
    ...configuredOrigins,
    ...developmentOrigins,
  ]);
  app.enableCors({
    origin: [...allowedOrigins],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'X-API-Key',
      'X-Device-Token',
    ],
    credentials: true,
  });
  app.use((request: Request, response: Response, next: NextFunction) => {
    if (!hasAllowedSessionOrigin(request, allowedOrigins)) {
      response.status(403).json({ message: 'Origem não autorizada.' });
      return;
    }

    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    );
    if (process.env.NODE_ENV === 'production') {
      response.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains',
      );
    }
    next();
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
