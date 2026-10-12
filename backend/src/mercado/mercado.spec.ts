import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AtualizarMercadoDto } from './dto/atualizar-mercado.dto.js';
import { CreateValorMercadoDto } from './dto/create-valor-mercado.dto.js';
import { ListValorMercadoDto } from './dto/list-valor-mercado.dto.js';
import { UpdateValorMercadoDto } from './dto/update-valor-mercado.dto.js';
import type {
  FonteMercado,
  RegistroMercado,
} from './fontes/fonte-mercado.interface.js';
import { ErroFonte } from './fontes/http-seguro.service.js';
import { MercadoFontesService } from './fontes/mercado-fontes.service.js';
import type { PtaxService } from './fontes/ptax.service.js';
import { MercadoController } from './mercado.controller.js';
import { MercadoService } from './mercado.service.js';

const cultura = { id: 1, nome: 'Manga' };
const valor = {
  id: 1,
  cultura_id: 1,
  cultura,
  mercado_destino: 'Argentina',
  pais_destino: 'Argentina',
  preco: new Prisma.Decimal('2.1234567890123456789'),
  moeda: 'USD',
  unidade_medida: 'kg',
  data_referencia: new Date('2026-08-01'),
  demanda_estimada: 100,
};
const registro: RegistroMercado = {
  mercadoDestino: 'Argentina',
  paisDestino: 'Argentina',
  preco: '2',
  moeda: 'USD',
  unidadeMedida: 'kg',
  dataReferencia: new Date('2026-08-01'),
  demandaEstimada: 100,
};
const dto = {
  cultura_id: 1,
  mercado_destino: 'Argentina',
  pais_destino: 'Argentina',
  preco: '2.1234567890123456789',
  moeda: 'USD',
  unidade_medida: 'kg',
  data_referencia: '2026-08-01',
} satisfies CreateValorMercadoDto;
const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});
const validar = (
  body: unknown,
  metatype: new () => object,
  type: 'body' | 'query' = 'body',
) => pipe.transform(body, { type, metatype });
let db: {
  cultura: { findUnique: ReturnType<typeof vi.fn> };
  valor_Mercado: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};
let fonte: FonteMercado;
let fontes: MercadoFontesService;
let ptax: { cotacaoAtual: ReturnType<typeof vi.fn> };
let service: MercadoService;
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('Rede proibida no teste');
    }),
  );
  db = {
    cultura: { findUnique: vi.fn().mockResolvedValue(cultura) },
    valor_Mercado: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(valor),
      update: vi.fn().mockResolvedValue(valor),
      findMany: vi.fn().mockResolvedValue([valor]),
      count: vi.fn().mockResolvedValue(1),
      findUnique: vi.fn().mockResolvedValue(valor),
    },
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation((callback: (tx: typeof db) => unknown) =>
    callback(db),
  );
  fonte = {
    id: 'comexstat',
    nome: 'Fonte',
    suporta: (c) => c.nome === 'Manga',
    buscar: vi.fn().mockResolvedValue([registro]),
  };
  fontes = new MercadoFontesService(new ConfigService(), [fonte]);
  ptax = {
    cotacaoAtual: vi.fn().mockResolvedValue({
      usd_brl: 5,
      data: '2026-10-09 13:00:00',
      fonte: 'BCB PTAX',
    }),
  };
  service = new MercadoService(
    db as unknown as PrismaService,
    fontes,
    ptax as unknown as PtaxService,
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Edição e resumo de mercado', () => {
  it('edita preço e verifica chave lógica excluindo o próprio id', async () => {
    db.valor_Mercado.update.mockResolvedValueOnce({
      ...valor,
      preco: new Prisma.Decimal('2.5'),
    });
    expect(await service.update(1, { preco: '2.5' })).toMatchObject({
      preco: '2.5',
    });
    expect(db.valor_Mercado.findFirst).toHaveBeenCalledWith({
      where: {
        cultura_id: 1,
        mercado_destino: 'Argentina',
        data_referencia: valor.data_referencia,
        NOT: { id: 1 },
      },
    });
    const chamada = db.valor_Mercado.update.mock.calls[0][0];
    expect(Object.keys(chamada.data)).toEqual(['preco']);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it('rejeita duplicidade e id inexistente sem atualizar', async () => {
    db.valor_Mercado.findFirst.mockResolvedValueOnce({ id: 2 });
    await expect(
      service.update(1, { mercado_destino: 'Chile' }),
    ).rejects.toBeInstanceOf(ConflictException);
    db.valor_Mercado.findUnique.mockResolvedValueOnce(null);
    await expect(service.update(999, { preco: '2' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(db.valor_Mercado.update).not.toHaveBeenCalled();
  });

  it('rejeita cultura inexistente e PATCH vazio', async () => {
    db.cultura.findUnique.mockResolvedValueOnce(null);
    await expect(service.update(1, { cultura_id: 999 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.update(1, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(db.valor_Mercado.update).not.toHaveBeenCalled();
  });

  it.each([
    { preco: '-1' },
    { preco: null },
    { moeda: null },
    { cultura_id: 0 },
    { origem: 'externa' },
  ])('valida PATCH parcial: %j', async (body) => {
    await expect(validar(body, UpdateValorMercadoDto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('calcula média por registro sem misturar culturas, moedas ou unidades', async () => {
    db.valor_Mercado.findMany.mockResolvedValueOnce([
      { ...valor, preco: new Prisma.Decimal(2) },
      {
        ...valor,
        id: 2,
        mercado_destino: 'Chile',
        preco: new Prisma.Decimal(4),
        data_referencia: new Date('2026-09-01'),
      },
      { ...valor, id: 3, moeda: 'BRL', preco: new Prisma.Decimal(10) },
      {
        ...valor,
        id: 4,
        unidade_medida: 'ton',
        preco: new Prisma.Decimal(2000),
      },
      {
        ...valor,
        id: 5,
        cultura_id: 2,
        cultura: { id: 2, nome: 'Uva' },
        preco: new Prisma.Decimal(8),
      },
    ]);
    const resultado = await service.resumo({
      cultura_id: 1,
      data_fim: '2026-09-30',
    });
    expect(resultado).toMatchObject({
      quantidade_registros: 5,
      quantidade_destinos: 2,
      periodo_disponivel: {
        inicio: new Date('2026-08-01'),
        fim: new Date('2026-09-01'),
      },
    });
    expect(resultado.grupos).toHaveLength(4);
    expect(resultado.grupos[0]).toMatchObject({
      moeda: 'USD',
      unidade_medida: 'kg',
      preco_minimo: '2',
      preco_medio: '3',
      preco_maximo: '4',
    });
    expect(db.valor_Mercado.findMany.mock.calls[0][0].where).toMatchObject({
      cultura_id: 1,
      data_referencia: { lte: new Date('2026-09-30T23:59:59.999Z') },
    });
    expect(ptax.cotacaoAtual).not.toHaveBeenCalled();
  });

  it('resumo vazio e período inválido são tratados', async () => {
    db.valor_Mercado.findMany.mockResolvedValueOnce([]);
    expect(await service.resumo({})).toEqual({
      quantidade_registros: 0,
      quantidade_destinos: 0,
      periodo_disponivel: { inicio: null, fim: null },
      grupos: [],
    });
    await expect(
      service.resumo({ data_inicio: '2026-10-12', data_fim: '2026-01-01' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('Cadastro e listagem', () => {
  it('cadastra em transação e serializa Decimal como string sem perder precisão', async () => {
    expect((await service.create(dto)).preco).toBe('2.1234567890123456789');
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });
  it('cultura inexistente retorna 404 antes de gravar', async () => {
    db.cultura.findUnique.mockResolvedValue(null);
    await expect(service.create(dto)).rejects.toBeInstanceOf(NotFoundException);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('duplicidade lógica retorna 409', async () => {
    db.valor_Mercado.findFirst.mockResolvedValue(valor);
    await expect(service.create(dto)).rejects.toBeInstanceOf(ConflictException);
    expect(db.valor_Mercado.create).not.toHaveBeenCalled();
  });
  it.each([
    ['P2002', ConflictException],
    ['P2003', BadRequestException],
    ['P2025', NotFoundException],
  ] as const)('converte %s e não revela Prisma', async (code, exception) => {
    db.valor_Mercado.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('segredo interno', {
        code,
        clientVersion: '7',
      }),
    );
    await expect(service.create(dto)).rejects.toBeInstanceOf(exception);
    await expect(service.create(dto)).rejects.not.toThrow('segredo');
  });
  it('lista com paginação, destino parcial e período inclusivo', async () => {
    const filtros = Object.assign(new ListValorMercadoDto(), {
      cultura_id: 1,
      mercado_destino: 'ARG',
      data_inicio: '2026-08-01',
      data_fim: '2026-08-31',
      page: 2,
      limit: 20,
    });
    const resultado = await service.findAll(filtros);
    expect(resultado.meta).toEqual({
      page: 2,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
    expect(resultado.data[0].preco).toBe(valor.preco.toString());
    expect(db.valor_Mercado.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          cultura_id: 1,
          mercado_destino: { contains: 'ARG', mode: 'insensitive' },
          data_referencia: {
            gte: new Date('2026-08-01'),
            lte: new Date('2026-08-31T23:59:59.999Z'),
          },
        },
        skip: 20,
        take: 20,
        orderBy: [{ data_referencia: 'desc' }, { id: 'desc' }],
      }),
    );
  });
  it('data inicial posterior ao fim retorna 400', async () => {
    await expect(
      service.findAll(
        Object.assign(new ListValorMercadoDto(), {
          data_inicio: '2026-09-01',
          data_fim: '2026-08-01',
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.valor_Mercado.findMany).not.toHaveBeenCalled();
  });
  it('detalhe inexistente retorna 404', async () => {
    db.valor_Mercado.findUnique.mockResolvedValue(null);
    await expect(service.findOne(999)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('Atualização e cotação', () => {
  it('insere e depois atualiza pela chave lógica, sem duplicar', async () => {
    const a = await service.atualizar({ cultura_id: 1, forcar: false });
    expect(a.fontes[0]).toMatchObject({
      status: 'atualizada',
      registros_gravados: 1,
    });
    const cache = await service.atualizar({ cultura_id: 1, forcar: false });
    expect(cache.fontes[0]).toMatchObject({
      status: 'cache',
      registros_gravados: 0,
    });
    db.valor_Mercado.findFirst.mockResolvedValue(valor);
    await service.atualizar({ cultura_id: 1, forcar: true });
    expect(db.valor_Mercado.create).toHaveBeenCalledTimes(1);
    expect(db.valor_Mercado.update).toHaveBeenCalledTimes(1);
  });
  it('falha com dados antigos retorna 200 lógico, dados, flag e erro em português', async () => {
    vi.mocked(fonte.buscar).mockRejectedValue(
      new ErroFonte('Fonte temporariamente limitada'),
    );
    const resposta = await service.atualizar({ cultura_id: 1, forcar: false });
    expect(resposta).toMatchObject({
      desatualizado: true,
      fonte_erro: 'Fonte temporariamente limitada',
      data: [{ preco: valor.preco.toString() }],
    });
    expect(db.$transaction).not.toHaveBeenCalled();
    const cotacao = await service.cotacao({ cultura_id: 1 });
    expect(cotacao.data[0].desatualizado).toBe(true);
  });
  it('falha sem dados retorna 502', async () => {
    vi.mocked(fonte.buscar).mockRejectedValue(
      new ErroFonte('Tempo limite da fonte excedido'),
    );
    db.valor_Mercado.findMany.mockResolvedValue([]);
    await expect(
      service.atualizar({ cultura_id: 1, forcar: false }),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
  it('resposta inválida de fonte plugável não inicia transação', async () => {
    vi.mocked(fonte.buscar).mockResolvedValue([{ ...registro, preco: '-1' }]);
    await service.atualizar({ cultura_id: 1, forcar: false });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('falha da transação não entra no cache e não vaza mensagem interna', async () => {
    db.$transaction.mockRejectedValueOnce(new Error('senha segredo'));
    const resultado = await service.atualizar({ cultura_id: 1, forcar: false });
    expect(resultado.fonte_erro).not.toContain('segredo');
    await service.atualizar({ cultura_id: 1, forcar: false });
    expect(fonte.buscar).toHaveBeenCalledTimes(2);
  });
  it('cultura sem mapeamento retorna 400 com mensagem prevista', async () => {
    db.cultura.findUnique.mockResolvedValue({ id: 2, nome: 'Banana' });
    await expect(
      service.atualizar({ cultura_id: 2, forcar: false }),
    ).rejects.toThrow('Cultura sem fonte de cotação configurada');
  });
  it('fonte inexistente/inativa retorna 400', async () => {
    await expect(
      service.atualizar({ cultura_id: 1, fonte: 'inexistente', forcar: false }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('cotação usa último dado por país; converte só USD com Decimal', async () => {
    const result = await service.cotacao({ cultura_id: 1 });
    expect(result.data[0].preco_usd).toBe(valor.preco.toString());
    expect(result.data[0].preco_brl).toBe(valor.preco.mul(5).toString());
    expect(db.valor_Mercado.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ distinct: ['pais_destino'] }),
    );
  });
  it('não rotula outra moeda como USD e não converte; PTAX indisponível BRL=null', async () => {
    db.valor_Mercado.findMany.mockResolvedValue([{ ...valor, moeda: 'EUR' }]);
    const result = await service.cotacao({ cultura_id: 1 });
    expect(result.data[0]).toMatchObject({ preco_usd: null, preco_brl: null });
    db.valor_Mercado.findMany.mockResolvedValue([valor]);
    ptax.cotacaoAtual.mockResolvedValue(null);
    expect(
      (await service.cotacao({ cultura_id: 1 })).data[0].preco_brl,
    ).toBeNull();
  });
  it('não-admin forçar =403, antes de consultar; admin permitido', async () => {
    const controller = new MercadoController(service);
    const comum = {
      id: 1,
      nome: 'Teste',
      email: 'teste@example.com',
      tipo: 'COMUM' as const,
    };
    await expect(
      controller.atualizar({ cultura_id: 1, forcar: true }, comum),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(fonte.buscar).not.toHaveBeenCalled();
    await expect(
      controller.atualizar(
        { cultura_id: 1, forcar: true },
        { ...comum, tipo: 'ADMIN' },
      ),
    ).resolves.toHaveProperty('cultura');
  });
});

describe('DTOs no ValidationPipe global', () => {
  it('aceita preco string ou número, normaliza moeda, trims e defaults', async () => {
    expect(
      await validar(
        { ...dto, moeda: ' usd ', mercado_destino: ' Argentina ' },
        CreateValorMercadoDto,
      ),
    ).toMatchObject({
      preco: dto.preco,
      moeda: 'USD',
      mercado_destino: 'Argentina',
    });
    expect(
      await validar({ ...dto, preco: 2.5 }, CreateValorMercadoDto),
    ).toHaveProperty('preco', '2.5');
    expect(await validar({}, ListValorMercadoDto, 'query')).toMatchObject({
      page: 1,
      limit: 20,
    });
  });
  it.each([
    { preco: 0 },
    { preco: -1 },
    { preco: '0' },
    { preco: true },
    { preco: '' },
    { preco: null },
    { moeda: '1$2' },
    { mercado_destino: ' ' },
    { demanda_estimada: -1 },
    { data_referencia: '2026-02-30' },
    { cultura_id: 0 },
    { segredo: 'x' },
  ])('rejeita cadastro inválido %j', async (patch) => {
    await expect(
      validar({ ...dto, ...patch }, CreateValorMercadoDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it.each(['false', 'true', 1])(
    'não transforma forcar=%j em boolean',
    async (forcar) => {
      await expect(
        validar({ cultura_id: 1, forcar }, AtualizarMercadoDto),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );
  it('rejeita limite acima de 100', async () => {
    await expect(
      validar({ limit: '101' }, ListValorMercadoDto, 'query'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
