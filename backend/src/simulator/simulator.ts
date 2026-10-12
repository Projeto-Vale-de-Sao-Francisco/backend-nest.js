import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

// Carrega variáveis do arquivo .env em qualquer nível de execução
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'backend', '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });

interface ReadingPayload {
  codigoDispositivo: string;
  temperatura: number;
  umidade: number;
  umidadeSolo: number;
  luminosidade: number;
  precipitacao: number;
}

const API_URL = process.env.API_URL || 'http://localhost:3000';
const API_KEY = process.env.DEVICE_API_KEY || 'iot-simulator-secret-2026';

// Configurações do ThingSpeak
const THINGSPEAK_CHANNEL_ID = process.env.THINGSPEAK_CHANNEL_ID || '3502672';
const THINGSPEAK_WRITE_API_KEY =
  process.env.THINGSPEAK_WRITE_API_KEY || 'GZS2ZFL9QXV1TNLD';
const THINGSPEAK_DEVICE = process.env.THINGSPEAK_DEVICE || 'ESP32-TALHAO-01';

// O plano gratuito do ThingSpeak exige no mínimo 15s entre atualizações
const INTERVAL_SECONDS = Number(process.env.SIMULATOR_INTERVAL_SECONDS || 15);

// Lista de dispositivos simulados
const DISPOSITIVOS_SIMULADOS = [
  { codigo: 'ESP32-TALHAO-01', baseTemp: 27, baseUmid: 65 },
  { codigo: 'SEN-TH-02', baseTemp: 29, baseUmid: 55 },
];

const ONLY_THINGSPEAK =
  process.argv.includes('--only-thingspeak') ||
  process.env.SIMULATOR_LOCAL_API === 'false';

let lastThingSpeakTimestamp = 0;

/**
 * Gera flutuações plausíveis e ocasionalmente induz um valor fora da faixa
 * para testar o sistema de alertas climáticos (Requisito 9.1).
 */
function gerarLeitura(baseTemp: number, baseUmid: number): ReadingPayload {
  // 15% de chance de gerar temperatura crítica (> 36°C) para disparar alerta
  const induzirAlerta = Math.random() < 0.15;

  const tempDelta = induzirAlerta
    ? 8 + Math.random() * 2
    : (Math.random() - 0.5) * 4;

  const temperatura = Number((baseTemp + tempDelta).toFixed(1));
  const umidade = Math.max(
    10,
    Math.min(95, Number((baseUmid + (Math.random() - 0.5) * 8).toFixed(1))),
  );
  const umidadeSolo = Number((45 + Math.random() * 25).toFixed(1));
  const luminosidade = Math.round(500 + Math.random() * 4500);
  const precipitacao =
    Math.random() > 0.8 ? Number((Math.random() * 5).toFixed(1)) : 0;

  return {
    codigoDispositivo: '',
    temperatura,
    umidade,
    umidadeSolo,
    luminosidade,
    precipitacao,
  };
}

async function enviarLeitura(payload: ReadingPayload) {
  if (ONLY_THINGSPEAK) {
    return;
  }

  try {
    const response = await axios.post(`${API_URL}/readings`, payload, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY, // Requisito 6.6
      },
      timeout: 5000,
    });

    const { alertasGerados } = response.data;
    console.log(
      `[API LOCAL] [OK] Dispositivo: ${payload.codigoDispositivo} gravado no banco local | ` +
        `Temp: ${payload.temperatura}°C | Umid: ${payload.umidade}% | Solo: ${payload.umidadeSolo}%`,
    );

    if (alertasGerados && alertasGerados.length > 0) {
      alertasGerados.forEach((alerta: any) => {
        console.warn(
          `[ALERTA CLIMÁTICO GERADO] Nível: ${alerta.nivel} | ${alerta.titulo}: ${alerta.descricao}`,
        );
      });
    }
  } catch (error: any) {
    if (error.response) {
      const msg = error.response.data?.message || error.response.data;
      if (error.response.status === 503 || error.response.status === 500) {
        console.warn(
          `[API LOCAL] [AVISO] PostgreSQL offline no localhost:5432. Telemetria de ${payload.codigoDispositivo} não salva no banco local.`,
        );
      } else {
        console.error(
          `[API LOCAL] [ERRO ${error.response.status}] ${payload.codigoDispositivo}:`,
          msg,
        );
      }
    } else {
      console.warn(
        `[API LOCAL] [AVISO] Backend offline (${API_URL}). Telemetria não salva no banco local.`,
      );
    }
  }
}

/**
 * Envia as leituras climáticas para o canal do ThingSpeak via HTTP API.
 * Respeita a taxa limite do ThingSpeak (mínimo de 15 segundos entre requisições).
 */
async function enviarParaThingSpeak(payload: ReadingPayload) {
  if (!THINGSPEAK_WRITE_API_KEY) {
    return;
  }

  const now = Date.now();
  const tempoDecorrido = (now - lastThingSpeakTimestamp) / 1000;

  if (lastThingSpeakTimestamp > 0 && tempoDecorrido < 15) {
    console.log(
      `[THINGSPEAK] [RATE LIMIT] Intervalo mínimo de 15s ainda não atingido (${tempoDecorrido.toFixed(0)}s decorridos). Aguardando próximo ciclo.`,
    );
    return;
  }

  try {
    const params: Record<string, any> = {
      api_key: THINGSPEAK_WRITE_API_KEY,
      field1: payload.temperatura,
      field2: payload.umidade,
    };

    if (payload.umidadeSolo !== undefined) {
      params.field3 = payload.umidadeSolo;
    }
    if (payload.luminosidade !== undefined) {
      params.field4 = payload.luminosidade;
    }
    if (payload.precipitacao !== undefined) {
      params.field5 = payload.precipitacao;
    }
    params.status = `Dispositivo: ${payload.codigoDispositivo}`;

    const response = await axios.get('https://api.thingspeak.com/update', {
      params,
      timeout: 10000,
    });

    const entryId = Number(response.data);

    if (entryId > 0) {
      lastThingSpeakTimestamp = Date.now();
      console.log(
        `[THINGSPEAK] [OK] Dados enviados com sucesso! Entry ID: ${entryId} | Canal: ${THINGSPEAK_CHANNEL_ID} | ` +
          `Temp: ${payload.temperatura}°C | Umid: ${payload.umidade}% (Dispositivo: ${payload.codigoDispositivo})`,
      );
    } else {
      console.warn(
        `[THINGSPEAK] [RATE LIMIT] Resposta: 0. O ThingSpeak rejeitou a escrita (mínimo de 15s entre envios).`,
      );
    }
  } catch (error: any) {
    console.error(
      `[THINGSPEAK] [ERRO] Falha ao enviar para o ThingSpeak:`,
      error.message,
    );
  }
}

async function cicloSimulacao() {
  for (const item of DISPOSITIVOS_SIMULADOS) {
    const dados = gerarLeitura(item.baseTemp, item.baseUmid);
    dados.codigoDispositivo = item.codigo;

    // 1. Envia para a API local (PostgreSQL / Alertas)
    await enviarLeitura(dados);

    // 2. Repassa para o ThingSpeak se for o dispositivo vinculado ao canal
    if (item.codigo === THINGSPEAK_DEVICE) {
      await enviarParaThingSpeak(dados);
    }
  }
}

async function main() {
  const isOnce = process.argv.includes('--once');

  console.log('====================================================');
  console.log('  SIMULADOR DE SENSORES IoT INICIADO (Requisito 6.4) ');
  console.log(
    `  Alvo Local: ${ONLY_THINGSPEAK ? 'Desativado (--only-thingspeak)' : `${API_URL}/readings`}`,
  );
  console.log(`  ThingSpeak Canal: ${THINGSPEAK_CHANNEL_ID}`);
  console.log(`  ThingSpeak Dispositivo Vinculado: ${THINGSPEAK_DEVICE}`);
  console.log(`  Intervalo: ${INTERVAL_SECONDS} segundos`);
  console.log('====================================================');

  await cicloSimulacao();

  if (!isOnce) {
    setInterval(cicloSimulacao, INTERVAL_SECONDS * 1000);
  }
}

main().catch((err) => {
  console.error('Erro fatal no simulador:', err);
});
