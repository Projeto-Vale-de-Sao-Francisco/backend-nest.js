import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('AuthService', () => {
  let service: AuthService;
  const prismaMock = { usuario: { findUnique: vi.fn(), update: vi.fn() } };
  const jwtMock = { signAsync: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(prismaMock as unknown as PrismaService, jwtMock as unknown as JwtService);
  });

  it('autentica usuário ativo e assina payload sem senha', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({ id: 7, nome: 'Ana', email: 'ana@example.com', senha: await bcrypt.hash('Senha123', 4), tipo: 'COMUM', status: 'ATIVO', tokenVersion: 2 });
    jwtMock.signAsync.mockResolvedValue('jwt-assinado');

    await expect(service.login({ email: ' ANA@EXAMPLE.COM ', senha: 'Senha123' })).resolves.toEqual({
      accessToken: 'jwt-assinado', user: { id: 7, nome: 'Ana', email: 'ana@example.com', tipo: 'COMUM' },
    });
    expect(jwtMock.signAsync).toHaveBeenCalledWith({ sub: 7, email: 'ana@example.com', tipo: 'COMUM', tokenVersion: 2 });
  });

  it('rejeita credenciais ausentes ou senha incorreta', async () => {
    prismaMock.usuario.findUnique.mockResolvedValueOnce(null);
    await expect(service.login({ email: 'ausente@example.com', senha: 'Senha123' })).rejects.toThrow(UnauthorizedException);
    prismaMock.usuario.findUnique.mockResolvedValueOnce({ id: 7, nome: 'Ana', email: 'ana@example.com', senha: await bcrypt.hash('Senha123', 4), tipo: 'COMUM', status: 'ATIVO', tokenVersion: 0 });
    await expect(service.login({ email: 'ana@example.com', senha: 'errada' })).rejects.toThrow(UnauthorizedException);
  });

  it('rejeita usuário inativo e invalida tokens no logout', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({ id: 7, nome: 'Ana', email: 'ana@example.com', senha: 'hash', tipo: 'COMUM', status: 'INATIVO', tokenVersion: 0 });
    await expect(service.login({ email: 'ana@example.com', senha: 'Senha123' })).rejects.toThrow(UnauthorizedException);
    await service.logout(7);
    expect(prismaMock.usuario.update).toHaveBeenCalledWith({ where: { id: 7 }, data: { tokenVersion: { increment: 1 } } });
  });
});
