import {
  BadRequestException,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PATH_METADATA, GUARDS_METADATA } from '@nestjs/common/constants';
import { ROLES_KEY } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { MercadoController } from '../mercado/mercado.controller.js';
import { LogisticaController } from './logistica.controller.js';
import { LogisticaService } from './logistica.service.js';
import { CreateLogisticaDto } from './dto/create-logistica.dto.js';
import { UpdateLogisticaDto } from './dto/update-logistica.dto.js';
import { ListLogisticaDto } from './dto/list-logistica.dto.js';

const dto = {
  empresa_id: 1,
  colheita_id: 2,
  origem: 'Petrolina',
  destino: 'Recife',
  modal: 'rodoviario',
  status: 'planejada',
  custo_estimado: 1000,
  tempo_estimado_horas: 8,
  data_prevista: '2026-11-01',
} satisfies CreateLogisticaDto;
function mockDb() {
  return {
    empresa: { findUnique: vi.fn().mockResolvedValue({ id: 1 }) },
    colheita: {
      findUnique: vi.fn().mockResolvedValue({
        id: 2,
        talhao_cultura: {
          data_plantio: new Date('2026-01-01'),
          talhao: { propriedade: { empresa_id: 1 } },
        },
      }),
    },
    operacao_Logistica: {
      create: vi.fn().mockResolvedValue({ id: 1, ...dto }),
      update: vi.fn().mockResolvedValue({ id: 1, ...dto }),
      findUnique: vi.fn().mockResolvedValue({
        id: 1,
        ...dto,
        data_prevista: new Date('2026-11-01'),
      }),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      aggregate: vi.fn().mockResolvedValue({
        _count: { _all: 0 },
        _sum: { custo_estimado: null },
        _avg: { tempo_estimado_horas: null },
      }),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    $transaction: vi.fn(),
  };
}
let db: ReturnType<typeof mockDb>;
let service: LogisticaService;
beforeEach(() => {
  db = mockDb();
  db.$transaction.mockImplementation((callback: (tx: typeof db) => unknown) =>
    callback(db),
  );
  service = new LogisticaService(db as unknown as PrismaService);
});

describe('Logística', () => {
  it('cria transacionalmente após conferir empresa da colheita', async () => {
    expect(await service.create(dto)).toMatchObject({ id: 1 });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.operacao_Logistica.create.mock.calls[0][0].data).toMatchObject({
      empresa_id: 1,
      colheita_id: 2,
      data_prevista: new Date('2026-11-01'),
    });
  });
  it('rejeita colheita de outra empresa no POST e PATCH', async () => {
    await expect(
      service.create({ ...dto, empresa_id: 3 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.update(1, { empresa_id: 3 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(db.operacao_Logistica.create).not.toHaveBeenCalled();
    expect(db.operacao_Logistica.update).not.toHaveBeenCalled();
  });
  it('rejeita referência ausente e data anterior ao plantio', async () => {
    db.empresa.findUnique.mockResolvedValueOnce(null);
    await expect(service.create(dto)).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.create({ ...dto, data_prevista: '2025-01-01' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('edita somente campos enviados e permite limpar opcionais', async () => {
    await service.update(1, { status: 'em_transporte', transportadora: null });
    expect(db.operacao_Logistica.update.mock.calls[0][0].data).toEqual({
      status: 'em_transporte',
      transportadora: null,
    });
    await expect(service.update(1, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
  it('retorna 404 ao consultar ou editar id ausente', async () => {
    db.operacao_Logistica.findUnique.mockResolvedValue(null);
    await expect(service.findOne(999)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.update(999, { status: 'cancelada' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
  it('filtra e pagina por empresa, colheita, destino, modal, status e período', async () => {
    const resultado = await service.findAll({
      empresa_id: 1,
      colheita_id: 2,
      destino: 'rec',
      modal: 'rodoviario',
      status: 'planejada',
      data_inicio: '2026-10-01',
      data_fim: '2026-11-01',
      page: 2,
      limit: 10,
    });
    expect(resultado.meta).toMatchObject({ page: 2, limit: 10, total: 0 });
    expect(db.operacao_Logistica.findMany.mock.calls[0][0]).toMatchObject({
      skip: 10,
      take: 10,
      where: {
        empresa_id: 1,
        colheita_id: 2,
        status: 'planejada',
        destino: { contains: 'rec', mode: 'insensitive' },
        data_prevista: { lte: new Date('2026-11-01T23:59:59.999Z') },
      },
    });
  });
  it('resumo respeita filtros e não depende de paginação', async () => {
    db.operacao_Logistica.aggregate.mockResolvedValueOnce({
      _count: { _all: 2 },
      _sum: { custo_estimado: 1000 },
      _avg: { tempo_estimado_horas: 8 },
    });
    db.operacao_Logistica.groupBy.mockResolvedValueOnce([
      { status: 'planejada', _count: { _all: 2 } },
    ]);
    expect(await service.resumo({ empresa_id: 1 })).toEqual({
      quantidade_operacoes: 2,
      por_status: [{ status: 'planejada', quantidade: 2 }],
      custo_estimado_total: 1000,
      tempo_medio_horas: 8,
    });
    expect(db.operacao_Logistica.aggregate.mock.calls[0][0].where).toEqual({
      empresa_id: 1,
    });
  });
  it('resumo vazio e intervalo invertido', async () => {
    expect(await service.resumo({})).toMatchObject({
      quantidade_operacoes: 0,
      custo_estimado_total: 0,
      tempo_medio_horas: null,
    });
    await expect(
      service.resumo({ data_inicio: '2026-12-01', data_fim: '2026-01-01' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('Contratos e guards E7', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  it.each([
    { custo_estimado: -1 },
    { tempo_estimado_horas: -1 },
    { status: 'qualquer' },
    { empresa_id: 0 },
    { data_prevista: 'inválida' },
    { segredo: 'extra' },
  ])('rejeita cadastro inválido: %j', async (alteracao) => {
    await expect(
      pipe.transform(
        { ...dto, ...alteracao },
        { type: 'body', metatype: CreateLogisticaDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('PATCH rejeita null nos campos obrigatórios e normaliza status', async () => {
    await expect(
      pipe.transform(
        { status: null },
        { type: 'body', metatype: UpdateLogisticaDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(
      await pipe.transform(
        { status: 'EM_TRANSPORTE' },
        { type: 'body', metatype: UpdateLogisticaDto },
      ),
    ).toMatchObject({ status: 'em_transporte' });
  });
  it('limita paginação', async () => {
    await expect(
      pipe.transform(
        { limit: '101' },
        { type: 'query', metatype: ListLogisticaDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('JWT nas consultas, ADMIN nas escritas e resumo antes de id', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, LogisticaController)).toContain(
      JwtAuthGuard,
    );
    for (const [controller, metodo] of [
      [LogisticaController, 'create'],
      [LogisticaController, 'update'],
      [MercadoController, 'update'],
    ] as const)
      expect(
        Reflect.getMetadata(
          ROLES_KEY,
          Object.getOwnPropertyDescriptor(controller.prototype, metodo)!.value,
        ),
      ).toEqual(['ADMIN']);
    for (const controller of [LogisticaController, MercadoController]) {
      expect(
        Reflect.getMetadata(
          PATH_METADATA,
          Object.getOwnPropertyDescriptor(controller.prototype, 'resumo')!
            .value,
        ),
      ).toBe('resumo');
      const nomes = Object.getOwnPropertyNames(controller.prototype);
      expect(nomes.indexOf('resumo')).toBeLessThan(nomes.indexOf('findOne'));
    }
  });
});
