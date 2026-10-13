import { Router } from "express";
import { db, mapLote } from "../lib/db";
import { autenticar } from "../middleware/auth";

const router = Router();
router.use(autenticar);

// Requisito 6 - Cadastro de Areas ou Lotes de Producao
router.get("/", (req, res) => {
  const { propriedadeId, culturaId } = req.query;
  let sql = `SELECT * FROM lotes WHERE 1=1`;
  const params: any[] = [];
  if (propriedadeId) { sql += ` AND propriedade_id = ?`; params.push(Number(propriedadeId)); }
  if (culturaId) { sql += ` AND cultura_id = ?`; params.push(Number(culturaId)); }
  res.json(db.prepare(sql).all(...params).map(mapLote));
});

router.get("/:id", (req, res) => {
  const lote = db.prepare(`SELECT * FROM lotes WHERE id = ?`).get(Number(req.params.id));
  if (!lote) return res.status(404).json({ erro: "Lote não encontrado." });
  const sensores = db.prepare(`SELECT * FROM sensores WHERE lote_id = ?`).all(lote.id);
  res.json({ ...mapLote(lote), sensores });
});

router.post("/", (req, res) => {
  const { propriedadeId, culturaId, nome, area, dataPlantio, previsaoColheita } = req.body;
  if (!propriedadeId || !culturaId || !nome) {
    return res.status(400).json({ erro: "propriedadeId, culturaId e nome são obrigatórios." });
  }
  const result = db
    .prepare(`INSERT INTO lotes (propriedade_id, cultura_id, nome, area, data_plantio, previsao_colheita) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(propriedadeId, culturaId, nome, area ?? null, dataPlantio ?? null, previsaoColheita ?? null);
  res.status(201).json(mapLote(db.prepare(`SELECT * FROM lotes WHERE id = ?`).get(result.lastInsertRowid)));
});

router.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  const atual = db.prepare(`SELECT * FROM lotes WHERE id = ?`).get(id);
  if (!atual) return res.status(404).json({ erro: "Lote não encontrado." });
  const d = { ...mapLote(atual), ...req.body };
  db.prepare(
    `UPDATE lotes SET nome=?, area=?, data_plantio=?, previsao_colheita=?, status=? WHERE id=?`
  ).run(d.nome, d.area, d.dataPlantio, d.previsaoColheita, d.status, id);
  res.json(mapLote(db.prepare(`SELECT * FROM lotes WHERE id = ?`).get(id)));
});

router.delete("/:id", (req, res) => {
  db.prepare(`UPDATE lotes SET status = 'inativo' WHERE id = ?`).run(Number(req.params.id));
  res.status(204).send();
});

export default router;
