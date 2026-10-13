import { Router } from "express";
import { db, mapDadoMercado } from "../lib/db";
import { autenticar } from "../middleware/auth";

const router = Router();
router.use(autenticar);

// Requisito 10 - Cadastro de Dados de Mercado
router.get("/", (req, res) => {
  const { culturaId } = req.query;
  const sql = culturaId
    ? `SELECT * FROM dados_mercado WHERE cultura_id = ? ORDER BY data_referencia DESC`
    : `SELECT * FROM dados_mercado ORDER BY data_referencia DESC`;
  const rows = culturaId ? db.prepare(sql).all(Number(culturaId)) : db.prepare(sql).all();
  res.json(rows.map(mapDadoMercado));
});

router.post("/", (req, res) => {
  const { culturaId, mercadoDestino, precoMedio, moeda, demandaEstimada, dataReferencia } = req.body;
  if (!culturaId || !mercadoDestino || precoMedio == null) {
    return res.status(400).json({ erro: "culturaId, mercadoDestino e precoMedio são obrigatórios." });
  }
  const result = db
    .prepare(
      `INSERT INTO dados_mercado (cultura_id, mercado_destino, preco_medio, moeda, demanda_estimada, data_referencia)
       VALUES (?, ?, ?, ?, ?, COALESCE(?, datetime('now')))`
    )
    .run(culturaId, mercadoDestino, precoMedio, moeda ?? "BRL", demandaEstimada ?? null, dataReferencia ?? null);
  res.status(201).json(mapDadoMercado(db.prepare(`SELECT * FROM dados_mercado WHERE id = ?`).get(result.lastInsertRowid)));
});

export default router;
