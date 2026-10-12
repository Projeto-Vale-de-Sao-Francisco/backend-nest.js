import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoginDto } from './dto/login.dto.js';

export interface AuthenticatedUser {
  id: number;
  nome: string;
  email: string;
  tipo: 'ADMIN' | 'COMUM';
}

export interface JwtPayload {
  sub: number;
  email: string;
  tipo: 'ADMIN' | 'COMUM';
  tokenVersion: number;
}

const INVALID_CREDENTIALS_MESSAGE = 'E-mail ou senha inválidos';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const usuario = await this.prisma.usuario.findUnique({
      where: { email },
      select: {
        id: true,
        nome: true,
        email: true,
        senha: true,
        tipo: true,
        status: true,
        tokenVersion: true,
      },
    });

    if (!usuario || usuario.status !== 'ATIVO') {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    if (!(await bcrypt.compare(dto.senha, usuario.senha))) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    const payload: JwtPayload = {
      sub: usuario.id,
      email: usuario.email,
      tipo: usuario.tipo,
      tokenVersion: usuario.tokenVersion,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: this.toAuthenticatedUser(usuario),
    };
  }

  async logout(usuarioId: number): Promise<void> {
    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { tokenVersion: { increment: 1 } },
    });
  }

  private toAuthenticatedUser(usuario: {
    id: number;
    nome: string;
    email: string;
    tipo: 'ADMIN' | 'COMUM';
  }): AuthenticatedUser {
    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      tipo: usuario.tipo,
    };
  }
}
