import { Controller, Get, Injectable, Module, NotFoundException, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { AcessoService } from '../common/acesso.service.js';
import { LIMITE_SEM_COMUNICACAO_MIN, PESO_ALERTA } from '../common/config.js';
import { Usuario, type UsuarioLogado } from '../common/decorators.js';
import { FiltroMedicaoDto, MedicoesModule, MedicoesService } from '../medicoes/medicoes.js';
import { PrismaService } from '../prisma/prisma.service.js';

const media = (v: number[], casas = 1) => (v.length ? Number((v.reduce((s, x) => s + x, 0) / v.length).toFixed(casas)) : null);
const minutosDesde = (d: Date) => Math.floor((Date.now() - d.getTime()) / 60_000);

type Semaforo = 'ok' | 'acima' | 'abaixo' | 'sem-faixa';
const semaforo = (v: number | null, min?: number | null, max?: number | null): Semaforo => {
  if (v === null || min == null || max == null) return 'sem-faixa';
  return v > max ? 'acima' : v < min ? 'abaixo' : 'ok';
};

export class HorasDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(168) horas?: number;
}
export class DiasDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(90) dias?: number;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acesso: AcessoService,
    private readonly medicoes: MedicoesService,
  ) {}

  async resumo(u: UsuarioLogado, f: FiltroMedicaoDto) {
    const where = this.medicoes.where(u, f);
    const talhaoFiltro = { propriedadeId: f.propriedadeId, culturaId: f.culturaId };

    const [ultimas, totalMedicoes, dispositivosAtivos, alertasAtivos] = await Promise.all([
      this.prisma.medicao.findMany({ where, orderBy: { dataHora: 'desc' }, take: 50 }),
      this.prisma.medicao.count({ where }),
      this.prisma.dispositivo.count({
        where: { AND: [this.acesso.dispositivo(u), { status: 'ATIVO', talhaoId: f.talhaoId, talhao: talhaoFiltro }] },
      }),
      this.prisma.alerta.count({
        where: { AND: [this.acesso.alerta(u), { resolvido: false, talhaoId: f.talhaoId, talhao: talhaoFiltro }] },
      }),
    ]);

    return {
      temperaturaAtual: ultimas[0]?.temperatura ?? null,
      umidadeAtual: ultimas[0]?.umidade ?? null,
      temperaturaMedia: media(ultimas.map((m) => m.temperatura)),
      umidadeMedia: media(ultimas.map((m) => m.umidade)),
      dispositivosAtivos,
      totalMedicoes,
      alertasAtivos,
    };
  }

  // Serie temporal em ordem cronologica (ultimos 500 pontos do filtro).
  async historico(u: UsuarioLogado, f: FiltroMedicaoDto) {
    const linhas = await this.prisma.medicao.findMany({
      where: this.medicoes.where(u, f),
      select: { dataHora: true, temperatura: true, umidade: true, dispositivoId: true, dispositivo: { select: { talhaoId: true } } },
      orderBy: { dataHora: 'desc' },
      take: 500,
    });
    return linhas.reverse().map(({ dispositivo, ...m }) => ({ ...m, talhaoId: dispositivo.talhaoId }));
  }

  /**
   * T1 - Saude climatica atual do talhao.
   * Regra do "valor atual" com varios dispositivos: media da ultima leitura de cada dispositivo que esta comunicando
   * (leitura dentro de LIMITE_SEM_COMUNICACAO_MIN). Se nenhum comunica, usa a leitura mais recente e marca desatualizado.
   */
  async saudeTalhao(u: UsuarioLogado, talhaoId: number, horas = 24) {
    const talhao = await this.prisma.talhao.findFirst({
      where: { id: talhaoId, ...this.acesso.talhao(u) },
      include: {
        cultura: true,
        propriedade: { select: { id: true, nome: true } },
        dispositivo: { include: { medicao: { orderBy: { dataHora: 'desc' }, take: 1 } } },
      },
    });
    if (!talhao) throw new NotFoundException('Talhão não encontrado.');

    const ativos = talhao.dispositivo.filter((d) => d.status === 'ATIVO');
    const dispositivos = ativos.map((d) => {
      const ultima = d.medicao[0] ?? null;
      const minutos = ultima ? minutosDesde(ultima.dataHora) : null;
      return { id: d.id, codigo: d.codigo, ultimaMedicao: ultima, minutosDesdeUltimaMedicao: minutos, comunicando: minutos !== null && minutos <= LIMITE_SEM_COMUNICACAO_MIN };
    });

    const comunicando = dispositivos.filter((d) => d.comunicando);
    const base = comunicando.length ? comunicando : dispositivos.filter((d) => d.ultimaMedicao).sort((a, b) => b.ultimaMedicao!.dataHora.getTime() - a.ultimaMedicao!.dataHora.getTime()).slice(0, 1);
    const leituras = base.map((d) => d.ultimaMedicao!);
    const campo = (k: 'temperatura' | 'umidade' | 'umidadeSolo' | 'luminosidade' | 'precipitacao') =>
      media(leituras.map((l) => l[k]).filter((v): v is number => v != null));

    const c = talhao.cultura;
    const atual = {
      temperatura: campo('temperatura'),
      umidade: campo('umidade'),
      umidadeSolo: campo('umidadeSolo'),
      luminosidade: campo('luminosidade'),
      precipitacao: campo('precipitacao'),
    };
    const ultimaLeituraEm = leituras.length ? new Date(Math.max(...leituras.map((l) => l.dataHora.getTime()))) : null;

    const desde = new Date(Date.now() - horas * 3_600_000);
    const brutas = await this.prisma.medicao.findMany({
      where: { dispositivo: { talhaoId }, dataHora: { gte: desde } },
      select: { dataHora: true, temperatura: true, umidade: true },
      orderBy: { dataHora: 'asc' },
    });
    // Poucas leituras: devolve cada uma. Muitas: agrupa em baldes de 30 min (media) para o grafico nao ficar pesado.
    let serie: { dataHora: Date; temperatura: number; umidade: number }[];
    if (brutas.length <= 120) {
      serie = brutas;
    } else {
      const baldes = new Map<number, { t: number[]; u: number[] }>();
      for (const m of brutas) {
        const k = Math.floor(m.dataHora.getTime() / 1_800_000) * 1_800_000;
        const b = baldes.get(k) ?? { t: [], u: [] };
        b.t.push(m.temperatura);
        b.u.push(m.umidade);
        baldes.set(k, b);
      }
      serie = [...baldes.entries()].map(([k, b]) => ({ dataHora: new Date(k), temperatura: media(b.t)!, umidade: media(b.u)! }));
    }

    return {
      talhao: { id: talhao.id, nome: talhao.nome, area: talhao.area, propriedade: talhao.propriedade },
      cultura: c && { id: c.id, nome: c.nome, variedade: c.variedade },
      faixa: c && { temperaturaMin: c.temperaturaMin, temperaturaMax: c.temperaturaMax, umidadeMin: c.umidadeMin, umidadeMax: c.umidadeMax },
      atual,
      semaforo: {
        temperatura: semaforo(atual.temperatura, c?.temperaturaMin, c?.temperaturaMax),
        umidade: semaforo(atual.umidade, c?.umidadeMin, c?.umidadeMax),
        umidadeSolo: 'sem-faixa' as Semaforo,
        luminosidade: 'sem-faixa' as Semaforo,
        precipitacao: 'sem-faixa' as Semaforo,
      },
      ultimaLeituraEm,
      minutosDesdeUltimaLeitura: ultimaLeituraEm ? minutosDesde(ultimaLeituraEm) : null,
      desatualizado: comunicando.length === 0,
      dispositivosOnline: comunicando.length,
      dispositivosTotal: dispositivos.length,
      dispositivos,
      horas,
      serie,
    };
  }

  /** T2 - Historico e frequencia de alertas do talhao (separa condicao do talhao x falha de sensor). */
  async alertasTalhao(u: UsuarioLogado, talhaoId: number, dias = 7) {
    const talhao = await this.prisma.talhao.findFirst({ where: { id: talhaoId, ...this.acesso.talhao(u) }, select: { id: true, nome: true } });
    if (!talhao) throw new NotFoundException('Talhão não encontrado.');

    const alertas = await this.prisma.alerta.findMany({
      where: { talhaoId, dataHora: { gte: new Date(Date.now() - dias * 86_400_000) } },
      include: { dispositivo: { select: { id: true, codigo: true } } },
    });

    const porTipo = new Map<string, { titulo: string; pendentes: number; resolvidos: number }>();
    const porDispositivo = new Map<string, { codigo: string; condicaoReal: number; falhaSensor: number }>();
    for (const a of alertas) {
      const t = porTipo.get(a.titulo) ?? { titulo: a.titulo, pendentes: 0, resolvidos: 0 };
      a.resolvido ? t.resolvidos++ : t.pendentes++;
      porTipo.set(a.titulo, t);

      const codigo = a.dispositivo?.codigo ?? 'sem dispositivo';
      const d = porDispositivo.get(codigo) ?? { codigo, condicaoReal: 0, falhaSensor: 0 };
      a.tipo === 'FALHA_SENSOR' ? d.falhaSensor++ : d.condicaoReal++;
      porDispositivo.set(codigo, d);
    }

    const dispositivos = [...porDispositivo.values()].sort((a, b) => b.condicaoReal + b.falhaSensor - (a.condicaoReal + a.falhaSensor));
    const comFalha = dispositivos.filter((d) => d.falhaSensor > 0);
    const observacao = comFalha.length
      ? `${comFalha.map((d) => d.codigo).join(', ')} concentra${comFalha.length > 1 ? 'm' : ''} falhas de sensor (${comFalha.reduce((s, d) => s + d.falhaSensor, 0)}): vale checar o equipamento. O restante é condição real do talhão.`
      : alertas.length
        ? 'Todos os alertas refletem a condição do talhão (nenhuma falha de sensor no período).'
        : 'Sem alertas no período.';

    return {
      talhao,
      dias,
      total: alertas.length,
      pendentes: alertas.filter((a) => !a.resolvido).length,
      resolvidos: alertas.filter((a) => a.resolvido).length,
      porTipo: [...porTipo.values()].sort((a, b) => b.pendentes + b.resolvidos - (a.pendentes + a.resolvidos)),
      porDispositivo: dispositivos,
      observacao,
    };
  }

  /** P2 - Ranking de prioridade dos talhoes da propriedade (score = criticos x5 + atencao x2; pesos em PESO_ALERTA). */
  async rankingPropriedade(u: UsuarioLogado, propriedadeId: number) {
    await this.acesso.garantirPropriedade(u, propriedadeId);
    const talhoes = await this.prisma.talhao.findMany({
      where: { propriedadeId, status: 'ATIVO' },
      include: { cultura: { select: { nome: true } }, alerta: { where: { resolvido: false }, select: { nivel: true } } },
    });

    const itens = talhoes
      .map((t) => {
        const criticos = t.alerta.filter((a) => a.nivel === 'CRITICO').length;
        const atencao = t.alerta.length - criticos;
        return {
          talhaoId: t.id,
          nome: t.nome,
          cultura: t.cultura?.nome ?? null,
          area: t.area,
          latitude: t.latitude,
          longitude: t.longitude,
          criticos,
          atencao,
          pendentes: t.alerta.length,
          score: criticos * PESO_ALERTA.CRITICO + atencao * PESO_ALERTA.ATENCAO,
        };
      })
      .sort((a, b) => b.score - a.score || b.pendentes - a.pendentes || a.nome.localeCompare(b.nome));

    return { propriedadeId, pesos: PESO_ALERTA, totalPendentes: itens.reduce((s, i) => s + i.pendentes, 0), scoreMaximo: Math.max(0, ...itens.map((i) => i.score)), itens };
  }
}

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('resumo') resumo(@Usuario() u: UsuarioLogado, @Query() f: FiltroMedicaoDto) { return this.service.resumo(u, f); }
  @Get('historico') historico(@Usuario() u: UsuarioLogado, @Query() f: FiltroMedicaoDto) { return this.service.historico(u, f); }

  @Get('talhao/:id/saude')
  saude(@Usuario() u: UsuarioLogado, @Param('id', ParseIntPipe) id: number, @Query() q: HorasDto) { return this.service.saudeTalhao(u, id, q.horas); }

  @Get('talhao/:id/alertas')
  alertasTalhao(@Usuario() u: UsuarioLogado, @Param('id', ParseIntPipe) id: number, @Query() q: DiasDto) { return this.service.alertasTalhao(u, id, q.dias); }

  @Get('propriedade/:id/ranking-alertas')
  ranking(@Usuario() u: UsuarioLogado, @Param('id', ParseIntPipe) id: number) { return this.service.rankingPropriedade(u, id); }
}

@Module({ imports: [MedicoesModule], controllers: [DashboardController], providers: [DashboardService] })
export class DashboardModule {}
