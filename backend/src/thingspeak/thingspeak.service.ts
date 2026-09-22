import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ThingspeakService {
  constructor(private readonly prisma: PrismaService) {}
  async enviarDados(temperatura: number, umidade: number) {
    const channelId = process.env.THINGSPEAK_CHANNEL_ID;
    const writeApiKey = process.env.THINGSPEAK_WRITE_API_KEY;

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
    const channelId = process.env.THINGSPEAK_CHANNEL_ID;
    const readApiKey = process.env.THINGSPEAK_READ_API_KEY;

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

  async salvarUltimaMedicao() {
  const dados = await this.buscarDados();

  const feed = dados.feeds[0];

  if (!feed) {
    throw new Error('Nenhuma medição encontrada no ThingSpeak.');
  }

  const temperatura = Number(feed.field1);
  const umidade = Number(feed.field2);
  const dataHora = new Date(feed.created_at);

  const medicao = await this.prisma.medicao.create({
    data: {
      dispositivoId: 1,
      temperatura,
      umidade,
      dataHora,
    },
  });

  return {
    mensagem: 'Medição salva com sucesso!',
    medicao,
  };
}

}