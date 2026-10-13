import { Body, Controller, Get, Injectable, Module, NotFoundException, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsPositive, IsString, Length } from 'class-validator';
import { SO_ADMIN, Roles } from '../common/decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';

export class CriarCulturaDto {
  @ApiProperty({ example: 'Manga' }) @IsString() @Length(2, 80) nome: string;
  @ApiPropertyOptional({ example: 'Tommy Atkins' }) @IsOptional() @IsString() variedade?: string;
  @ApiProperty({ example: 20 }) @Type(() => Number) @IsNumber() temperaturaMin: number;
  @ApiProperty({ example: 34 }) @Type(() => Number) @IsNumber() temperaturaMax: number;
  @ApiProperty({ example: 40 }) @Type(() => Number) @IsNumber() umidadeMin: number;
  @ApiProperty({ example: 70 }) @Type(() => Number) @IsNumber() umidadeMax: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @IsPositive() cicloMedioDias?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() descricao?: string;
}
export class AtualizarCulturaDto extends PartialType(CriarCulturaDto) {}

@Injectable()
export class CulturasService {
  constructor(private readonly prisma: PrismaService) {}

  listar() {
    return this.prisma.cultura.findMany({ orderBy: { nome: 'asc' } });
  }

  async buscar(id: number) {
    const c = await this.prisma.cultura.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Cultura não encontrada.');
    return c;
  }

  criar(dto: CriarCulturaDto) {
    return this.prisma.cultura.create({ data: dto });
  }

  async atualizar(id: number, dto: AtualizarCulturaDto) {
    await this.buscar(id);
    return this.prisma.cultura.update({ where: { id }, data: dto });
  }
}

@ApiTags('culturas')
@ApiBearerAuth()
@Controller('culturas')
export class CulturasController {
  constructor(private readonly service: CulturasService) {}

  @Get() listar() { return this.service.listar(); }
  @Get(':id') buscar(@Param('id', ParseIntPipe) id: number) { return this.service.buscar(id); }

  @Roles(...SO_ADMIN) @Post()
  criar(@Body() dto: CriarCulturaDto) { return this.service.criar(dto); }

  @Roles(...SO_ADMIN) @Patch(':id')
  atualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: AtualizarCulturaDto) { return this.service.atualizar(id, dto); }
}

@Module({ controllers: [CulturasController], providers: [CulturasService] })
export class CulturasModule {}
