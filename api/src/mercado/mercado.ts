import {
  BadGatewayException, Body, Controller, Delete, Get, HttpCode, Injectable, Module, NotFoundException, Param,
  ParseIntPipe, Patch, Post, Query, ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags, OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsNumber, IsOptional, IsString } from 'class-validator';
import { SO_ADMIN, Roles } from '../common/decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';

export class CriarValorMercadoDto {
  @ApiProperty() @Type(() => Number) @IsInt() culturaId: number;
  @ApiProperty({ example: 'Europa' }) @IsString() mercadoDestino: string;
  @ApiProperty({ example: 8.5 }) @Type(() => Number) @IsNumber() precoMedio: number;
  @ApiPropertyOptional({ example: 'BRL' }) @IsOptional() @IsString() moeda?: string;
  @ApiProperty({ example: '2026-09-24' }) @IsDateString() dataReferencia: string;
  @ApiPropertyOptional({ example: 'alta' }) @IsOptional() @IsString() demandaEstimada?: string;
}
export class AtualizarValorMercadoDto extends PartialType(OmitType(CriarValorMercadoDto, ['culturaId'] as const)) {}
export class FiltroMercadoDto {
  @IsOptional() @Type(() => Number) @IsInt() culturaId?: number;
  @IsOptional() @IsString() mercadoDestino?: string;
}

interface ItemFonte {
  cultura: string;
  mercadoDestino: string;
  precoMedio: number;
  moeda?: string;
  demandaEstimada?: string;
  dataReferencia?: string;
}

@Injectable()
export class MercadoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  listar(f: FiltroMercadoDto) {
    return this.prisma.valorMercado.findMany({
      where: { culturaId: f.culturaId, mercadoDestino: f.mercadoDestino },
      include: { cultura: { select: { id: true, nome: true, variedade: true } } },
      orderBy: [{ dataReferencia: 'desc' }, { id: 'desc' }],
      take: 200,
    });
  }

  criar(dto: CriarValorMercadoDto) {
    return this.prisma.valorMercado.create({ data: { ...dto, dataReferencia: new Date(dto.dataReferencia) } });
  }

  async atualizarRegistro(id: number, dto: AtualizarValorMercadoDto) {
    await this.existe(id);
    return this.prisma.valorMercado.update({
      where: { id },
      data: { ...dto, dataReferencia: dto.dataReferencia ? new Date(dto.dataReferencia) : undefined },
    });
  }

  async remover(id: number) {
    await this.existe(id);
    await this.prisma.valorMercado.delete({ where: { id } });
    return { mensagem: 'Registro removido.' };
  }

  // Botao "Atualizar" do site: busca os valores na fonte configurada (MERCADO_FONTE_URL) e grava com origem ATUALIZACAO.
  // Contrato esperado da fonte: JSON array de { cultura, mercadoDestino, precoMedio, moeda?, demandaEstimada?, dataReferencia? }.
  async atualizarPelaFonte() {
    const url = this.config.get<string>('MERCADO_FONTE_URL');
    if (!url) throw new ServiceUnavailableException('Fonte de dados de mercado não configurada (defina MERCADO_FONTE_URL).');

    let itens: ItemFonte[];
    try {
      // URL http(s) ou caminho de arquivo JSON local (ex.: ./data/mercado-exemplo.json, so valores de exemplo).
      if (/^https?:\/\//.test(url)) {
        const resposta = await fetch(url, { signal: AbortSignal.timeout(10_000) });
        if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
        itens = (await resposta.json()) as ItemFonte[];
      } else {
        itens = JSON.parse(await readFile(resolve(url), 'utf8')) as ItemFonte[];
      }
      if (!Array.isArray(itens)) throw new Error('resposta não é uma lista');
    } catch (erro) {
      throw new BadGatewayException(`Falha ao consultar a fonte de mercado: ${(erro as Error).message}`);
    }

    const culturas = await this.prisma.cultura.findMany({ select: { id: true, nome: true } });
    const porNome = new Map(culturas.map((c) => [c.nome.toLowerCase(), c.id]));
    const hoje = new Date();

    const validos = itens.flatMap((i) => {
      const culturaId = porNome.get(String(i.cultura).toLowerCase());
      if (!culturaId || !i.mercadoDestino || typeof i.precoMedio !== 'number') return [];
      return [{
        culturaId,
        mercadoDestino: i.mercadoDestino,
        precoMedio: i.precoMedio,
        moeda: i.moeda ?? 'BRL',
        demandaEstimada: i.demandaEstimada,
        dataReferencia: i.dataReferencia ? new Date(i.dataReferencia) : hoje,
        origem: 'ATUALIZACAO' as const,
      }];
    });

    // Uma linha por cultura, destino e data de referencia: repetir a atualizacao no mesmo dia corrige o valor em vez de duplicar.
    let inseridos = 0;
    let atualizados = 0;
    for (const v of validos) {
      const dia = new Date(Date.UTC(v.dataReferencia.getUTCFullYear(), v.dataReferencia.getUTCMonth(), v.dataReferencia.getUTCDate()));
      const existente = await this.prisma.valorMercado.findFirst({
        where: { culturaId: v.culturaId, mercadoDestino: v.mercadoDestino, dataReferencia: dia },
        select: { id: true },
      });
      if (existente) {
        await this.prisma.valorMercado.update({ where: { id: existente.id }, data: { ...v, dataReferencia: dia } });
        atualizados++;
      } else {
        await this.prisma.valorMercado.create({ data: { ...v, dataReferencia: dia } });
        inseridos++;
      }
    }
    return { inseridos, atualizados, ignorados: itens.length - validos.length, atualizadoEm: hoje.toISOString() };
  }

  private async existe(id: number) {
    if (!(await this.prisma.valorMercado.findUnique({ where: { id }, select: { id: true } }))) {
      throw new NotFoundException('Registro não encontrado.');
    }
  }
}

@ApiTags('mercado')
@ApiBearerAuth()
@Controller('mercado')
export class MercadoController {
  constructor(private readonly service: MercadoService) {}

  @Get() listar(@Query() f: FiltroMercadoDto) { return this.service.listar(f); }

  @Roles(...SO_ADMIN) @Post()
  criar(@Body() dto: CriarValorMercadoDto) { return this.service.criar(dto); }

  @Roles(...SO_ADMIN) @HttpCode(200) @Post('atualizar')
  atualizarPelaFonte() { return this.service.atualizarPelaFonte(); }

  @Roles(...SO_ADMIN) @Patch(':id')
  atualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: AtualizarValorMercadoDto) { return this.service.atualizarRegistro(id, dto); }

  @Roles(...SO_ADMIN) @Delete(':id')
  remover(@Param('id', ParseIntPipe) id: number) { return this.service.remover(id); }
}

@Module({ controllers: [MercadoController], providers: [MercadoService] })
export class MercadoModule {}
