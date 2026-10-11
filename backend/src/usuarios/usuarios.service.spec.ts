import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsuariosService } from './usuarios.service.js';

describe('UsuariosService - regras administrativas', () => {
  let service: UsuariosService;
  let prismaMock: any;

  const admin = { id: 1, nome: 'Admin', cpf: '1', email: 'admin@example.com', telefone: '1', senha: 'hash', vinculo: 'TI', tipo: 'ADMIN', status: 'ATIVO', tokenVersion: 0 };

  beforeEach(() => {
    prismaMock = {
      usuario: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), update: vi.fn(), create: vi.fn() },
      $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(prismaMock)),
    };
    service = new UsuariosService(prismaMock as PrismaService);
  });

  it('não permite que administrador rebaixe a si mesmo', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(admin);
    await expect(service.update(1, 1, { tipo: 'COMUM' })).rejects.toThrow(ForbiddenException);
  });

  it('não permite inativar o último administrador ativo', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(admin);
    prismaMock.usuario.count.mockResolvedValue(0);
    await expect(service.updateStatus(2, 1, 'INATIVO')).rejects.toThrow(BadRequestException);
  });

  it('incrementa tokenVersion ao inativar usuário', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({ ...admin, id: 3, tipo: 'COMUM' });
    prismaMock.usuario.update.mockResolvedValue({ id: 3, status: 'INATIVO' });
    await service.updateStatus(1, 3, 'INATIVO');
    expect(prismaMock.usuario.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'INATIVO', tokenVersion: { increment: 1 } } }));
  });

  it('incrementa tokenVersion ao trocar senha', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({ ...admin, id: 3, tipo: 'COMUM' });
    prismaMock.usuario.update.mockResolvedValue({ id: 3 });
    await service.update(1, 3, { senha: 'SenhaNova123' });
    expect(prismaMock.usuario.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tokenVersion: { increment: 1 } }) }));
  });

  it('mantém cadastro público como COMUM e ATIVO', async () => {
    prismaMock.usuario.create.mockResolvedValue({ id: 3 });
    await service.createPublic({ nome: 'Comum', cpf: '52998224725', email: 'comum@example.com', telefone: '87999999999', senha: 'Senha123', vinculo: 'Campo', tipo: 'ADMIN' });
    expect(prismaMock.usuario.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tipo: 'COMUM', status: 'ATIVO' }) }));
  });
});
