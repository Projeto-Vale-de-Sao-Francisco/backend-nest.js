import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { db, mapUsuario } from "../lib/db";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

const cadastroSchema = z.object({
  nome: z.string().min(2),
  cpf: z.string().min(11),
  email: z.string().email(),
  senha: z.string().min(6),
  telefone: z.string().optional(),
  perfil: z.enum(["ADMINISTRADOR", "GESTOR", "TECNICO", "PRODUTOR"]).default("PRODUTOR"),
  empresaId: z.number().optional(),
});

// POST /auth/cadastro - Cadastro de Usuarios (Requisito 1)
router.post("/cadastro", async (req, res) => {
  const parse = cadastroSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ erro: parse.error.flatten() });

  const { nome, cpf, email, senha, telefone, perfil, empresaId } = parse.data;

  const existente = db.prepare(`SELECT id FROM usuarios WHERE cpf = ? OR email = ?`).get(cpf, email);
  if (existente) return res.status(409).json({ erro: "CPF ou e-mail já cadastrado." });

  const senhaHash = await bcrypt.hash(senha, 10);
  const result = db
    .prepare(`INSERT INTO usuarios (nome, cpf, email, senha_hash, telefone, perfil, empresa_id) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(nome, cpf, email, senhaHash, telefone ?? null, perfil, empresaId ?? null);

  res.status(201).json({ id: result.lastInsertRowid, nome, email });
});

// POST /auth/login - Autenticacao (Requisito 2)
router.post("/login", async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ erro: "Informe e-mail e senha." });

  const usuario: any = db.prepare(`SELECT * FROM usuarios WHERE email = ?`).get(email);
  if (!usuario || !usuario.status) return res.status(401).json({ erro: "Credenciais inválidas." });

  const ok = await bcrypt.compare(senha, String(usuario.senha_hash));
  if (!ok) return res.status(401).json({ erro: "Credenciais inválidas." });

  const token = jwt.sign(
    { id: usuario.id, perfil: usuario.perfil, empresaId: usuario.empresa_id },
    JWT_SECRET,
    { expiresIn: "8h" }
  );

  res.json({ token, usuario: mapUsuario(usuario) });
});

export default router;
