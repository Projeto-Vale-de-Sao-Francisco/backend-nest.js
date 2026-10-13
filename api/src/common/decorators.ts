import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Perfil } from '../generated/prisma/enums.js';

export interface UsuarioLogado {
  id: number;
  nomeCompleto: string;
  email: string;
  perfil: Perfil;
  status: string;
}

export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const ROLES = 'roles';
export const Roles = (...perfis: Perfil[]) => SetMetadata(ROLES, perfis);

// 1a entrega: so o Administrador cadastra, edita e inativa. Os demais perfis consultam e tratam alertas.
// Para separar Tecnico e Agricultor na 2a entrega (RBAC), basta criar novas listas aqui e usa-las nos controllers.
export const SO_ADMIN: Perfil[] = ['ADMINISTRADOR'];

export const Usuario = createParamDecorator(
  (_dados: unknown, ctx: ExecutionContext): UsuarioLogado =>
    ctx.switchToHttp().getRequest().usuario,
);
