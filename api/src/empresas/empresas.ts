import { Body, ConflictException, Controller, Get, Injectable, Module, NotFoundException, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags, PartialType } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, Length } from 'class-validator';
import { Roles, SO_ADMIN } from '../common/decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';

export class CriarEmpresaDto {
  @ApiProperty({ example: 'Vale Verde Exportação de Frutas Ltda' }) @IsString() @Length(2, 160) razaoSocial: string;
  @ApiPropertyOptional() @IsOptional() @IsString() nomeFantasia?: string;
  @ApiProperty({ example: '12345678000199', description: 'CPF ou CNPJ, so digitos' }) @IsString() @Length(11, 14) cpfCnpj: string;
  @ApiPropertyOptional() @IsOptional() @IsString() telefone?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional({ example: 'Petrolina' }) @IsOptional() @IsString() cidade?: string;
  @ApiPropertyOptional({ example: 'PE' }) @IsOptional() @IsString() @Length(2, 2) estado?: string;
  @ApiPropertyOptional({ description: 'Pessoa responsavel pela empresa' }) @IsOptional() @IsString() responsavel?: string;
}
export class AtualizarEmpresaDto extends PartialType(CriarEmpresaDto) {
  @ApiPropertyOptional({ enum: ['ATIVO', 'INATIVO'] }) @IsOptional() @IsIn(['ATIVO', 'INATIVO']) status?: string;
}

// Telas de produtores/empresas: somente o Administrador (inclusive para consulta).
@Injectable()
export class EmpresasService {
  constructor(private readonly prisma: PrismaService) {}

  listar() {
    return this.prisma.empresa.findMany({
      include: { _count: { select: { propriedade: true, usuarioEmpresa: { where: { status: 'ATIVO' } } } } },
      orderBy: { razaoSocial: 'asc' },
    });
  }

  async buscar(id: number) {
    const e = await this.prisma.empresa.findUnique({
      where: { id },
      include: { propriedade: { select: { id: true, nome: true, municipio: true, estado: true, status: true } } },
    });
    if (!e) throw new NotFoundException('Empresa não encontrada.');
    return e;
  }

  async criar(dto: CriarEmpresaDto) {
    if (await this.prisma.empresa.findUnique({ where: { cpfCnpj: dto.cpfCnpj }, select: { id: true } })) {
      throw new ConflictException('CPF/CNPJ já cadastrado.');
    }
    return this.prisma.empresa.create({ data: dto });
  }

  async atualizar(id: number, dto: AtualizarEmpresaDto) {
    await this.buscar(id);
    return this.prisma.empresa.update({ where: { id }, data: dto });
  }
}

@ApiTags('empresas')
@ApiBearerAuth()
@Roles(...SO_ADMIN)
@Controller('empresas')
export class EmpresasController {
  constructor(private readonly service: EmpresasService) {}

  @Get() listar() { return this.service.listar(); }
  @Get(':id') buscar(@Param('id', ParseIntPipe) id: number) { return this.service.buscar(id); }
  @Post() criar(@Body() dto: CriarEmpresaDto) { return this.service.criar(dto); }
  @Patch(':id') atualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: AtualizarEmpresaDto) { return this.service.atualizar(id, dto); }
}

@Module({ controllers: [EmpresasController], providers: [EmpresasService] })
export class EmpresasModule {}
