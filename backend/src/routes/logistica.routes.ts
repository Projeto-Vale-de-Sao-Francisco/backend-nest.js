import { Router } from "express";
import { db, mapLogistica } from "../lib/db";
import { autenticar } from "../middleware/auth";

const router = Router();
router.use(autenticar);

// Requisito 11 - Cadastro de Informacoes Logisticas
router.get("/", (req, res) => {
  const { empresaId, loteId } = req.query;
  let sql = `SELECT * FROM operacoes_logisticas WHERE 1=1`;
  const params: any[] = [];
  if (empresaId) { sql += ` AND empresa_id = ?`; params.push(Number(empresaId)); }
  if (loteId) { sql += ` AND lote_id = ?`; params.push(Number(loteId)); }
  sql += ` ORDER BY criado_em DESC`;
  res.json(db.prepare(sql).all(...params).map(mapLogistica));
});

router.post("/", (req, res) => {
  const { empresaId, loteId, origem, destino, modal, dataPrevista, tempoEstimado, custoEstimado, transportadora } = req.body;
  if (!empresaId || !origem || !destino || !modal) {
    return res.status(400).json({ erro: "empresaId, origem, destino e modal são obrigatórios." });
  }
  const result = db
    .prepare(
      `INSERT INTO operacoes_logisticas (empresa_id, lote_id, origem, destino, modal, data_prevista, tempo_estimado, custo_estimado, transportadora)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(empresaId, loteId ?? null, origem, destino, modal, dataPrevista ?? null, tempoEstimado ?? null, custoEstimado ?? null, transportadora ?? null);
  res.status(201).json(mapLogistica(db.prepare(`SELECT * FROM operacoes_logisticas WHERE id = ?`).get(result.lastInsertRowid)));
});

export default router;
