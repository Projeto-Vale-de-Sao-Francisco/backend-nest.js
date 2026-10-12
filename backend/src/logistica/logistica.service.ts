import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateLogisticaDto } from './dto/create-logistica.dto.js';
import { UpdateLogisticaDto } from './dto/update-logistica.dto.js';
import {
  ListLogisticaDto,
  ResumoLogisticaDto,
} from './dto/list-logistica.dto.js';

const includeOperacao = {
  empresa: { select: { id: true, razao_social: true, nome_fantasia: true } },
  colheita: {
    include: {
      talhao_cultura: {
        include: {
          cultura: { select: { id: true, nome: true, variedade: true } },
          talhao: {
            select: {
              id: true,
              nome: true,
              propriedade: {
                select: { id: true, nome: true, empresa_id: true },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.Operacao_LogisticaInclude;

@Injectable()
export class LogisticaService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLogisticaDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.validarVinculo(
          tx,
          dto.empresa_id,
          dto.colheita_id,
          dto.data_prevista,
        );
        return tx.operacao_Logistica.create({
          data: {
            ...this.dados(dto),
            empresa_id: dto.empresa_id,
            colheita_id: dto.colheita_id,
            origem: dto.origem.trim(),
            destino: dto.destino.trim(),
            modal: dto.modal.trim(),
            status: dto.status,
          },
          include: includeOperacao,
        });
      });
    } catch (error) {
      this.tratarErro(error);
    }
  }

  async update(id: number, dto: UpdateLogisticaDto) {
    if (!Object.values(dto).some((value) => value !== undefined))
      throw new BadRequestException('Informe ao menos um campo para edição');
    try {
      return await this.prisma.$transaction(async (tx) => {
        const atual = await tx.operacao_Logistica.findUnique({ where: { id } });
        if (!atual)
          throw new NotFoundException('Operação logística não encontrada');
        await this.validarVinculo(
          tx,
          dto.empresa_id ?? atual.empresa_id,
          dto.colheita_id ?? atual.colheita_id,
          dto.data_prevista !== undefined
            ? dto.data_prevista
            : atual.data_prevista?.toISOString(),
        );
        return tx.operacao_Logistica.update({
          where: { id },
          data: this.dados(dto),
          include: includeOperacao,
        });
      });
    } catch (error) {
      this.tratarErro(error);
    }
  }

  async findAll(dto: ListLogisticaDto) {
    const where = this.filtros(dto);
    const [data, total] = await Promise.all([
      this.prisma.operacao_Logistica.findMany({
        where,
        include: includeOperacao,
        orderBy: { id: 'desc' },
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
      }),
      this.prisma.operacao_Logistica.count({ where }),
    ]);
    return {
      data,
      meta: {
        page: dto.page,
        limit: dto.limit,
        total,
        totalPages: Math.ceil(total / dto.limit),
      },
    };
  }

  async findOne(id: number) {
    const operacao = await this.prisma.operacao_Logistica.findUnique({
      where: { id },
      include: includeOperacao,
    });
    if (!operacao)
      throw new NotFoundException('Operação logística não encontrada');
    return operacao;
  }

  async resumo(dto: ResumoLogisticaDto) {
    const where = this.filtros(dto);
    const [totais, grupos] = await Promise.all([
      this.prisma.operacao_Logistica.aggregate({
        where,
        _count: { _all: true },
        _sum: { custo_estimado: true },
        _avg: { tempo_estimado_horas: true },
      }),
      this.prisma.operacao_Logistica.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
        orderBy: { status: 'asc' },
      }),
    ]);
    return {
      quantidade_operacoes: totais._count._all,
      por_status: grupos.map((grupo) => ({
        status: grupo.status,
        quantidade: grupo._count._all,
      })),
      custo_estimado_total: totais._sum.custo_estimado ?? 0,
      tempo_medio_horas: totais._avg.tempo_estimado_horas,
    };
  }

  private async validarVinculo(
    tx: Prisma.TransactionClient,
    empresaId: number,
    colheitaId: number,
    data?: string | null,
  ) {
    const [empresa, colheita] = await Promise.all([
      tx.empresa.findUnique({ where: { id: empresaId }, select: { id: true } }),
      tx.colheita.findUnique({
        where: { id: colheitaId },
        include: {
          talhao_cultura: {
            include: { talhao: { include: { propriedade: true } } },
          },
        },
      }),
    ]);
    if (!empresa) throw new NotFoundException('Empresa não encontrada');
    if (!colheita) throw new NotFoundException('Colheita não encontrada');
    if (colheita.talhao_cultura.talhao.propriedade.empresa_id !== empresaId)
      throw new BadRequestException(
        'A colheita não pertence à empresa informada',
      );
    if (data && new Date(data) < colheita.talhao_cultura.data_plantio)
      throw new BadRequestException(
        'data_prevista não pode ser anterior ao plantio',
      );
  }

  private dados(dto: Partial<CreateLogisticaDto>) {
    return {
      ...(dto.empresa_id !== undefined ? { empresa_id: dto.empresa_id } : {}),
      ...(dto.colheita_id !== undefined
        ? { colheita_id: dto.colheita_id }
        : {}),
      ...(dto.origem !== undefined ? { origem: dto.origem.trim() } : {}),
      ...(dto.destino !== undefined ? { destino: dto.destino.trim() } : {}),
      ...(dto.modal !== undefined ? { modal: dto.modal.trim() } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.transportadora !== undefined
        ? { transportadora: dto.transportadora?.trim() || null }
        : {}),
      ...(dto.data_prevista !== undefined
        ? {
            data_prevista: dto.data_prevista
              ? new Date(dto.data_prevista)
              : null,
          }
        : {}),
      ...(dto.tempo_estimado_horas !== undefined
        ? { tempo_estimado_horas: dto.tempo_estimado_horas }
        : {}),
      ...(dto.custo_estimado !== undefined
        ? { custo_estimado: dto.custo_estimado }
        : {}),
    };
  }

  private filtros(
    dto: ResumoLogisticaDto,
  ): Prisma.Operacao_LogisticaWhereInput {
    const fim = dto.data_fim ? new Date(dto.data_fim) : undefined;
    if (fim && /^\d{4}-\d{2}-\d{2}$/.test(dto.data_fim!))
      fim.setUTCHours(23, 59, 59, 999);
    if (dto.data_inicio && fim && new Date(dto.data_inicio) > fim)
      throw new BadRequestException(
        'data_inicio deve ser anterior ou igual a data_fim',
      );
    return {
      ...(dto.empresa_id ? { empresa_id: dto.empresa_id } : {}),
      ...(dto.colheita_id ? { colheita_id: dto.colheita_id } : {}),
      ...(dto.status ? { status: dto.status } : {}),
      ...(dto.destino
        ? { destino: { contains: dto.destino.trim(), mode: 'insensitive' } }
        : {}),
      ...(dto.modal
        ? { modal: { equals: dto.modal.trim(), mode: 'insensitive' } }
        : {}),
      ...(dto.data_inicio || fim
        ? {
            data_prevista: {
              ...(dto.data_inicio ? { gte: new Date(dto.data_inicio) } : {}),
              ...(fim ? { lte: fim } : {}),
            },
          }
        : {}),
    };
  }

  private tratarErro(error: unknown): never {
    if (
      error instanceof BadRequestException ||
      error instanceof NotFoundException ||
      error instanceof ConflictException
    )
      throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025')
        throw new NotFoundException('Recurso não encontrado');
      if (error.code === 'P2003')
        throw new BadRequestException(
          'Referência de empresa ou colheita inválida',
        );
      if (error.code === 'P2002')
        throw new ConflictException(
          'Operação em conflito com registro existente',
        );
    }
    throw new ServiceUnavailableException(
      'Não foi possível salvar a operação logística',
    );
  }
}
