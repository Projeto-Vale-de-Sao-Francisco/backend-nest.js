import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReadingsService } from './readings.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AlertsService } from '../alerts/alerts.service.js';
import { AuditService } from '../audit/audit.service.js';

describe('ReadingsService', () => {
  let service: ReadingsService;
  let prismaMock: any;
  let alertsServiceMock: any;

  beforeEach(() => {
    prismaMock = {
      usuario_Propriedade: { findMany: vi.fn() },
      sensor: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
      },
      dispositivo: {
        findUnique: vi.fn(),
      },
      medicao: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      audit_Log: { create: vi.fn().mockResolvedValue(undefined) },
    };
    prismaMock.$transaction = vi.fn(
      async (callback: (tx: typeof prismaMock) => unknown) =>
        callback(prismaMock),
    );

    alertsServiceMock = {
      checkAndCreateAlerts: vi.fn().mockResolvedValue([]),
    };

    service = new ReadingsService(
      prismaMock as unknown as PrismaService,
      alertsServiceMock as unknown as AlertsService,
      new AuditService(prismaMock as unknown as PrismaService),
    );
  });

  describe('create (Requisitos 6.1, 6.2, 6.7)', () => {
    it('deve rejeitar temperaturas implausíveis com mensagem clara (Requisito 6.2)', async () => {
      await expect(
        service.create({
          sensorId: 1,
          temperatura: 150, // Implausível
          umidade: 50,
        }, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve rejeitar umidade implausível com mensagem clara (Requisito 6.2)', async () => {
      await expect(
        service.create({
          sensorId: 1,
          temperatura: 25,
          umidade: 120, // > 100%
        }, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve rejeitar se o sensor estiver inativo (Requisito 6.2)', async () => {
      prismaMock.dispositivo.findUnique.mockResolvedValue({
        id: 1,
        status: 'inativo',
        codigo: 'DEV-01',
        sensores: [{ id: 1, status: 'ativo', unidade_medida: '°C, %' }],
      });

      await expect(
        service.create({
          sensorId: 1,
          temperatura: 25,
          umidade: 60,
        }, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve registrar leitura válida e acionar verificação de alertas (Requisito 6.1, 9.1)', async () => {
      prismaMock.dispositivo.findUnique.mockResolvedValue({
        id: 1,
        codigo: 'DEV-01',
        status: 'ativo',
        talhao: { nome: 'Talhão 1' },
        sensores: [{ id: 1, status: 'ativo', unidade_medida: '°C, %' }],
      });

      prismaMock.medicao.create.mockResolvedValue({
        id: 1,
        sensor_id: 1,
        temperatura: 28.5,
        umidade: 62,
        umidade_solo: 50,
        data_hora: new Date(),
      });

      const response = await service.create({
        sensorId: 1,
        temperatura: 28.5,
        umidade: 62,
        umidadeSolo: 50,
      }, 1);

      expect(response.sucesso).toBe(true);
      expect(prismaMock.medicao.create).toHaveBeenCalled();
      expect(alertsServiceMock.checkAndCreateAlerts).toHaveBeenCalledWith(
        1,
        1,
        undefined,
      );
    });
  });

  it('rejeita dispositivo inativo mesmo com sensor ativo', async () => {
    prismaMock.dispositivo.findUnique.mockResolvedValue({
      id: 1,
      codigo: 'DEV-01',
      status: 'inativo',
      sensores: [{ id: 1, status: 'ativo', unidade_medida: '°C, %' }],
    });
    await expect(
      service.create({ sensorId: 1, temperatura: 25, umidade: 60 }, 1),
    ).rejects.toThrow(BadRequestException);
    expect(prismaMock.medicao.create).not.toHaveBeenCalled();
  });

  it('não cria sensor substituto quando os sensores estão inativos', async () => {
    prismaMock.dispositivo.findUnique.mockResolvedValue({
      id: 1,
      codigo: 'TEST',
      status: 'ativo',
      sensores: [{ id: 1, status: 'inativo', unidade_medida: '°C, %' }],
    });
    await expect(
      service.create({
        codigoDispositivo: 'TEST',
        temperatura: 25,
        umidade: 60,
      }, 1),
    ).rejects.toThrow(BadRequestException);
    expect(prismaMock.sensor.create).not.toHaveBeenCalled();
    expect(prismaMock.medicao.create).not.toHaveBeenCalled();
  });

  it('persiste pressão atmosférica', async () => {
    prismaMock.dispositivo.findUnique.mockResolvedValue({
      id: 1,
      codigo: 'DEV-01',
      status: 'ativo',
      sensores: [{ id: 1, status: 'ativo', unidade_medida: '°C, %' }],
    });
    prismaMock.medicao.create.mockResolvedValue({ id: 1 });
    await service.create({
      sensorId: 1,
      temperatura: 25,
      umidade: 60,
      pressao: 1013,
    }, 1);
    expect(prismaMock.medicao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pressao: 1013 }),
      }),
    );
  });

  it('dispositivo autenticado não pode gravar leitura em sensor de outro dispositivo', async () => {
    prismaMock.dispositivo.findUnique.mockResolvedValue({
      id: 1,
      codigo: 'DEV-01',
      status: 'ativo',
      sensores: [{ id: 1, status: 'ativo', unidade_medida: '°C, %' }],
    });

    await expect(
      service.create(
        {
          sensorId: 2,
          temperatura: 25,
          umidade: 60,
        },
        1,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(prismaMock.medicao.create).not.toHaveBeenCalled();
  });

  describe('findLatestReadings (Requisito 6.5)', () => {
    it('deve retornar sensores associados à sua última medição', async () => {
      prismaMock.sensor.findMany.mockResolvedValue([
        {
          id: 1,
          tipo: 'temperatura_umidade',
          unidade_medida: '°C, %',
          status: 'ativo',
          dispositivo: { codigo: 'DEV-01' },
          medicoes: [{ id: 10, temperatura: 26, umidade: 70 }],
        },
      ]);

      const result = await service.findLatestReadings({ id: 1, tipo: 'ADMIN' });

      expect(result.length).toBe(1);
      expect(result[0].ultimaLeitura?.temperatura).toBe(26);
    });

    it('escopa o histórico à propriedade vinculada e não confia em sensorId isolado', async () => {
      prismaMock.usuario_Propriedade.findMany.mockResolvedValue([
        { propriedade_id: 12, status: 'ATIVO' },
      ]);
      prismaMock.medicao.findMany.mockResolvedValue([]);

      await service.findAll(
        { sensorId: 900 },
        { id: 21, tipo: 'COMUM' },
      );

      expect(prismaMock.medicao.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            sensor_id: 900,
            sensor: {
              dispositivo: {
                talhao: { propriedade_id: { in: [12] } },
              },
            },
          }),
        }),
      );
    });

    it('restringe leituras mais recentes a sensores das propriedades autorizadas', async () => {
      prismaMock.usuario_Propriedade.findMany.mockResolvedValue([
        { propriedade_id: 12, status: 'ativo' },
      ]);
      prismaMock.sensor.findMany.mockResolvedValue([]);

      await service.findLatestReadings({ id: 21, tipo: 'COMUM' });

      expect(prismaMock.sensor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            dispositivo: {
              talhao: { propriedade_id: { in: [12] } },
            },
          },
        }),
      );
    });
  });
});
