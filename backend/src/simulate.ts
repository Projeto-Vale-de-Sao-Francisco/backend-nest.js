import "dotenv/config";
import { db } from "./lib/db";
import { verificarAlerta } from "./lib/alerts";

/**
 * Simulador de sensores IoT (substitui o ESP32 fisico durante o desenvolvimento).
 * Uso:
 *   npm run simulate          -> gera 1 leitura para cada sensor ativo e encerra
 *   npm run simulate -- loop  -> gera leituras a cada 30s continuamente (Ctrl+C para parar)
 */
function gerarLeituras() {
  const sensores = db.prepare(`
    SELECT s.id, s.codigo, c.nome as culturaNome,
           c.temperatura_min as tMin, c.temperatura_max as tMax,
           c.umidade_min as uMin, c.umidade_max as uMax
    FROM sensores s
    JOIN lotes l ON l.id = s.lote_id
    JOIN culturas c ON c.id = l.cultura_id
    WHERE s.status = 'ativo'
  `).all();

  const insert = db.prepare(`INSERT INTO leituras_sensor (sensor_id, temperatura, umidade) VALUES (?, ?, ?)`);

  for (const sensor of sensores as any[]) {
    const amplitudeTemp = (sensor.tMax - sensor.tMin) / 2;
    const centroTemp = (sensor.tMax + sensor.tMin) / 2;
    const amplitudeUm = (sensor.uMax - sensor.uMin) / 2;
    const centroUm = (sensor.uMax + sensor.uMin) / 2;

    // 10% de chance de gerar um valor fora da faixa, para exercitar os alertas
    const foraDaFaixa = Math.random() < 0.1;
    const fator = foraDaFaixa ? 1.6 : 1.0;

    const temperatura = Number((centroTemp + (Math.random() * 2 - 1) * amplitudeTemp * fator).toFixed(1));
    const umidade = Number((centroUm + (Math.random() * 2 - 1) * amplitudeUm * fator).toFixed(1));

    insert.run(sensor.id, temperatura, umidade);
    verificarAlerta(sensor.id, temperatura, umidade);

    console.log(`[${sensor.codigo}] temp=${temperatura}°C umidade=${umidade}%${foraDaFaixa ? "  ⚠ fora da faixa" : ""}`);
  }
}

function main() {
  const loop = process.argv.includes("loop");
  gerarLeituras();
  if (loop) {
    setInterval(gerarLeituras, 30_000);
    console.log("Simulador em loop (a cada 30s). Ctrl+C para encerrar.");
  }
}

main();
