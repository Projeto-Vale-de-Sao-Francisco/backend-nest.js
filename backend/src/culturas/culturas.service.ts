import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCulturaDto } from './dto/create-cultura.dto.js';
import { UpdateCulturaDto } from './dto/update-cultura.dto.js';

@Injectable()
export class CulturasService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCulturaDto) {
    this.validarFaixas(dto);
    await this.garantirNomeDisponivel(dto.nome);
    return this.prisma.cultura.create({
      data: { ...this.dados(dto), nome: dto.nome.trim() },
    });
  }

  findAll() {
    return this.prisma.cultura.findMany({
      orderBy: [{ nome: 'asc' }, { id: 'asc' }],
    });
  }

  async findOne(id: number) {
    const cultura = await this.prisma.cultura.findUnique({ where: { id } });
    if (!cultura) throw new NotFoundException('Cultura não encontrada');
    return cultura;
  }

  async update(id: number, dto: UpdateCulturaDto) {
    const atual = await this.findOne(id);
    this.validarFaixas({
      temperatura_min:
        dto.temperatura_min !== undefined
          ? dto.temperatura_min
          : atual.temperatura_min,
      temperatura_max:
        dto.temperatura_max !== undefined
          ? dto.temperatura_max
          : atual.temperatura_max,
      umidade_min:
        dto.umidade_min !== undefined ? dto.umidade_min : atual.umidade_min,
      umidade_max:
        dto.umidade_max !== undefined ? dto.umidade_max : atual.umidade_max,
    });
    if (dto.nome !== undefined) await this.garantirNomeDisponivel(dto.nome, id);
    try {
      return await this.prisma.cultura.update({
        where: { id },
        data: this.dados(dto),
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      )
        throw new NotFoundException('Cultura não encontrada');
      throw error;
    }
  }

  private async garantirNomeDisponivel(nome: string, ignorarId?: number) {
    const existente = await this.prisma.cultura.findFirst({
      where: {
        nome: { equals: nome.trim(), mode: 'insensitive' },
        ...(ignorarId ? { NOT: { id: ignorarId } } : {}),
      },
      select: { id: true },
    });
    if (existente)
      throw new ConflictException('Já existe uma cultura com este nome');
  }

  private validarFaixas(dto: {
    temperatura_min?: number | null;
    temperatura_max?: number | null;
    umidade_min?: number | null;
    umidade_max?: number | null;
  }) {
    if (
      dto.temperatura_min != null &&
      dto.temperatura_max != null &&
      dto.temperatura_min > dto.temperatura_max
    )
      throw new BadRequestException(
        'temperatura_min deve ser menor ou igual a temperatura_max',
      );
    if (
      dto.umidade_min != null &&
      dto.umidade_max != null &&
      dto.umidade_min > dto.umidade_max
    )
      throw new BadRequestException(
        'umidade_min deve ser menor ou igual a umidade_max',
      );
  }

  private dados(dto: Partial<CreateCulturaDto>) {
    return {
      ...(dto.nome !== undefined ? { nome: dto.nome.trim() } : {}),
      ...(dto.variedade !== undefined
        ? { variedade: dto.variedade?.trim() || null }
        : {}),
      ...(dto.temperatura_min !== undefined
        ? { temperatura_min: dto.temperatura_min }
        : {}),
      ...(dto.temperatura_max !== undefined
        ? { temperatura_max: dto.temperatura_max }
        : {}),
      ...(dto.umidade_min !== undefined
        ? { umidade_min: dto.umidade_min }
        : {}),
      ...(dto.umidade_max !== undefined
        ? { umidade_max: dto.umidade_max }
        : {}),
      ...(dto.ciclo_medio_dias !== undefined
        ? { ciclo_medio_dias: dto.ciclo_medio_dias }
        : {}),
      ...(dto.descricao !== undefined
        ? { descricao: dto.descricao?.trim() || null }
        : {}),
    };
  }
}
