import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Optional,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AlertsService } from '../alerts/alerts.service.js';
import { PipelineService } from '../pipeline/pipeline.service.js';
import { CreateReadingDto } from './dto/create-reading.dto.js';
import { AuditService } from '../audit/audit.service.js';
import {
  authorizedPropertyIds,
  type PropertyActor,
} from '../common/property-access.js';

@Injectable()
export class ReadingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alertsService: AlertsService,
    private readonly audit: AuditService,
    @Optional() private readonly pipelineService?: PipelineService,
  ) {}

  /**
   * Requisito 6.1, 6.2, 6.7: Registra e valida uma leitura e aciona geração de alertas (9.1).
   */
  async create(
    dto: CreateReadingDto,
    authenticatedDeviceId: number,
    ipOrigem?: string,
  ) {
    this.validatePlausibility(dto);

    try {
      const sensor = await this.resolveAndValidateSensor(
        dto,
        authenticatedDeviceId,
      );

      const dataHora = dto.dataHora ? new Date(dto.dataHora) : new Date();
      if (Number.isNaN(dataHora.getTime())) {
        throw new BadRequestException('Data/hora da leitura inválida.');
      }

      const medicao = await this.prisma.$transaction(async (tx) => {
        const registro = await tx.medicao.create({
          data: {
            sensor_id: sensor.id,
            data_hora: dataHora,
            temperatura: dto.temperatura,
            umidade: dto.umidade,
            umidade_solo: dto.umidadeSolo ?? null,
            luminosidade: dto.luminosidade ?? null,
            precipitacao: dto.precipitacao ?? null,
            pressao: dto.pressao ?? null,
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
        await this.audit.record(
          {
            acao: 'RECEBER',
            recurso: 'LEITURA',
            recursoId: registro.id,
            ipOrigem,
          },
          tx,
        );
        return registro;
      });

      // Requisito 9.1: Processa alertas climáticos automaticamente
      const alertas = await this.alertsService.checkAndCreateAlerts(
        medicao.id,
        sensor.id,
        ipOrigem,
      );

      if (this.pipelineService) {
        await this.pipelineService.executeAutomatic([
          {
            source: 'sensor' as const,
            id: medicao.id,
            sensorId: sensor.id,
            variable: 'temperatura',
            value: dto.temperatura,
            unit: sensor.unidade_medida,
            timestamp: medicao.data_hora,
            location: (sensor as any).dispositivo?.talhao?.nome ?? null,
          },
          {
            source: 'sensor' as const,
            id: medicao.id,
            sensorId: sensor.id,
            variable: 'umidade',
            value: dto.umidade,
            unit: sensor.unidade_medida,
            timestamp: medicao.data_hora,
            location: (sensor as any).dispositivo?.talhao?.nome ?? null,
          },
          ...(dto.umidadeSolo !== undefined && dto.umidadeSolo !== null
            ? [{
                source: 'sensor' as const,
                id: medicao.id,
                sensorId: sensor.id,
                variable: 'umidade_solo',
                value: dto.umidadeSolo,
                unit: '%',
                timestamp: medicao.data_hora,
                location: (sensor as any).dispositivo?.talhao?.nome ?? null,
              }]
            : []),
          ...(dto.luminosidade !== undefined && dto.luminosidade !== null
            ? [{
                source: 'sensor' as const,
                id: medicao.id,
                sensorId: sensor.id,
                variable: 'luminosidade',
                value: dto.luminosidade,
                unit: 'lux',
                timestamp: medicao.data_hora,
                location: (sensor as any).dispositivo?.talhao?.nome ?? null,
              }]
            : []),
          ...(dto.precipitacao !== undefined && dto.precipitacao !== null
            ? [{
                source: 'sensor' as const,
                id: medicao.id,
                sensorId: sensor.id,
                variable: 'precipitacao',
                value: dto.precipitacao,
                unit: 'mm',
                timestamp: medicao.data_hora,
                location: (sensor as any).dispositivo?.talhao?.nome ?? null,
              }]
            : []),
          ...(dto.pressao !== undefined && dto.pressao !== null
            ? [{
                source: 'sensor' as const,
                id: medicao.id,
                sensorId: sensor.id,
                variable: 'pressao',
                value: dto.pressao,
                unit: 'hPa',
                timestamp: medicao.data_hora,
                location: (sensor as any).dispositivo?.talhao?.nome ?? null,
              }]
            : []),
        ] as any);
      }

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
          'Banco de dados indisponível para registrar a leitura.',
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
  }, actor?: PropertyActor) {
    const where: any = {};
    const propertyIds = actor
      ? await authorizedPropertyIds(this.prisma, actor)
      : [];

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

    if (propertyIds !== null) {
      where.sensor = {
        ...where.sensor,
        dispositivo: {
          ...where.sensor?.dispositivo,
          talhao: {
            ...where.sensor?.dispositivo?.talhao,
            propriedade_id: { in: propertyIds },
          },
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
  async findLatestReadings(actor?: PropertyActor) {
    const propertyIds = actor
      ? await authorizedPropertyIds(this.prisma, actor)
      : [];
    const sensores = await this.prisma.sensor.findMany({
      where:
        propertyIds === null
          ? undefined
          : {
              dispositivo: {
                talhao: { propriedade_id: { in: propertyIds } },
              },
            },
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
  private async resolveAndValidateSensor(
    dto: CreateReadingDto,
    authenticatedDeviceId: number,
  ) {
    if (
      !Number.isSafeInteger(authenticatedDeviceId) ||
      authenticatedDeviceId < 1
    ) {
      throw new UnauthorizedException('Credencial do dispositivo inválida.');
    }

    if (!dto.sensorId && !dto.codigoDispositivo?.trim()) {
      throw new BadRequestException(
        'É obrigatório informar "sensorId" ou "codigoDispositivo".',
      );
    }

    const dispositivo = await this.prisma.dispositivo.findUnique({
      where: { id: authenticatedDeviceId },
      include: { sensores: true, talhao: true },
    });

    if (!dispositivo) {
      throw new UnauthorizedException('Credencial do dispositivo inválida.');
    }

    if (dispositivo.status !== 'ativo') {
      throw new BadRequestException(
        'Dispositivo inativo. Leituras rejeitadas.',
      );
    }

    if (
      dto.codigoDispositivo?.trim() &&
      dto.codigoDispositivo.trim() !== dispositivo.codigo
    ) {
      throw new ForbiddenException(
        'A leitura não pertence ao dispositivo autenticado.',
      );
    }

    const sensor = dto.sensorId
      ? dispositivo.sensores.find((item) => item.id === dto.sensorId)
      : dispositivo.sensores.find((item) => item.status === 'ativo');

    if (!sensor) {
      if (dto.sensorId) {
        throw new ForbiddenException(
          'A leitura não pertence ao dispositivo autenticado.',
        );
      }
      throw new BadRequestException(
        'Dispositivo sem sensor ativo. Ative o sensor antes de enviar leituras.',
      );
    }

    if (sensor.status !== 'ativo') {
      throw new BadRequestException(
        `Sensor #${sensor.id} está inativo. Leituras só são aceitas para sensores ativos.`,
      );
    }

    return {
      ...sensor,
      dispositivo: {
        id: dispositivo.id,
        codigo: dispositivo.codigo,
        status: dispositivo.status,
        talhao: dispositivo.talhao,
      },
    };
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
