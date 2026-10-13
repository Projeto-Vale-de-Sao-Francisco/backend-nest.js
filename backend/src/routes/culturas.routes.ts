import { Router } from "express";
import { db, mapCultura } from "../lib/db";
import { autenticar } from "../middleware/auth";

const router = Router();
router.use(autenticar);

// Requisito 5 - Cadastro de Culturas
router.get("/", (_req, res) => {
  res.json(db.prepare(`SELECT * FROM culturas`).all().map(mapCultura));
});

router.get("/:id", (req, res) => {
  const cultura = db.prepare(`SELECT * FROM culturas WHERE id = ?`).get(Number(req.params.id));
  if (!cultura) return res.status(404).json({ erro: "Cultura não encontrada." });
  res.json(mapCultura(cultura));
});

router.post("/", (req, res) => {
  const { nome, variedade, temperaturaMin, temperaturaMax, umidadeMin, umidadeMax, cicloMedioDias, descricao } = req.body;
  if (!nome || temperaturaMin == null || temperaturaMax == null || umidadeMin == null || umidadeMax == null) {
    return res.status(400).json({ erro: "nome, temperaturaMin/Max e umidadeMin/Max são obrigatórios." });
  }
  const result = db
    .prepare(`INSERT INTO culturas (nome, variedade, temperatura_min, temperatura_max, umidade_min, umidade_max, ciclo_medio_dias, descricao) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(nome, variedade ?? null, temperaturaMin, temperaturaMax, umidadeMin, umidadeMax, cicloMedioDias ?? null, descricao ?? null);
  res.status(201).json(mapCultura(db.prepare(`SELECT * FROM culturas WHERE id = ?`).get(result.lastInsertRowid)));
});

router.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  const atual = db.prepare(`SELECT * FROM culturas WHERE id = ?`).get(id);
  if (!atual) return res.status(404).json({ erro: "Cultura não encontrada." });
  const d = { ...mapCultura(atual), ...req.body };
  db.prepare(
    `UPDATE culturas SET nome=?, variedade=?, temperatura_min=?, temperatura_max=?, umidade_min=?, umidade_max=?, ciclo_medio_dias=?, descricao=? WHERE id=?`
  ).run(d.nome, d.variedade, d.temperaturaMin, d.temperaturaMax, d.umidadeMin, d.umidadeMax, d.cicloMedioDias, d.descricao, id);
  res.json(mapCultura(db.prepare(`SELECT * FROM culturas WHERE id = ?`).get(id)));
});

router.delete("/:id", (req, res) => {
  db.prepare(`DELETE FROM culturas WHERE id = ?`).run(Number(req.params.id));
  res.status(204).send();
});

export default router;
