import { Router } from "express";
import { db } from "../lib/db";
import { autenticar } from "../middleware/auth";

const router = Router();
router.use(autenticar);

// Requisito 12 - Dashboard Climatico Inicial
router.get("/resumo", (_req, res) => {
  const sensoresAtivos = (db.prepare(`SELECT COUNT(*) as n FROM sensores WHERE status = 'ativo'`).get() as any).n;
  const totalLeituras = (db.prepare(`SELECT COUNT(*) as n FROM leituras_sensor`).get() as any).n;
  const alertasAtivos = (db.prepare(`SELECT COUNT(*) as n FROM alertas WHERE visualizado = 0`).get() as any).n;

  const ultimas = db.prepare(`SELECT * FROM leituras_sensor ORDER BY data_hora DESC LIMIT 50`).all();
  const mediaTemp = ultimas.length ? ultimas.reduce((s: number, l: any) => s + l.temperatura, 0) / ultimas.length : 0;
  const mediaUmidade = ultimas.length ? ultimas.reduce((s: number, l: any) => s + l.umidade, 0) / ultimas.length : 0;

  res.json({
    temperaturaAtual: ultimas[0]?.temperatura ?? null,
    umidadeAtual: ultimas[0]?.umidade ?? null,
    temperaturaMedia: Number(mediaTemp.toFixed(1)),
    umidadeMedia: Number(mediaUmidade.toFixed(1)),
    sensoresAtivos,
    totalLeituras,
    alertasAtivos,
  });
});

// Requisito 13 - Visualizacao Historica dos Dados
router.get("/historico", (req, res) => {
  const { propriedadeId, loteId, culturaId, sensorId, inicio, fim } = req.query;

  let sql = `
    SELECT ls.data_hora as dataHora, ls.temperatura, ls.umidade, l.id as loteId FROM leituras_sensor ls
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

  sql += ` ORDER BY ls.data_hora ASC LIMIT 500`;

  res.json(db.prepare(sql).all(...params));
});

export default router;
