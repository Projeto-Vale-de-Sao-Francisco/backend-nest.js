import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  user?: { id: number; perfil: string; empresaId: number | null };
}

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

export function autenticar(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ erro: "Token não informado." });
  }
  const token = header.replace("Bearer ", "");
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthRequest["user"];
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ erro: "Token inválido ou expirado." });
  }
}

// Controle de acesso basico por perfil (base para o RBAC completo da 2a entrega)
export function autorizar(...perfis: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !perfis.includes(req.user.perfil)) {
      return res.status(403).json({ erro: "Sem permissão para este recurso." });
    }
    next();
  };
}
