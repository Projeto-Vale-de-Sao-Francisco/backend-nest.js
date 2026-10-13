import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { type App } from 'supertest/types';
import { createTestApp, loginAs } from '../helpers/app.js';

describe('contrato de cadastros', () => {
  let app: INestApplication<App>;
  beforeAll(async () => { app = await createTestApp(); });
  afterAll(async () => { await app.close(); });

  it.each(['/usuarios', '/empresas', '/propriedades', '/culturas', '/talhoes'])(
    'GET %s devolve uma coleção para o administrador',
    async (path) => {
      const auth = await loginAs(app, 'admin@sivale.com.br');
      const response = await request(app.getHttpServer()).get(path).set(auth).expect(200);
      expect(Array.isArray(response.body)).toBe(true);
    },
  );

  it('agricultor não acessa o cadastro de usuários', async () => {
    const auth = await loginAs(app, 'carlos@sivale.com.br');
    await request(app.getHttpServer()).get('/usuarios').set(auth).expect(403);
  });

  it('aplica o escopo de propriedades de cada perfil', async () => {
    const admin = await loginAs(app, 'admin@sivale.com.br');
    const gestor = await loginAs(app, 'gestor@sivale.com.br');
    const tecnico = await loginAs(app, 'tecnico@sivale.com.br');
    const agricultor = await loginAs(app, 'carlos@sivale.com.br');

    const todas = await request(app.getHttpServer()).get('/propriedades').set(admin).expect(200);
    const daEmpresa = await request(app.getHttpServer()).get('/propriedades').set(gestor).expect(200);
    const daTecnica = await request(app.getHttpServer()).get('/propriedades').set(tecnico).expect(200);
    const doAgricultor = await request(app.getHttpServer()).get('/propriedades').set(agricultor).expect(200);

    expect(todas.body).toHaveLength(2);
    expect(daEmpresa.body).toHaveLength(2);
    expect(daTecnica.body).toHaveLength(1);
    expect(doAgricultor.body).toHaveLength(1);

    const propriedadeAlheia = todas.body.find((p: { id: number }) => p.id !== doAgricultor.body[0].id);
    await request(app.getHttpServer()).get(`/propriedades/${propriedadeAlheia.id}`).set(agricultor).expect(404);
  });

  it('rejeita com 400 um talhão que ultrapassa a área da propriedade', async () => {
    const auth = await loginAs(app, 'admin@sivale.com.br');
    const propriedades = await request(app.getHttpServer()).get('/propriedades').set(auth).expect(200);
    await request(app.getHttpServer())
      .post('/talhoes')
      .set(auth)
      .send({ propriedadeId: propriedades.body[0].id, nome: 'Área impossível', area: 999999 })
      .expect(400);
  });
});
