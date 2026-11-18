import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DevicesService } from './devices.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';

describe('DevicesService', () => {
  let service: DevicesService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      usuario_Propriedade: { findMany: vi.fn() },
      talhao: {
        findUnique: vi.fn(),
      },
      dispositivo: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      sensor: {
        updateMany: vi.fn(),
      },
      dispositivo_Credencial: {
        upsert: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      audit_Log: { create: vi.fn().mockResolvedValue(undefined) },
    };

    prismaMock.$transaction = vi.fn(async (callback) => callback(prismaMock));

    service = new DevicesService(
      prismaMock as unknown as PrismaService,
      new AuditService(prismaMock as unknown as PrismaService),
    );
  });

  describe('create (Requisito 5.1)', () => {
    it('deve lançar erro se o talhão não existir', async () => {
      prismaMock.talhao.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          codigo: 'ESP32-01',
          modelo: 'ESP32',
          talhaoId: 999,
        }, { id: 7, tipo: 'ADMIN' }),
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
        }, { id: 7, tipo: 'ADMIN' }),
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
      }, { id: 7, tipo: 'ADMIN' });

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
      }, { id: 7, tipo: 'ADMIN' });

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

  it('limita consultas comuns às propriedades vinculadas, mesmo com filtro externo', async () => {
    prismaMock.usuario_Propriedade.findMany.mockResolvedValue([
      { propriedade_id: 10, status: 'ativo' },
    ]);
    prismaMock.dispositivo.findMany.mockResolvedValue([]);

    await service.findAll(
      { propriedadeId: 99 },
      { id: 21, tipo: 'COMUM' },
    );

    expect(prismaMock.dispositivo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { talhao: { propriedade_id: { in: [] } } },
      }),
    );
  });

  it('não permite criar dispositivo em propriedade sem vínculo ativo', async () => {
    prismaMock.talhao.findUnique.mockResolvedValue({
      id: 1,
      propriedade_id: 99,
    });
    prismaMock.usuario_Propriedade.findMany.mockResolvedValue([
      { propriedade_id: 10, status: 'ativo' },
    ]);

    await expect(
      service.create(
        { codigo: 'ESP32-02', modelo: 'ESP32', talhaoId: 1 },
        { id: 21, tipo: 'COMUM' },
      ),
    ).rejects.toThrow(NotFoundException);
    expect(prismaMock.dispositivo.create).not.toHaveBeenCalled();
  });

  it('não retorna dispositivo pertencente a outra propriedade', async () => {
    prismaMock.usuario_Propriedade.findMany.mockResolvedValue([
      { propriedade_id: 10, status: 'ativo' },
    ]);
    prismaMock.dispositivo.findFirst.mockResolvedValue(null);

    await expect(
      service.findOne(70, { id: 21, tipo: 'COMUM' }),
    ).rejects.toThrow(NotFoundException);
    expect(prismaMock.dispositivo.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 70,
          talhao: { propriedade_id: { in: [10] } },
        },
      }),
    );
  });

  it('emite token uma única vez e persiste somente seu hash', async () => {
    prismaMock.dispositivo.findUnique.mockResolvedValue({ id: 8 });

    const result = await service.rotateCredential(8, 7, '192.0.2.1');

    expect(result.token).toHaveLength(43);
    expect(result).not.toHaveProperty('token_hash');
    const upsert = prismaMock.dispositivo_Credencial.upsert.mock.calls[0][0];
    expect(upsert.create.token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(upsert.create.token_hash).not.toBe(result.token);
  });

  it('revoga a credencial ativa sem expor seu valor', async () => {
    prismaMock.dispositivo.findUnique.mockResolvedValue({ id: 8 });

    await expect(service.revokeCredential(8, 7)).resolves.toEqual({
      dispositivoId: 8,
      revogada: true,
    });
    expect(prismaMock.dispositivo_Credencial.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { dispositivo_id: 8, revoked_at: null },
        data: { revoked_at: expect.any(Date) },
      }),
    );
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

      const updated = await service.updateStatus(1, 'inativo', 7);

      expect(updated.status).toBe('inativo');
      expect(prismaMock.sensor.updateMany).toHaveBeenCalledWith({
        where: { dispositivo_id: 1 },
        data: { status: 'inativo' },
      });
    });
  });
});
