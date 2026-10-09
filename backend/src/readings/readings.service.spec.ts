import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReadingsService } from './readings.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AlertsService } from '../alerts/alerts.service.js';

describe('ReadingsService', () => {
  let service: ReadingsService;
  let prismaMock: any;
  let alertsServiceMock: any;

  beforeEach(() => {
    prismaMock = {
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
    };

    alertsServiceMock = {
      checkAndCreateAlerts: vi.fn().mockResolvedValue([]),
    };

    service = new ReadingsService(
      prismaMock as unknown as PrismaService,
      alertsServiceMock as unknown as AlertsService,
    );
  });

  describe('create (Requisitos 6.1, 6.2, 6.7)', () => {
    it('deve rejeitar temperaturas implausíveis com mensagem clara (Requisito 6.2)', async () => {
      await expect(
        service.create({
          sensorId: 1,
          temperatura: 150, // Implausível
          umidade: 50,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve rejeitar umidade implausível com mensagem clara (Requisito 6.2)', async () => {
      await expect(
        service.create({
          sensorId: 1,
          temperatura: 25,
          umidade: 120, // > 100%
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve rejeitar se o sensor estiver inativo (Requisito 6.2)', async () => {
      prismaMock.sensor.findUnique.mockResolvedValue({
        id: 1,
        status: 'inativo',
        dispositivo: { status: 'inativo' },
      });

      await expect(
        service.create({
          sensorId: 1,
          temperatura: 25,
          umidade: 60,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve registrar leitura válida e acionar verificação de alertas (Requisito 6.1, 9.1)', async () => {
      prismaMock.sensor.findUnique.mockResolvedValue({
        id: 1,
        status: 'ativo',
        dispositivo: { status: 'ativo' },
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
      });

      expect(response.sucesso).toBe(true);
      expect(prismaMock.medicao.create).toHaveBeenCalled();
      expect(alertsServiceMock.checkAndCreateAlerts).toHaveBeenCalledWith(1, 1);
    });
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

      const result = await service.findLatestReadings();

      expect(result.length).toBe(1);
      expect(result[0].ultimaLeitura?.temperatura).toBe(26);
    });
  });
});
