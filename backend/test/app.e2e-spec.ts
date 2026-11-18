import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { DevicesService } from '../src/devices/devices.service.js';
import { ReadingsService } from '../src/readings/readings.service.js';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

describe('API contracts (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  const devices = {
    findAll: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    updateStatus: vi.fn(),
  };
  const readings = { create: vi.fn(), findAll: vi.fn().mockResolvedValue([]) };
  const prismaMock = {
    dispositivo_Credencial: { findUnique: vi.fn() },
    usuario: {
      findUnique: vi.fn().mockResolvedValue({
        id: 1,
        nome: 'Test Admin',
        email: 'admin@example.test',
        tipo: 'ADMIN',
        status: 'ATIVO',
        tokenVersion: 0,
      }),
    },
    dispositivo: {
      findUnique: vi.fn().mockResolvedValue({
        id: 1,
        codigo: 'DEVICE-01',
        status: 'ativo',
      }),
    },
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(ConfigService)
      .useValue({
        get: (key: string, defaultValue?: unknown) =>
          ({
            DEVICE_API_KEY: 'test-legacy-key-with-at-least-32-characters',
            DEVICE_API_KEY_LEGACY_ENABLED: 'true',
            DEVICE_API_KEY_LEGACY_DEVICE_ID: '1',
          })[key] ?? defaultValue,
        getOrThrow: () => 'test-jwt-secret',
      })
      .overrideProvider(DevicesService)
      .useValue(devices)
      .overrideProvider(ReadingsService)
      .useValue(readings)
      .compile();
    app = module.createNestApplication();
    await app.init();
    accessToken = await app.get(JwtService).signAsync({
      sub: 1,
      email: 'admin@example.test',
      tipo: 'ADMIN',
      tokenVersion: 0,
    });
  });
  afterAll(async () => {
    if (app) await app.close();
  });
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const withAuth = (testRequest: request.Test) =>
    testRequest.set('Authorization', `Bearer ${accessToken}`);

  it('lista dispositivos na rota registrada', async () => {
    await withAuth(request(app.getHttpServer()).get('/devices'))
      .expect(200)
      .expect([]);
  });
  it.each([
    ['/devices?talhaoId=abc'],
    ['/devices?propriedadeId=0'],
    ['/readings?limit=abc'],
    ['/readings?limit=1.5'],
    ['/readings?sensorId=abc'],
    ['/readings?dataInicio=invalida'],
    ['/alerts?visualizado=banana'],
    ['/alerts?talhaoId=-1'],
    ['/readings?dataInicio=2026-10-12&dataFim=2026-10-11'],
  ])('rejeita query inválida %s', async (path) => {
    await withAuth(request(app.getHttpServer()).get(path)).expect(400);
  });
  it('rejeita codigo numérico antes do serviço', async () => {
    await withAuth(request(app.getHttpServer()).post('/devices'))
      .send({ codigo: 123, modelo: 'TEST', talhaoId: 1 })
      .expect(400);
    expect(devices.create).not.toHaveBeenCalled();
  });
  it('rejeita status ausente antes do serviço', async () => {
    await withAuth(request(app.getHttpServer()).patch('/devices/1/status'))
      .send({})
      .expect(400);
    expect(devices.updateStatus).not.toHaveBeenCalled();
  });
  it('rejeita temperatura string antes do serviço', async () => {
    await request(app.getHttpServer())
      .post('/readings')
      .set('x-api-key', 'test-legacy-key-with-at-least-32-characters')
      .send({ sensorId: 1, temperatura: '25', umidade: 60 })
      .expect(400);
    expect(readings.create).not.toHaveBeenCalled();
  });
  it('exige autenticação', async () => {
    await request(app.getHttpServer())
      .post('/readings')
      .send({ sensorId: 1, temperatura: 25, umidade: 60 })
      .expect(401);
  });
  it('autentica JWT pelo cookie de sessão', async () => {
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', `sivale_session=${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: 1,
          tipo: 'ADMIN',
          email: 'admin@example.test',
        });
      });
  });
  it('exige POST e validação numérica para mutações ThingSpeak', async () => {
    await withAuth(
      request(app.getHttpServer()).get(
        '/thingspeak/enviar?temperatura=25&umidade=60',
      ),
    ).expect(404);
    await withAuth(request(app.getHttpServer()).post('/thingspeak/enviar'))
      .send({ temperatura: '25', umidade: 60 })
      .expect(400);
  });
  it('encaminha filtros válidos com tipos corretos', async () => {
    await withAuth(
      request(app.getHttpServer()).get('/readings?sensorId=1&limit=50'),
    )
      .expect(200);
    expect(readings.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ sensorId: 1, limit: 50 }),
      expect.objectContaining({ id: 1, tipo: 'ADMIN' }),
    );
  });
});
