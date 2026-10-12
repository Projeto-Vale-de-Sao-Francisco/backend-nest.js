import { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComexstatFonte } from './comexstat.fonte.js';
import { HttpSeguroService } from './http-seguro.service.js';
import { MercadoFontesService } from './mercado-fontes.service.js';
import { PtaxService } from './ptax.service.js';
import type {
  FonteMercado,
  RegistroMercado,
} from './fonte-mercado.interface.js';

const cultura = { id: 1, nome: 'Uva fresca' };
const linha = {
  year: '2026',
  monthNumber: '08',
  country: 'Argentina',
  metricFOB: '200',
  metricKG: '100',
};
const fixture = (list: unknown[] = [linha]) => ({
  success: true,
  data: { list },
});
const registro: RegistroMercado = {
  mercadoDestino: 'Argentina',
  paisDestino: 'Argentina',
  preco: '2',
  moeda: 'USD',
  unidadeMedida: 'kg',
  dataReferencia: new Date('2026-08-01'),
  demandaEstimada: 100,
};
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-11T15:00:00Z'));
  fetchMock = vi.fn(() => {
    throw new Error('Teste tentou usar rede sem fixture');
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const responder = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), { status, headers });
const config = (values: Record<string, unknown> = {}) =>
  new ConfigService(values);

describe('Comex Stat (fixtures no contrato real)', () => {
  it('valida, agrega FOB/peso por país e mês e envia NCM/PE/BA', async () => {
    fetchMock.mockResolvedValue(
      responder(
        fixture([linha, { ...linha, metricFOB: '100', metricKG: '50' }]),
      ),
    );
    const fonte = new ComexstatFonte(config(), new HttpSeguroService());
    expect(await fonte.buscar(cultura)).toEqual([
      { ...registro, demandaEstimada: 150 },
    ]);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toMatchObject({
      flow: 'export',
      monthDetail: true,
      period: { from: '2025-10', to: '2026-09' },
      filters: [
        { filter: 'ncm', values: ['08061000'] },
        { filter: 'state', values: [26, 32] },
      ],
      details: ['country'],
      metrics: ['metricFOB', 'metricKG'],
    });
  });
  it('COMEXSTAT_ESTADOS vazio consulta Brasil inteiro', async () => {
    fetchMock.mockResolvedValue(responder(fixture()));
    await new ComexstatFonte(
      config({ COMEXSTAT_ESTADOS: '' }),
      new HttpSeguroService(),
    ).buscar(cultura);
    expect(
      JSON.parse(fetchMock.mock.calls[0][1].body as string).filters,
    ).toHaveLength(1);
  });
  it('rejeita lista vazia em vez de registrar atualização bem-sucedida', async () => {
    fetchMock.mockResolvedValue(responder(fixture([])));
    await expect(
      new ComexstatFonte(config(), new HttpSeguroService()).buscar(cultura),
    ).rejects.toThrow(
      'Comex Stat não retornou dados para o período e filtros configurados',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each([
    null,
    {},
    { success: false, data: { list: [] } },
    { success: true, data: { list: [null] } },
    fixture([42]),
    fixture([{ ...linha, metricKG: '' }]),
    fixture([{ ...linha, metricKG: '-1' }]),
    fixture([{ ...linha, country: {} }]),
    fixture([{ ...linha, monthNumber: '13' }]),
    fixture([{ ...linha, year: '2020' }]),
    fixture([{ ...linha, metricFOB: '0' }]),
  ])('rejeita resposta inválida inteira: %j', async (body) => {
    fetchMock.mockResolvedValue(responder(body));
    await expect(
      new ComexstatFonte(config(), new HttpSeguroService()).buscar(cultura),
    ).rejects.toThrow('Resposta inesperada');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('ignora peso zero e não cria meses sem dados', async () => {
    fetchMock.mockResolvedValue(
      responder(fixture([{ ...linha, metricKG: '0' }])),
    );
    expect(
      await new ComexstatFonte(config(), new HttpSeguroService()).buscar(
        cultura,
      ),
    ).toEqual([]);
  });
  it('normaliza cultura, mapeia manga e não suporta desconhecida', () => {
    const fonte = new ComexstatFonte(config(), new HttpSeguroService());
    expect(fonte.suporta({ id: 2, nome: ' MÁNGA ' })).toBe(true);
    expect(fonte.suporta({ id: 3, nome: 'Banana' })).toBe(false);
  });
});

describe('HTTP seguro', () => {
  const url = 'https://api-comexstat.mdic.gov.br/general';
  const call = (http: HttpSeguroService, path = url) =>
    http.json(path, {}, ['api-comexstat.mdic.gov.br'], 1000);
  it.each([
    'https://outro.example/x',
    'http://api-comexstat.mdic.gov.br/general',
    'https://user:pass@api-comexstat.mdic.gov.br/general',
  ])('bloqueia URL %s antes do fetch', async (path) => {
    await expect(call(new HttpSeguroService(), path)).rejects.toThrow('Host');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('bloqueia redirects sem seguir', async () => {
    fetchMock.mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: 'https://evil.example' },
      }),
    );
    await expect(call(new HttpSeguroService())).rejects.toThrow(
      'Redirecionamento',
    );
    expect(fetchMock.mock.calls[0][1].redirect).toBe('manual');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each(['60', 'Sun, 11 Oct 2026 15:01:00 GMT'])(
    'respeita Retry-After %s sem retry',
    async (retry) => {
      fetchMock.mockResolvedValue(responder({}, 429, { 'retry-after': retry }));
      const http = new HttpSeguroService();
      await expect(call(http)).rejects.toThrow('limitada');
      await expect(call(http)).rejects.toThrow('limitada');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(60_001);
      fetchMock.mockResolvedValue(responder({ ok: true }));
      await expect(call(http)).resolves.toEqual({ ok: true });
    },
  );
  it('timeout aborta, repete só uma vez e não vaza erro interno', async () => {
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) =>
          init.signal?.addEventListener('abort', () =>
            reject(new Error('segredo interno')),
          ),
        ),
    );
    const pending = expect(call(new HttpSeguroService())).rejects.toThrow(
      'Tempo limite',
    );
    await vi.advanceTimersByTimeAsync(2500);
    await pending;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it.each([new TypeError('rede'), 503])(
    'repete rede/5xx uma vez: %s',
    async (falha) => {
      if (typeof falha === 'number')
        fetchMock.mockResolvedValueOnce(responder({}, falha));
      else fetchMock.mockRejectedValueOnce(falha);
      fetchMock.mockResolvedValueOnce(responder({ ok: true }));
      const pending = call(new HttpSeguroService());
      await vi.advanceTimersByTimeAsync(300);
      expect(await pending).toEqual({ ok: true });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    },
  );
  it('não repete erro 400 ou JSON inválido', async () => {
    fetchMock.mockResolvedValue(responder({}, 400));
    await expect(call(new HttpSeguroService())).rejects.toThrow('HTTP 400');
    fetchMock.mockResolvedValue(new Response('bad json'));
    await expect(call(new HttpSeguroService())).rejects.toThrow(
      'JSON inválido',
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('limita 5 MB pelo header e também pelo stream', async () => {
    fetchMock.mockResolvedValue(
      new Response('{}', {
        headers: { 'content-length': String(5 * 1024 * 1024 + 1) },
      }),
    );
    await expect(call(new HttpSeguroService())).rejects.toThrow('5 MB');
    fetchMock.mockResolvedValue(new Response('x'.repeat(5 * 1024 * 1024 + 1)));
    await expect(call(new HttpSeguroService())).rejects.toThrow('5 MB');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('PTAX', () => {
  const ptaxFixture = {
    value: [
      { cotacaoVenda: 5.1, dataHoraCotacao: '2026-10-09 13:05:00.123456' },
      { cotacaoVenda: 5.2, dataHoraCotacao: '2026-10-08 13:05:00.123456' },
    ],
  };
  it('no domingo usa fechamento da sexta; compartilha Promise e cache', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(responder(ptaxFixture)));
    const ptax = new PtaxService(config(), new HttpSeguroService());
    const [a, b] = await Promise.all([
      ptax.cotacaoAtual(),
      ptax.cotacaoAtual(),
    ]);
    expect(a).toEqual({
      usd_brl: 5.1,
      data: '2026-10-09 13:05:00.123456',
      fonte: 'BCB PTAX',
    });
    expect(b).toEqual(a);
    await ptax.cotacaoAtual();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(decodeURIComponent(fetchMock.mock.calls[0][0] as string)).toContain(
      '10-05-2026',
    );
    vi.advanceTimersByTime(60 * 60_000 + 1);
    await ptax.cotacaoAtual();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it.each([
    {},
    { value: [] },
    { value: [{ cotacaoVenda: -1, dataHoraCotacao: '2026-10-09 13:05:00' }] },
    { value: [...ptaxFixture.value, null] },
  ])('indisponível/inválida retorna null: %j', async (body) => {
    fetchMock.mockResolvedValue(responder(body));
    expect(
      await new PtaxService(config(), new HttpSeguroService()).cotacaoAtual(),
    ).toBeNull();
  });
});

describe('Cache de fontes inclui persistência', () => {
  let fonte: FonteMercado;
  let fontes: MercadoFontesService;
  let gravar: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fonte = {
      id: 'comexstat',
      nome: 'Fonte',
      suporta: () => true,
      buscar: vi.fn().mockResolvedValue([registro]),
    };
    fontes = new MercadoFontesService(config(), [fonte]);
    gravar = vi.fn().mockResolvedValue(1);
  });
  it('miss, hit, expiração, force e diagnóstico', async () => {
    expect((await fontes.buscar(fonte, cultura, false, gravar)).cache).toBe(
      false,
    );
    expect((await fontes.buscar(fonte, cultura, false, gravar)).cache).toBe(
      true,
    );
    expect(fonte.buscar).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60 * 60_000 + 1);
    expect(fontes.estadoCultura(cultura).desatualizado).toBe(true);
    await fontes.buscar(fonte, cultura, false, gravar);
    await fontes.buscar(fonte, cultura, true, gravar);
    expect(fonte.buscar).toHaveBeenCalledTimes(3);
    expect(fontes.diagnosticos()[0]).toMatchObject({
      ativa: true,
      ultimo_erro: null,
    });
  });
  it('deduplica inclusive force durante a transação', async () => {
    let resolver!: (value: number) => void;
    gravar.mockImplementation(
      () =>
        new Promise<number>((resolve) => {
          resolver = resolve;
        }),
    );
    const a = fontes.buscar(fonte, cultura, false, gravar);
    const b = fontes.buscar(fonte, cultura, true, gravar);
    await Promise.resolve();
    resolver(1);
    const [primeiro, segundo] = await Promise.all([a, b]);
    expect(primeiro.cache).toBe(false);
    expect(segundo.cache).toBe(true);
    expect(segundaData(segundo)).toBe(segundaData(primeiro));
    expect(gravar).toHaveBeenCalledTimes(1);
  });
  it('falha de gravação não cria cache; erro não contamina outra cultura', async () => {
    gravar.mockRejectedValueOnce(new Error('payload secreto'));
    await expect(
      fontes.buscar(fonte, cultura, false, gravar),
    ).rejects.toThrow();
    expect(fontes.estadoCultura(cultura)).toMatchObject({
      desatualizado: true,
      fonte_erro: 'Não foi possível consultar ou armazenar os dados da fonte',
    });
    expect(
      fontes.estadoCultura({ id: 2, nome: 'Manga' }).fonte_erro,
    ).toBeNull();
    await fontes.buscar(fonte, cultura, false, gravar);
    expect(fonte.buscar).toHaveBeenCalledTimes(2);
  });
  it('mostra fonte desativada e descobre fonte extra por injeção', () => {
    const extra = { ...fonte, id: 'nova' };
    const registry = new MercadoFontesService(
      config({ MERCADO_FONTES_ATIVAS: 'nova' }),
      [fonte, extra],
    );
    expect(registry.selecionar(cultura)).toEqual([extra]);
    expect(registry.diagnosticos()[0].ativa).toBe(false);
  });
  it('fonte desconhecida no env falha com mensagem de configuração', () => {
    expect(
      () =>
        new MercadoFontesService(
          config({ MERCADO_FONTES_ATIVAS: 'inexistente' }),
          [fonte],
        ),
    ).toThrow('desconhecida');
  });
});
function segundaData(item: { atualizadoEm: Date }) {
  return item.atualizadoEm.getTime();
}
