import { Router } from "express";
import { db, mapSensor } from "../lib/db";
import { autenticar } from "../middleware/auth";

const router = Router();
router.use(autenticar);

// Requisito 7 - Cadastro de Sensores IoT Simulados
router.get("/", (req, res) => {
  const { loteId, status } = req.query;
  let sql = `SELECT * FROM sensores WHERE 1=1`;
  const params: any[] = [];
  if (loteId) { sql += ` AND lote_id = ?`; params.push(Number(loteId)); }
  if (status) { sql += ` AND status = ?`; params.push(String(status)); }
  res.json(db.prepare(sql).all(...params).map(mapSensor));
});

router.get("/:id", (req, res) => {
  const sensor = db.prepare(`SELECT * FROM sensores WHERE id = ?`).get(Number(req.params.id));
  if (!sensor) return res.status(404).json({ erro: "Sensor não encontrado." });
  res.json(mapSensor(sensor));
});

router.post("/", (req, res) => {
  const { loteId, codigo, tipo, latitude, longitude } = req.body;
  if (!loteId || !codigo) return res.status(400).json({ erro: "loteId e codigo são obrigatórios." });
  const result = db
    .prepare(`INSERT INTO sensores (lote_id, codigo, tipo, latitude, longitude) VALUES (?, ?, ?, ?, ?)`)
    .run(loteId, codigo, tipo ?? "temperatura_umidade", latitude ?? null, longitude ?? null);
  res.status(201).json(mapSensor(db.prepare(`SELECT * FROM sensores WHERE id = ?`).get(result.lastInsertRowid)));
});

router.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  const atual = db.prepare(`SELECT * FROM sensores WHERE id = ?`).get(id);
  if (!atual) return res.status(404).json({ erro: "Sensor não encontrado." });
  const d = { ...mapSensor(atual), ...req.body };
  db.prepare(`UPDATE sensores SET codigo=?, tipo=?, latitude=?, longitude=?, status=? WHERE id=?`)
    .run(d.codigo, d.tipo, d.latitude, d.longitude, d.status, id);
  res.json(mapSensor(db.prepare(`SELECT * FROM sensores WHERE id = ?`).get(id)));
});

router.delete("/:id", (req, res) => {
  db.prepare(`UPDATE sensores SET status = 'inativo' WHERE id = ?`).run(Number(req.params.id));
  res.status(204).send();
});

export default router;
