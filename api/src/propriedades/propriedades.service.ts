import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { USUARIO_PUBLICO } from '../auth/auth.service.js';
import { AcessoService } from '../common/acesso.service.js';
import type { UsuarioLogado } from '../common/decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AtualizarPropriedadeDto, CriarPropriedadeDto } from './propriedades.dto.js';

@Injectable()
export class PropriedadesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acesso: AcessoService,
  ) {}

  listar(u: UsuarioLogado) {
    return this.prisma.propriedade.findMany({
      where: this.acesso.propriedade(u),
      include: { empresa: { select: { id: true, razaoSocial: true, nomeFantasia: true } }, _count: { select: { talhao: true } } },
      orderBy: { nome: 'asc' },
    });
  }

  async buscar(u: UsuarioLogado, id: number) {
    const p = await this.prisma.propriedade.findFirst({
      where: { id, ...this.acesso.propriedade(u) },
      include: {
        empresa: true,
        talhao: { include: { cultura: true } },
        usuarioPropriedade: { include: { usuario: { select: USUARIO_PUBLICO } } },
      },
    });
    if (!p) throw new NotFoundException('Propriedade não encontrada.');
    return p;
  }

  async criar(u: UsuarioLogado, dto: CriarPropriedadeDto) {
    const p = await this.prisma.propriedade.create({ data: dto });
    // Quem cria a propriedade passa a ter acesso a ela (o ADMIN ja enxerga tudo).
    if (u.perfil !== 'ADMINISTRADOR') {
      await this.prisma.usuarioPropriedade.create({ data: { usuarioId: u.id, propriedadeId: p.id } });
    }
    return p;
  }

  async atualizar(u: UsuarioLogado, id: number, dto: AtualizarPropriedadeDto) {
    await this.acesso.garantirPropriedade(u, id);
    return this.prisma.propriedade.update({ where: { id }, data: dto });
  }

  async vincular(u: UsuarioLogado, propriedadeId: number, usuarioId: number) {
    await this.acesso.garantirPropriedade(u, propriedadeId);
    const alvo = await this.prisma.usuario.findUnique({ where: { id: usuarioId }, select: { id: true } });
    if (!alvo) throw new NotFoundException('Usuário não encontrado.');
    const existente = await this.prisma.usuarioPropriedade.findUnique({
      where: { usuarioId_propriedadeId: { usuarioId, propriedadeId } },
    });
    if (existente?.status === 'ATIVO') throw new ConflictException('Usuário já vinculado a esta propriedade.');
    return this.prisma.usuarioPropriedade.upsert({
      where: { usuarioId_propriedadeId: { usuarioId, propriedadeId } },
      create: { usuarioId, propriedadeId },
      update: { status: 'ATIVO' },
    });
  }

  async desvincular(u: UsuarioLogado, propriedadeId: number, usuarioId: number) {
    await this.acesso.garantirPropriedade(u, propriedadeId);
    const { count } = await this.prisma.usuarioPropriedade.updateMany({
      where: { propriedadeId, usuarioId },
      data: { status: 'INATIVO' },
    });
    if (!count) throw new NotFoundException('Vínculo não encontrado.');
    return { mensagem: 'Vínculo removido.' };
  }
}
