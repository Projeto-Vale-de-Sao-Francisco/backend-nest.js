import { useEffect, useMemo, useState } from "react";
import Cabecalho from "../Cabecalho";
import { CartesianGrid, Legend, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api";
import { estatistica, fmt } from "../geo";

const CORES = {
  temp: ["#ea580c", "#c2410c", "#f59e0b", "#b45309", "#9a3412", "#fb923c"],
  umid: ["#2563eb", "#0891b2", "#4f46e5", "#0e7490", "#1d4ed8", "#38bdf8"],
};
const PERIODOS = [
  { rotulo: "24 h", horas: 24 },
  { rotulo: "7 dias", horas: 24 * 7 },
  { rotulo: "30 dias", horas: 24 * 30 },
];

const dataLocal = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const rotuloX = (ms: number, curto: boolean) =>
  new Date(ms).toLocaleString("pt-BR", curto ? { hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function Historico() {
  const [propriedades, setPropriedades] = useState<any[]>([]);
  const [talhoes, setTalhoes] = useState<any[]>([]);
  const [culturas, setCulturas] = useState<any[]>([]);
  const [dispositivos, setDispositivos] = useState<any[]>([]);
  const [pontos, setPontos] = useState<any[]>([]);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [f, setF] = useState({ propriedadeId: "", talhaoId: "", culturaId: "", dispositivoId: "", inicio: dataLocal(Date.now() - 7 * 86_400_000), fim: dataLocal(Date.now()) });

  useEffect(() => {
    Promise.all([api.propriedades(), api.talhoes(), api.culturas(), api.dispositivos()])
      .then(([p, t, c, d]) => { setPropriedades(p); setTalhoes(t); setCulturas(c); setDispositivos(d); })
      .catch((e) => setErro(e.message));
  }, []);

  useEffect(() => {
    setCarregando(true);
    api
      .dashboardHistorico({
        propriedadeId: f.propriedadeId,
        talhaoId: f.talhaoId,
        culturaId: f.culturaId,
        dispositivoId: f.dispositivoId,
        inicio: f.inicio ? new Date(`${f.inicio}T00:00:00`).toISOString() : "",
        fim: f.fim ? new Date(`${f.fim}T23:59:59`).toISOString() : "",
      })
      .then((r) => { setPontos(r); setErro(""); })
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, [f]);

  const talhoesDisponiveis = talhoes.filter((t) => !f.propriedadeId || String(t.propriedadeId) === f.propriedadeId);
  const dispositivosDisponiveis = dispositivos.filter((d) => {
    const t = talhoes.find((x) => x.id === d.talhaoId);
    return (!f.talhaoId || String(d.talhaoId) === f.talhaoId) && (!f.propriedadeId || String(t?.propriedadeId) === f.propriedadeId) && (!f.culturaId || String(t?.culturaId) === f.culturaId);
  });

  function mudar(campo: string, valor: string) {
    const novo = { ...f, [campo]: valor };
    if (campo === "propriedadeId") { novo.talhaoId = ""; novo.dispositivoId = ""; }
    if (campo === "talhaoId") novo.dispositivoId = "";
    setF(novo);
  }
  function periodo(horas: number) {
    setF({ ...f, inicio: dataLocal(Date.now() - horas * 3_600_000), fim: dataLocal(Date.now()) });
  }

  const ids = useMemo(() => [...new Set(pontos.map((p) => p.dispositivoId))], [pontos]);
  const nome = (id: number) => dispositivos.find((d) => d.id === id)?.codigo ?? `#${id}`;
  const dados = useMemo(() => pontos.map((p) => ({ t: new Date(p.dataHora).getTime(), [`temp${p.dispositivoId}`]: p.temperatura, [`umid${p.dispositivoId}`]: p.umidade })), [pontos]);
  const curto = pontos.length > 0 && new Date(pontos[pontos.length - 1].dataHora).getTime() - new Date(pontos[0].dataHora).getTime() < 2 * 86_400_000;

  // Faixa ideal so quando o filtro identifica uma unica cultura (talhao ou cultura escolhidos).
  const cultura = useMemo(() => {
    const id = f.talhaoId ? talhoes.find((t) => String(t.id) === f.talhaoId)?.culturaId : f.culturaId ? Number(f.culturaId) : null;
    return id ? culturas.find((c) => c.id === id) : null;
  }, [f.talhaoId, f.culturaId, talhoes, culturas]);

  const est = { t: estatistica(pontos.map((p) => p.temperatura)), u: estatistica(pontos.map((p) => p.umidade)) };

  const grafico = (prefixo: "temp" | "umid", titulo: string, unidade: string, min?: number, max?: number) => (
    <div className="painel">
      <h3>{titulo}{min != null && <small style={{ fontWeight: 400, color: "var(--texto-suave)" }}> · faixa ideal de {cultura?.nome} sombreada</small>}</h3>
      <div style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dados} margin={{ left: -10, right: 12, top: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tick={{ fontSize: 11 }} tickFormatter={(v) => rotuloX(v, curto)} minTickGap={50} />
            <YAxis tick={{ fontSize: 11 }} unit={unidade} domain={[(d: number) => Math.floor(Math.min(d, min ?? d) - 2), (d: number) => Math.ceil(Math.max(d, max ?? d) + 2)]} />
            {min != null && max != null && <ReferenceArea y1={min} y2={max} fill="#22a05a" fillOpacity={0.14} ifOverflow="extendDomain" />}
            <Tooltip labelFormatter={(v) => rotuloX(Number(v), false)} formatter={(v: number, n: string) => [`${fmt(v)} ${unidade}`, n]} />
            {ids.length > 1 && <Legend />}
            {ids.map((id, i) => (
              <Line key={id} type="monotone" dataKey={`${prefixo}${id}`} name={nome(id)} stroke={CORES[prefixo][i % CORES[prefixo].length]} strokeWidth={2} dot={false} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  return (
    <div>
      <Cabecalho titulo="Histórico climático" subtitulo="Evolução de temperatura e umidade, com filtros por local e período." />
      <div className="filtros-historico">
        <label>Propriedade
          <select value={f.propriedadeId} onChange={(e) => mudar("propriedadeId", e.target.value)}>
            <option value="">Todas</option>
            {propriedades.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </label>
        <label>Talhão
          <select value={f.talhaoId} onChange={(e) => mudar("talhaoId", e.target.value)}>
            <option value="">Todos</option>
            {talhoesDisponiveis.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        </label>
        <label>Cultura
          <select value={f.culturaId} onChange={(e) => mudar("culturaId", e.target.value)}>
            <option value="">Todas</option>
            {culturas.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.variedade ? ` · ${c.variedade}` : ""}</option>)}
          </select>
        </label>
        <label>Dispositivo
          <select value={f.dispositivoId} onChange={(e) => mudar("dispositivoId", e.target.value)}>
            <option value="">Todos</option>
            {dispositivosDisponiveis.map((d) => <option key={d.id} value={d.id}>{d.codigo}</option>)}
          </select>
        </label>
        <label>De <input type="date" value={f.inicio} max={f.fim} onChange={(e) => mudar("inicio", e.target.value)} /></label>
        <label>Até <input type="date" value={f.fim} min={f.inicio} onChange={(e) => mudar("fim", e.target.value)} /></label>
        <div className="seletor atalhos">
          {PERIODOS.map((p) => <button key={p.rotulo} onClick={() => periodo(p.horas)}>{p.rotulo}</button>)}
        </div>
      </div>

      {erro && <div className="erro">{erro}</div>}

      <div className="cartoes">
        <div className="cartao"><div className="rotulo">Leituras no período</div><div className="valor">{pontos.length}</div></div>
        <div className="cartao"><div className="rotulo">Temperatura média</div><div className="valor">{fmt(est.t.media)}°C</div><small>mín {fmt(est.t.min)} · máx {fmt(est.t.max)}</small></div>
        <div className="cartao"><div className="rotulo">Umidade média</div><div className="valor">{fmt(est.u.media, 0)}%</div><small>mín {fmt(est.u.min, 0)} · máx {fmt(est.u.max, 0)}</small></div>
        <div className="cartao"><div className="rotulo">Dispositivos</div><div className="valor">{ids.length}</div></div>
      </div>

      {carregando && pontos.length === 0 ? (
        <p className="vazio">Carregando...</p>
      ) : pontos.length === 0 ? (
        <div className="painel"><p className="vazio">Nenhuma leitura para os filtros escolhidos. Ajuste o período ou rode o simulador.</p></div>
      ) : (
        <>
          {grafico("temp", "Temperatura ao longo do tempo", "°C", cultura?.temperaturaMin, cultura?.temperaturaMax)}
          {grafico("umid", "Umidade ao longo do tempo", "%", cultura?.umidadeMin, cultura?.umidadeMax)}
          {pontos.length >= 500 && <p className="vazio">Mostrando as 500 leituras mais recentes do filtro; reduza o período para ver o detalhe.</p>}
        </>
      )}
    </div>
  );
}
