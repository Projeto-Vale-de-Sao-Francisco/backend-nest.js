import { Body, Controller, Get, Injectable, Module, NotFoundException, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags, OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsNumber, IsOptional, IsString } from 'class-validator';
import { AcessoService } from '../common/acesso.service.js';
import { SO_ADMIN, Roles, Usuario, type UsuarioLogado } from '../common/decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';

export class CriarOperacaoDto {
  @ApiProperty() @Type(() => Number) @IsInt() propriedadeId: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() talhaoId?: number;
  @ApiProperty({ example: 'Petrolina/PE' }) @IsString() origem: string;
  @ApiProperty({ example: 'Porto de Pecém/CE' }) @IsString() destino: string;
  @ApiProperty({ example: 'rodoviario' }) @IsString() modal: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dataPrevista?: string;
  @ApiPropertyOptional({ example: '18h' }) @IsOptional() @IsString() tempoEstimado?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() custoEstimado?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() transportadora?: string;
  @ApiPropertyOptional({ example: 'PLANEJADA' }) @IsOptional() @IsString() situacao?: string;
}
export class AtualizarOperacaoDto extends PartialType(OmitType(CriarOperacaoDto, ['propriedadeId'] as const)) {}
export class FiltroOperacaoDto {
  @IsOptional() @Type(() => Number) @IsInt() propriedadeId?: number;
}

const data = (v?: string) => (v ? new Date(v) : undefined);

@Injectable()
export class LogisticaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acesso: AcessoService,
  ) {}

  listar(u: UsuarioLogado, f: FiltroOperacaoDto) {
    return this.prisma.operacaoLogistica.findMany({
      where: { ...this.acesso.logistica(u), propriedadeId: f.propriedadeId },
      include: { talhao: { select: { id: true, nome: true } } },
      orderBy: { dataCadastro: 'desc' },
    });
  }

  async criar(u: UsuarioLogado, dto: CriarOperacaoDto) {
    await this.acesso.garantirPropriedade(u, dto.propriedadeId);
    if (dto.talhaoId) await this.acesso.garantirTalhao(u, dto.talhaoId);
    return this.prisma.operacaoLogistica.create({ data: { ...dto, dataPrevista: data(dto.dataPrevista) } });
  }

  async atualizar(u: UsuarioLogado, id: number, dto: AtualizarOperacaoDto) {
    const op = await this.prisma.operacaoLogistica.findFirst({ where: { id, ...this.acesso.logistica(u) }, select: { id: true } });
    if (!op) throw new NotFoundException('Operação não encontrada.');
    if (dto.talhaoId) await this.acesso.garantirTalhao(u, dto.talhaoId);
    return this.prisma.operacaoLogistica.update({ where: { id }, data: { ...dto, dataPrevista: data(dto.dataPrevista) } });
  }
}

@ApiTags('logistica')
@ApiBearerAuth()
@Controller('logistica')
export class LogisticaController {
  constructor(private readonly service: LogisticaService) {}

  @Get() listar(@Usuario() u: UsuarioLogado, @Query() f: FiltroOperacaoDto) { return this.service.listar(u, f); }

  @Roles(...SO_ADMIN) @Post()
  criar(@Usuario() u: UsuarioLogado, @Body() dto: CriarOperacaoDto) { return this.service.criar(u, dto); }

  @Roles(...SO_ADMIN) @Patch(':id')
  atualizar(@Usuario() u: UsuarioLogado, @Param('id', ParseIntPipe) id: number, @Body() dto: AtualizarOperacaoDto) {
    return this.service.atualizar(u, id, dto);
  }
}

@Module({ controllers: [LogisticaController], providers: [LogisticaService] })
export class LogisticaModule {}
