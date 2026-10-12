import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { DashboardService } from './dashboard.service.js';
import { HistoricoFiltrosDto } from './dto/dashboard-filtros.dto.js';

const cultura = {
  id: 1,
  nome: 'Uva Vitória',
  variedade: 'Sem semente',
  temperatura_min: 18,
  temperatura_max: 32,
  umidade_min: 40,
  umidade_max: 80,
  ciclo_medio_dias: 110,
  descricao: null,
};

const leitura = {
  id: 10,
  sensor_id: 5,
  data_hora: new Date('2026-10-12T15:00:00Z'),
  temperatura: 35,
  umidade: 60,
  sensor: {
    id: 5,
    tipo: 'temperatura_umidade',
    unidade_medida: '°C, %',
    status: 'ativo',
    dispositivo: {
      id: 7,
      codigo: 'DEV-01',
      status: 'ativo',
      talhao: {
        id: 2,
        nome: 'Lote 2',
        propriedade_id: 1,
        propriedade: { id: 1, nome: 'Fazenda' },
        culturas: [
          {
            id: 3,
            talhao_id: 2,
            cultura_id: 1,
            data_plantio: new Date('2026-01-01'),
            status: 'ativo',
            cultura,
          },
        ],
      },
    },
  },
};

describe('DashboardService', () => {
  let db: {
    medicao: {
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      aggregate: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    sensor: { count: ReturnType<typeof vi.fn> };
  };
  let service: DashboardService;

  beforeEach(() => {
    db = {
      medicao: {
        findFirst: vi.fn().mockResolvedValue(leitura),
        findMany: vi.fn().mockResolvedValue([leitura]),
        aggregate: vi.fn().mockResolvedValue({
          _avg: { temperatura: 29.5, umidade: 61.2 },
        }),
        count: vi.fn().mockResolvedValue(1),
      },
      sensor: { count: vi.fn().mockResolvedValue(2) },
    };
    service = new DashboardService(db as unknown as PrismaService);
  });

  it('resume leitura atual, médias, sensores ativos e comparação climática', async () => {
    const resultado = await service.resumo({
      propriedade_id: 1,
      talhao_id: 2,
      cultura_id: 1,
      data_inicio: '2026-10-01',
      data_fim: '2026-10-12',
    });
    expect(resultado).toMatchObject({
      medias: { temperatura: 29.5, umidade: 61.2 },
      sensores_ativos: 2,
      total_leituras: 1,
      atual: {
        temperatura: 35,
        comparacao: {
          disponivel: true,
          status: 'fora_da_faixa',
          temperatura: { status: 'acima' },
          umidade: { status: 'dentro' },
        },
      },
    });
    expect(db.medicao.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ data_hora: 'desc' }, { id: 'desc' }],
      }),
    );
  });

  it('responde adequadamente quando não existem medições', async () => {
    db.medicao.findFirst.mockResolvedValueOnce(null);
    db.medicao.aggregate.mockResolvedValueOnce({
      _avg: { temperatura: null, umidade: null },
    });
    db.medicao.count.mockResolvedValueOnce(0);
    const resultado = await service.resumo({});
    expect(resultado.atual).toBeNull();
    expect(resultado.ultima_comunicacao).toBeNull();
    expect(resultado.medias).toEqual({ temperatura: null, umidade: null });
    expect(resultado.mensagem).toContain('Nenhuma medição');
  });

  it('retorna histórico cronológico paginado e sinaliza parâmetros ausentes', async () => {
    const semParametros = {
      ...leitura,
      sensor: {
        ...leitura.sensor,
        dispositivo: {
          ...leitura.sensor.dispositivo,
          talhao: {
            ...leitura.sensor.dispositivo.talhao,
            culturas: [
              {
                ...leitura.sensor.dispositivo.talhao.culturas[0],
                cultura: {
                  ...cultura,
                  temperatura_min: null,
                  temperatura_max: null,
                  umidade_min: null,
                  umidade_max: null,
                },
              },
            ],
          },
        },
      },
    };
    db.medicao.findMany.mockResolvedValueOnce([semParametros]);
    db.medicao.count.mockResolvedValueOnce(3);
    const resultado = await service.historico({ page: 2, limit: 2 });
    expect(resultado.meta).toEqual({
      page: 2,
      limit: 2,
      total: 3,
      totalPages: 2,
    });
    expect(resultado.data[0].comparacao).toMatchObject({
      disponivel: false,
      status: 'indisponivel',
    });
    expect(db.medicao.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 2,
        take: 2,
        orderBy: [{ data_hora: 'asc' }, { id: 'asc' }],
      }),
    );
  });

  it('rejeita período invertido e limite acima do máximo', async () => {
    await expect(
      service.resumo({
        data_inicio: '2026-10-13',
        data_fim: '2026-10-12',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    const pipe = new ValidationPipe({ transform: true });
    await expect(
      pipe.transform(
        { limit: '501' },
        { type: 'query', metatype: HistoricoFiltrosDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
