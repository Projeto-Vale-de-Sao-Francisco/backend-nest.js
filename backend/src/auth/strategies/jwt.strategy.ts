import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuthenticatedUser, JwtPayload } from '../auth.service.js';
import { SESSION_COOKIE_NAME } from '../session-cookie.js';

function extractSessionCookie(request: Request): string | null {
  const cookiePrefix = `${SESSION_COOKIE_NAME}=`;
  const sessionCookie = request.headers.cookie
    ?.split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(cookiePrefix));
  return sessionCookie?.slice(cookiePrefix.length) || null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        extractSessionCookie,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
      algorithms: ['HS256'],
      issuer: configService.get<string>('JWT_ISSUER', 'sivale-api'),
      audience: configService.get<string>(
        'JWT_AUDIENCE',
        'sivale-frontend',
      ),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        nome: true,
        email: true,
        tipo: true,
        status: true,
        tokenVersion: true,
      },
    });

    if (
      !usuario ||
      usuario.status !== 'ATIVO' ||
      usuario.tokenVersion !== payload.tokenVersion
    ) {
      throw new UnauthorizedException('Token inválido ou expirado');
    }

    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      tipo: usuario.tipo,
    };
  }
}
