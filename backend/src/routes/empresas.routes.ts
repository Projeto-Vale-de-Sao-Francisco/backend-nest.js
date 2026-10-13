import { Router } from "express";
import { db, mapEmpresa } from "../lib/db";
import { autenticar } from "../middleware/auth";

const router = Router();
router.use(autenticar);

// Requisito 3 - Cadastro de Produtores ou Empresas
router.get("/", (_req, res) => {
  res.json(db.prepare(`SELECT * FROM empresas`).all().map(mapEmpresa));
});

router.get("/:id", (req, res) => {
  const empresa = db.prepare(`SELECT * FROM empresas WHERE id = ?`).get(Number(req.params.id));
  if (!empresa) return res.status(404).json({ erro: "Empresa não encontrada." });
  const propriedades = db.prepare(`SELECT * FROM propriedades WHERE empresa_id = ?`).all(empresa.id);
  res.json({ ...mapEmpresa(empresa), propriedades });
});

router.post("/", (req, res) => {
  const { razaoSocial, nomeFantasia, cpfCnpj, telefone, email, cidade, estado } = req.body;
  if (!razaoSocial || !cpfCnpj) return res.status(400).json({ erro: "razaoSocial e cpfCnpj são obrigatórios." });
  const result = db
    .prepare(`INSERT INTO empresas (razao_social, nome_fantasia, cpf_cnpj, telefone, email, cidade, estado) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(razaoSocial, nomeFantasia ?? null, cpfCnpj, telefone ?? null, email ?? null, cidade ?? null, estado ?? null);
  const empresa = db.prepare(`SELECT * FROM empresas WHERE id = ?`).get(result.lastInsertRowid);
  res.status(201).json(mapEmpresa(empresa));
});

router.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  const atual = db.prepare(`SELECT * FROM empresas WHERE id = ?`).get(id);
  if (!atual) return res.status(404).json({ erro: "Empresa não encontrada." });
  const d = { ...mapEmpresa(atual), ...req.body };
  db.prepare(
    `UPDATE empresas SET razao_social=?, nome_fantasia=?, cpf_cnpj=?, telefone=?, email=?, cidade=?, estado=? WHERE id=?`
  ).run(d.razaoSocial, d.nomeFantasia, d.cpfCnpj, d.telefone, d.email, d.cidade, d.estado, id);
  res.json(mapEmpresa(db.prepare(`SELECT * FROM empresas WHERE id = ?`).get(id)));
});

router.delete("/:id", (req, res) => {
  db.prepare(`UPDATE empresas SET status = 0 WHERE id = ?`).run(Number(req.params.id));
  res.status(204).send();
});

export default router;
