import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { type App } from 'supertest/types';
import { createTestApp, loginAs } from '../helpers/app.js';

describe('contrato de autenticação', () => {
  let app: INestApplication<App>;

  beforeAll(async () => { app = await createTestApp(); });
  afterAll(async () => { await app.close(); });

  it('expõe login e identidade no contrato em português', async () => {
    const auth = await loginAs(app, 'admin@sivale.com.br');
    const me = await request(app.getHttpServer()).get('/auth/me').set(auth).expect(200);
    expect(me.body).toMatchObject({ email: 'admin@sivale.com.br', perfil: 'ADMINISTRADOR' });
    expect(me.body).not.toHaveProperty('senha');
  });

  it('revoga a sessão no logout', async () => {
    const auth = await loginAs(app, 'admin@sivale.com.br');
    await request(app.getHttpServer()).post('/auth/logout').set(auth).expect(204);
    await request(app.getHttpServer()).get('/auth/me').set(auth).expect(401);
  });

  it('não publica o contrato alternativo em inglês', async () => {
    const auth = await loginAs(app, 'admin@sivale.com.br');
    await request(app.getHttpServer()).get('/users').set(auth).expect(404);
  });
});
