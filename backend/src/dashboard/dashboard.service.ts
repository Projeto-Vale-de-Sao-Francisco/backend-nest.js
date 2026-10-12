import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  DashboardFiltrosDto,
  HistoricoFiltrosDto,
} from './dto/dashboard-filtros.dto.js';

const leituraSelect = {
  id: true,
  sensor_id: true,
  data_hora: true,
  temperatura: true,
  umidade: true,
  sensor: {
    select: {
      id: true,
      tipo: true,
      unidade_medida: true,
      status: true,
      dispositivo: {
        select: {
          id: true,
          codigo: true,
          status: true,
          talhao: {
            select: {
              id: true,
              nome: true,
              propriedade_id: true,
              propriedade: { select: { id: true, nome: true } },
              culturas: {
                where: { status: 'ativo' },
                orderBy: { id: 'desc' as const },
                include: { cultura: true },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.MedicaoSelect;

type Leitura = Prisma.MedicaoGetPayload<{ select: typeof leituraSelect }>;
type Cultura =
  Leitura['sensor']['dispositivo']['talhao']['culturas'][number]['cultura'];

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async resumo(dto: DashboardFiltrosDto) {
    this.validarPeriodo(dto);
    const where = this.filtroMedicoes(dto);
    const [atual, medias, totalLeituras, sensoresAtivos] = await Promise.all([
      this.prisma.medicao.findFirst({
        where,
        select: leituraSelect,
        orderBy: [{ data_hora: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.medicao.aggregate({
        where,
        _avg: { temperatura: true, umidade: true },
      }),
      this.prisma.medicao.count({ where }),
      this.prisma.sensor.count({ where: this.filtroSensoresAtivos(dto) }),
    ]);

    return {
      filtros: this.filtrosAplicados(dto),
      atual: atual
        ? {
            medicao_id: atual.id,
            sensor_id: atual.sensor_id,
            temperatura: atual.temperatura,
            umidade: atual.umidade,
            data_hora: atual.data_hora,
            talhao: this.contextoTalhao(atual),
            comparacao: this.comparar(atual, this.culturaAtiva(atual, dto)),
          }
        : null,
      medias: {
        temperatura: medias._avg.temperatura,
        umidade: medias._avg.umidade,
      },
      sensores_ativos: sensoresAtivos,
      total_leituras: totalLeituras,
      ultima_comunicacao: atual?.data_hora ?? null,
      mensagem:
        totalLeituras === 0
          ? 'Nenhuma medição encontrada para os filtros informados'
          : null,
    };
  }

  async historico(dto: HistoricoFiltrosDto) {
    this.validarPeriodo(dto);
    const where = this.filtroMedicoes(dto);
    const [leituras, total] = await Promise.all([
      this.prisma.medicao.findMany({
        where,
        select: leituraSelect,
        orderBy: [{ data_hora: 'asc' }, { id: 'asc' }],
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
      }),
      this.prisma.medicao.count({ where }),
    ]);
    return {
      data: leituras.map((leitura) => ({
        id: leitura.id,
        sensor_id: leitura.sensor_id,
        data_hora: leitura.data_hora,
        temperatura: leitura.temperatura,
        umidade: leitura.umidade,
        talhao: this.contextoTalhao(leitura),
        comparacao: this.comparar(leitura, this.culturaAtiva(leitura, dto)),
      })),
      meta: {
        page: dto.page,
        limit: dto.limit,
        total,
        totalPages: Math.ceil(total / dto.limit),
      },
      mensagem:
        total === 0
          ? 'Nenhuma medição encontrada para os filtros informados'
          : null,
    };
  }

  private filtroMedicoes(dto: DashboardFiltrosDto): Prisma.MedicaoWhereInput {
    const talhao: Prisma.TalhaoWhereInput = {
      ...(dto.propriedade_id ? { propriedade_id: dto.propriedade_id } : {}),
      ...(dto.talhao_id ? { id: dto.talhao_id } : {}),
      ...(dto.cultura_id
        ? {
            culturas: {
              some: { cultura_id: dto.cultura_id, status: 'ativo' },
            },
          }
        : {}),
    };
    return {
      ...(dto.sensor_id ? { sensor_id: dto.sensor_id } : {}),
      ...(dto.propriedade_id || dto.talhao_id || dto.cultura_id
        ? { sensor: { dispositivo: { talhao } } }
        : {}),
      ...(dto.data_inicio || dto.data_fim
        ? {
            data_hora: {
              ...(dto.data_inicio ? { gte: new Date(dto.data_inicio) } : {}),
              ...(dto.data_fim ? { lte: this.fimInclusivo(dto.data_fim) } : {}),
            },
          }
        : {}),
    };
  }

  private filtroSensoresAtivos(
    dto: DashboardFiltrosDto,
  ): Prisma.SensorWhereInput {
    return {
      status: 'ativo',
      ...(dto.sensor_id ? { id: dto.sensor_id } : {}),
      dispositivo: {
        status: 'ativo',
        talhao: {
          ...(dto.propriedade_id ? { propriedade_id: dto.propriedade_id } : {}),
          ...(dto.talhao_id ? { id: dto.talhao_id } : {}),
          ...(dto.cultura_id
            ? {
                culturas: {
                  some: { cultura_id: dto.cultura_id, status: 'ativo' },
                },
              }
            : {}),
        },
      },
    };
  }

  private culturaAtiva(
    leitura: Leitura,
    dto: DashboardFiltrosDto,
  ): Cultura | null {
    const vinculos = leitura.sensor.dispositivo.talhao.culturas;
    return (
      vinculos.find((item) => item.cultura_id === dto.cultura_id)?.cultura ??
      vinculos[0]?.cultura ??
      null
    );
  }

  private comparar(leitura: Leitura, cultura: Cultura | null) {
    if (!cultura)
      return {
        disponivel: false,
        status: 'indisponivel',
        motivo: 'Nenhuma cultura ativa vinculada ao lote',
        cultura: null,
      };
    const temperatura = this.compararValor(
      leitura.temperatura,
      cultura.temperatura_min,
      cultura.temperatura_max,
    );
    const umidade = this.compararValor(
      leitura.umidade,
      cultura.umidade_min,
      cultura.umidade_max,
    );
    const disponivel =
      temperatura.status !== 'sem_parametros' ||
      umidade.status !== 'sem_parametros';
    return {
      disponivel,
      status: !disponivel
        ? 'indisponivel'
        : temperatura.status === 'abaixo' ||
            temperatura.status === 'acima' ||
            umidade.status === 'abaixo' ||
            umidade.status === 'acima'
          ? 'fora_da_faixa'
          : 'dentro_da_faixa',
      motivo: disponivel
        ? null
        : 'A cultura ativa não possui parâmetros climáticos cadastrados',
      cultura: { id: cultura.id, nome: cultura.nome },
      temperatura,
      umidade,
    };
  }

  private compararValor(
    valor: number | null,
    minimo: number | null,
    maximo: number | null,
  ) {
    let status = 'dentro';
    if (valor === null) status = 'sem_leitura';
    else if (minimo === null && maximo === null) status = 'sem_parametros';
    else if (minimo !== null && valor < minimo) status = 'abaixo';
    else if (maximo !== null && valor > maximo) status = 'acima';
    return { valor, minimo, maximo, status };
  }

  private contextoTalhao(leitura: Leitura) {
    const talhao = leitura.sensor.dispositivo.talhao;
    return {
      id: talhao.id,
      nome: talhao.nome,
      propriedade: talhao.propriedade,
      dispositivo: {
        id: leitura.sensor.dispositivo.id,
        codigo: leitura.sensor.dispositivo.codigo,
      },
    };
  }

  private validarPeriodo(dto: DashboardFiltrosDto) {
    if (
      dto.data_inicio &&
      dto.data_fim &&
      new Date(dto.data_inicio) > this.fimInclusivo(dto.data_fim)
    )
      throw new BadRequestException(
        'data_inicio deve ser anterior ou igual a data_fim',
      );
  }

  private fimInclusivo(valor: string) {
    const data = new Date(valor);
    if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) data.setUTCHours(23, 59, 59, 999);
    return data;
  }

  private filtrosAplicados(dto: DashboardFiltrosDto) {
    return {
      propriedade_id: dto.propriedade_id ?? null,
      talhao_id: dto.talhao_id ?? null,
      cultura_id: dto.cultura_id ?? null,
      sensor_id: dto.sensor_id ?? null,
      data_inicio: dto.data_inicio ?? null,
      data_fim: dto.data_fim ?? null,
    };
  }
}
