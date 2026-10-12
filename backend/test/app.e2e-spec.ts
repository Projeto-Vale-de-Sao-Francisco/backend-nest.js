import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { DevicesService } from '../src/devices/devices.service.js';
import { ReadingsService } from '../src/readings/readings.service.js';
import { ConfigService } from '@nestjs/config';

describe('API contracts (e2e)', () => {
  let app: INestApplication;
  const devices = {
    findAll: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    updateStatus: vi.fn(),
  };
  const readings = { create: vi.fn(), findAll: vi.fn().mockResolvedValue([]) };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(ConfigService)
      .useValue({
        getOrThrow: () => 'test-jwt-secret',
        get: (key: string) =>
          key === 'DEVICE_API_KEY' ? 'test-key' : undefined,
      })
      .overrideProvider(DevicesService)
      .useValue(devices)
      .overrideProvider(ReadingsService)
      .useValue(readings)
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lista dispositivos na rota registrada', async () => {
    await request(app.getHttpServer()).get('/devices').expect(200).expect([]);
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
    await request(app.getHttpServer()).get(path).expect(400);
  });
  it('rejeita codigo numérico antes do serviço', async () => {
    await request(app.getHttpServer())
      .post('/devices')
      .send({ codigo: 123, modelo: 'TEST', talhaoId: 1 })
      .expect(400);
    expect(devices.create).not.toHaveBeenCalled();
  });
  it('rejeita status ausente antes do serviço', async () => {
    await request(app.getHttpServer())
      .patch('/devices/1/status')
      .send({})
      .expect(400);
    expect(devices.updateStatus).not.toHaveBeenCalled();
  });
  it('rejeita temperatura string antes do serviço', async () => {
    await request(app.getHttpServer())
      .post('/readings')
      .set('x-api-key', 'test-key')
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
  it('encaminha filtros válidos com tipos corretos', async () => {
    await request(app.getHttpServer())
      .get('/readings?sensorId=1&limit=50')
      .expect(200);
    expect(readings.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ sensorId: 1, limit: 50 }),
    );
  });
});
