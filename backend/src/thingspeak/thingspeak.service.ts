import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AlertsService } from '../alerts/alerts.service.js';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';

@Injectable()
export class ThingspeakService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly alerts: AlertsService,
    private readonly audit: AuditService,
  ) {}
  private requiredConfig(name: 'THINGSPEAK_CHANNEL_ID' | 'THINGSPEAK_WRITE_API_KEY' | 'THINGSPEAK_READ_API_KEY') {
    const value = process.env[name]?.trim();
    if (!value) {
      throw new ServiceUnavailableException(
        `Integração ThingSpeak indisponível: ${name} não configurada.`,
      );
    }
    return value;
  }
  async enviarDados(
    temperatura: number,
    umidade: number,
    usuarioId?: number,
    ipOrigem?: string,
  ) {
    if (
      !Number.isFinite(temperatura) ||
      temperatura < -50 ||
      temperatura > 65 ||
      !Number.isFinite(umidade) ||
      umidade < 0 ||
      umidade > 100
    ) {
      throw new BadRequestException('Temperatura ou umidade inválida.');
    }
    const channelId = this.requiredConfig('THINGSPEAK_CHANNEL_ID');
    const writeApiKey = this.requiredConfig('THINGSPEAK_WRITE_API_KEY');

    await this.prisma.$transaction((tx) =>
      this.audit.record(
        {
          usuarioId,
          acao: 'ENVIAR_DADOS',
          recurso: 'THINGSPEAK',
          ipOrigem,
        },
        tx,
      ),
    );
    const resposta = await axios.get('https://api.thingspeak.com/update', {
      params: {
        api_key: writeApiKey,
        field1: temperatura,
        field2: umidade,
      },
    });

    return {
      channelId,
      respostaThingSpeak: resposta.data,
      temperatura,
      umidade,
    };
  }

  async buscarDados() {
    const channelId = this.requiredConfig('THINGSPEAK_CHANNEL_ID');
    const readApiKey = this.requiredConfig('THINGSPEAK_READ_API_KEY');

    const resposta = await axios.get(
      `https://api.thingspeak.com/channels/${channelId}/feeds.json`,
      {
        params: {
          api_key: readApiKey,
          results: 1,
        },
      },
    );

    return resposta.data;
  }

  async listarDispositivos() {
    return this.prisma.dispositivo.findMany();
  }

  async salvarUltimaMedicao(usuarioId?: number, ipOrigem?: string) {
    const raw = this.config.get<string>('THINGSPEAK_SENSOR_ID');
    if (
      !raw ||
      !/^\d+$/.test(raw) ||
      !Number.isSafeInteger(Number(raw)) ||
      Number(raw) < 1
    )
      throw new ServiceUnavailableException(
        'Configure THINGSPEAK_SENSOR_ID com um id positivo',
      );
    const sensorId = Number(raw);
    const sensor = await this.prisma.sensor.findUnique({
      where: { id: sensorId },
      include: { dispositivo: true },
    });
    if (!sensor)
      throw new NotFoundException('Sensor configurado não encontrado');
    if (
      sensor.tipo !== 'temperatura_umidade' ||
      sensor.status !== 'ativo' ||
      sensor.dispositivo.status !== 'ativo'
    )
      throw new BadRequestException(
        'A importação exige sensor temperatura_umidade e dispositivo ativos',
      );
    let dados;
    try {
      dados = await this.buscarDados();
    } catch {
      throw new BadGatewayException('Não foi possível consultar o ThingSpeak');
    }
    const feed = dados?.feeds?.[0];
    if (!feed)
      throw new BadGatewayException('Nenhuma medição encontrada no ThingSpeak');
    const numero = (valor: unknown, min: number, max: number) => {
      if (
        (typeof valor !== 'string' && typeof valor !== 'number') ||
        String(valor).trim() === ''
      )
        throw new BadGatewayException('Leitura inválida do ThingSpeak');
      const convertido = Number(valor);
      if (!Number.isFinite(convertido) || convertido < min || convertido > max)
        throw new BadGatewayException('Leitura inválida do ThingSpeak');
      return convertido;
    };
    const temperatura = numero(feed.field1, -50, 65);
    const umidade = numero(feed.field2, 0, 100);
    if (
      typeof feed.created_at !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(feed.created_at)
    )
      throw new BadGatewayException('Data inválida do ThingSpeak');
    const dataHora = new Date(feed.created_at);
    if (!Number.isFinite(dataHora.getTime()) || dataHora.getTime() > Date.now())
      throw new BadGatewayException('Data inválida do ThingSpeak');
    const resultado = await this.prisma.$transaction(async (tx) => {
      // Serializa importações do sensor entre processos sem mudar o schema.
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(74006, ${sensorId}::int)`;
      const atual = await tx.sensor.findUnique({
        where: { id: sensorId },
        include: { dispositivo: true },
      });
      if (
        !atual ||
        atual.tipo !== 'temperatura_umidade' ||
        atual.status !== 'ativo' ||
        atual.dispositivo.status !== 'ativo'
      )
        throw new BadRequestException(
          'Sensor ou dispositivo indisponível para importação',
        );
      const existente = await tx.medicao.findFirst({
        where: { sensor_id: sensorId, data_hora: dataHora },
      });
      if (existente) return { medicao: existente, importada: false };
      const medicao = await tx.medicao.create({
        data: {
          sensor_id: sensorId,
          temperatura,
          umidade,
          data_hora: dataHora,
        },
      });
      await this.audit.record(
        {
          usuarioId,
          acao: 'IMPORTAR',
          recurso: 'LEITURA_THINGSPEAK',
          recursoId: medicao.id,
          ipOrigem,
        },
        tx,
      );
      return { medicao, importada: true };
    });
    const alertasGerados = resultado.importada
      ? await this.alerts.checkAndCreateAlerts(
          resultado.medicao.id,
          sensorId,
          ipOrigem,
        )
      : [];
    return {
      mensagem: resultado.importada
        ? 'Medição salva com sucesso!'
        : 'Medição já importada',
      ...resultado,
      alertasGerados,
    };
  }
}
