import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateAdminUsuarioDto } from './dto/create-admin-usuario.dto.js';
import { CreateUsuarioDto } from './dto/create-usuario.dto.js';
import { ListUsuariosDto } from './dto/list-usuarios.dto.js';
import { UpdateUsuarioDto } from './dto/update-usuario.dto.js';
import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;
const userSelect = {
  id: true, nome: true, cpf: true, email: true, telefone: true, tipo: true,
  vinculo: true, status: true, createdAt: true, updatedAt: true,
} satisfies Prisma.UsuarioSelect;

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  async createPublic(dto: CreateUsuarioDto) {
    return this.create(dto, 'COMUM', 'ATIVO');
  }

  async createByAdmin(dto: CreateAdminUsuarioDto) {
    return this.create(dto, dto.tipo, dto.status);
  }

  async findAll(filters: ListUsuariosDto) {
    const { page, limit, nome, email, cpf, tipo, status } = filters;
    const where: Prisma.UsuarioWhereInput = {
      ...(nome ? { nome: { contains: nome, mode: 'insensitive' } } : {}),
      ...(email ? { email: { contains: email, mode: 'insensitive' } } : {}),
      ...(cpf ? { cpf } : {}),
      ...(tipo ? { tipo } : {}),
      ...(status ? { status } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.usuario.findMany({ where, select: userSelect, skip: (page - 1) * limit, take: limit, orderBy: { id: 'asc' } }),
      this.prisma.usuario.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: number) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id }, select: userSelect });
    if (!usuario) throw new NotFoundException('Usuário não encontrado');
    return usuario;
  }

  async update(adminId: number, id: number, dto: UpdateUsuarioDto) {
    return this.prisma.$transaction(async (tx) => {
      const atual = await tx.usuario.findUnique({ where: { id } });
      if (!atual) throw new NotFoundException('Usuário não encontrado');
      await this.assertCanRemoveAdminRole(tx, adminId, atual, dto.tipo);

      const senha = dto.senha ? await bcrypt.hash(dto.senha, SALT_ROUNDS) : undefined;
      const usuario = await tx.usuario.update({
        where: { id },
        data: {
          ...(dto.nome !== undefined ? { nome: dto.nome.trim() } : {}),
          ...(dto.cpf !== undefined ? { cpf: dto.cpf } : {}),
          ...(dto.email !== undefined ? { email: dto.email.trim().toLowerCase() } : {}),
          ...(dto.telefone !== undefined ? { telefone: dto.telefone } : {}),
          ...(dto.vinculo !== undefined ? { vinculo: dto.vinculo.trim() } : {}),
          ...(dto.tipo !== undefined ? { tipo: dto.tipo } : {}),
          ...(senha ? { senha, tokenVersion: { increment: 1 } } : {}),
        },
        select: userSelect,
      });
      return usuario;
    }).catch((error) => this.handlePrismaError(error));
  }

  async updateStatus(adminId: number, id: number, status: 'ATIVO' | 'INATIVO') {
    return this.prisma.$transaction(async (tx) => {
      const atual = await tx.usuario.findUnique({ where: { id } });
      if (!atual) throw new NotFoundException('Usuário não encontrado');
      if (adminId === id && status === 'INATIVO') {
        throw new ForbiddenException('Um administrador não pode inativar a si mesmo');
      }
      if (atual.tipo === 'ADMIN' && atual.status === 'ATIVO' && status === 'INATIVO') {
        await this.assertOtherActiveAdmin(tx, id);
      }
      return tx.usuario.update({
        where: { id },
        data: { status, ...(status === 'INATIVO' ? { tokenVersion: { increment: 1 } } : {}) },
        select: userSelect,
      });
    });
  }

  private async create(dto: CreateUsuarioDto, tipo: 'ADMIN' | 'COMUM', status: 'ATIVO' | 'INATIVO') {
    const senha = await bcrypt.hash(dto.senha, SALT_ROUNDS);
    try {
      return await this.prisma.usuario.create({
        data: { nome: dto.nome.trim(), cpf: dto.cpf, email: dto.email.trim().toLowerCase(), telefone: dto.telefone, senha, vinculo: dto.vinculo.trim(), tipo, status },
        select: userSelect,
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  private async assertCanRemoveAdminRole(tx: Prisma.TransactionClient, adminId: number, atual: { id: number; tipo: string; status: string }, novoTipo?: 'ADMIN' | 'COMUM') {
    if (novoTipo !== 'COMUM' || atual.tipo !== 'ADMIN') return;
    if (adminId === atual.id) throw new ForbiddenException('Um administrador não pode rebaixar a si mesmo');
    if (atual.status === 'ATIVO') await this.assertOtherActiveAdmin(tx, atual.id);
  }

  private async assertOtherActiveAdmin(tx: Prisma.TransactionClient, usuarioId: number) {
    const outrosAdmins = await tx.usuario.count({ where: { tipo: 'ADMIN', status: 'ATIVO', NOT: { id: usuarioId } } });
    if (outrosAdmins === 0) throw new BadRequestException('Deve existir ao menos um administrador ativo');
  }

  private handlePrismaError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const fields = Array.isArray(error.meta?.target) ? error.meta.target : [];
      if (fields.includes('cpf')) throw new ConflictException('CPF já cadastrado');
      if (fields.includes('email')) throw new ConflictException('E-mail já cadastrado');
      throw new ConflictException('Já existe um usuário com estes dados');
    }
    throw error;
  }
}
