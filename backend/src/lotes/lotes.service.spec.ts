import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { LotesService } from './lotes.service.js';

const propriedade = { id: 1, area_total: 10 };
const detalhe = {
  id: 10,
  propriedade_id: 1,
  nome: 'Lote MVP',
  area: 3,
  status: 'ativo',
  culturas: [],
};

describe('LotesService', () => {
  let tx: {
    propriedade: { findUnique: ReturnType<typeof vi.fn> };
    cultura: { findUnique: ReturnType<typeof vi.fn> };
    talhao: {
      findFirst: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      aggregate: ReturnType<typeof vi.fn>;
    };
    talhao_Cultura: {
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    colheita: {
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };
  let db: { $transaction: ReturnType<typeof vi.fn>; talhao: object };
  let service: LotesService;

  beforeEach(() => {
    tx = {
      propriedade: { findUnique: vi.fn().mockResolvedValue(propriedade) },
      cultura: { findUnique: vi.fn().mockResolvedValue({ id: 2 }) },
      talhao: {
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(detalhe),
        create: vi.fn().mockResolvedValue({ id: 10 }),
        update: vi.fn(),
        aggregate: vi.fn().mockResolvedValue({ _sum: { area: 2 } }),
      },
      talhao_Cultura: {
        create: vi.fn().mockResolvedValue({ id: 20 }),
        update: vi.fn(),
      },
      colheita: { create: vi.fn(), update: vi.fn() },
    };
    db = {
      $transaction: vi
        .fn()
        .mockImplementation((callback: (client: typeof tx) => unknown) =>
          callback(tx),
        ),
      talhao: {},
    };
    service = new LotesService(db as unknown as PrismaService);
  });

  it('cadastra lote, plantio e previsão na mesma transação', async () => {
    const resultado = await service.create({
      nome: 'Lote MVP',
      propriedade_id: 1,
      cultura_id: 2,
      area: 3,
      data_plantio: '2026-10-01',
      previsao_colheita: '2027-01-15',
      situacao: 'ativo',
    });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.talhao.create).toHaveBeenCalledTimes(1);
    expect(tx.talhao_Cultura.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ talhao_id: 10, cultura_id: 2 }),
    });
    expect(tx.colheita.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        talhao_cultura_id: 20,
        status: 'PLANEJADA',
      }),
    });
    expect(resultado).toEqual(detalhe);
  });

  it('rejeita soma de áreas superior à área total', async () => {
    tx.talhao.aggregate.mockResolvedValueOnce({ _sum: { area: 8 } });
    await expect(
      service.create({
        nome: 'Excesso',
        propriedade_id: 1,
        cultura_id: 2,
        area: 3,
        data_plantio: '2026-10-01',
        situacao: 'ativo',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.talhao.create).not.toHaveBeenCalled();
  });

  it('rejeita previsão anterior ao plantio antes de abrir transação', async () => {
    expect(() =>
      service.create({
        nome: 'Datas inválidas',
        propriedade_id: 1,
        cultura_id: 2,
        area: 1,
        data_plantio: '2026-10-10',
        previsao_colheita: '2026-10-01',
        situacao: 'ativo',
      }),
    ).toThrow(BadRequestException);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('não permite substituir a cultura de plantio existente', async () => {
    tx.talhao.findUnique.mockResolvedValueOnce({
      ...detalhe,
      culturas: [
        {
          id: 20,
          cultura_id: 2,
          data_plantio: new Date('2026-10-01T00:00:00Z'),
          status: 'ativo',
          colheitas: [],
        },
      ],
    });
    await expect(service.update(10, { cultura_id: 3 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tx.talhao.update).not.toHaveBeenCalled();
  });
});
