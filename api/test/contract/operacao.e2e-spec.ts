import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { type App } from 'supertest/types';
import { createTestApp, loginAs } from '../helpers/app.js';

describe('contrato operacional', () => {
  let app: INestApplication<App>;
  beforeAll(async () => { app = await createTestApp(); });
  afterAll(async () => { await app.close(); });

  it.each(['/dispositivos', '/medicoes', '/alertas', '/mercado', '/logistica', '/dashboard/resumo', '/dashboard/historico'])(
    'GET %s responde pelo contrato oficial',
    async (path) => {
      const auth = await loginAs(app, 'admin@sivale.com.br');
      await request(app.getHttpServer()).get(path).set(auth).expect(200);
    },
  );

  it.each(['/devices', '/readings', '/alerts'])(
    'GET %s não publica contrato alternativo em inglês',
    async (path) => {
      const auth = await loginAs(app, 'admin@sivale.com.br');
      await request(app.getHttpServer()).get(path).set(auth).expect(404);
    },
  );

  it('não expõe o hash da chave do dispositivo', async () => {
    const auth = await loginAs(app, 'admin@sivale.com.br');
    const lista = await request(app.getHttpServer()).get('/dispositivos').set(auth).expect(200);
    expect(lista.body[0]).not.toHaveProperty('chaveApiHash');
    const detalhe = await request(app.getHttpServer()).get(`/dispositivos/${lista.body[0].id}`).set(auth).expect(200);
    expect(detalhe.body).not.toHaveProperty('chaveApiHash');
  });
});
