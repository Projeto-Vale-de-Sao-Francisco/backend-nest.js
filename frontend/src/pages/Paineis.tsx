import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api";
import Cabecalho from "../Cabecalho";
import { fmt } from "../geo";

type Aba = "talhao" | "propriedade";
type Estado = "ok" | "acima" | "abaixo" | "sem-faixa";

const hora = (d: string) => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

function tempoAtras(min: number | null) {
  if (min === null) return "sem leituras";
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  if (min < 2880) return `há ${Math.floor(min / 60)} h`;
  return `há ${Math.floor(min / 1440)} dias`;
}

/* ---------- Medidor: onde o valor esta em relacao a faixa ideal da cultura ---------- */
function Medidor({ valor, min, max }: { valor: number; min: number; max: number }) {
  const folga = (max - min) * 0.5;
  const lo = min - folga;
  const hi = max + folga;
  const pos = (v: number) => Math.max(2, Math.min(98, ((v - lo) / (hi - lo)) * 100));
  const fora = valor < min || valor > max;
  return (
    <div className="medidor" aria-hidden="true">
      <div className="faixa-ideal" style={{ left: `${pos(min)}%`, width: `${pos(max) - pos(min)}%` }} />
      <i className={`ponteiro ${fora ? "fora" : "ok"}`} style={{ left: `${pos(valor)}%` }} />
      <span className="limite" style={{ left: `${pos(min)}%` }}>{min}</span>
      <span className="limite" style={{ left: `${pos(max)}%` }}>{max}</span>
    </div>
  );
}

function descricaoEstado(estado: Estado, valor: number | null, min?: number, max?: number, unidade = "") {
  if (valor === null) return "Sem leitura";
  if (estado === "ok") return "Dentro do ideal";
  if (estado === "acima" && max != null) return `Acima do ideal em ${fmt(valor - max)} ${unidade}`;
  if (estado === "abaixo" && min != null) return `Abaixo do ideal em ${fmt(min - valor)} ${unidade}`;
  return "";
}

function CartaoMedida({ rotulo, valor, unidade, estado, min, max, casas = 1 }: { rotulo: string; valor: number | null; unidade: string; estado: Estado; min?: number; max?: number; casas?: number }) {
  const cor = estado === "ok" ? "ok" : estado === "sem-faixa" ? "neutro" : "ruim";
  return (
    <div className={`cartao-medida ${cor}`}>
      <div className="rot">{rotulo}</div>
      <div className="val">{valor === null ? "—" : `${fmt(valor, casas)} ${unidade}`}</div>
      <div className={`situacao ${cor}`}>{descricaoEstado(estado, valor, min, max, unidade)}</div>
      {valor !== null && min != null && max != null && <Medidor valor={valor} min={min} max={max} />}
      {min != null && max != null && <div className="ideal-texto">Ideal para a cultura: {min} a {max} {unidade}</div>}
    </div>
  );
}

function veredito(saude: any) {
  const { temperatura, umidade } = saude.atual;
  if (temperatura === null && umidade === null) return { nivel: "neutro", titulo: "Sem dados", resumo: "Sem leituras para avaliar este talhão. Rode o simulador ou verifique se os dispositivos estão enviando dados." };
  const problemas: string[] = [];
  if (saude.semaforo.temperatura === "acima") problemas.push("temperatura acima do ideal");
  if (saude.semaforo.temperatura === "abaixo") problemas.push("temperatura abaixo do ideal");
  if (saude.semaforo.umidade === "acima") problemas.push("umidade acima do ideal");
  if (saude.semaforo.umidade === "abaixo") problemas.push("umidade abaixo do ideal");
  if (!problemas.length) return { nivel: "ok", titulo: "Tudo certo", resumo: "Temperatura e umidade estão dentro do ideal para a cultura." };
  const texto = `${problemas.join(" e ")}.`.replace(/^./, (c) => c.toUpperCase());
  return { nivel: problemas.length > 1 ? "critico" : "atencao", titulo: problemas.length > 1 ? "Urgente" : "Atenção", resumo: texto };
}

/* ---------- T1: saude atual do talhao ---------- */
function SaudeTalhao({ saude }: { saude: any }) {
  const [campo, setCampo] = useState<"temperatura" | "umidade">("temperatura");
  const f = saude.faixa;
  const v = veredito(saude);
  const serie = saude.serie.map((p: any) => ({ ...p, hora: hora(p.dataHora) }));
  const [min, max] = campo === "temperatura" ? [f?.temperaturaMin, f?.temperaturaMax] : [f?.umidadeMin, f?.umidadeMax];
  const unidade = campo === "temperatura" ? "°C" : "%";
  const extras = [
    { rotulo: "Umidade do solo", valor: saude.atual.umidadeSolo, un: "%" },
    { rotulo: "Luminosidade", valor: saude.atual.luminosidade, un: "lx" },
    { rotulo: "Chuva", valor: saude.atual.precipitacao, un: "mm" },
  ].filter((e) => e.valor !== null);

  return (
    <>
      <section className={`veredito ${v.nivel}`}>
        <div className="veredito-texto">
          <span className="veredito-selo">{v.titulo}</span>
          <h3>{saude.talhao.nome}{saude.cultura ? ` · ${saude.cultura.nome}${saude.cultura.variedade ? ` ${saude.cultura.variedade}` : ""}` : ""}</h3>
          <p>{v.resumo}</p>
        </div>
        <ul className="veredito-fatos">
          <li><b>{tempoAtras(saude.minutosDesdeUltimaLeitura)}</b><span>última leitura</span></li>
          <li><b>{saude.dispositivosOnline} de {saude.dispositivosTotal}</b><span>dispositivos online</span></li>
        </ul>
      </section>
      {saude.desatualizado && saude.ultimaLeituraEm && (
        <div className="aviso">Nenhum dispositivo enviou leitura recentemente. Os valores abaixo são da última leitura conhecida ({tempoAtras(saude.minutosDesdeUltimaLeitura)}).</div>
      )}

      <div className="duas-medidas">
        <CartaoMedida rotulo="Temperatura" valor={saude.atual.temperatura} unidade="°C" estado={saude.semaforo.temperatura} min={f?.temperaturaMin} max={f?.temperaturaMax} />
        <CartaoMedida rotulo="Umidade do ar" valor={saude.atual.umidade} unidade="%" estado={saude.semaforo.umidade} min={f?.umidadeMin} max={f?.umidadeMax} casas={0} />
      </div>
      {extras.length > 0 ? (
        <div className="extras-medidas">
          {extras.map((e) => (
            <div key={e.rotulo}><span>{e.rotulo}</span><b>{fmt(e.valor, 1)} {e.un}</b></div>
          ))}
        </div>
      ) : (
        <p className="vazio nota">Este talhão só tem sensores de temperatura e umidade do ar (sem solo, luz ou chuva).</p>
      )}

      <div className="painel">
        <div className="linha-titulo">
          <h3>Como variou nas últimas {saude.horas} horas</h3>
          <div className="seletor">
            <button className={campo === "temperatura" ? "on" : ""} onClick={() => setCampo("temperatura")}>Temperatura</button>
            <button className={campo === "umidade" ? "on" : ""} onClick={() => setCampo("umidade")}>Umidade</button>
          </div>
        </div>
        {serie.length < 3 ? (
          <p className="vazio">Poucas leituras neste período ({serie.length}); o gráfico aparece com pelo menos 3.{serie.length > 0 && <> Última: {fmt(serie[serie.length - 1][campo])} {unidade} às {serie[serie.length - 1].hora}.</>}</p>
        ) : (
          <>
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={serie} margin={{ left: -10, right: 10, top: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="hora" tick={{ fontSize: 12 }} minTickGap={32} />
                  <YAxis tick={{ fontSize: 12 }} unit={unidade === "%" ? "%" : "°"} domain={[(d: number) => Math.floor(Math.min(d, min ?? d) - 2), (d: number) => Math.ceil(Math.max(d, max ?? d) + 2)]} />
                  {min != null && max != null && <ReferenceArea y1={min} y2={max} fill="#22a05a" fillOpacity={0.14} ifOverflow="extendDomain" />}
                  <Tooltip formatter={(val: number) => [`${fmt(val)} ${unidade}`, campo === "temperatura" ? "Temperatura" : "Umidade"]} />
                  <Line type="monotone" dataKey={campo} stroke={campo === "temperatura" ? "#ea580c" : "#2563eb"} strokeWidth={2.5} dot={serie.length < 25} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {min != null && <p className="legenda-grafico"><i className="amostra-ideal" /> Faixa verde: ideal para {saude.cultura?.nome ?? "a cultura"} ({min} a {max} {unidade})</p>}
          </>
        )}
      </div>
    </>
  );
}

/* ---------- T2: alertas do talhao ---------- */
function AlertasTalhao({ dados }: { dados: any }) {
  const falhas = dados.porDispositivo.reduce((s: number, d: any) => s + d.falhaSensor, 0);
  const maxTipo = Math.max(1, ...dados.porTipo.map((t: any) => t.pendentes + t.resolvidos));
  return (
    <section className="painel">
      <h3>Alertas dos últimos {dados.dias} dias</h3>
      <div className="resumo-alertas">
        <div><b>{dados.total}</b><span>no total</span></div>
        <div className={dados.pendentes ? "destaque" : ""}><b>{dados.pendentes}</b><span>{dados.pendentes === 1 ? "pendente" : "pendentes"}</span></div>
        <div><b>{dados.resolvidos}</b><span>{dados.resolvidos === 1 ? "resolvido" : "resolvidos"}</span></div>
        <div className={falhas ? "falha" : ""}><b>{falhas}</b><span>{falhas === 1 ? "falha de sensor" : "falhas de sensor"}</span></div>
      </div>

      {dados.total === 0 ? (
        <p className="vazio">{dados.observacao}</p>
      ) : (
        <>
          <div className={`aviso ${falhas ? "" : "info"}`}>{dados.observacao}</div>
          <div className="duas-colunas">
            <div>
              <h4>O que mais aconteceu</h4>
              <ul className="barras">
                {dados.porTipo.map((t: any) => (
                  <li key={t.titulo}>
                    <div className="barra-cab"><span>{t.titulo}</span><small>{t.pendentes ? `${t.pendentes} pendente${t.pendentes > 1 ? "s" : ""} · ` : ""}{t.resolvidos} resolvido{t.resolvidos === 1 ? "" : "s"}</small></div>
                    <div className="barra-trilho" style={{ width: `${((t.pendentes + t.resolvidos) / maxTipo) * 100}%` }}>
                      <i className="pendente" style={{ flex: t.pendentes }} />
                      <i className="resolvido" style={{ flex: t.resolvidos }} />
                    </div>
                  </li>
                ))}
              </ul>
              <p className="legenda-barras"><i className="pendente" /> pendente <i className="resolvido" /> resolvido</p>
            </div>
            <div>
              <h4>De onde vêm os alertas</h4>
              <ul className="barras">
                {dados.porDispositivo.map((d: any) => (
                  <li key={d.codigo}>
                    <div className="barra-cab"><span>{d.codigo}</span><small>{d.condicaoReal} do talhão · {d.falhaSensor} do sensor</small></div>
                    <div className="barra-trilho cheia">
                      <i className="talhao" style={{ flex: d.condicaoReal || 0.0001 }} />
                      <i className="sensor" style={{ flex: d.falhaSensor || 0.0001 }} />
                    </div>
                  </li>
                ))}
              </ul>
              <p className="legenda-barras"><i className="talhao" /> clima fora do ideal <i className="sensor" /> sensor parou de enviar</p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

/* ---------- P2: prioridade dos talhoes da propriedade ---------- */
function corScore(score: number, maximo: number) {
  if (maximo <= 0 || score <= 0) return "hsl(140 45% 58%)";
  return `hsl(${Math.round(120 - (score / maximo) * 120)} 65% 52%)`;
}

function RankingPropriedade({ ranking, nome }: { ranking: any; nome?: string }) {
  const itens: any[] = ranking.itens;
  const geo = useMemo(() => {
    const comPos = itens.filter((i) => i.latitude != null && i.longitude != null);
    if (comPos.length < 2) return null;
    const lats = comPos.map((i) => i.latitude), lngs = comPos.map((i) => i.longitude);
    const [la0, la1, lo0, lo1] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
    return (i: any) => ({
      left: `${12 + (lo1 === lo0 ? 0.38 : (i.longitude - lo0) / (lo1 - lo0)) * 76}%`,
      top: `${14 + (la1 === la0 ? 0.38 : 1 - (i.latitude - la0) / (la1 - la0)) * 68}%`,
    });
  }, [itens]);

  return (
    <>
      <section className={`veredito ${ranking.totalPendentes ? "atencao" : "ok"}`}>
        <div className="veredito-texto">
          <span className="veredito-selo">{ranking.totalPendentes ? "Atenção" : "Tudo certo"}</span>
          <h3>{nome}</h3>
          <p>{ranking.totalPendentes ? `${ranking.totalPendentes} alerta${ranking.totalPendentes > 1 ? "s" : ""} pendente${ranking.totalPendentes > 1 ? "s" : ""}. Visite primeiro o talhão do topo da lista.` : "Nenhum alerta pendente nos talhões desta propriedade."}</p>
        </div>
      </section>

      <div className="duas-colunas assimetrica">
        <section className="painel">
          <h3>Quem visitar primeiro</h3>
          <p className="vazio nota">Pontuação = alertas críticos × {ranking.pesos.CRITICO} + alertas de atenção × {ranking.pesos.ATENCAO}. Quanto maior, mais urgente.</p>
          <ol className="ranking">
            {itens.map((i, idx) => (
              <li key={i.talhaoId}>
                <span className="posicao">{idx + 1}</span>
                <div className="ranking-corpo">
                  <div className="barra-cab"><b>{i.nome}</b><small>{i.cultura ?? "sem cultura"}{i.area ? ` · ${i.area} ha` : ""}</small></div>
                  <div className="chips">
                    {i.pendentes === 0 ? <span className="badge ativo">sem alertas</span> : (
                      <>
                        {i.criticos > 0 && <span className="badge critico">{i.criticos} crítico{i.criticos > 1 ? "s" : ""}</span>}
                        {i.atencao > 0 && <span className="badge atencao">{i.atencao} de atenção</span>}
                      </>
                    )}
                  </div>
                </div>
                <div className="pontos" style={{ background: corScore(i.score, ranking.scoreMaximo) }} title={`Pontuação ${i.score}`}>{i.score}</div>
              </li>
            ))}
          </ol>
        </section>

        <section className="painel">
          <h3>Onde ficam os talhões</h3>
          <p className="vazio nota">Posição aproximada; a cor segue a pontuação (verde = tranquilo, vermelho = urgente).</p>
          {geo ? (
            <div className="mapa-tiles">
              {itens.map((i) => (
                <div key={i.talhaoId} className="tile-pos" style={{ ...geo(i), background: corScore(i.score, ranking.scoreMaximo) }}>
                  <b>{i.nome}</b>
                  <small>{i.pendentes} pendente{i.pendentes === 1 ? "" : "s"}</small>
                </div>
              ))}
            </div>
          ) : (
            <div className="tiles">
              {itens.map((i) => (
                <div key={i.talhaoId} className="tile" style={{ background: corScore(i.score, ranking.scoreMaximo) }}>
                  <b>{i.nome}</b>
                  <small>{i.pendentes} pendente{i.pendentes === 1 ? "" : "s"}</small>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

export default function Paineis() {
  const [aba, setAba] = useState<Aba>("talhao");
  const [propriedades, setPropriedades] = useState<any[]>([]);
  const [talhoes, setTalhoes] = useState<any[]>([]);
  const [propId, setPropId] = useState<number | null>(null);
  const [talhaoId, setTalhaoId] = useState<number | null>(null);
  const [saude, setSaude] = useState<any>(null);
  const [alertas, setAlertas] = useState<any>(null);
  const [ranking, setRanking] = useState<any>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    Promise.all([api.propriedades(), api.talhoes()])
      .then(([p, t]) => {
        setPropriedades(p);
        setTalhoes(t);
        setPropId(p[0]?.id ?? null);
      })
      .catch((e) => setErro(e.message));
  }, []);

  const doProp = talhoes.filter((t) => t.propriedadeId === propId);
  useEffect(() => {
    if (!doProp.some((t) => t.id === talhaoId)) setTalhaoId(doProp[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propId, talhoes]);

  useEffect(() => {
    if (talhaoId == null) return setSaude(null), setAlertas(null);
    const carregar = () =>
      Promise.all([api.saudeTalhao(talhaoId), api.alertasTalhao(talhaoId)])
        .then(([s, a]) => { setSaude(s); setAlertas(a); setErro(""); })
        .catch((e) => setErro(e.message));
    carregar();
    const t = setInterval(carregar, 30000);
    return () => clearInterval(t);
  }, [talhaoId]);

  useEffect(() => {
    if (propId == null) return;
    const carregar = () => api.rankingPropriedade(propId).then(setRanking).catch((e) => setErro(e.message));
    carregar();
    const t = setInterval(carregar, 30000);
    return () => clearInterval(t);
  }, [propId]);

  return (
    <div>
      <Cabecalho titulo="Painéis" subtitulo={aba === "talhao" ? "Como está um talhão agora e o que aconteceu nos últimos dias." : "Quais talhões precisam de visita primeiro."} />
      <div className="filtros-painel">
        <div className="seletor">
          <button className={aba === "talhao" ? "on" : ""} onClick={() => setAba("talhao")}>Por talhão</button>
          <button className={aba === "propriedade" ? "on" : ""} onClick={() => setAba("propriedade")}>Propriedade</button>
        </div>
        <select aria-label="Propriedade" value={propId ?? ""} onChange={(e) => setPropId(Number(e.target.value))}>
          {propriedades.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        {aba === "talhao" && (
          <select aria-label="Talhão" value={talhaoId ?? ""} onChange={(e) => setTalhaoId(Number(e.target.value))}>
            {doProp.map((t) => <option key={t.id} value={t.id}>{t.nome}{t.cultura ? ` · ${t.cultura.nome}` : ""}</option>)}
          </select>
        )}
      </div>
      {erro && <div className="erro">{erro}</div>}

      {aba === "talhao" && (saude ? <><SaudeTalhao saude={saude} />{alertas && <AlertasTalhao dados={alertas} />}</> : <p className="vazio">{doProp.length ? "Carregando..." : "Esta propriedade ainda não tem talhões."}</p>)}
      {aba === "propriedade" && (ranking ? <RankingPropriedade ranking={ranking} nome={propriedades.find((p) => p.id === propId)?.nome} /> : <p className="vazio">Carregando...</p>)}
    </div>
  );
}
