import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PipelineService } from './pipeline.service.js';

describe('PipelineService', () => {
  let service: PipelineService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      pipeline_Execucao: {
        create: vi.fn().mockResolvedValue({ id: 1 }),
        update: vi.fn().mockResolvedValue({ id: 1 }),
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(null),
      },
      pipeline_Problema: {
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    service = new PipelineService(prismaMock as any);
  });

  it('identifica valores ausentes e descarta quando não há histórico suficiente', () => {
    const result = service.processRecords([
      {
        source: 'sensor',
        sensorId: 7,
        variable: 'temperatura',
        value: null,
        timestamp: '2026-11-11T10:00:00',
      },
    ]);

    expect(result.totalDiscarded).toBeGreaterThanOrEqual(1);
    expect(result.records[0].status).toBe('discarded');
  });

  it('preenche automaticamente por interpolação temporal com dados do mesmo sensor', () => {
    const result = service.processRecords([
      {
        source: 'sensor',
        sensorId: 7,
        variable: 'temperatura',
        value: 20,
        timestamp: '2026-11-11T09:00:00',
      },
      {
        source: 'sensor',
        sensorId: 7,
        variable: 'temperatura',
        value: null,
        timestamp: '2026-11-11T10:00:00',
      },
      {
        source: 'sensor',
        sensorId: 7,
        variable: 'temperatura',
        value: 40,
        timestamp: '2026-11-11T11:00:00',
      },
    ]);

    const filled = result.records.find((record) => record.value === 30);
    expect(filled).toBeDefined();
    expect(filled?.status).toBe('filled');
  });

  it('remove duplicidades com a mesma chave e preserva registros legítimos diferentes', () => {
    const result = service.processRecords([
      {
        source: 'sensor',
        sensorId: 2,
        variable: 'umidade',
        value: 60,
        timestamp: '2026-11-11T09:00:00',
      },
      {
        source: 'sensor',
        sensorId: 2,
        variable: 'umidade',
        value: 60,
        timestamp: '2026-11-11T09:00:00',
      },
      {
        source: 'sensor',
        sensorId: 3,
        variable: 'umidade',
        value: 55,
        timestamp: '2026-11-11T09:00:00',
      },
    ]);

    expect(result.totalDuplicatesRemoved).toBeGreaterThanOrEqual(1);
    expect(result.records.length).toBe(2);
  });

  it('identifica e classifica valores inválidos e outliers', () => {
    const result = service.processRecords([
      {
        source: 'sensor',
        sensorId: 4,
        variable: 'temperatura',
        value: 500,
        timestamp: '2026-11-11T12:00:00',
      },
      {
        source: 'sensor',
        sensorId: 5,
        variable: 'precipitacao',
        value: 2500,
        timestamp: '2026-11-11T13:00:00',
      },
    ]);

    expect(result.records.some((record) => record.status === 'invalid')).toBe(true);
    expect(result.records.some((record) => record.status === 'suspect')).toBe(true);
  });

  it('padroniza datas para UTC e converte moedas para o código normalizado', () => {
    const result = service.processRecords([
      {
        source: 'mercado',
        market: 'São Paulo',
        crop: 'uva',
        variable: 'preco',
        value: 10,
        currency: 'usd',
        timestamp: '2026-11-11T11:00:00',
      },
    ]);

    expect(result.records[0].normalizedTimestamp).toContain('Z');
    expect(result.records[0].currency).toBe('USD');
  });

  it('executa persistência de relatório e status final da execução', async () => {
    const response = await service.execute({
      source: 'sensor',
      records: [{
        source: 'sensor',
        sensorId: 8,
        variable: 'temperatura',
        value: 25,
        timestamp: '2026-11-11T09:00:00',
      }],
    });

    expect(response.status).toBe('success');
    expect(prismaMock.pipeline_Execucao.create).toHaveBeenCalled();
    expect(prismaMock.pipeline_Execucao.update).toHaveBeenCalled();
  });
});
