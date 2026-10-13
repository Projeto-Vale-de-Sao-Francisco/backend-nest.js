import { BadRequestException, Body, Controller, Get, Injectable, Module, NotFoundException, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags, OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsLatitude, IsLongitude, IsNumber, IsOptional, IsPositive, IsString, Length } from 'class-validator';
import { AcessoService } from '../common/acesso.service.js';
import { SO_ADMIN, Roles, Usuario, type UsuarioLogado } from '../common/decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';

export class CriarTalhaoDto {
  @ApiProperty() @Type(() => Number) @IsInt() propriedadeId: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() culturaId?: number;
  @ApiProperty({ example: 'Talhão A' }) @IsString() @Length(1, 120) nome: string;
  @ApiPropertyOptional() @IsOptional() @IsString() descricao?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsLatitude() latitude?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsLongitude() longitude?: number;
  @ApiPropertyOptional({ description: 'hectares' }) @IsOptional() @Type(() => Number) @IsNumber() @IsPositive() area?: number;
  @ApiPropertyOptional({ example: '2024-02-01' }) @IsOptional() @IsDateString() dataPlantio?: string;
  @ApiPropertyOptional({ example: '2026-11-20' }) @IsOptional() @IsDateString() previsaoColheita?: string;
}
export class AtualizarTalhaoDto extends PartialType(OmitType(CriarTalhaoDto, ['propriedadeId'] as const)) {
  @ApiPropertyOptional({ enum: ['ATIVO', 'INATIVO'] }) @IsOptional() @IsIn(['ATIVO', 'INATIVO']) status?: string;
}
export class FiltroTalhaoDto {
  @IsOptional() @Type(() => Number) @IsInt() propriedadeId?: number;
  @IsOptional() @Type(() => Number) @IsInt() culturaId?: number;
}

const data = (v?: string) => (v ? new Date(v) : undefined);

@Injectable()
export class TalhoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acesso: AcessoService,
  ) {}

  listar(u: UsuarioLogado, f: FiltroTalhaoDto) {
    return this.prisma.talhao.findMany({
      where: { ...this.acesso.talhao(u), propriedadeId: f.propriedadeId, culturaId: f.culturaId },
      include: { cultura: true, dispositivo: true, _count: { select: { alerta: { where: { visualizado: false } } } } },
      orderBy: { nome: 'asc' },
    });
  }

  async buscar(u: UsuarioLogado, id: number) {
    const t = await this.prisma.talhao.findFirst({
      where: { id, ...this.acesso.talhao(u) },
      include: { cultura: true, propriedade: true, dispositivo: { include: { sensor: true } } },
    });
    if (!t) throw new NotFoundException('Talhão não encontrado.');
    return t;
  }

  // Soma das areas dos talhoes ativos nao pode passar da area total da propriedade.
  private async validarArea(propriedadeId: number, area: number | undefined, ignorarTalhaoId?: number) {
    if (!area) return;
    const p = await this.prisma.propriedade.findUnique({ where: { id: propriedadeId }, select: { areaTotal: true, nome: true } });
    if (!p?.areaTotal) return;
    const { _sum } = await this.prisma.talhao.aggregate({
      _sum: { area: true },
      where: { propriedadeId, status: 'ATIVO', id: ignorarTalhaoId ? { not: ignorarTalhaoId } : undefined },
    });
    const usada = _sum.area ?? 0;
    if (usada + area > p.areaTotal) {
      throw new BadRequestException(
        `A soma das áreas dos talhões (${usada + area} ha) passaria da área total de ${p.nome} (${p.areaTotal} ha).`,
      );
    }
  }

  async criar(u: UsuarioLogado, dto: CriarTalhaoDto) {
    await this.acesso.garantirPropriedade(u, dto.propriedadeId);
    await this.validarArea(dto.propriedadeId, dto.area);
    return this.prisma.talhao.create({
      data: { ...dto, dataPlantio: data(dto.dataPlantio), previsaoColheita: data(dto.previsaoColheita) },
    });
  }

  async atualizar(u: UsuarioLogado, id: number, dto: AtualizarTalhaoDto) {
    await this.acesso.garantirTalhao(u, id);
    if (dto.area) {
      const atual = await this.prisma.talhao.findUnique({ where: { id }, select: { propriedadeId: true } });
      await this.validarArea(atual!.propriedadeId, dto.area, id);
    }
    return this.prisma.talhao.update({
      where: { id },
      data: { ...dto, dataPlantio: data(dto.dataPlantio), previsaoColheita: data(dto.previsaoColheita) },
    });
  }
}

@ApiTags('talhoes')
@ApiBearerAuth()
@Controller('talhoes')
export class TalhoesController {
  constructor(private readonly service: TalhoesService) {}

  @Get() listar(@Usuario() u: UsuarioLogado, @Query() f: FiltroTalhaoDto) { return this.service.listar(u, f); }
  @Get(':id') buscar(@Usuario() u: UsuarioLogado, @Param('id', ParseIntPipe) id: number) { return this.service.buscar(u, id); }

  @Roles(...SO_ADMIN) @Post()
  criar(@Usuario() u: UsuarioLogado, @Body() dto: CriarTalhaoDto) { return this.service.criar(u, dto); }

  @Roles(...SO_ADMIN) @Patch(':id')
  atualizar(@Usuario() u: UsuarioLogado, @Param('id', ParseIntPipe) id: number, @Body() dto: AtualizarTalhaoDto) {
    return this.service.atualizar(u, id, dto);
  }
}

@Module({ controllers: [TalhoesController], providers: [TalhoesService] })
export class TalhoesModule {}
