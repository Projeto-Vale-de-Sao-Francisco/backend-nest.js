import { db } from "./db";

/**
 * Verifica uma leitura recem-criada contra os limites da cultura do lote
 * e gera um Alerta automaticamente quando fora da faixa recomendada.
 * (Requisito 14 - Alertas Climaticos Basicos)
 */
export function verificarAlerta(sensorId: number, temperatura: number, umidade: number) {
  const sensor: any = db
    .prepare(
      `SELECT s.lote_id as loteId, c.nome as culturaNome,
              c.temperatura_min as tMin, c.temperatura_max as tMax,
              c.umidade_min as uMin, c.umidade_max as uMax
       FROM sensores s
       JOIN lotes l ON l.id = s.lote_id
       JOIN culturas c ON c.id = l.cultura_id
       WHERE s.id = ?`
    )
    .get(sensorId);

  if (!sensor) return;

  const problemas: string[] = [];
  const nome = String(sensor.culturaNome).toLowerCase();

  if (temperatura > sensor.tMax) problemas.push(`Temperatura acima do recomendado para o lote de ${nome} (${temperatura}°C > ${sensor.tMax}°C).`);
  if (temperatura < sensor.tMin) problemas.push(`Temperatura abaixo do recomendado para o lote de ${nome} (${temperatura}°C < ${sensor.tMin}°C).`);
  if (umidade > sensor.uMax) problemas.push(`Umidade acima do recomendado para o lote de ${nome} (${umidade}% > ${sensor.uMax}%).`);
  if (umidade < sensor.uMin) problemas.push(`Umidade abaixo do recomendado para o lote de ${nome} (${umidade}% < ${sensor.uMin}%).`);

  const insert = db.prepare(
    `INSERT INTO alertas (lote_id, sensor_id, tipo, nivel, titulo, descricao) VALUES (?, ?, 'climatico', 'atencao', 'Alerta climático', ?)`
  );
  for (const descricao of problemas) {
    insert.run(sensor.loteId, sensorId, descricao);
  }
}
