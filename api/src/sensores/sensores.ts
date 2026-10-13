import { Body, Controller, Get, Injectable, Module, NotFoundException, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { AcessoService } from '../common/acesso.service.js';
import { SO_ADMIN, Roles, Usuario, type UsuarioLogado } from '../common/decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';

export class CriarSensorDto {
  @ApiProperty() @Type(() => Number) @IsInt() dispositivoId: number;
  @ApiProperty({ example: 'temperatura' }) @IsString() tipo: string;
  @ApiProperty({ example: '°C' }) @IsString() unidadeMedida: string;
}
export class AtualizarSensorDto {
  @ApiPropertyOptional() @IsOptional() @IsString() tipo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() unidadeMedida?: string;
  @ApiPropertyOptional({ enum: ['ATIVO', 'INATIVO'] }) @IsOptional() @IsIn(['ATIVO', 'INATIVO']) status?: string;
}
export class FiltroSensorDto {
  @IsOptional() @Type(() => Number) @IsInt() dispositivoId?: number;
}

@Injectable()
export class SensoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acesso: AcessoService,
  ) {}

  listar(u: UsuarioLogado, f: FiltroSensorDto) {
    return this.prisma.sensor.findMany({
      where: { dispositivoId: f.dispositivoId, dispositivo: this.acesso.dispositivo(u) },
      include: { dispositivo: { select: { id: true, codigo: true, talhaoId: true } } },
      orderBy: { id: 'asc' },
    });
  }

  async criar(u: UsuarioLogado, dto: CriarSensorDto) {
    await this.acesso.garantirDispositivo(u, dto.dispositivoId);
    return this.prisma.sensor.create({ data: dto });
  }

  async atualizar(u: UsuarioLogado, id: number, dto: AtualizarSensorDto) {
    const s = await this.prisma.sensor.findFirst({ where: { id, dispositivo: this.acesso.dispositivo(u) }, select: { id: true } });
    if (!s) throw new NotFoundException('Sensor não encontrado.');
    return this.prisma.sensor.update({ where: { id }, data: dto });
  }
}

@ApiTags('sensores')
@ApiBearerAuth()
@Controller('sensores')
export class SensoresController {
  constructor(private readonly service: SensoresService) {}

  @Get() listar(@Usuario() u: UsuarioLogado, @Query() f: FiltroSensorDto) { return this.service.listar(u, f); }

  @Roles(...SO_ADMIN) @Post()
  criar(@Usuario() u: UsuarioLogado, @Body() dto: CriarSensorDto) { return this.service.criar(u, dto); }

  @Roles(...SO_ADMIN) @Patch(':id')
  atualizar(@Usuario() u: UsuarioLogado, @Param('id', ParseIntPipe) id: number, @Body() dto: AtualizarSensorDto) {
    return this.service.atualizar(u, id, dto);
  }
}

@Module({ controllers: [SensoresController], providers: [SensoresService] })
export class SensoresModule {}
