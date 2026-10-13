import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoginDto } from './auth.dto.js';

export const USUARIO_PUBLICO = {
  id: true,
  nomeCompleto: true,
  cpf: true,
  email: true,
  telefone: true,
  perfil: true,
  status: true,
  dataCadastro: true,
} as const;

// Vinculos ativos do usuario, para a tela "Meu perfil" e para a gestao de usuarios.
export const VINCULOS = {
  usuarioEmpresa: {
    where: { status: 'ATIVO' },
    select: { empresa: { select: { id: true, razaoSocial: true, nomeFantasia: true } } },
  },
  usuarioPropriedade: {
    where: { status: 'ATIVO' },
    select: { propriedade: { select: { id: true, nome: true, municipio: true, estado: true } } },
  },
} as const;

export function comVinculos<T extends { usuarioEmpresa: { empresa: unknown }[]; usuarioPropriedade: { propriedade: unknown }[] }>(u: T) {
  const { usuarioEmpresa, usuarioPropriedade, ...resto } = u;
  return { ...resto, empresas: usuarioEmpresa.map((v) => v.empresa), propriedades: usuarioPropriedade.map((v) => v.propriedade) };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login({ email, senha }: LoginDto) {
    const usuario = await this.prisma.usuario.findUnique({ where: { email } });
    const ok = usuario && usuario.status === 'ATIVO' && (await bcrypt.compare(senha, usuario.senha));
    if (!usuario || !ok) throw new UnauthorizedException('Credenciais inválidas.');

    const token = await this.jwt.signAsync({ sub: usuario.id, perfil: usuario.perfil, tokenVersion: usuario.tokenVersion });
    const { senha: _omitida, tokenVersion: _versaoOmitida, ...publico } = usuario;
    return { token, usuario: publico };
  }

  async logout(id: number) {
    await this.prisma.$transaction([
      this.prisma.usuario.update({ where: { id }, data: { tokenVersion: { increment: 1 } } }),
      this.prisma.auditLog.create({ data: { usuarioId: id, acao: 'LOGOUT', recurso: 'SESSAO', recursoId: String(id) } }),
    ]);
  }

  async perfil(id: number) {
    const u = await this.prisma.usuario.findUniqueOrThrow({ where: { id }, select: { ...USUARIO_PUBLICO, ...VINCULOS } });
    return comVinculos(u);
  }
}
