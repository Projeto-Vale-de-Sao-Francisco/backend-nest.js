import { Router } from "express";
import { db, mapAlerta } from "../lib/db";
import { autenticar } from "../middleware/auth";

const router = Router();
router.use(autenticar);

// Requisito 14 - Alertas Climaticos Basicos
router.get("/", (req, res) => {
  const { loteId, visualizado } = req.query;
  let sql = `SELECT * FROM alertas WHERE 1=1`;
  const params: any[] = [];
  if (loteId) { sql += ` AND lote_id = ?`; params.push(Number(loteId)); }
  if (visualizado != null) { sql += ` AND visualizado = ?`; params.push(visualizado === "true" ? 1 : 0); }
  sql += ` ORDER BY data_hora DESC LIMIT 100`;
  res.json(db.prepare(sql).all(...params).map(mapAlerta));
});

router.patch("/:id/visualizar", (req, res) => {
  db.prepare(`UPDATE alertas SET visualizado = 1 WHERE id = ?`).run(Number(req.params.id));
  res.json(mapAlerta(db.prepare(`SELECT * FROM alertas WHERE id = ?`).get(Number(req.params.id))));
});

export default router;
