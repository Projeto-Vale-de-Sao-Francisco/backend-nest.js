import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Avalia uma medição recente contra os limites climáticos da cultura cadastrada no talhão.
   * Atende aos requisitos 9.1 (gerar alerta fora da faixa), 9.2 (mensagem legível)
   * e 9.5 (evitar duplicidade em sequência).
   */
  async checkAndCreateAlerts(medicaoId: number, sensorId: number) {
    const medicao = await this.prisma.medicao.findUnique({
      where: { id: medicaoId },
    });

    if (!medicao) {
      return [];
    }

    // Busca o sensor com seu dispositivo, talhão e culturas ativas
    const sensor = await this.prisma.sensor.findUnique({
      where: { id: sensorId },
      include: {
        dispositivo: {
          include: {
            talhao: {
              include: {
                culturas: {
                  where: { status: 'ativo' },
                  include: { cultura: true },
                },
              },
            },
          },
        },
      },
    });

    if (!sensor?.dispositivo?.talhao) {
      return [];
    }

    const talhao = sensor.dispositivo.talhao;
    const culturasAtivas = talhao.culturas;

    if (!culturasAtivas || culturasAtivas.length === 0) {
      return [];
    }

    const createdAlerts = [];

    for (const item of culturasAtivas) {
      const cultura = item.cultura;
      const culturaNome = cultura.nome;

      // 1. Verificação de Temperatura Máxima
      if (
        medicao.temperatura !== null &&
        cultura.temperatura_max !== null &&
        medicao.temperatura > cultura.temperatura_max
      ) {
        const jaExiste = await this.hasRecentAlert(
          sensorId,
          'TEMPERATURA_ALTA',
        );

        if (!jaExiste) {
          const alerta = await this.prisma.alerta.create({
            data: {
              medicao_id: medicao.id,
              tipo: 'TEMPERATURA_ALTA',
              nivel: 'CRITICO',
              titulo: 'Temperatura acima do recomendado',
              descricao: `Temperatura de ${medicao.temperatura.toFixed(1)}°C acima do limite máximo (${cultura.temperatura_max}°C) para o lote de ${culturaNome} no ${talhao.nome}.`,
              data_hora: medicao.data_hora,
              visualizado: false,
              status: 'ativo',
            },
          });
          createdAlerts.push(alerta);
        }
      }

      // 2. Verificação de Temperatura Mínima
      if (
        medicao.temperatura !== null &&
        cultura.temperatura_min !== null &&
        medicao.temperatura < cultura.temperatura_min
      ) {
        const jaExiste = await this.hasRecentAlert(
          sensorId,
          'TEMPERATURA_BAIXA',
        );

        if (!jaExiste) {
          const alerta = await this.prisma.alerta.create({
            data: {
              medicao_id: medicao.id,
              tipo: 'TEMPERATURA_BAIXA',
              nivel: 'ALERTA',
              titulo: 'Temperatura abaixo do recomendado',
              descricao: `Temperatura de ${medicao.temperatura.toFixed(1)}°C abaixo do limite mínimo (${cultura.temperatura_min}°C) para o lote de ${culturaNome} no ${talhao.nome}.`,
              data_hora: medicao.data_hora,
              visualizado: false,
              status: 'ativo',
            },
          });
          createdAlerts.push(alerta);
        }
      }

      // 3. Verificação de Umidade Máxima
      if (
        medicao.umidade !== null &&
        cultura.umidade_max !== null &&
        medicao.umidade > cultura.umidade_max
      ) {
        const jaExiste = await this.hasRecentAlert(sensorId, 'UMIDADE_ALTA');

        if (!jaExiste) {
          const alerta = await this.prisma.alerta.create({
            data: {
              medicao_id: medicao.id,
              tipo: 'UMIDADE_ALTA',
              nivel: 'ALERTA',
              titulo: 'Umidade acima do recomendado',
              descricao: `Umidade do ar de ${medicao.umidade.toFixed(1)}% acima do limite máximo (${cultura.umidade_max}%) para o lote de ${culturaNome} no ${talhao.nome}.`,
              data_hora: medicao.data_hora,
              visualizado: false,
              status: 'ativo',
            },
          });
          createdAlerts.push(alerta);
        }
      }

      // 4. Verificação de Umidade Mínima
      if (
        medicao.umidade !== null &&
        cultura.umidade_min !== null &&
        medicao.umidade < cultura.umidade_min
      ) {
        const jaExiste = await this.hasRecentAlert(sensorId, 'UMIDADE_BAIXA');

        if (!jaExiste) {
          const alerta = await this.prisma.alerta.create({
            data: {
              medicao_id: medicao.id,
              tipo: 'UMIDADE_BAIXA',
              nivel: 'CRITICO',
              titulo: 'Umidade abaixo do recomendado',
              descricao: `Umidade do ar de ${medicao.umidade.toFixed(1)}% abaixo do limite mínimo (${cultura.umidade_min}%) para o lote de ${culturaNome} no ${talhao.nome}.`,
              data_hora: medicao.data_hora,
              visualizado: false,
              status: 'ativo',
            },
          });
          createdAlerts.push(alerta);
        }
      }
    }

    return createdAlerts;
  }

  /**
   * Requisito 9.5: Evita disparos repetidos em sequência para o mesmo sensor e mesmo tipo de alerta
   * verificando se já existe um alerta ativo emitido nos últimos 30 minutos.
   */
  private async hasRecentAlert(
    sensorId: number,
    tipo: string,
  ): Promise<boolean> {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    const recent = await this.prisma.alerta.findFirst({
      where: {
        tipo,
        status: 'ativo',
        data_hora: { gte: thirtyMinutesAgo },
        medicao: {
          sensor_id: sensorId,
        },
      },
    });

    return !!recent;
  }

  /**
   * Requisito 9.2 e 9.3: Lista alertas com filtros opcionais (status, visualizado, talhão).
   */
  async findAll(filters?: {
    status?: string;
    visualizado?: boolean;
    talhaoId?: number;
  }) {
    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.visualizado !== undefined) {
      where.visualizado = filters.visualizado;
    }

    if (filters?.talhaoId) {
      where.medicao = {
        sensor: {
          dispositivo: {
            talhao_id: filters.talhaoId,
          },
        },
      };
    }

    return this.prisma.alerta.findMany({
      where,
      include: {
        medicao: {
          include: {
            sensor: {
              include: {
                dispositivo: {
                  include: {
                    talhao: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        data_hora: 'desc',
      },
    });
  }

  /**
   * Requisito 9.3: Alertas ativos para exibição em destaque no Dashboard.
   */
  async findActive() {
    return this.findAll({ status: 'ativo' });
  }

  /**
   * Requisito 9.4: Marcar alerta como visualizado.
   */
  async markAsViewed(id: number) {
    const alerta = await this.prisma.alerta.findUnique({ where: { id } });
    if (!alerta) {
      throw new NotFoundException(`Alerta com id ${id} não encontrado.`);
    }

    return this.prisma.alerta.update({
      where: { id },
      data: { visualizado: true },
    });
  }

  /**
   * Requisito 9.4: Marcar alerta como resolvido.
   */
  async resolve(id: number) {
    const alerta = await this.prisma.alerta.findUnique({ where: { id } });
    if (!alerta) {
      throw new NotFoundException(`Alerta com id ${id} não encontrado.`);
    }

    return this.prisma.alerta.update({
      where: { id },
      data: {
        status: 'resolvido',
        visualizado: true,
      },
    });
  }
}
