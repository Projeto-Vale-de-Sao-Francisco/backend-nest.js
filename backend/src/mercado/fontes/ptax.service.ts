import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ErroFonte,
  HttpSeguroService,
  mensagemFonte,
} from './http-seguro.service.js';
export interface CambioPtax {
  usd_brl: number;
  data: string;
  fonte: 'BCB PTAX';
}

@Injectable()
export class PtaxService {
  private readonly logger = new Logger(PtaxService.name);
  private cache?: { expiraEm: number; valor: CambioPtax | null };
  private pendente?: Promise<CambioPtax | null>;
  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpSeguroService,
  ) {}
  async cotacaoAtual(): Promise<CambioPtax | null> {
    if (this.pendente) return this.pendente;
    if (this.cache && this.cache.expiraEm > Date.now()) return this.cache.valor;
    this.pendente = this.buscar()
      .catch((error: unknown) => {
        this.logger.warn(mensagemFonte(error));
        return null;
      })
      .then((valor) => {
        const ttl = Number(this.config.get('MERCADO_CACHE_TTL_MIN', 60));
        this.cache = {
          valor,
          expiraEm:
            Date.now() + (Number.isFinite(ttl) && ttl > 0 ? ttl : 60) * 60_000,
        };
        return valor;
      });
    try {
      return await this.pendente;
    } finally {
      this.pendente = undefined;
    }
  }
  private async buscar(): Promise<CambioPtax | null> {
    const hoje = new Date(
      new Date().toLocaleDateString('en-CA', {
        timeZone: 'America/Sao_Paulo',
      }) + 'T12:00:00Z',
    );
    const inicio = new Date(hoje);
    inicio.setUTCDate(hoje.getUTCDate() - 6);
    // OData PTAX recebe MM-DD-YYYY, não DD/MM/YYYY.
    const formatar = (data: Date) =>
      `${String(data.getUTCMonth() + 1).padStart(2, '0')}-${String(data.getUTCDate()).padStart(2, '0')}-${data.getUTCFullYear()}`;
    const params = new URLSearchParams({
      '@dataInicial': `'${formatar(inicio)}'`,
      '@dataFinalCotacao': `'${formatar(hoje)}'`,
      $format: 'json',
    });
    // CotacaoDolarPeriodo já retorna os boletins de fechamento (sem campo tipoBoletim).
    const resposta = await this.http.json(
      `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)?${params}`,
      { headers: { accept: 'application/json' } },
      ['olinda.bcb.gov.br'],
      Number(this.config.get('MERCADO_HTTP_TIMEOUT_MS', 10000)),
    );
    if (
      !resposta ||
      typeof resposta !== 'object' ||
      !('value' in resposta) ||
      !Array.isArray(resposta.value)
    )
      throw new ErroFonte('Resposta inesperada da PTAX');
    const cotacoes = resposta.value as unknown[];
    const validas = cotacoes.map((row) => {
      if (!row || typeof row !== 'object')
        throw new ErroFonte('Resposta inesperada da PTAX');
      const item = row as Record<string, unknown>;
      if (
        typeof item.cotacaoVenda !== 'number' ||
        !Number.isFinite(item.cotacaoVenda) ||
        item.cotacaoVenda <= 0 ||
        typeof item.dataHoraCotacao !== 'string' ||
        !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(
          item.dataHoraCotacao,
        )
      )
        throw new ErroFonte('Resposta inesperada da PTAX');
      const dia = item.dataHoraCotacao.slice(0, 10);
      if (
        dia < inicio.toISOString().slice(0, 10) ||
        dia > hoje.toISOString().slice(0, 10)
      )
        throw new ErroFonte('Data inesperada da PTAX');
      return {
        usd_brl: item.cotacaoVenda,
        data: item.dataHoraCotacao,
        fonte: 'BCB PTAX' as const,
      };
    });
    return validas.sort((a, b) => b.data.localeCompare(a.data))[0] ?? null;
  }
}
