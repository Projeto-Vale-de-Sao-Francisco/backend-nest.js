import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AlertsService } from '../alerts/alerts.service.js';
import { CreateReadingDto } from './dto/create-reading.dto.js';

@Injectable()
export class ReadingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alertsService: AlertsService,
  ) {}

  /**
   * Requisito 6.1, 6.2, 6.7: Registra e valida uma leitura e aciona geração de alertas (9.1).
   */
  async create(dto: CreateReadingDto) {
    this.validatePlausibility(dto);

    try {
      const sensor = await this.resolveAndValidateSensor(dto);

      const dataHora = dto.dataHora ? new Date(dto.dataHora) : new Date();
      if (Number.isNaN(dataHora.getTime())) {
        throw new BadRequestException('Data/hora da leitura inválida.');
      }

      const medicao = await this.prisma.medicao.create({
        data: {
          sensor_id: sensor.id,
          data_hora: dataHora,
          temperatura: dto.temperatura,
          umidade: dto.umidade,
          umidade_solo: dto.umidadeSolo ?? null,
          luminosidade: dto.luminosidade ?? null,
          precipitacao: dto.precipitacao ?? null,
        },
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
      });

      // Requisito 9.1: Processa alertas climáticos automaticamente
      const alertas = await this.alertsService.checkAndCreateAlerts(
        medicao.id,
        sensor.id,
      );

      return {
        sucesso: true,
        mensagem: 'Leitura registrada com sucesso.',
        medicao,
        alertasGerados: alertas,
      };
    } catch (error: any) {
      if (
        error?.code === 'ECONNREFUSED' ||
        error?.message?.includes('ECONNREFUSED')
      ) {
        throw new ServiceUnavailableException(
          'Banco de dados PostgreSQL (localhost:5432) indisponível. Inicie o PostgreSQL para gravar medições locais.',
        );
      }
      throw error;
    }
  }

  /**
   * Requisito 6.3: Histórico de leituras com filtros por sensor, talhão e período.
   */
  async findAll(filters?: {
    sensorId?: number;
    talhaoId?: number;
    codigoDispositivo?: string;
    dataInicio?: string | Date;
    dataFim?: string | Date;
    limit?: number;
  }) {
    const where: any = {};

    if (filters?.sensorId) {
      where.sensor_id = filters.sensorId;
    }

    if (filters?.codigoDispositivo) {
      where.sensor = {
        dispositivo: {
          codigo: filters.codigoDispositivo,
        },
      };
    }

    if (filters?.talhaoId) {
      where.sensor = {
        ...where.sensor,
        dispositivo: {
          ...where.sensor?.dispositivo,
          talhao_id: filters.talhaoId,
        },
      };
    }

    if (filters?.dataInicio || filters?.dataFim) {
      where.data_hora = {};
      if (filters.dataInicio) {
        where.data_hora.gte = new Date(filters.dataInicio);
      }
      if (filters.dataFim) {
        where.data_hora.lte = new Date(filters.dataFim);
      }
    }

    const take = filters?.limit ? Math.min(filters.limit, 1000) : 100;

    return this.prisma.medicao.findMany({
      where,
      take,
      orderBy: {
        data_hora: 'desc',
      },
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
        alertas: true,
      },
    });
  }

  /**
   * Requisito 6.5: Consultar sensores com sua última leitura registrada.
   */
  async findLatestReadings() {
    const sensores = await this.prisma.sensor.findMany({
      include: {
        dispositivo: {
          include: {
            talhao: {
              include: {
                propriedade: true,
              },
            },
          },
        },
        medicoes: {
          orderBy: {
            data_hora: 'desc',
          },
          take: 1,
        },
      },
    });

    return sensores.map((sensor) => {
      const ultimaLeitura = sensor.medicoes[0] ?? null;
      return {
        sensorId: sensor.id,
        tipo: sensor.tipo,
        unidadeMedida: sensor.unidade_medida,
        status: sensor.status,
        dispositivo: sensor.dispositivo,
        ultimaLeitura,
      };
    });
  }

  /**
   * Requisito 6.2: Identifica o sensor e garante que o sensor e seu hardware estão ativos.
   */
  private async resolveAndValidateSensor(dto: CreateReadingDto) {
    if (!dto.sensorId && !dto.codigoDispositivo?.trim()) {
      throw new BadRequestException(
        'É obrigatório informar "sensorId" ou "codigoDispositivo".',
      );
    }

    let sensor = null;

    if (dto.sensorId) {
      sensor = await this.prisma.sensor.findUnique({
        where: { id: dto.sensorId },
        include: { dispositivo: true },
      });

      if (!sensor) {
        throw new NotFoundException(
          `Sensor com ID ${dto.sensorId} não encontrado.`,
        );
      }
    } else if (dto.codigoDispositivo) {
      const dispositivo = await this.prisma.dispositivo.findUnique({
        where: { codigo: dto.codigoDispositivo.trim() },
        include: {
          sensores: true,
        },
      });

      if (!dispositivo) {
        throw new NotFoundException(
          `Dispositivo com código "${dto.codigoDispositivo}" não encontrado.`,
        );
      }

      if (dispositivo.status !== 'ativo') {
        throw new BadRequestException(
          `Dispositivo "${dto.codigoDispositivo}" está com status inativo. Leituras rejeitadas.`,
        );
      }

      // Obtém o primeiro sensor ativo do dispositivo
      sensor = dispositivo.sensores.find((s) => s.status === 'ativo') ?? null;

      if (!sensor) {
        // Se ainda não existir sensor criado para o dispositivo, cria um padrão
        sensor = await this.prisma.sensor.create({
          data: {
            dispositivo_id: dispositivo.id,
            tipo: 'temperatura_umidade',
            unidade_medida: '°C, %',
            status: 'ativo',
          },
          include: { dispositivo: true },
        });
      }
    }

    if (!sensor) {
      throw new NotFoundException('Sensor não localizado.');
    }

    if (sensor.status !== 'ativo') {
      throw new BadRequestException(
        `Sensor #${sensor.id} está inativo. Leituras só são aceitas para sensores ativos.`,
      );
    }

    return sensor;
  }

  /**
   * Requisito 6.2: Validação de plausibilidade física dos dados recebidos.
   */
  private validatePlausibility(dto: CreateReadingDto) {
    if (dto.temperatura === undefined || dto.temperatura === null) {
      throw new BadRequestException('O campo "temperatura" é obrigatório.');
    }

    if (dto.umidade === undefined || dto.umidade === null) {
      throw new BadRequestException('O campo "umidade" é obrigatório.');
    }

    const temp = Number(dto.temperatura);
    const umid = Number(dto.umidade);

    if (Number.isNaN(temp) || temp < -50 || temp > 65) {
      throw new BadRequestException(
        `Temperatura implausível (${dto.temperatura}°C). Valores válidos: -50°C a 65°C.`,
      );
    }

    if (Number.isNaN(umid) || umid < 0 || umid > 100) {
      throw new BadRequestException(
        `Umidade implausível (${dto.umidade}%). Valores válidos: 0% a 100%.`,
      );
    }

    if (dto.umidadeSolo !== undefined && dto.umidadeSolo !== null) {
      const umidSolo = Number(dto.umidadeSolo);
      if (Number.isNaN(umidSolo) || umidSolo < 0 || umidSolo > 100) {
        throw new BadRequestException(
          `Umidade do solo implausível (${dto.umidadeSolo}%). Valores válidos: 0% a 100%.`,
        );
      }
    }

    if (dto.luminosidade !== undefined && dto.luminosidade !== null) {
      const lum = Number(dto.luminosidade);
      if (Number.isNaN(lum) || lum < 0) {
        throw new BadRequestException(
          `Luminosidade implausível (${dto.luminosidade} lux). Deve ser >= 0.`,
        );
      }
    }

    if (dto.precipitacao !== undefined && dto.precipitacao !== null) {
      const prec = Number(dto.precipitacao);
      if (Number.isNaN(prec) || prec < 0) {
        throw new BadRequestException(
          `Precipitação implausível (${dto.precipitacao} mm). Deve ser >= 0.`,
        );
      }
    }
  }
}
