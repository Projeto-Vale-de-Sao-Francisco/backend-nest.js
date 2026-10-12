import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../../generated/prisma/client.js';
import { CULTURAS_NCM, normalizarNomeCultura } from './culturas-ncm.config.js';
import type {
  CulturaMercado,
  FonteMercado,
  OpcoesFonteMercado,
  RegistroMercado,
} from './fonte-mercado.interface.js';
import { ErroFonte, HttpSeguroService } from './http-seguro.service.js';

@Injectable()
export class ComexstatFonte implements FonteMercado {
  readonly id = 'comexstat';
  readonly nome = 'Comex Stat (MDIC) — valor médio de exportação';
  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpSeguroService,
  ) {}
  suporta(cultura: CulturaMercado): boolean {
    return !!CULTURAS_NCM[normalizarNomeCultura(cultura.nome)];
  }
  async buscar(
    cultura: CulturaMercado,
    _opcoes?: OpcoesFonteMercado,
  ): Promise<RegistroMercado[]> {
    const ncm = CULTURAS_NCM[normalizarNomeCultura(cultura.nome)];
    if (!ncm) throw new ErroFonte('Cultura sem fonte de cotação configurada');
    const raw = this.config.get<string>('COMEXSTAT_ESTADOS', '26,32').trim();
    if (raw && !/^\d{2}(,\s*\d{2})*$/.test(raw))
      throw new ErroFonte('Configuração de estados do Comex Stat inválida');
    const estados = raw ? raw.split(',').map(Number) : [];
    const meses = Number(this.config.get('COMEXSTAT_MESES', 12));
    if (!Number.isInteger(meses) || meses < 1 || meses > 24)
      throw new ErroFonte('Período do Comex Stat deve ter de 1 a 24 meses');
    const hoje = new Date();
    const inicio = new Date(
      Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - meses, 1),
    );
    const fim = new Date(
      Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - 1, 1),
    );
    const formatar = (data: Date) => data.toISOString().slice(0, 7);
    const resposta = await this.http.json(
      'https://api-comexstat.mdic.gov.br/general?language=pt',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          flow: 'export',
          monthDetail: true,
          period: { from: formatar(inicio), to: formatar(fim) },
          filters: [
            { filter: 'ncm', values: ncm },
            ...(estados.length ? [{ filter: 'state', values: estados }] : []),
          ],
          details: ['country'],
          metrics: ['metricFOB', 'metricKG'],
        }),
      },
      ['api-comexstat.mdic.gov.br'],
      Number(this.config.get('MERCADO_HTTP_TIMEOUT_MS', 10000)),
    );
    return this.validar(resposta, inicio, fim);
  }
  private validar(
    resposta: unknown,
    inicio: Date,
    fim: Date,
  ): RegistroMercado[] {
    const invalida = () => new ErroFonte('Resposta inesperada do Comex Stat');
    if (
      !resposta ||
      typeof resposta !== 'object' ||
      !('success' in resposta) ||
      resposta.success !== true ||
      !('data' in resposta)
    )
      throw invalida();
    const data = resposta.data;
    if (
      !data ||
      typeof data !== 'object' ||
      !('list' in data) ||
      !Array.isArray(data.list)
    )
      throw invalida();
    if (data.list.length === 0)
      throw new ErroFonte(
        'Comex Stat não retornou dados para o período e filtros configurados',
      );
    const grupos = new Map<
      string,
      { pais: string; data: Date; fob: Prisma.Decimal; peso: Prisma.Decimal }
    >();
    for (const row of data.list as unknown[]) {
      if (!row || typeof row !== 'object') throw invalida();
      const linha = row as Record<string, unknown>;
      if (typeof linha.country !== 'string' || !linha.country.trim())
        throw invalida();
      const numero = (campo: string): Prisma.Decimal => {
        const valor = linha[campo];
        if (
          (typeof valor !== 'number' && typeof valor !== 'string') ||
          !/^\d+(\.\d+)?$/.test(String(valor))
        )
          throw invalida();
        const decimal = new Prisma.Decimal(valor);
        if (
          !decimal.isFinite() ||
          decimal.isNegative() ||
          !Number.isFinite(decimal.toNumber())
        )
          throw invalida();
        return decimal;
      };
      const ano = numero('year').toNumber();
      const mes = numero('monthNumber').toNumber();
      if (
        !Number.isInteger(ano) ||
        ano < 1997 ||
        !Number.isInteger(mes) ||
        mes < 1 ||
        mes > 12
      )
        throw invalida();
      const referencia = new Date(Date.UTC(ano, mes - 1, 1));
      if (referencia < inicio || referencia > fim) throw invalida();
      const fob = numero('metricFOB');
      const peso = numero('metricKG');
      if (peso.isZero()) continue;
      if (fob.isZero()) throw invalida();
      const pais = linha.country.trim();
      const chave = `${pais}:${referencia.toISOString()}`;
      const anterior = grupos.get(chave);
      grupos.set(chave, {
        pais,
        data: referencia,
        fob: fob.add(anterior?.fob ?? 0),
        peso: peso.add(anterior?.peso ?? 0),
      });
    }
    return [...grupos.values()].map((item) => ({
      mercadoDestino: item.pais,
      paisDestino: item.pais,
      preco: item.fob.div(item.peso).toFixed(),
      moeda: 'USD',
      unidadeMedida: 'kg',
      dataReferencia: item.data,
      demandaEstimada: item.peso.toNumber(),
    }));
  }
}
export default ComexstatFonte;
