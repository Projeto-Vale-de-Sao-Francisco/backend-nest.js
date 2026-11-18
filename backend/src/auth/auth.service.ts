import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoginDto } from './dto/login.dto.js';
import { LoginRateLimitService } from './login-rate-limit.service.js';

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
  private readonly dummyPasswordHash = bcrypt.hash(
    randomBytes(32).toString('hex'),
    12,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly loginRateLimit: LoginRateLimitService,
  ) {}

  async login(dto: LoginDto, ipOrigem = 'unknown') {
    const email = dto.email.trim().toLowerCase();
    const keys = this.loginBucketKeys(ipOrigem, email);
    await this.loginRateLimit.assertNotBlocked(keys);
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

    const senhaValida = await bcrypt.compare(
      dto.senha,
      usuario?.senha ?? (await this.dummyPasswordHash),
    );
    if (!usuario || usuario.status !== 'ATIVO' || !senhaValida) {
      await this.loginRateLimit.recordFailure(keys);
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }
    await this.loginRateLimit.clearAccountKey(keys[1]);

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

  private loginBucketKeys(
    ipOrigem: string,
    email: string,
  ): [ipKey: string, accountKey: string] {
    return [
      `ip:${this.hashIdentifier(ipOrigem)}`,
      `email:${this.hashIdentifier(email)}`,
    ];
  }

  private hashIdentifier(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

}
