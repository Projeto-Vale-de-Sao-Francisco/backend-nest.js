import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { type App } from 'supertest/types';
import { AppModule } from '../../src/app.module.js';
import { configurar } from '../../src/main.js';

export async function createTestApp(): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  configurar(app);
  await app.init();
  return app;
}

export async function loginAs(app: INestApplication<App>, email: string) {
  const response = await request(app.getHttpServer()).post('/auth/login').send({ email, senha: '123456' }).expect(200);
  return { Authorization: `Bearer ${response.body.token as string}` };
}
