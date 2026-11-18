import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AlertsService } from './alerts.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';

describe('AlertsService', () => {
  let service: AlertsService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      usuario_Propriedade: { findMany: vi.fn() },
      medicao: {
        findUnique: vi.fn(),
      },
      sensor: {
        findUnique: vi.fn(),
      },
      alerta: {
        create: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      audit_Log: { create: vi.fn().mockResolvedValue(undefined) },
    };
    prismaMock.$transaction = vi.fn(async (callback) => callback(prismaMock));

    service = new AlertsService(
      prismaMock as unknown as PrismaService,
      new AuditService(prismaMock as unknown as PrismaService),
    );
  });

  describe('checkAndCreateAlerts (Requisitos 9.1, 9.2, 9.5)', () => {
    it('deve gerar alerta quando a temperatura ultrapassar a máxima da cultura', async () => {
      prismaMock.medicao.findUnique.mockResolvedValue({
        id: 100,
        temperatura: 38.5,
        umidade: 50,
        data_hora: new Date(),
      });

      prismaMock.sensor.findUnique.mockResolvedValue({
        id: 1,
        dispositivo: {
          talhao: {
            nome: 'Talhão de Uvas',
            culturas: [
              {
                cultura: {
                  nome: 'Uva Niágara',
                  temperatura_min: 15,
                  temperatura_max: 32,
                  umidade_min: 40,
                  umidade_max: 80,
                },
              },
            ],
          },
        },
      });

      // Sem alerta recente
      prismaMock.alerta.findFirst.mockResolvedValue(null);
      prismaMock.alerta.create.mockResolvedValue({
        id: 1,
        tipo: 'TEMPERATURA_ALTA',
        nivel: 'CRITICO',
        titulo: 'Temperatura acima do recomendado',
        descricao: 'Temperatura de 38.5°C acima do limite máximo...',
      });

      const alertas = await service.checkAndCreateAlerts(
        100,
        1,
        '203.0.113.8',
      );

      expect(alertas.length).toBe(1);
      expect(prismaMock.alerta.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tipo: 'TEMPERATURA_ALTA',
            nivel: 'CRITICO',
            status: 'ativo',
          }),
        }),
      );
      expect(prismaMock.audit_Log.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            acao: 'GERAR',
            recurso: 'ALERTA',
            ip_origem: '203.0.113.8',
          }),
        }),
      );
    });

    it('deve evitar alerta repetido em sequência para o mesmo sensor (Requisito 9.5)', async () => {
      prismaMock.medicao.findUnique.mockResolvedValue({
        id: 101,
        temperatura: 39,
        umidade: 50,
        data_hora: new Date(),
      });

      prismaMock.sensor.findUnique.mockResolvedValue({
        id: 1,
        dispositivo: {
          talhao: {
            nome: 'Talhão de Uvas',
            culturas: [
              {
                cultura: {
                  nome: 'Uva Niágara',
                  temperatura_max: 32,
                },
              },
            ],
          },
        },
      });

      // Já existe alerta recente emitido
      prismaMock.alerta.findFirst.mockResolvedValue({
        id: 50,
        tipo: 'TEMPERATURA_ALTA',
        status: 'ativo',
      });

      const alertas = await service.checkAndCreateAlerts(101, 1);

      expect(alertas.length).toBe(0);
      expect(prismaMock.alerta.create).not.toHaveBeenCalled();
    });
  });

  describe('resolve e markAsViewed (Requisito 9.4)', () => {
    it('deve resolver o alerta com sucesso', async () => {
      prismaMock.alerta.findFirst.mockResolvedValue({ id: 1 });
      prismaMock.alerta.update.mockResolvedValue({
        id: 1,
        status: 'resolvido',
        visualizado: true,
      });

      const result = await service.resolve(1, { id: 1, tipo: 'ADMIN' });
      expect(result.status).toBe('resolvido');
      expect(result.visualizado).toBe(true);
      expect(prismaMock.audit_Log.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            acao: 'RESOLVER',
            recurso: 'ALERTA',
            recurso_id: '1',
          }),
        }),
      );
    });

    it('filtra alertas pelas propriedades ativas do usuário', async () => {
      prismaMock.usuario_Propriedade.findMany.mockResolvedValue([
        { propriedade_id: 12, status: 'ativo' },
      ]);

      await service.findAll({}, { id: 21, tipo: 'COMUM' });

      expect(prismaMock.alerta.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            medicao: {
              sensor: {
                dispositivo: {
                  talhao: { propriedade_id: { in: [12] } },
                },
              },
            },
          },
        }),
      );
    });

    it('não permite alterar alerta de propriedade sem vínculo', async () => {
      prismaMock.usuario_Propriedade.findMany.mockResolvedValue([
        { propriedade_id: 12, status: 'ativo' },
      ]);
      prismaMock.alerta.findFirst.mockResolvedValue(null);

      await expect(
        service.resolve(400, { id: 21, tipo: 'COMUM' }),
      ).rejects.toThrow();
      expect(prismaMock.alerta.update).not.toHaveBeenCalled();
    });
  });
});
