import { Router } from "express";
import { db, mapPropriedade, mapLote } from "../lib/db";
import { autenticar } from "../middleware/auth";

const router = Router();
router.use(autenticar);

// Requisito 4 - Cadastro de Propriedades Rurais
router.get("/", (req, res) => {
  const { empresaId } = req.query;
  const rows = empresaId
    ? db.prepare(`SELECT * FROM propriedades WHERE empresa_id = ?`).all(Number(empresaId))
    : db.prepare(`SELECT * FROM propriedades`).all();
  res.json(rows.map(mapPropriedade));
});

router.get("/:id", (req, res) => {
  const propriedade = db.prepare(`SELECT * FROM propriedades WHERE id = ?`).get(Number(req.params.id));
  if (!propriedade) return res.status(404).json({ erro: "Propriedade não encontrada." });
  const lotes = db.prepare(`SELECT * FROM lotes WHERE propriedade_id = ?`).all(propriedade.id);
  res.json({ ...mapPropriedade(propriedade), lotes: lotes.map(mapLote) });
});

router.post("/", (req, res) => {
  const { empresaId, nome, municipio, estado, latitude, longitude, areaTotal } = req.body;
  if (!empresaId || !nome || !municipio || !estado) {
    return res.status(400).json({ erro: "empresaId, nome, municipio e estado são obrigatórios." });
  }
  const result = db
    .prepare(`INSERT INTO propriedades (empresa_id, nome, municipio, estado, latitude, longitude, area_total) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(empresaId, nome, municipio, estado, latitude ?? null, longitude ?? null, areaTotal ?? null);
  res.status(201).json(mapPropriedade(db.prepare(`SELECT * FROM propriedades WHERE id = ?`).get(result.lastInsertRowid)));
});

router.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  const atual = db.prepare(`SELECT * FROM propriedades WHERE id = ?`).get(id);
  if (!atual) return res.status(404).json({ erro: "Propriedade não encontrada." });
  const d = { ...mapPropriedade(atual), ...req.body };
  db.prepare(
    `UPDATE propriedades SET nome=?, municipio=?, estado=?, latitude=?, longitude=?, area_total=? WHERE id=?`
  ).run(d.nome, d.municipio, d.estado, d.latitude, d.longitude, d.areaTotal, id);
  res.json(mapPropriedade(db.prepare(`SELECT * FROM propriedades WHERE id = ?`).get(id)));
});

router.delete("/:id", (req, res) => {
  db.prepare(`UPDATE propriedades SET status = 0 WHERE id = ?`).run(Number(req.params.id));
  res.status(204).send();
});

export default router;
