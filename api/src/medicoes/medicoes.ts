import {
  BadRequestException, Body, Controller, Get, Headers, HttpCode, Injectable, Module, NotFoundException, Post, Query,
  UnauthorizedException, UnprocessableEntityException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { AlertasModule, AlertasService } from '../alertas/alertas.js';
import { AcessoService } from '../common/acesso.service.js';
import { hashChave } from '../common/chave.js';
import { Public, Usuario, type UsuarioLogado } from '../common/decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';

// Faixas de plausibilidade: valores fora delas sao tratados como erro de leitura, nao como alerta.
export class DadosMedicaoDto {
  @ApiProperty({ example: 27.4, description: 'graus Celsius, -30 a 70' }) @Type(() => Number) @IsNumber() @Min(-30) @Max(70) temperatura: number;
  @ApiProperty({ example: 55, description: 'umidade relativa do ar, 0 a 100' }) @Type(() => Number) @IsNumber() @Min(0) @Max(100) umidade: number;
  @ApiPropertyOptional({ description: '0 a 100' }) @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) umidadeSolo?: number;
  @ApiPropertyOptional({ description: 'lux' }) @IsOptional() @Type(() => Number) @IsNumber() @Min(0) luminosidade?: number;
  @ApiPropertyOptional({ description: 'mm' }) @IsOptional() @Type(() => Number) @IsNumber() @Min(0) precipitacao?: number;
  @ApiPropertyOptional({ description: 'ISO 8601; padrao: agora' }) @IsOptional() @IsDateString() dataHora?: string;
}

export class FiltroMedicaoDto {
  @IsOptional() @Type(() => Number) @IsInt() dispositivoId?: number;
  @IsOptional() @Type(() => Number) @IsInt() talhaoId?: number;
  @IsOptional() @Type(() => Number) @IsInt() propriedadeId?: number;
  @IsOptional() @Type(() => Number) @IsInt() culturaId?: number;
  @IsOptional() @IsDateString() inicio?: string;
  @IsOptional() @IsDateString() fim?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1000) limite?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pagina?: number;
}

@Injectable()
export class MedicoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acesso: AcessoService,
    private readonly alertas: AlertasService,
  ) {}

  where(u: UsuarioLogado, f: FiltroMedicaoDto) {
    return {
      AND: [
        this.acesso.medicao(u),
        {
          dispositivoId: f.dispositivoId,
          dataHora: { gte: f.inicio ? new Date(f.inicio) : undefined, lte: f.fim ? new Date(f.fim) : undefined },
          dispositivo: { talhaoId: f.talhaoId, talhao: { propriedadeId: f.propriedadeId, culturaId: f.culturaId } },
        },
      ],
    };
  }

  async listar(u: UsuarioLogado, f: FiltroMedicaoDto) {
    const where = this.where(u, f);
    const limite = f.limite ?? 100;
    const pagina = f.pagina ?? 1;
    const [dados, total] = await Promise.all([
      this.prisma.medicao.findMany({ where, orderBy: { dataHora: 'desc' }, take: limite, skip: (pagina - 1) * limite }),
      this.prisma.medicao.count({ where }),
    ]);
    return { dados, total, pagina, limite, paginas: Math.max(1, Math.ceil(total / limite)) };
  }

  // Autenticacao do dispositivo: cabecalho x-device-key (chave emitida em /dispositivos/:id/chave).
  async registrarPorChave(chave: string | undefined, dados: DadosMedicaoDto) {
    if (!chave) throw new UnauthorizedException('Informe o cabeçalho x-device-key.');
    const d = await this.prisma.dispositivo.findUnique({ where: { chaveApiHash: hashChave(chave) }, select: { id: true } });
    if (!d) throw new UnauthorizedException('Chave de dispositivo inválida.');
    return this.gravar(d.id, dados);
  }

  // Usado tambem por integracoes (ex.: ThingSpeak) que ja resolveram o dispositivo.
  async gravar(dispositivoId: number, dados: DadosMedicaoDto) {
    const d = await this.prisma.dispositivo.findUnique({ where: { id: dispositivoId }, select: { status: true, codigo: true } });
    if (!d) throw new NotFoundException('Dispositivo não encontrado.');
    if (d.status !== 'ATIVO') throw new UnprocessableEntityException(`Dispositivo ${d.codigo} está inativo; a leitura foi recusada.`);

    const medicao = await this.prisma.medicao.create({
      data: { ...dados, dispositivoId, dataHora: dados.dataHora ? new Date(dados.dataHora) : new Date() },
    });
    const alertas = await this.alertas.avaliar(medicao);
    return { ...medicao, alertasGerados: alertas.length };
  }
}

@ApiTags('medicoes')
@ApiBearerAuth()
@Controller('medicoes')
export class MedicoesController {
  constructor(private readonly service: MedicoesService) {}

  // Nenhum perfil registra leitura: quem envia e o dispositivo (ou simulador), por /ingest/medicoes com chave.
  @Get() listar(@Usuario() u: UsuarioLogado, @Query() f: FiltroMedicaoDto) { return this.service.listar(u, f); }
}

// Porta de entrada para o hardware (ESP32 / ponte AWS IoT Core): sem JWT de usuario, so a chave do dispositivo.
@ApiTags('ingestao')
@Controller('ingest')
export class IngestController {
  constructor(private readonly service: MedicoesService) {}

  @Public()
  @HttpCode(201)
  @ApiHeader({ name: 'x-device-key', required: true, description: 'Chave do dispositivo' })
  @Post('medicoes')
  registrar(@Headers('x-device-key') chave: string | undefined, @Body() dto: DadosMedicaoDto) {
    return this.service.registrarPorChave(chave, dto);
  }
}

@Module({
  imports: [AlertasModule],
  controllers: [MedicoesController, IngestController],
  providers: [MedicoesService],
  exports: [MedicoesService],
})
export class MedicoesModule {}
