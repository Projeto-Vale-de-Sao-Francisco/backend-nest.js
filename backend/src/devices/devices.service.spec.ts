import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DevicesService } from './devices.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('DevicesService', () => {
  let service: DevicesService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      talhao: {
        findUnique: vi.fn(),
      },
      dispositivo: {
        findUnique: vi.fn(),
        create: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      sensor: {
        updateMany: vi.fn(),
      },
    };

    service = new DevicesService(prismaMock as unknown as PrismaService);
  });

  describe('create (Requisito 5.1)', () => {
    it('deve lançar erro se o talhão não existir', async () => {
      prismaMock.talhao.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          codigo: 'ESP32-01',
          modelo: 'ESP32',
          talhaoId: 999,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('deve lançar erro se o dispositivo já existir', async () => {
      prismaMock.talhao.findUnique.mockResolvedValue({
        id: 1,
        propriedade_id: 10,
      });
      prismaMock.dispositivo.findUnique.mockResolvedValue({
        id: 1,
        codigo: 'ESP32-01',
      });

      await expect(
        service.create({
          codigo: 'ESP32-01',
          modelo: 'ESP32',
          talhaoId: 1,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve cadastrar dispositivo e criar sensor vinculado com sucesso', async () => {
      prismaMock.talhao.findUnique.mockResolvedValue({
        id: 1,
        propriedade_id: 10,
      });
      prismaMock.dispositivo.findUnique.mockResolvedValue(null);
      prismaMock.dispositivo.create.mockResolvedValue({
        id: 1,
        codigo: 'ESP32-01',
        modelo: 'ESP32',
        status: 'ativo',
        talhao_id: 1,
        sensores: [{ id: 1, tipo: 'temperatura_umidade', status: 'ativo' }],
      });

      const result = await service.create({
        codigo: 'ESP32-01',
        modelo: 'ESP32',
        talhaoId: 1,
        propriedadeId: 10,
      });

      expect(result.id).toBe(1);
      expect(result.codigo).toBe('ESP32-01');
      expect(prismaMock.dispositivo.create).toHaveBeenCalled();
    });
  });

  describe('findAll (Requisito 5.2)', () => {
    it('deve aplicar filtros por propriedade, lote e status', async () => {
      prismaMock.dispositivo.findMany.mockResolvedValue([]);

      await service.findAll({
        propriedadeId: 10,
        talhaoId: 2,
        status: 'ativo',
      });

      expect(prismaMock.dispositivo.findMany).toHaveBeenCalledWith({
        where: {
          status: 'ativo',
          talhao_id: 2,
          talhao: {
            propriedade_id: 10,
          },
        },
        include: {
          talhao: {
            include: {
              propriedade: true,
            },
          },
          sensores: true,
        },
        orderBy: {
          codigo: 'asc',
        },
      });
    });
  });

  describe('updateStatus (Requisito 5.3)', () => {
    it('deve atualizar status do hardware e seus sensores para inativo', async () => {
      prismaMock.dispositivo.findUnique.mockResolvedValue({
        id: 1,
        status: 'ativo',
      });
      prismaMock.sensor.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.dispositivo.update.mockResolvedValue({
        id: 1,
        status: 'inativo',
      });

      const updated = await service.updateStatus(1, 'inativo');

      expect(updated.status).toBe('inativo');
      expect(prismaMock.sensor.updateMany).toHaveBeenCalledWith({
        where: { dispositivo_id: 1 },
        data: { status: 'inativo' },
      });
    });
  });
});
