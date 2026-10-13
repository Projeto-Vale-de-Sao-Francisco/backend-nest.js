import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

export function configurar(app: INestApplication) {
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableCors({ origin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',') });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configurar(app);

  const documento = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('SIVALE API')
      .setDescription('Monitoramento climático e logístico da fruticultura do Vale do São Francisco')
      .setVersion('2.0.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('docs', app, documento);

  await app.listen(process.env.PORT ?? 3333);
}

// Nao inicia o servidor quando importado pelos testes e2e.
if (!process.env.VITEST) bootstrap();
