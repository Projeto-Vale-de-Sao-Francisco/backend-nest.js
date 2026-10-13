import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, loginAs } from './helpers/app.js';

// Requer o banco do .env migrado e com seed (npx prisma migrate deploy && npx prisma db seed).
describe('API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET / informa que a API está online (rota pública)', () =>
    request(app.getHttpServer()).get('/').expect(200).expect({ servico: 'SIVALE API', status: 'online', versao: '2.0.0' }));

  it('GET /propriedades sem token => 401', () => request(app.getHttpServer()).get('/propriedades').expect(401));

  it('login com credenciais inválidas => 401', () =>
    request(app.getHttpServer()).post('/auth/login').send({ email: 'admin@sivale.com.br', senha: 'errada' }).expect(401));

  it('rejeita campos desconhecidos no corpo => 400', () =>
    request(app.getHttpServer()).post('/auth/login').send({ email: 'a@b.com', senha: 'x', extra: 1 }).expect(400));

  it('ingest sem chave de dispositivo => 401', () =>
    request(app.getHttpServer()).post('/ingest/medicoes').send({ temperatura: 25, umidade: 50 }).expect(401));

  it('fluxo: admin lista propriedades e o dispositivo grava leitura com a própria chave', async () => {
    const auth = await loginAs(app, 'admin@sivale.com.br');
    const props = await request(app.getHttpServer()).get('/propriedades').set(auth).expect(200);
    expect(props.body.length).toBeGreaterThan(0);

    const disp = await request(app.getHttpServer()).get('/dispositivos').set(auth).expect(200);
    const chave = await request(app.getHttpServer()).post(`/dispositivos/${disp.body[0].id}/chave`).set(auth).expect(201);

    const m = await request(app.getHttpServer())
      .post('/ingest/medicoes')
      .set('x-device-key', chave.body.chaveApi)
      .send({ temperatura: 27, umidade: 50 })
      .expect(201);
    expect(m.body.temperatura).toBe(27);
  });

  it('nenhum perfil registra leitura manualmente (POST /medicoes não existe)', async () => {
    const auth = await loginAs(app, 'admin@sivale.com.br');
    await request(app.getHttpServer()).post('/medicoes').set(auth).send({ temperatura: 27, umidade: 50 }).expect(404);
  });

  it('agricultor consulta mas não cadastra (403) e não acessa usuários', async () => {
    const auth = await loginAs(app, 'carlos@sivale.com.br');
    await request(app.getHttpServer()).get('/propriedades').set(auth).expect(200);
    await request(app.getHttpServer()).post('/propriedades').set(auth).send({ nome: 'X', localizacao: 'Y' }).expect(403);
    await request(app.getHttpServer()).get('/usuarios').set(auth).expect(403);
  });
});
