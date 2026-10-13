import { Controller, Get, HttpCode, Injectable, Logger, Module, NotFoundException, OnModuleDestroy, OnModuleInit, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional } from 'class-validator';
import { AcessoService } from '../common/acesso.service.js';
import { LIMITE_SEM_COMUNICACAO_MIN } from '../common/config.js';
import { SO_ADMIN, Roles, Usuario, type UsuarioLogado } from '../common/decorators.js';
import { NivelAlerta } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

export class FiltroAlertaDto {
  @IsOptional() @Type(() => Number) @IsInt() talhaoId?: number;
  @IsOptional() @Type(() => Number) @IsInt() propriedadeId?: number;
  @IsOptional() @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value)) @IsBoolean() visualizado?: boolean;
  @IsOptional() @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value)) @IsBoolean() resolvido?: boolean;
  @IsOptional() @IsEnum(NivelAlerta) nivel?: NivelAlerta;
}

// Amplitude fora da faixa acima desta fracao da largura da faixa vira CRITICO.
const LIMITE_CRITICO = 0.15;
// Enquanto houver alerta igual (mesmo dispositivo e titulo) nao resolvido dentro desta janela, nao cria outro.
const JANELA_REPETICAO_MIN = Number(process.env.ALERTA_JANELA_MIN ?? 60);

const INTERVALO_VERIFICACAO_MIN = Number(process.env.ALERTA_VERIFICAR_COMUNICACAO_MIN ?? 5);

@Injectable()
export class AlertasService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(AlertasService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly acesso: AcessoService,
  ) {}

  onModuleInit() {
    if (process.env.VITEST || INTERVALO_VERIFICACAO_MIN <= 0) return;
    this.timer = setInterval(() => {
      this.verificarComunicacao().catch((e: Error) => this.log.error(`Falha ao verificar comunicacao: ${e.message}`));
    }, INTERVALO_VERIFICACAO_MIN * 60_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  // Falha de sensor: dispositivo ATIVO sem enviar leituras ha mais que LIMITE_SEM_COMUNICACAO_MIN.
  // Separa problema de equipamento (FALHA_SENSOR) de problema do talhao (CLIMATICO). Sem repeticao enquanto nao resolvido.
  async verificarComunicacao() {
    const limite = new Date(Date.now() - LIMITE_SEM_COMUNICACAO_MIN * 60_000);
    const dispositivos = await this.prisma.dispositivo.findMany({
      where: { status: 'ATIVO' },
      select: { id: true, codigo: true, talhaoId: true, medicao: { orderBy: { dataHora: 'desc' }, take: 1, select: { dataHora: true } } },
    });

    let criados = 0;
    for (const d of dispositivos) {
      const ultima = d.medicao[0]?.dataHora;
      if (ultima && ultima >= limite) continue;
      const titulo = 'Dispositivo sem comunicação';
      const aberto = await this.prisma.alerta.findFirst({ where: { dispositivoId: d.id, titulo, resolvido: false }, select: { id: true } });
      if (aberto) continue;
      const min = ultima ? Math.floor((Date.now() - ultima.getTime()) / 60_000) : null;
      await this.prisma.alerta.create({
        data: {
          talhaoId: d.talhaoId,
          dispositivoId: d.id,
          tipo: 'FALHA_SENSOR',
          nivel: 'ATENCAO',
          titulo,
          descricao: min === null ? `${d.codigo} ainda não enviou nenhuma leitura.` : `${d.codigo} sem enviar leituras há ${min >= 120 ? `${Math.floor(min / 60)} h` : `${min} min`}.`,
        },
      });
      criados++;
    }
    return { verificados: dispositivos.length, alertasCriados: criados };
  }

  listar(u: UsuarioLogado, f: FiltroAlertaDto) {
    return this.prisma.alerta.findMany({
      where: {
        AND: [
          this.acesso.alerta(u),
          {
            talhaoId: f.talhaoId,
            visualizado: f.visualizado,
            resolvido: f.resolvido,
            nivel: f.nivel,
            ...(f.propriedadeId ? { talhao: { propriedadeId: f.propriedadeId } } : {}),
          },
        ],
      },
      include: { talhao: { select: { id: true, nome: true, propriedadeId: true, cultura: { select: { id: true, nome: true } } } } },
      orderBy: { dataHora: 'desc' },
      take: 200,
    });
  }

  async marcarVisualizado(u: UsuarioLogado, id: number) {
    const a = await this.prisma.alerta.findFirst({ where: { id, ...this.acesso.alerta(u) }, select: { id: true } });
    if (!a) throw new NotFoundException('Alerta não encontrado.');
    return this.prisma.alerta.update({ where: { id }, data: { visualizado: true } });
  }

  // Regra do requisito 14: medicao fora da faixa da cultura do talhao gera alerta sozinha.
  async resolver(u: UsuarioLogado, id: number) {
    const a = await this.prisma.alerta.findFirst({ where: { id, ...this.acesso.alerta(u) }, select: { id: true } });
    if (!a) throw new NotFoundException('Alerta não encontrado.');
    return this.prisma.alerta.update({ where: { id }, data: { resolvido: true, resolvidoEm: new Date(), visualizado: true } });
  }

  async avaliar(medicao: { id: number; dispositivoId: number; temperatura: number; umidade: number }) {
    const d = await this.prisma.dispositivo.findUnique({
      where: { id: medicao.dispositivoId },
      select: { talhao: { select: { id: true, nome: true, cultura: true } } },
    });
    const talhao = d?.talhao;
    const cultura = talhao?.cultura;
    if (!talhao || !cultura) return [];

    const checagens = [
      { rotulo: 'Temperatura', unidade: '°C', v: medicao.temperatura, min: cultura.temperaturaMin, max: cultura.temperaturaMax },
      { rotulo: 'Umidade', unidade: '%', v: medicao.umidade, min: cultura.umidadeMin, max: cultura.umidadeMax },
    ];

    const dados = checagens.flatMap((c) => {
      if (c.v >= c.min && c.v <= c.max) return [];
      const acima = c.v > c.max;
      const desvio = acima ? c.v - c.max : c.min - c.v;
      const nivel: NivelAlerta = desvio > (c.max - c.min) * LIMITE_CRITICO ? 'CRITICO' : 'ATENCAO';
      return [
        {
          talhaoId: talhao.id,
          medicaoId: medicao.id,
          dispositivoId: medicao.dispositivoId,
          nivel,
          titulo: `${c.rotulo} ${acima ? 'acima' : 'abaixo'} do recomendado`,
          descricao: `${c.rotulo} ${acima ? 'acima' : 'abaixo'} do recomendado para o talhão ${talhao.nome} (${cultura.nome.toLowerCase()}): ${c.v}${c.unidade} ${acima ? '>' : '<'} ${acima ? c.max : c.min}${c.unidade}.`,
        },
      ];
    });

    const desde = new Date(Date.now() - JANELA_REPETICAO_MIN * 60_000);
    const novos = (
      await Promise.all(
        dados.map(async (d) =>
          (await this.prisma.alerta.findFirst({
            where: { dispositivoId: d.dispositivoId, titulo: d.titulo, resolvido: false, dataHora: { gte: desde } },
            select: { id: true },
          }))
            ? null
            : d,
        ),
      )
    ).filter((d): d is NonNullable<typeof d> => d !== null);

    if (novos.length) await this.prisma.alerta.createMany({ data: novos });
    return novos;
  }
}

@ApiTags('alertas')
@ApiBearerAuth()
@Controller('alertas')
export class AlertasController {
  constructor(private readonly service: AlertasService) {}

  @Get() listar(@Usuario() u: UsuarioLogado, @Query() f: FiltroAlertaDto) { return this.service.listar(u, f); }

  @Patch(':id/visualizar')
  visualizar(@Usuario() u: UsuarioLogado, @Param('id', ParseIntPipe) id: number) { return this.service.marcarVisualizado(u, id); }

  @Roles(...SO_ADMIN) @HttpCode(200) @Post('verificar-comunicacao')
  verificarComunicacao() { return this.service.verificarComunicacao(); }

  @Patch(':id/resolver')
  resolver(@Usuario() u: UsuarioLogado, @Param('id', ParseIntPipe) id: number) { return this.service.resolver(u, id); }
}

@Module({ controllers: [AlertasController], providers: [AlertasService], exports: [AlertasService] })
export class AlertasModule {}
