import { Router } from "express";
import { db, mapUsuario } from "../lib/db";
import { autenticar, autorizar } from "../middleware/auth";

const router = Router();
router.use(autenticar);

// GET /usuarios - lista (somente admin/gestor)
router.get("/", autorizar("ADMINISTRADOR", "GESTOR"), (_req, res) => {
  const usuarios = db.prepare(`SELECT * FROM usuarios`).all();
  res.json(usuarios.map(mapUsuario));
});

router.get("/:id", (req, res) => {
  const usuario = db.prepare(`SELECT * FROM usuarios WHERE id = ?`).get(Number(req.params.id));
  if (!usuario) return res.status(404).json({ erro: "Usuário não encontrado." });
  res.json(mapUsuario(usuario));
});

router.patch("/:id/status", autorizar("ADMINISTRADOR"), (req, res) => {
  db.prepare(`UPDATE usuarios SET status = ? WHERE id = ?`).run(req.body.status ? 1 : 0, Number(req.params.id));
  const usuario = db.prepare(`SELECT * FROM usuarios WHERE id = ?`).get(Number(req.params.id));
  res.json(mapUsuario(usuario));
});

export default router;
