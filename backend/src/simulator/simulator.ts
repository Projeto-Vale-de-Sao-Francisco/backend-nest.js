import axios from 'axios';

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
const INTERVAL_SECONDS = Number(process.env.SIMULATOR_INTERVAL_SECONDS || 5);

// Lista de dispositivos simulados
const DISPOSITIVOS_SIMULADOS = [
  { codigo: 'ESP32-TALHAO-01', baseTemp: 27, baseUmid: 65 },
  { codigo: 'SEN-TH-02', baseTemp: 29, baseUmid: 55 },
];

/**
 * Gera flutuações plausíveis e ocasionalmente induz um valor fora da faixa
 * para testar o sistema de alertas climáticos (Requisito 9.1).
 */
function gerarLeitura(baseTemp: number, baseUmid: number): ReadingPayload {
  // 10% de chance de gerar temperatura crítica (> 36°C) para disparar alerta
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
  try {
    const response = await axios.post(`${API_URL}/readings`, payload, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY, // Requisito 6.6
      },
    });

    const { alertasGerados } = response.data;
    console.log(
      `[SIMULADOR] [OK] Dispositivo: ${payload.codigoDispositivo} | ` +
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
      console.error(
        `[SIMULADOR] [ERRO ${error.response.status}] ${payload.codigoDispositivo}:`,
        error.response.data?.message || error.response.data,
      );
    } else {
      console.error(
        `[SIMULADOR] Falha de conexão com a API (${API_URL}):`,
        error.message,
      );
    }
  }
}

async function cicloSimulacao() {
  for (const item of DISPOSITIVOS_SIMULADOS) {
    const dados = gerarLeitura(item.baseTemp, item.baseUmid);
    dados.codigoDispositivo = item.codigo;
    await enviarLeitura(dados);
  }
}

async function main() {
  const isOnce = process.argv.includes('--once');

  console.log('====================================================');
  console.log('  SIMULADOR DE SENSORES IoT INICIADO (Requisito 6.4) ');
  console.log(`  Alvo: ${API_URL}/readings`);
  console.log(`  Autenticação x-api-key: ${API_KEY}`);
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
