import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  CulturaMercado,
  FonteMercado,
  RegistroMercado,
} from './fonte-mercado.interface.js';
import { mensagemFonte } from './http-seguro.service.js';

export const FONTES_MERCADO = Symbol('FONTES_MERCADO');
export interface ConsultaFonte {
  registros: RegistroMercado[];
  cache: boolean;
  atualizadoEm: Date;
  gravados: number;
}
interface Estado {
  atualizacao: Date | null;
  erro: string | null;
}

@Injectable()
export class MercadoFontesService {
  private readonly ativas: Set<string>;
  private readonly ttlMs: number;
  private readonly cache = new Map<
    string,
    { expiraEm: number; resultado: ConsultaFonte }
  >();
  private readonly pendentes = new Map<string, Promise<ConsultaFonte>>();
  private readonly estados = new Map<string, Estado>();
  private readonly estadosCultura = new Map<string, Estado>();
  constructor(
    config: ConfigService,
    @Inject(FONTES_MERCADO) private readonly fontes: FonteMercado[],
  ) {
    this.ativas = new Set(
      config
        .get<string>('MERCADO_FONTES_ATIVAS', 'comexstat')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    );
    for (const id of this.ativas)
      if (!fontes.some((fonte) => fonte.id === id))
        throw new Error(`Fonte de mercado desconhecida na configuração: ${id}`);
    const ttl = Number(config.get('MERCADO_CACHE_TTL_MIN', 60));
    this.ttlMs = (Number.isFinite(ttl) && ttl > 0 ? ttl : 60) * 60_000;
  }
  selecionar(cultura: CulturaMercado, id?: string): FonteMercado[] {
    return this.fontes.filter(
      (fonte) =>
        this.ativas.has(fonte.id) &&
        (!id || fonte.id === id) &&
        fonte.suporta(cultura),
    );
  }
  async buscar(
    fonte: FonteMercado,
    cultura: CulturaMercado,
    forcar: boolean,
    gravar: (registros: RegistroMercado[]) => Promise<number>,
  ): Promise<ConsultaFonte> {
    const chave = `${fonte.id}:${cultura.id}`;
    // Mesmo forçar reutiliza uma atualização em andamento; inclui a transação.
    const pendente = this.pendentes.get(chave);
    if (pendente) return { ...(await pendente), cache: true, gravados: 0 };
    const existente = this.cache.get(chave);
    if (!forcar && existente && existente.expiraEm > Date.now())
      return { ...existente.resultado, cache: true, gravados: 0 };
    const promessa = (async () => {
      try {
        const registros = await fonte.buscar(cultura, { forcar });
        const gravados = await gravar(registros);
        const atualizadoEm = new Date();
        const resultado = { registros, cache: false, atualizadoEm, gravados };
        this.cache.set(chave, { expiraEm: Date.now() + this.ttlMs, resultado });
        const estado = { atualizacao: atualizadoEm, erro: null };
        this.estados.set(fonte.id, estado);
        this.estadosCultura.set(chave, estado);
        return resultado;
      } catch (error) {
        const erro = mensagemFonte(error);
        this.estados.set(fonte.id, {
          atualizacao: this.estados.get(fonte.id)?.atualizacao ?? null,
          erro,
        });
        this.estadosCultura.set(chave, {
          atualizacao: this.estadosCultura.get(chave)?.atualizacao ?? null,
          erro,
        });
        throw error;
      }
    })();
    this.pendentes.set(chave, promessa);
    try {
      return await promessa;
    } finally {
      this.pendentes.delete(chave);
    }
  }
  estadoCultura(cultura: CulturaMercado) {
    const estados = this.selecionar(cultura).map((fonte) =>
      this.estadosCultura.get(`${fonte.id}:${cultura.id}`),
    );
    const datas = estados.flatMap((estado) =>
      estado?.atualizacao ? [estado.atualizacao] : [],
    );
    const atualizado_em =
      datas.sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
    const fonte_erro = estados.find((estado) => estado?.erro)?.erro ?? null;
    const desatualizado =
      !estados.length ||
      estados.some(
        (estado) =>
          !estado?.atualizacao ||
          !!estado.erro ||
          Date.now() - estado.atualizacao.getTime() >= this.ttlMs,
      );
    return { atualizado_em, desatualizado, fonte_erro };
  }
  diagnosticos() {
    return this.fontes.map((fonte) => ({
      id: fonte.id,
      nome: fonte.nome,
      ativa: this.ativas.has(fonte.id),
      ultima_atualizacao: this.estados.get(fonte.id)?.atualizacao ?? null,
      ultimo_erro: this.estados.get(fonte.id)?.erro ?? null,
    }));
  }
}
