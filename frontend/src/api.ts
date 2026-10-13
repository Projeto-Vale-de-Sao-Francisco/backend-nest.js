const API_URL = (import.meta.env.VITE_API_URL || "https://chico-talhao-backend.onrender.com").replace(/\/$/, "");

function getToken() { return localStorage.getItem("sivale_token"); }
function mensagemDeErro(corpo: any) {
  const mensagem = corpo?.message;
  return Array.isArray(mensagem) ? mensagem.join(" · ") : mensagem || "Erro na requisição.";
}
async function request(path: string, options: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, { ...options, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) } });
  if (res.status === 401 && token) { limparSessao(); window.location.href = "/login"; throw new Error("Sessão expirada."); }
  if (!res.ok) throw new Error(mensagemDeErro(await res.json().catch(() => null)));
  if (res.status === 204) return null;
  return res.json();
}

const corpo = (data: unknown) => JSON.stringify(data);
const lista = (resposta: any) => Array.isArray(resposta) ? resposta : resposta?.data ?? [];
const qs = (params: Record<string, unknown> = {}) => {
  const itens = Object.entries(params).filter(([, valor]) => valor !== undefined && valor !== null && valor !== "");
  return itens.length ? `?${new URLSearchParams(itens.map(([chave, valor]) => [chave, String(valor)]))}` : "";
};
const renomearConsulta = (params: Record<string, any> = {}) => {
  const mapa: Record<string, string> = { propriedadeId: "propriedade_id", talhaoId: "talhao_id", culturaId: "cultura_id", dispositivoId: "dispositivo_id", sensorId: "sensor_id", dataInicio: "data_inicio", dataFim: "data_fim", resolvido: "status" };
  return Object.fromEntries(Object.entries(params).map(([chave, valor]) => [mapa[chave] ?? chave, chave === "resolvido" ? (valor === "false" ? "ATIVO" : "RESOLVIDO") : valor]));
};
const normalizarUsuario = (u: any) => {
  const { nome, tipo, ...demais } = u ?? {};
  return { ...demais, nomeCompleto: nome ?? u?.nomeCompleto, perfil: tipo ?? u?.perfil };
};
const normalizarCultura = (c: any) => ({ ...c, temperaturaMin: c?.temperatura_min ?? c?.temperaturaMin, temperaturaMax: c?.temperatura_max ?? c?.temperaturaMax, umidadeMin: c?.umidade_min ?? c?.umidadeMin, umidadeMax: c?.umidade_max ?? c?.umidadeMax, cicloMedioDias: c?.ciclo_medio_dias ?? c?.cicloMedioDias });
function normalizarTalhao(t: any) {
  const relacao = t?.culturas?.find((item: any) => item.status === "ATIVA") ?? t?.culturas?.[0];
  const cultura = relacao?.cultura ?? t?.cultura;
  return { ...t, propriedadeId: t?.propriedade_id ?? t?.propriedadeId ?? t?.propriedade?.id, culturaId: relacao?.cultura_id ?? cultura?.id ?? t?.culturaId, cultura: cultura ? normalizarCultura(cultura) : undefined, dataPlantio: relacao?.data_plantio ?? t?.data_plantio ?? t?.dataPlantio, previsaoColheita: relacao?.previsao_colheita ?? t?.previsao_colheita ?? t?.previsaoColheita, status: relacao?.status ?? t?.situacao ?? t?.status };
}
const normalizarDispositivo = (d: any) => ({ ...d, talhaoId: d?.talhao_id ?? d?.talhaoId ?? d?.talhao?.id, propriedadeId: d?.propriedade_id ?? d?.propriedadeId ?? d?.talhao?.propriedade_id, dataInstalacao: d?.data_instalacao ?? d?.dataInstalacao, ultimaLeitura: d?.ultima_leitura ?? d?.ultimaLeitura });
function normalizarMedicao(m: any) {
  const dispositivo = m?.sensor?.dispositivo ?? m?.dispositivo;
  return { ...m, dispositivoId: m?.dispositivo_id ?? dispositivo?.id ?? m?.dispositivoId, sensorId: m?.sensor_id ?? m?.sensorId ?? m?.sensor?.id, talhaoId: m?.talhao_id ?? dispositivo?.talhao?.id ?? m?.talhaoId, dataHora: m?.data_hora ?? m?.dataHora, umidadeSolo: m?.umidade_solo ?? m?.umidadeSolo };
}
function normalizarAlerta(a: any) {
  const dispositivo = a?.medicao?.sensor?.dispositivo;
  return { ...a, dataHora: a?.data_hora ?? a?.dataHora, visualizado: a?.visualizado ?? false, resolvido: a?.resolvido ?? String(a?.status).toUpperCase() === "RESOLVIDO", talhaoId: a?.talhao_id ?? dispositivo?.talhao?.id ?? a?.talhaoId };
}
const normalizarMercado = (m: any) => ({ ...m, culturaId: m?.cultura_id ?? m?.culturaId, dataReferencia: m?.data_referencia ?? m?.dataReferencia, mercadoDestino: m?.mercado_destino ?? m?.mercadoDestino, paisDestino: m?.pais_destino ?? m?.paisDestino, precoMedio: m?.preco ?? m?.precoMedio, unidadeMedida: m?.unidade_medida ?? m?.unidadeMedida, demandaEstimada: m?.demanda_estimada ?? m?.demandaEstimada });
const normalizarLogistica = (o: any) => ({ ...o, empresaId: o?.empresa_id ?? o?.empresaId, colheitaId: o?.colheita_id ?? o?.colheitaId, dataPrevista: o?.data_prevista ?? o?.dataPrevista, tempoEstimadoHoras: o?.tempo_estimado_horas ?? o?.tempoEstimadoHoras, custoEstimado: o?.custo_estimado ?? o?.custoEstimado, situacao: o?.status ?? o?.situacao });
const naoDisponivel = (recurso: string) => Promise.reject(new Error(`${recurso} não possui endpoint próprio no backend Chico Talhão.`));

export const api = {
  login: async (email: string, senha: string) => { const r = await request("/auth/login", { method: "POST", body: corpo({ email, senha }) }); return { token: r.accessToken, usuario: normalizarUsuario(r.user) }; },
  me: async () => normalizarUsuario(await request("/auth/me")),
  logout: () => request("/auth/logout", { method: "POST" }),
  dashboardResumo: (p = {}) => request(`/dashboard/resumo${qs(renomearConsulta(p))}`),
  dashboardHistorico: async (p = {}) => lista(await request(`/dashboard/historico${qs(renomearConsulta(p))}`)).map(normalizarMedicao),
  saudeTalhao: (..._args: any[]): Promise<any> => naoDisponivel("O painel de saúde do talhão"), alertasTalhao: (..._args: any[]): Promise<any> => naoDisponivel("O painel específico do talhão"), rankingPropriedade: (..._args: any[]): Promise<any> => naoDisponivel("O ranking por propriedade"),
  usuarios: async () => lista(await request("/users")).map(normalizarUsuario),
  criarUsuario: async (d: any) => normalizarUsuario(await request("/users/admin", { method: "POST", body: corpo({ nome: d.nome ?? d.nomeCompleto, cpf: d.cpf, email: d.email, telefone: d.telefone, senha: d.senha, tipo: d.tipo ?? d.perfil ?? "COMUM", vinculo: d.vinculo }) })),
  atualizarUsuario: (id: number, d: any) => d.status ? request(`/users/${id}/status`, { method: "PATCH", body: corpo({ status: d.status }) }) : request(`/users/${id}`, { method: "PATCH", body: corpo({ ...d, nome: d.nome ?? d.nomeCompleto, tipo: d.tipo ?? d.perfil }) }),
  vincularEmpresa: (..._args: any[]): Promise<any> => naoDisponivel("Vínculos com empresas"), desvincularEmpresa: (..._args: any[]): Promise<any> => naoDisponivel("Vínculos com empresas"), vincularPropriedade: (..._args: any[]): Promise<any> => naoDisponivel("Vínculos diretos com propriedades"), desvincularPropriedade: (..._args: any[]): Promise<any> => naoDisponivel("Vínculos diretos com propriedades"),
  empresas: async () => [], criarEmpresa: (..._args: any[]): Promise<any> => naoDisponivel("Cadastro de empresas"),
  propriedades: async () => { const lotes = lista(await request("/lotes")); const unicas = new Map<number, any>(); lotes.forEach((l: any) => { if (l.propriedade?.id) unicas.set(l.propriedade.id, l.propriedade); }); return [...unicas.values()]; },
  propriedade: async (id: number) => (await api.propriedades()).find((p: any) => p.id === id), criarPropriedade: (..._args: any[]): Promise<any> => naoDisponivel("Cadastro de propriedades"),
  culturas: async () => lista(await request("/culturas")).map(normalizarCultura),
  criarCultura: (d: any) => request("/culturas", { method: "POST", body: corpo({ nome: d.nome, variedade: d.variedade, temperatura_min: d.temperaturaMin, temperatura_max: d.temperaturaMax, umidade_min: d.umidadeMin, umidade_max: d.umidadeMax, ciclo_medio_dias: d.cicloMedioDias, descricao: d.descricao }) }),
  talhoes: async (p = {}) => lista(await request(`/lotes${qs(renomearConsulta(p))}`)).map(normalizarTalhao),
  criarTalhao: (d: any) => request("/lotes", { method: "POST", body: corpo({ nome: d.nome, propriedade_id: d.propriedadeId, cultura_id: d.culturaId, area: d.area, data_plantio: d.dataPlantio, previsao_colheita: d.previsaoColheita, situacao: d.status ?? d.situacao }) }),
  dispositivos: async (p = {}) => lista(await request(`/devices${qs(renomearConsulta(p))}`)).map(normalizarDispositivo),
  criarDispositivo: (d: any) => request("/devices", { method: "POST", body: corpo({ talhaoId: d.talhaoId, propriedadeId: d.propriedadeId, codigo: d.codigo, modelo: d.modelo, tipoSensor: d.tipoSensor ?? d.tipo, unidadeMedida: d.unidadeMedida, status: d.status }) }),
  rotacionarChave: (..._args: any[]): Promise<any> => naoDisponivel("Rotação de chave de dispositivo"), atualizarDispositivo: (id: number, d: any) => request(`/devices/${id}/status`, { method: "PATCH", body: corpo({ status: d.status }) }),
  medicoes: async (p = {}) => { const r = await request(`/readings${qs(renomearConsulta(p))}`); const dados = lista(r).map(normalizarMedicao); return { dados, total: r?.meta?.total ?? dados.length, pagina: r?.meta?.page ?? 1, limite: r?.meta?.limit ?? dados.length, paginas: r?.meta?.totalPages ?? 1 }; },
  mercado: async (p = {}) => lista(await request(`/mercado${qs(renomearConsulta(p))}`)).map(normalizarMercado), atualizarMercado: () => request("/mercado/atualizar", { method: "POST" }),
  criarValorMercado: (d: any) => request("/mercado", { method: "POST", body: corpo({ cultura_id: d.culturaId, data_referencia: d.dataReferencia, mercado_destino: d.mercadoDestino, pais_destino: d.paisDestino, preco: d.preco ?? d.precoMedio, moeda: d.moeda, unidade_medida: d.unidadeMedida, demanda_estimada: d.demandaEstimada }) }),
  logistica: async (p = {}) => lista(await request(`/logistica${qs(renomearConsulta(p))}`)).map(normalizarLogistica),
  criarLogistica: (d: any) => request("/logistica", { method: "POST", body: corpo({ empresa_id: d.empresaId, colheita_id: d.colheitaId, origem: d.origem, destino: d.destino, modal: d.modal, transportadora: d.transportadora, data_prevista: d.dataPrevista, tempo_estimado_horas: d.tempoEstimadoHoras, custo_estimado: d.custoEstimado, status: d.status }) }),
  alertas: async (p = {}) => lista(await request(`/alerts${qs(renomearConsulta(p))}`)).map(normalizarAlerta), visualizarAlerta: (id: number) => request(`/alerts/${id}/view`, { method: "PATCH" }), resolverAlerta: (id: number) => request(`/alerts/${id}/resolve`, { method: "PATCH" }),
};

export function salvarSessao(token: string, usuario: any) { localStorage.setItem("sivale_token", token); localStorage.setItem("sivale_usuario", JSON.stringify(usuario)); }
export function limparSessao() { localStorage.removeItem("sivale_token"); localStorage.removeItem("sivale_usuario"); }
export function usuarioAtual() { const raw = localStorage.getItem("sivale_usuario"); return raw ? JSON.parse(raw) : null; }
export function estaAutenticado() { return !!getToken(); }
