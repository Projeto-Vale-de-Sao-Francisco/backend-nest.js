import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { comVinculos, USUARIO_PUBLICO, VINCULOS } from '../auth/auth.service.js';
import type { UsuarioLogado } from '../common/decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AtualizarUsuarioDto, CriarUsuarioDto } from './usuarios.dto.js';

const SELECT = { ...USUARIO_PUBLICO, ...VINCULOS } as const;

// Somente o Administrador chega aqui (RolesGuard no controller).
@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  async listar() {
    const usuarios = await this.prisma.usuario.findMany({ select: SELECT, orderBy: { nomeCompleto: 'asc' } });
    return usuarios.map(comVinculos);
  }

  async criar(dto: CriarUsuarioDto) {
    const existente = await this.prisma.usuario.findFirst({
      where: { OR: [{ email: dto.email }, { cpf: dto.cpf }] },
      select: { id: true },
    });
    if (existente) throw new ConflictException('CPF ou e-mail já cadastrado.');
    const u = await this.prisma.usuario.create({ data: { ...dto, senha: await bcrypt.hash(dto.senha, 10) }, select: SELECT });
    return comVinculos(u);
  }

  async atualizar(logado: UsuarioLogado, id: number, dto: AtualizarUsuarioDto) {
    const alvo = await this.prisma.usuario.findUnique({ where: { id }, select: { id: true } });
    if (!alvo) throw new NotFoundException('Usuário não encontrado.');
    if (id === logado.id && (dto.status === 'INATIVO' || (dto.perfil && dto.perfil !== logado.perfil))) {
      throw new ForbiddenException('Você não pode inativar nem mudar o perfil da própria conta.');
    }
    const { senha, ...resto } = dto;
    const u = await this.prisma.usuario.update({
      where: { id },
      data: { ...resto, ...(senha ? { senha: await bcrypt.hash(senha, 10) } : {}) },
      select: SELECT,
    });
    return comVinculos(u);
  }

  private async garantirUsuario(id: number) {
    if (!(await this.prisma.usuario.findUnique({ where: { id }, select: { id: true } }))) throw new NotFoundException('Usuário não encontrado.');
  }

  async vincularEmpresa(usuarioId: number, empresaId: number) {
    await this.garantirUsuario(usuarioId);
    if (!(await this.prisma.empresa.findUnique({ where: { id: empresaId }, select: { id: true } }))) throw new NotFoundException('Empresa não encontrada.');
    return this.prisma.usuarioEmpresa.upsert({
      where: { usuarioId_empresaId: { usuarioId, empresaId } },
      create: { usuarioId, empresaId },
      update: { status: 'ATIVO' },
    });
  }

  async desvincularEmpresa(usuarioId: number, empresaId: number) {
    const { count } = await this.prisma.usuarioEmpresa.updateMany({ where: { usuarioId, empresaId }, data: { status: 'INATIVO' } });
    if (!count) throw new NotFoundException('Vínculo não encontrado.');
    return { mensagem: 'Vínculo removido.' };
  }

  async vincularPropriedade(usuarioId: number, propriedadeId: number) {
    await this.garantirUsuario(usuarioId);
    if (!(await this.prisma.propriedade.findUnique({ where: { id: propriedadeId }, select: { id: true } }))) throw new NotFoundException('Propriedade não encontrada.');
    return this.prisma.usuarioPropriedade.upsert({
      where: { usuarioId_propriedadeId: { usuarioId, propriedadeId } },
      create: { usuarioId, propriedadeId },
      update: { status: 'ATIVO' },
    });
  }

  async desvincularPropriedade(usuarioId: number, propriedadeId: number) {
    const { count } = await this.prisma.usuarioPropriedade.updateMany({ where: { usuarioId, propriedadeId }, data: { status: 'INATIVO' } });
    if (!count) throw new NotFoundException('Vínculo não encontrado.');
    return { mensagem: 'Vínculo removido.' };
  }
}
