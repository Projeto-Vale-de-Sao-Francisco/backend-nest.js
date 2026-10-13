import 'dotenv/config';

/**
 * Simulador de sensores IoT (substitui o ESP32 fisico). Envia medicoes pela API REST, como o hardware fara.
 *   npm run simulate          -> uma rodada para cada dispositivo ativo e encerra
 *   npm run simulate -- loop  -> uma rodada a cada INTERVALO_S segundos (padrao 30)
 * Autenticacao: cada dispositivo usa a propria chave (cabecalho x-device-key), emitida a cada execucao (a anterior deixa de valer).
 * Variaveis: API_URL, SIM_EMAIL, SIM_SENHA, INTERVALO_S, CHANCE_FORA_DA_FAIXA (0..1, padrao 0.1)
 */
const API = process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 3333}`;
const EMAIL = process.env.SIM_EMAIL ?? 'admin@sivale.com.br';
const SENHA = process.env.SIM_SENHA ?? '123456';
const INTERVALO_S = Number(process.env.INTERVALO_S ?? 30);
const CHANCE_FORA = Number(process.env.CHANCE_FORA_DA_FAIXA ?? 0.1);

let token = '';
const chaves = new Map<number, string>();

async function chamar<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(`${API}${caminho}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
  });
  if (!r.ok) throw new Error(`${init.method ?? 'GET'} ${caminho} => ${r.status} ${await r.text()}`);
  return r.json() as Promise<T>;
}

async function login() {
  const r = await chamar<{ token: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email: EMAIL, senha: SENHA }) });
  token = r.token;
}

const aleatorio = (centro: number, amplitude: number) => centro + (Math.random() * 2 - 1) * amplitude;

async function rodada() {
  const dispositivos = await chamar<any[]>('/dispositivos');
  const talhoes = new Map((await chamar<any[]>('/talhoes')).map((t) => [t.id, t]));

  for (const d of dispositivos.filter((x) => x.status === 'ATIVO')) {
    // Cada dispositivo se autentica com a propria chave (como o ESP32 fara): emitimos uma na primeira rodada.
    if (!chaves.has(d.id)) {
      const r = await chamar<{ chaveApi: string }>(`/dispositivos/${d.id}/chave`, { method: 'POST' });
      chaves.set(d.id, r.chaveApi);
    }
    const cultura = talhoes.get(d.talhaoId)?.cultura;
    if (!cultura) continue;

    const fora = Math.random() < CHANCE_FORA;
    const fator = fora ? 1.6 : 0.9;
    const temperatura = Number(aleatorio((cultura.temperaturaMax + cultura.temperaturaMin) / 2, ((cultura.temperaturaMax - cultura.temperaturaMin) / 2) * fator).toFixed(1));
    const umidade = Number(aleatorio((cultura.umidadeMax + cultura.umidadeMin) / 2, ((cultura.umidadeMax - cultura.umidadeMin) / 2) * fator).toFixed(1));

    try {
      const m = await chamar<{ alertasGerados: number }>('/ingest/medicoes', {
        method: 'POST',
        headers: { 'x-device-key': chaves.get(d.id)! },
        body: JSON.stringify({ temperatura, umidade }),
      });
      console.log(`[${d.codigo}] ${temperatura}°C ${umidade}%${m.alertasGerados ? `  ⚠ ${m.alertasGerados} alerta(s)` : ''}`);
    } catch (e) {
      console.error(`[${d.codigo}] falha ao enviar: ${(e as Error).message}`);
    }
  }
}

await login();
await rodada();
if (process.argv.includes('loop')) {
  console.log(`Simulador em loop (a cada ${INTERVALO_S}s). Ctrl+C para encerrar.`);
  setInterval(() => rodada().catch((e) => console.error(e.message)), INTERVALO_S * 1000);
}
