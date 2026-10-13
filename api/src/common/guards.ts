import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import { IS_PUBLIC, ROLES } from './decorators.js';
import type { Perfil } from '../generated/prisma/enums.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext) {
    const publica = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (publica) return true;

    const req = ctx.switchToHttp().getRequest();
    const cabecalho: string | undefined = req.headers.authorization;
    if (!cabecalho?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token não informado.');
    }

    let payload: { sub: number; tokenVersion?: number };
    try {
      payload = await this.jwt.verifyAsync(cabecalho.slice(7));
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado.');
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
      select: { id: true, nomeCompleto: true, email: true, perfil: true, status: true, tokenVersion: true },
    });
    if (!usuario || usuario.status !== 'ATIVO') {
      throw new UnauthorizedException('Usuário inativo ou inexistente.');
    }
    if (payload.tokenVersion !== usuario.tokenVersion) {
      throw new UnauthorizedException('Sessão revogada.');
    }
    const { tokenVersion: _tokenVersion, ...usuarioLogado } = usuario;
    req.usuario = usuarioLogado;
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext) {
    const perfis = this.reflector.getAllAndOverride<Perfil[] | undefined>(ROLES, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!perfis?.length) return true;
    const usuario = ctx.switchToHttp().getRequest().usuario;
    if (!usuario || !perfis.includes(usuario.perfil)) {
      throw new ForbiddenException('Sem permissão para este recurso.');
    }
    return true;
  }
}
