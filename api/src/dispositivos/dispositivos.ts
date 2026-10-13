import { Body, ConflictException, Controller, Get, Injectable, Module, NotFoundException, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags, OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsLatitude, IsLongitude, IsOptional, IsString, Length } from 'class-validator';
import { AcessoService } from '../common/acesso.service.js';
import { SO_ADMIN, Roles, Usuario, type UsuarioLogado } from '../common/decorators.js';
import { gerarChaveApi, hashChave } from '../common/chave.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LIMITE_SEM_COMUNICACAO_MIN } from '../common/config.js';

export class CriarDispositivoDto {
  @ApiProperty() @Type(() => Number) @IsInt() talhaoId: number;
  @ApiProperty({ example: 'ESP32-01', description: 'Identificador usado pelo hardware/AWS IoT Core' }) @IsString() @Length(2, 60) codigo: string;
  @ApiProperty({ example: 'ESP32 - Talhão A' }) @IsString() @Length(2, 120) nome: string;
  @ApiPropertyOptional({ example: 'ESP32' }) @IsOptional() @IsString() tipo?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsLatitude() latitude?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsLongitude() longitude?: number;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dataInstalacao?: string;
}
export class AtualizarDispositivoDto extends PartialType(OmitType(CriarDispositivoDto, ['talhaoId'] as const)) {
  @ApiPropertyOptional({ enum: ['ATIVO', 'INATIVO'] }) @IsOptional() @IsIn(['ATIVO', 'INATIVO']) status?: string;
}
export class FiltroDispositivoDto {
  @IsOptional() @Type(() => Number) @IsInt() talhaoId?: number;
  @IsOptional() @Type(() => Number) @IsInt() propriedadeId?: number;
}

const data = (v?: string) => (v ? new Date(v) : undefined);

@Injectable()
export class DispositivosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acesso: AcessoService,
  ) {}

  private comUltimaMedicao<T extends { medicao: { dataHora: Date }[]; chaveApiHash?: unknown }>(d: T) {
    const { medicao, chaveApiHash, ...resto } = d;
    const ultima = medicao[0] ?? null;
    const minutos = ultima ? Math.floor((Date.now() - ultima.dataHora.getTime()) / 60_000) : null;
    return {
      ...resto,
      temChave: !!chaveApiHash,
      ultimaMedicao: ultima,
      minutosDesdeUltimaMedicao: minutos,
      semComunicacao: minutos === null || minutos > LIMITE_SEM_COMUNICACAO_MIN,
    };
  }

  async listar(u: UsuarioLogado, f: FiltroDispositivoDto) {
    const lista = await this.prisma.dispositivo.findMany({
      where: { ...this.acesso.dispositivo(u), talhaoId: f.talhaoId, ...(f.propriedadeId ? { talhao: { propriedadeId: f.propriedadeId } } : {}) },
      include: { sensor: true, medicao: { orderBy: { dataHora: 'desc' }, take: 1 } },
      orderBy: { codigo: 'asc' },
    });
    return lista.map((d) => this.comUltimaMedicao(d));
  }

  async buscar(u: UsuarioLogado, id: number) {
    const d = await this.prisma.dispositivo.findFirst({
      where: { id, ...this.acesso.dispositivo(u) },
      include: { sensor: true, talhao: true },
    });
    if (!d) throw new NotFoundException('Dispositivo não encontrado.');
    const { chaveApiHash: _oculto, ...publico } = d;
    return publico;
  }

  async criar(u: UsuarioLogado, dto: CriarDispositivoDto) {
    await this.acesso.garantirTalhao(u, dto.talhaoId);
    if (await this.prisma.dispositivo.findUnique({ where: { codigo: dto.codigo }, select: { id: true } })) {
      throw new ConflictException('Já existe um dispositivo com este código.');
    }
    const chaveApi = gerarChaveApi();
    const criado = await this.prisma.dispositivo.create({
      data: { ...dto, dataInstalacao: data(dto.dataInstalacao), chaveApiHash: hashChave(chaveApi) },
    });
    const { chaveApiHash: _oculto, ...publico } = criado;
    return { ...publico, chaveApi };
  }

  // Gera uma nova chave (a anterior deixa de funcionar). A chave so aparece nesta resposta.
  async rotacionarChave(u: UsuarioLogado, id: number) {
    await this.acesso.garantirDispositivo(u, id);
    const chaveApi = gerarChaveApi();
    await this.prisma.dispositivo.update({ where: { id }, data: { chaveApiHash: hashChave(chaveApi) } });
    return { dispositivoId: id, chaveApi };
  }

  async atualizar(u: UsuarioLogado, id: number, dto: AtualizarDispositivoDto) {
    await this.acesso.garantirDispositivo(u, id);
    return this.prisma.dispositivo.update({ where: { id }, data: { ...dto, dataInstalacao: data(dto.dataInstalacao) } });
  }
}

@ApiTags('dispositivos')
@ApiBearerAuth()
@Controller('dispositivos')
export class DispositivosController {
  constructor(private readonly service: DispositivosService) {}

  @Get() listar(@Usuario() u: UsuarioLogado, @Query() f: FiltroDispositivoDto) { return this.service.listar(u, f); }
  @Get(':id') buscar(@Usuario() u: UsuarioLogado, @Param('id', ParseIntPipe) id: number) { return this.service.buscar(u, id); }

  @Roles(...SO_ADMIN) @Post()
  criar(@Usuario() u: UsuarioLogado, @Body() dto: CriarDispositivoDto) { return this.service.criar(u, dto); }

  @Roles(...SO_ADMIN) @Post(':id/chave')
  rotacionarChave(@Usuario() u: UsuarioLogado, @Param('id', ParseIntPipe) id: number) { return this.service.rotacionarChave(u, id); }

  @Roles(...SO_ADMIN) @Patch(':id')
  atualizar(@Usuario() u: UsuarioLogado, @Param('id', ParseIntPipe) id: number, @Body() dto: AtualizarDispositivoDto) {
    return this.service.atualizar(u, id, dto);
  }
}

@Module({ controllers: [DispositivosController], providers: [DispositivosService] })
export class DispositivosModule {}
