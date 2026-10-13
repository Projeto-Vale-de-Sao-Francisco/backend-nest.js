import { Router } from "express";
import { db, mapLeitura } from "../lib/db";
import { autenticar } from "../middleware/auth";
import { verificarAlerta } from "../lib/alerts";

const router = Router();
router.use(autenticar);

// Requisitos 8 e 9 - Registro de Leituras + API REST para dados IoT
router.post("/", (req, res) => {
  const { sensorId, temperatura, umidade, umidadeSolo, luminosidade, precipitacao, dataHora } = req.body;
  if (!sensorId || temperatura == null || umidade == null) {
    return res.status(400).json({ erro: "sensorId, temperatura e umidade são obrigatórios." });
  }
  const result = db
    .prepare(
      `INSERT INTO leituras_sensor (sensor_id, temperatura, umidade, umidade_solo, luminosidade, precipitacao, data_hora)
       VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, strftime('%Y-%m-%dT%H:%M:%fZ','now')))`
    )
    .run(sensorId, temperatura, umidade, umidadeSolo ?? null, luminosidade ?? null, precipitacao ?? null, dataHora ?? null);

  verificarAlerta(sensorId, temperatura, umidade);

  res.status(201).json(mapLeitura(db.prepare(`SELECT * FROM leituras_sensor WHERE id = ?`).get(result.lastInsertRowid)));
});

// GET /leituras - consultar/filtrar por sensor, lote, propriedade, cultura e periodo
router.get("/", (req, res) => {
  const { sensorId, loteId, propriedadeId, culturaId, inicio, fim, limite } = req.query;

  let sql = `
    SELECT ls.* FROM leituras_sensor ls
    JOIN sensores s ON s.id = ls.sensor_id
    JOIN lotes l ON l.id = s.lote_id
    WHERE 1=1`;
  const params: any[] = [];

  if (sensorId) { sql += ` AND ls.sensor_id = ?`; params.push(Number(sensorId)); }
  if (loteId) { sql += ` AND l.id = ?`; params.push(Number(loteId)); }
  if (propriedadeId) { sql += ` AND l.propriedade_id = ?`; params.push(Number(propriedadeId)); }
  if (culturaId) { sql += ` AND l.cultura_id = ?`; params.push(Number(culturaId)); }
  if (inicio) { sql += ` AND ls.data_hora >= ?`; params.push(String(inicio)); }
  if (fim) { sql += ` AND ls.data_hora <= ?`; params.push(String(fim)); }

  sql += ` ORDER BY ls.data_hora DESC LIMIT ?`;
  params.push(limite ? Number(limite) : 200);

  res.json(db.prepare(sql).all(...params).map(mapLeitura));
});

export default router;
