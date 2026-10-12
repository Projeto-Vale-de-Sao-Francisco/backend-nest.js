import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AtualizarMercadoDto } from './dto/atualizar-mercado.dto.js';
import { CotacaoMercadoDto } from './dto/cotacao-mercado.dto.js';
import { CreateValorMercadoDto } from './dto/create-valor-mercado.dto.js';
import { ListValorMercadoDto } from './dto/list-valor-mercado.dto.js';
import { UpdateValorMercadoDto } from './dto/update-valor-mercado.dto.js';
import { ResumoMercadoDto } from './dto/resumo-mercado.dto.js';
import type {
  CulturaMercado,
  RegistroMercado,
} from './fontes/fonte-mercado.interface.js';
import { ErroFonte, mensagemFonte } from './fontes/http-seguro.service.js';
import { MercadoFontesService } from './fontes/mercado-fontes.service.js';
import { PtaxService } from './fontes/ptax.service.js';
const selectValor = {
  id: true,
  cultura_id: true,
  mercado_destino: true,
  pais_destino: true,
  preco: true,
  moeda: true,
  unidade_medida: true,
  data_referencia: true,
  demanda_estimada: true,
  cultura: { select: { id: true, nome: true } },
} satisfies Prisma.Valor_MercadoSelect;
type Valor = Prisma.Valor_MercadoGetPayload<{ select: typeof selectValor }>;

@Injectable()
export class MercadoService {
  private readonly logger = new Logger(MercadoService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly fontes: MercadoFontesService,
    private readonly ptax: PtaxService,
  ) {}
  async create(dto: CreateValorMercadoDto) {
    await this.cultura(dto.cultura_id);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const data = {
          cultura_id: dto.cultura_id,
          demanda_estimada: dto.demanda_estimada,
          preco: new Prisma.Decimal(dto.preco),
          mercado_destino: dto.mercado_destino.trim(),
          pais_destino: dto.pais_destino.trim(),
          moeda: dto.moeda.toUpperCase(),
          unidade_medida: dto.unidade_medida.trim(),
          data_referencia: new Date(dto.data_referencia),
        };
        const existente = await tx.valor_Mercado.findFirst({
          where: {
            cultura_id: data.cultura_id,
            mercado_destino: data.mercado_destino,
            data_referencia: data.data_referencia,
          },
        });
        if (existente)
          throw new ConflictException(
            'Já existe um valor de mercado com esta referência',
          );
        return this.serializar(
          await tx.valor_Mercado.create({ data, select: selectValor }),
        );
      });
    } catch (error) {
      this.prismaError(error);
    }
  }
  async findAll(dto: ListValorMercadoDto) {
    if (
      dto.data_inicio &&
      dto.data_fim &&
      new Date(dto.data_inicio) > new Date(dto.data_fim)
    )
      throw new BadRequestException(
        'data_inicio deve ser anterior ou igual a data_fim',
      );
    const where: Prisma.Valor_MercadoWhereInput = {
      ...(dto.cultura_id ? { cultura_id: dto.cultura_id } : {}),
      ...(dto.mercado_destino
        ? {
            mercado_destino: {
              contains: dto.mercado_destino,
              mode: 'insensitive',
            },
          }
        : {}),
      ...(dto.data_inicio || dto.data_fim
        ? {
            data_referencia: {
              ...(dto.data_inicio ? { gte: new Date(dto.data_inicio) } : {}),
              ...(dto.data_fim ? { lte: this.fimDoDia(dto.data_fim) } : {}),
            },
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.valor_Mercado.findMany({
        where,
        select: selectValor,
        orderBy: [{ data_referencia: 'desc' }, { id: 'desc' }],
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
      }),
      this.prisma.valor_Mercado.count({ where }),
    ]);
    return {
      data: data.map((item) => this.serializar(item)),
      meta: {
        page: dto.page,
        limit: dto.limit,
        total,
        totalPages: Math.ceil(total / dto.limit),
      },
    };
  }
  async findOne(id: number) {
    const valor = await this.prisma.valor_Mercado.findUnique({
      where: { id },
      select: selectValor,
    });
    if (!valor) throw new NotFoundException('Valor de mercado não encontrado');
    return this.serializar(valor);
  }
  async update(id: number, dto: UpdateValorMercadoDto) {
    if (!Object.values(dto).some((value) => value !== undefined))
      throw new BadRequestException('Informe ao menos um campo para edição');
    try {
      return await this.prisma.$transaction(async (tx) => {
        const atual = await tx.valor_Mercado.findUnique({
          where: { id },
          select: selectValor,
        });
        if (!atual)
          throw new NotFoundException('Valor de mercado não encontrado');
        const culturaId = dto.cultura_id ?? atual.cultura_id;
        if (
          dto.cultura_id !== undefined &&
          !(await tx.cultura.findUnique({
            where: { id: culturaId },
            select: { id: true },
          }))
        )
          throw new NotFoundException('Cultura não encontrada');
        const destino = dto.mercado_destino?.trim() ?? atual.mercado_destino;
        const dataReferencia =
          dto.data_referencia !== undefined
            ? new Date(dto.data_referencia)
            : atual.data_referencia;
        const duplicado = await tx.valor_Mercado.findFirst({
          where: {
            cultura_id: culturaId,
            mercado_destino: destino,
            data_referencia: dataReferencia,
            NOT: { id },
          },
        });
        if (duplicado)
          throw new ConflictException(
            'Já existe um valor de mercado com esta referência',
          );
        return this.serializar(
          await tx.valor_Mercado.update({
            where: { id },
            select: selectValor,
            data: {
              ...(dto.cultura_id !== undefined
                ? { cultura_id: culturaId }
                : {}),
              ...(dto.mercado_destino !== undefined
                ? { mercado_destino: destino }
                : {}),
              ...(dto.pais_destino !== undefined
                ? { pais_destino: dto.pais_destino.trim() }
                : {}),
              ...(dto.preco !== undefined
                ? { preco: new Prisma.Decimal(dto.preco) }
                : {}),
              ...(dto.moeda !== undefined
                ? { moeda: dto.moeda.toUpperCase() }
                : {}),
              ...(dto.unidade_medida !== undefined
                ? { unidade_medida: dto.unidade_medida.trim() }
                : {}),
              ...(dto.data_referencia !== undefined
                ? { data_referencia: dataReferencia }
                : {}),
              ...(dto.demanda_estimada !== undefined
                ? { demanda_estimada: dto.demanda_estimada }
                : {}),
            },
          }),
        );
      });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      )
        throw error;
      this.prismaError(error);
    }
  }

  async resumo(dto: ResumoMercadoDto) {
    if (
      dto.data_inicio &&
      dto.data_fim &&
      new Date(dto.data_inicio) > this.fimDoDia(dto.data_fim)
    )
      throw new BadRequestException(
        'data_inicio deve ser anterior ou igual a data_fim',
      );
    const valores = await this.prisma.valor_Mercado.findMany({
      where: {
        ...(dto.cultura_id ? { cultura_id: dto.cultura_id } : {}),
        ...(dto.mercado_destino
          ? {
              mercado_destino: {
                contains: dto.mercado_destino,
                mode: 'insensitive',
              },
            }
          : {}),
        ...(dto.data_inicio || dto.data_fim
          ? {
              data_referencia: {
                ...(dto.data_inicio ? { gte: new Date(dto.data_inicio) } : {}),
                ...(dto.data_fim ? { lte: this.fimDoDia(dto.data_fim) } : {}),
              },
            }
          : {}),
      },
      select: selectValor,
      orderBy: [
        { cultura_id: 'asc' },
        { moeda: 'asc' },
        { unidade_medida: 'asc' },
        { id: 'asc' },
      ],
    });
    const grupos = new Map<
      string,
      {
        cultura: Valor['cultura'];
        moeda: string;
        unidade_medida: string;
        quantidade: number;
        destinos: Set<string>;
        soma: Prisma.Decimal;
        min: Prisma.Decimal;
        max: Prisma.Decimal;
      }
    >();
    let inicio: Date | null = null;
    let fim: Date | null = null;
    for (const valor of valores) {
      const chave = JSON.stringify([
        valor.cultura_id,
        valor.moeda,
        valor.unidade_medida,
      ]);
      const grupo = grupos.get(chave) ?? {
        cultura: valor.cultura,
        moeda: valor.moeda,
        unidade_medida: valor.unidade_medida,
        quantidade: 0,
        destinos: new Set<string>(),
        soma: new Prisma.Decimal(0),
        min: valor.preco,
        max: valor.preco,
      };
      grupo.quantidade++;
      grupo.destinos.add(valor.mercado_destino);
      grupo.soma = grupo.soma.add(valor.preco);
      if (valor.preco.lt(grupo.min)) grupo.min = valor.preco;
      if (valor.preco.gt(grupo.max)) grupo.max = valor.preco;
      grupos.set(chave, grupo);
      if (!inicio || valor.data_referencia < inicio)
        inicio = valor.data_referencia;
      if (!fim || valor.data_referencia > fim) fim = valor.data_referencia;
    }
    return {
      quantidade_registros: valores.length,
      quantidade_destinos: new Set(
        valores.map((valor) => valor.mercado_destino),
      ).size,
      periodo_disponivel: { inicio, fim },
      grupos: [...grupos.values()].map((grupo) => ({
        cultura: grupo.cultura,
        moeda: grupo.moeda,
        unidade_medida: grupo.unidade_medida,
        quantidade_registros: grupo.quantidade,
        quantidade_destinos: grupo.destinos.size,
        preco_minimo: grupo.min.toString(),
        preco_medio: grupo.soma.div(grupo.quantidade).toString(),
        preco_maximo: grupo.max.toString(),
      })),
    };
  }
  async atualizar(dto: AtualizarMercadoDto) {
    const cultura = await this.cultura(dto.cultura_id);
    const fontes = this.fontes.selecionar(cultura, dto.fonte);
    if (!fontes.length) {
      if (
        dto.fonte &&
        !this.fontes
          .diagnosticos()
          .some((fonte) => fonte.id === dto.fonte && fonte.ativa)
      )
        throw new BadRequestException(
          'Fonte de cotação indisponível ou inativa',
        );
      throw new BadRequestException('Cultura sem fonte de cotação configurada');
    }
    const resultados: Array<{
      id: string;
      status: 'cache' | 'atualizada' | 'erro';
      atualizado_em: Date | null;
      registros_gravados: number;
      erro?: string;
    }> = [];
    let houveSucesso = false;
    for (const fonte of fontes) {
      try {
        const consulta = await this.fontes.buscar(
          fonte,
          cultura,
          dto.forcar,
          (registros) => this.gravar(cultura.id, registros),
        );
        resultados.push({
          id: fonte.id,
          status: consulta.cache ? 'cache' : 'atualizada',
          atualizado_em: consulta.atualizadoEm,
          registros_gravados: consulta.gravados,
        });
        houveSucesso = true;
      } catch (error) {
        const mensagem = mensagemFonte(error);
        this.logger.warn(
          `Fonte ${fonte.id}, cultura ${cultura.id}: ${mensagem}`,
        );
        resultados.push({
          id: fonte.id,
          status: 'erro',
          atualizado_em: this.fontes.estadoCultura(cultura).atualizado_em,
          registros_gravados: 0,
          erro: mensagem,
        });
      }
    }
    const cambio = await this.ptax.cotacaoAtual();
    const erros = resultados.filter((item) => item.status === 'erro');
    if (!houveSucesso) {
      const data = await this.ultimos(cultura.id);
      if (!data.length)
        throw new BadGatewayException(
          'Não foi possível obter cotação e não há dados armazenados',
        );
      return {
        cultura,
        fontes: resultados,
        cambio,
        data: data.map((item) => this.serializar(item)),
        desatualizado: true,
        fonte_erro: erros.map((item) => item.erro).join('; '),
      };
    }
    const estado = this.fontes.estadoCultura(cultura);
    return {
      cultura,
      fontes: resultados,
      cambio,
      desatualizado: !!erros.length || estado.desatualizado,
      fonte_erro: erros.length
        ? erros.map((item) => item.erro).join('; ')
        : estado.fonte_erro,
    };
  }
  async cotacao(dto: CotacaoMercadoDto) {
    const cultura = await this.cultura(dto.cultura_id);
    const valores = await this.ultimos(cultura.id);
    const cambio = await this.ptax.cotacaoAtual();
    const estado = this.fontes.estadoCultura(cultura);
    return {
      cultura,
      cambio,
      ...estado,
      data: valores.map((valor) => ({
        ...this.serializar(valor),
        preco_usd: valor.moeda === 'USD' ? valor.preco.toString() : null,
        preco_brl:
          cambio && valor.moeda === 'USD'
            ? valor.preco.mul(cambio.usd_brl).toString()
            : null,
        ...estado,
      })),
    };
  }
  fontesAtivas() {
    return this.fontes.diagnosticos();
  }
  private ultimos(culturaId: number) {
    return this.prisma.valor_Mercado.findMany({
      where: { cultura_id: culturaId },
      select: selectValor,
      distinct: ['pais_destino'],
      orderBy: [{ data_referencia: 'desc' }, { id: 'desc' }],
    });
  }
  private serializar(valor: Valor) {
    return { ...valor, preco: valor.preco.toString() };
  }
  private async gravar(
    culturaId: number,
    registros: RegistroMercado[],
  ): Promise<number> {
    // Valida o lote inteiro antes da transação, inclusive para futuras fontes.
    if (
      !Array.isArray(registros) ||
      registros.some(
        (r) =>
          !r ||
          typeof r.mercadoDestino !== 'string' ||
          !r.mercadoDestino.trim() ||
          typeof r.paisDestino !== 'string' ||
          !r.paisDestino.trim() ||
          typeof r.preco !== 'string' ||
          !/^\d+(\.\d+)?$/.test(r.preco) ||
          !new Prisma.Decimal(r.preco).isPositive() ||
          new Prisma.Decimal(r.preco).isZero() ||
          r.moeda !== 'USD' ||
          r.unidadeMedida !== 'kg' ||
          !(r.dataReferencia instanceof Date) ||
          !Number.isFinite(r.dataReferencia.getTime()) ||
          typeof r.demandaEstimada !== 'number' ||
          !Number.isFinite(r.demandaEstimada) ||
          r.demandaEstimada < 0,
      )
    )
      throw new ErroFonte('Resposta inesperada da fonte de mercado');
    return this.prisma.$transaction(
      async (tx) => {
        for (const registro of registros) {
          const where = {
            cultura_id: culturaId,
            mercado_destino: registro.mercadoDestino,
            data_referencia: registro.dataReferencia,
          };
          const existente = await tx.valor_Mercado.findFirst({ where });
          const data = {
            pais_destino: registro.paisDestino,
            preco: new Prisma.Decimal(registro.preco),
            moeda: registro.moeda,
            unidade_medida: registro.unidadeMedida,
            demanda_estimada: registro.demandaEstimada,
          };
          if (existente)
            await tx.valor_Mercado.update({
              where: { id: existente.id },
              data,
            });
          else await tx.valor_Mercado.create({ data: { ...where, ...data } });
        }
        return registros.length;
      },
      { timeout: 30_000 },
    );
  }
  private async cultura(id: number): Promise<CulturaMercado> {
    const cultura = await this.prisma.cultura.findUnique({
      where: { id },
      select: { id: true, nome: true },
    });
    if (!cultura) throw new NotFoundException('Cultura não encontrada');
    return cultura;
  }
  private fimDoDia(data: string): Date {
    const fim = new Date(data);
    if (/^\d{4}-\d{2}-\d{2}$/.test(data)) fim.setUTCHours(23, 59, 59, 999);
    return fim;
  }
  private prismaError(error: unknown): never {
    if (error instanceof ConflictException) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2003')
        throw new BadRequestException('Referência de cultura inválida');
      if (error.code === 'P2025')
        throw new NotFoundException('Valor de mercado não encontrado');
      if (error.code === 'P2002')
        throw new ConflictException(
          'Já existe um valor de mercado com esta referência',
        );
    }
    this.logger.error('Falha ao cadastrar valor de mercado');
    throw new ServiceUnavailableException(
      'Não foi possível armazenar o valor de mercado',
    );
  }
}
