import { BadGatewayException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { MedicoesService } from '../medicoes/medicoes.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ThingspeakService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly medicoes: MedicoesService,
  ) {}

  async enviarDados(temperatura: number, umidade: number) {
    const resposta = await axios.get('https://api.thingspeak.com/update', {
      params: { api_key: this.config.get('THINGSPEAK_WRITE_API_KEY'), field1: temperatura, field2: umidade },
    });
    return {
      channelId: this.config.get('THINGSPEAK_CHANNEL_ID'),
      respostaThingSpeak: resposta.data,
      temperatura,
      umidade,
    };
  }

  async buscarDados() {
    const channelId = this.config.get('THINGSPEAK_CHANNEL_ID');
    const resposta = await axios.get(`https://api.thingspeak.com/channels/${channelId}/feeds.json`, {
      params: { api_key: this.config.get('THINGSPEAK_READ_API_KEY'), results: 1 },
    });
    return resposta.data;
  }

  // Le a ultima medicao do canal e grava para o dispositivo informado (pelo codigo). Gera alertas como qualquer medicao.
  async salvarUltimaMedicao(codigoDispositivo: string) {
    const dispositivo = await this.prisma.dispositivo.findUnique({ where: { codigo: codigoDispositivo }, select: { id: true } });
    if (!dispositivo) throw new NotFoundException(`Dispositivo ${codigoDispositivo} não encontrado.`);

    const dados = await this.buscarDados().catch((e: Error) => {
      throw new BadGatewayException(`Falha ao consultar o ThingSpeak: ${e.message}`);
    });
    const feed = dados.feeds?.[0];
    if (!feed) throw new NotFoundException('Nenhuma medição encontrada no ThingSpeak.');

    const medicao = await this.medicoes.gravar(dispositivo.id, {
      temperatura: Number(feed.field1),
      umidade: Number(feed.field2),
      dataHora: new Date(feed.created_at).toISOString(),
    });
    return { mensagem: 'Medição salva com sucesso!', medicao };
  }
}
