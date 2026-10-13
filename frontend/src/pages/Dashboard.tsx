import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Polygon, Rectangle, CircleMarker, Tooltip, ScaleControl, useMap } from "react-leaflet";
import type { Map as LMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import { api } from "../api";
import { ehAdmin } from "../perfil";
import Icon from "../Icon";
import CondicaoClimatica from "../CondicaoClimatica";
import CardTalhao from "../CardTalhao";
import { estatistica, fmt, percentualNaFaixa, quadradoDaArea } from "../geo";

const COR_RISCO: Record<string, string> = { bom: "#22c55e", atencao: "#f97316", critico: "#dc2626" };
const ROTULO_RISCO: Record<string, string> = { bom: "Boas condições", atencao: "Atenção", critico: "Crítico" };
type Estado = "fechado" | "meio" | "aberto";

const TILE_SAT = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const TILE_MAPA = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

function MiniInterno({ principal }: { principal: LMap }) {
  const mini = useMap();
  const [caixa, setCaixa] = useState(principal.getBounds());
  useEffect(() => {
    mini.dragging.disable(); mini.touchZoom.disable(); mini.scrollWheelZoom.disable();
    mini.doubleClickZoom.disable(); mini.boxZoom.disable(); mini.keyboard.disable();
    function sync() {
      mini.setView(principal.getCenter(), Math.max(principal.getZoom() - 4, 2), { animate: false });
      setCaixa(principal.getBounds());
    }
    sync();
    principal.on("move zoom", sync);
    return () => { principal.off("move zoom", sync); };
  }, [mini, principal]);
  return <Rectangle bounds={caixa} pathOptions={{ color: "#fff", weight: 2, fillOpacity: 0.05 }} />;
}

function MiniMapa({ principal }: { principal: LMap | null }) {
  if (!principal) return null;
  return (
    <div className="minimapa" aria-hidden="true">
      <MapContainer center={principal.getCenter()} zoom={11} zoomControl={false} attributionControl={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer url={TILE_SAT} />
        <MiniInterno principal={principal} />
      </MapContainer>
    </div>
  );
}

function AjustarMapa({ pontos, painel }: { pontos: [number, number][]; painel: Estado }) {
  const mapa = useMap();
  const chave = JSON.stringify(pontos);
  useEffect(() => {
    if (!pontos.length) return;
    const mobile = window.innerWidth <= 860;
    const esquerda = mobile ? 20 : window.innerWidth <= 1100 ? 372 : 432;
    const baixo = mobile ? (painel === "fechado" ? 90 : window.innerHeight * 0.5) : 30;
    mapa.fitBounds(pontos, { paddingTopLeft: [esquerda, 70], paddingBottomRight: [20, baixo], maxZoom: 17 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, mapa]);
  return null;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [propriedades, setPropriedades] = useState<any[]>([]);
  const [lotes, setLotes] = useState<any[]>([]);
  const [sensores, setSensores] = useState<any[]>([]);
  const [culturas, setCulturas] = useState<any[]>([]);
  const [alertas, setAlertas] = useState<any[]>([]);
  const [historico, setHistorico] = useState<any[]>([]);
  const [ultimaPorSensor, setUltimaPorSensor] = useState<Record<number, any>>({});
  const [propId, setPropId] = useState<number | null>(null);
  const [loteSel, setLoteSel] = useState<number | null>(null);
  const [estado, setEstado] = useState<Estado>("meio");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const inicioArraste = useRef<number | null>(null);
  const telaRef = useRef<HTMLDivElement>(null);
  const [mapa, setMapa] = useState<LMap | null>(null);
  const [camada, setCamada] = useState<"sat" | "mapa">("sat");
  const [minhaPos, setMinhaPos] = useState<[number, number] | null>(null);

  function localizar() {
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        const pos: [number, number] = [p.coords.latitude, p.coords.longitude];
        setMinhaPos(pos);
        mapa?.flyTo(pos, 16);
      },
      () => setErro("Não foi possível obter sua localização."),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }
  // O menu pode recolher/expandir: o mapa precisa recalcular o tamanho.
  useEffect(() => {
    const el = telaRef.current;
    if (!mapa || !el) return;
    const ro = new ResizeObserver(() => mapa.invalidateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [mapa]);

  function telaCheia() {
    if (document.fullscreenElement) document.exitFullscreen();
    else telaRef.current?.requestFullscreen?.();
  }

  const carregar = useCallback(async () => {
    try {
      const [p, l, s, c, a] = await Promise.all([
        api.propriedades(),
        api.talhoes(),
        api.dispositivos(),
        api.culturas(),
        api.alertas({ resolvido: "false" }),
      ]);
      setPropriedades(p);
      setLotes(l);
      setSensores(s);
      setCulturas(c);
      setAlertas(a);
      setPropId((atual) => atual ?? p[0]?.id ?? null);
      const ultimas = await Promise.all(
        s.map((x: any) => api.medicoes({ dispositivoId: String(x.id), limite: "1" }).then((r: any) => [x.id, r.dados[0]]))
      );
      setUltimaPorSensor(Object.fromEntries(ultimas));
      setErro("");
    } catch (e: any) {
      setErro(e.message || "Falha ao carregar dados.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 30000);
    return () => clearInterval(t);
  }, [carregar]);

  useEffect(() => {
    if (propId == null) return;
    api.dashboardHistorico({ propriedadeId: String(propId) }).then(setHistorico).catch(() => setHistorico([]));
  }, [propId, ultimaPorSensor]);

  const propriedade = propriedades.find((p) => p.id === propId);
  const culturaDe = (id: number) => culturas.find((c) => c.id === id);

  const talhoes = useMemo(() => {
    const doProp = lotes.filter((l) => l.propriedadeId === propId);
    return doProp.map((l, idx) => {
      const sens = sensores.filter((s) => s.talhaoId === l.id);
      const com = sens.find((s) => s.latitude != null && s.longitude != null);
      const lat = l.latitude ?? com?.latitude ?? (propriedade?.latitude ?? -9.4) + idx * 0.004;
      const lng = l.longitude ?? com?.longitude ?? (propriedade?.longitude ?? -40.5);
      const pend = alertas.filter((a) => a.talhaoId === l.id);
      const risco = pend.some((a) => a.nivel === "CRITICO") ? "critico" : pend.length ? "atencao" : "bom";
      return { ...l, sensores: sens, poligono: quadradoDaArea(lat, lng, l.area), risco, alertas: pend };
    });
  }, [lotes, sensores, alertas, propId, propriedade]);

  const pontos = useMemo(() => talhoes.flatMap((t) => t.poligono as [number, number][]), [talhoes]);
  const selecionado = talhoes.find((t) => t.id === loteSel);

  const temps = historico.map((h) => h.temperatura);
  const umids = historico.map((h) => h.umidade);
  const est = { t: estatistica(temps), u: estatistica(umids) };
  const sensoresAtivos = sensores.filter((s) => talhoes.some((t) => t.id === s.talhaoId) && s.status === "ATIVO").length;

  const conforto = useMemo(() => {
    const pcts = talhoes
      .map((t) => percentualNaFaixa(historico.filter((h) => h.talhaoId === t.id).slice(-24), culturaDe(t.culturaId)))
      .filter((v): v is number => v != null);
    return pcts.length ? Math.round(pcts.reduce((s, v) => s + v, 0) / pcts.length) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [talhoes, historico, culturas]);

  function alternarPainel() {
    setEstado((e) => (e === "fechado" ? "meio" : e === "meio" ? "aberto" : "fechado"));
  }
  function soltar(y: number) {
    if (inicioArraste.current == null) return;
    const dy = y - inicioArraste.current;
    inicioArraste.current = null;
    if (Math.abs(dy) < 8) return alternarPainel();
    setEstado((e) => (dy < 0 ? (e === "fechado" ? "meio" : "aberto") : e === "aberto" ? "meio" : "fechado"));
  }

  function exportarCsv() {
    const linhas = ["dataHora,talhaoId,temperatura,umidade", ...historico.map((h) => `${h.dataHora},${h.talhaoId},${h.temperatura},${h.umidade}`)];
    const url = URL.createObjectURL(new Blob([linhas.join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `sivale-leituras-${propriedade?.nome ?? "propriedade"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (carregando) return <p style={{ padding: 24 }}>Carregando mapa...</p>;

  const centro: [number, number] = [propriedade?.latitude ?? -9.39, propriedade?.longitude ?? -40.5];

  return (
    <div className="mapa-tela" ref={telaRef}>
      <MapContainer ref={setMapa} center={centro} zoom={15} zoomControl={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          key={camada}
          attribution={camada === "sat" ? "Imagens &copy; Esri, Maxar, Earthstar Geographics" : "&copy; OpenStreetMap"}
          url={camada === "sat" ? TILE_SAT : TILE_MAPA}
          maxZoom={19}
        />
        <ScaleControl position="bottomleft" imperial={false} />
        {minhaPos && <CircleMarker center={minhaPos} radius={8} pathOptions={{ color: "#fff", weight: 3, fillColor: "#2563eb", fillOpacity: 1 }} />}
        <AjustarMapa pontos={pontos} painel={estado} />
        {talhoes.map((t) => (
          <Polygon
            key={t.id}
            positions={t.poligono}
            pathOptions={{
              color: t.id === loteSel ? "#fff" : COR_RISCO[t.risco],
              weight: t.id === loteSel ? 4 : 2,
              fillColor: COR_RISCO[t.risco],
              fillOpacity: 0.35,
            }}
            eventHandlers={{ click: () => setLoteSel(t.id) }}
          >
            <Tooltip permanent direction="center" className="rotulo-lote">
              {t.nome}
            </Tooltip>
          </Polygon>
        ))}
        {talhoes.flatMap((t) =>
          t.sensores
            .filter((s: any) => s.latitude != null && s.longitude != null)
            .map((s: any) => (
              <CircleMarker
                key={s.id}
                center={[s.latitude, s.longitude]}
                radius={7}
                pathOptions={{ color: "#fff", weight: 2, fillColor: s.status === "ATIVO" ? "#16a34a" : "#9ca3af", fillOpacity: 1 }}
                eventHandlers={{ click: () => setLoteSel(t.id) }}
              >
                <Tooltip>{s.codigo}</Tooltip>
              </CircleMarker>
            ))
        )}
      </MapContainer>

      <div className="controles-mapa">
        <button onClick={telaCheia} aria-label="Tela cheia" title="Tela cheia">⤢</button>
        <div className="par">
          <button onClick={() => mapa?.zoomIn()} aria-label="Aproximar">+</button>
          <button onClick={() => mapa?.zoomOut()} aria-label="Afastar">−</button>
        </div>
        <button onClick={localizar} aria-label="Minha localização" title="Minha localização">➤</button>
        <button onClick={() => setCamada((c) => (c === "sat" ? "mapa" : "sat"))} aria-label="Trocar camada" title="Trocar camada">
          {camada === "sat" ? "SAT" : "MAPA"}
        </button>
      </div>
      <MiniMapa principal={mapa} />

      <div className="topo-mapa">
        <label className="busca">
          <Icon nome="propriedades" tamanho={18} />
          <select
            aria-label="Propriedade"
            value={propId ?? ""}
            onChange={(e) => {
              setPropId(Number(e.target.value));
              setLoteSel(null);
            }}
          >
            {propriedades.map((p) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
        </label>
        {ehAdmin() && (
          <button onClick={() => navigate("/talhoes")}>
          + <span className="txt-btn">Novo talhão</span>
        </button>
        )}
        <button className="secundario" onClick={exportarCsv} aria-label="Exportar CSV">
          <Icon nome="exportar" tamanho={18} /> <span className="txt-btn">Exportar</span>
        </button>
        <button className="sino" onClick={() => navigate("/alertas")} aria-label="Alertas">
          <Icon nome="alertas" tamanho={20} />
          {alertas.length > 0 && <b>{alertas.length}</b>}
        </button>
      </div>

      <aside className="painel-lateral" data-estado={estado}>
        <div
          className="puxador"
          onPointerDown={(e) => {
            inicioArraste.current = e.clientY;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerUp={(e) => soltar(e.clientY)}
        >
          {propriedade?.nome ?? "Painel"} · {talhoes.length} {talhoes.length === 1 ? "talhão" : "talhões"}
        </div>

        {erro && <div className="pl-cartao erro">{erro}</div>}

        <section className="pl-cartao">
          <div className="pl-cabecalho">
            <div>
              <div className="nome">{propriedade?.nome ?? "Sem propriedade"}</div>
              <div className="sub">
                {propriedade ? `${propriedade.municipio} · ${propriedade.estado}` : "Cadastre uma propriedade"}
              </div>
            </div>
            <div className="area">
              {propriedade?.areaTotal ?? "—"} ha
              <small>{talhoes.length} {talhoes.length === 1 ? "talhão ativo" : "talhões ativos"}</small>
            </div>
          </div>
        </section>

        <section className="pl-cartao">
          <div className="metricas">
            <div className="metrica">
              <div className="rot">Umidade média</div>
              <div className="val">{fmt(est.u.media, 0)}%</div>
              <div className="mm"><span>Máx <b>{fmt(est.u.max, 0)}%</b></span><span>Mín <b>{fmt(est.u.min, 0)}%</b></span></div>
            </div>
            <div className="metrica">
              <div className="rot">Temperatura média</div>
              <div className="val">{fmt(est.t.media)}°C</div>
              <div className="mm"><span>Máx <b>{fmt(est.t.max, 0)}°</b></span><span>Mín <b>{fmt(est.t.min, 0)}°</b></span></div>
            </div>
            <div className="metrica">
              <div className="rot">Dispositivos ativos</div>
              <div className="val">{sensoresAtivos}</div>
              <div className="mm"><span>de <b>{sensores.filter((s) => talhoes.some((t) => t.id === s.talhaoId)).length}</b></span></div>
            </div>
            <div className="metrica">
              <div className="rot">Leituras registradas</div>
              <div className="val">{historico.length}</div>
              <div className="mm"><span>{alertas.filter((a) => talhoes.some((t) => t.id === a.talhaoId)).length} alertas pendentes</span></div>
            </div>
          </div>
        </section>

        <section className="pl-cartao previsao">
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
            <b>Conforto climático</b>
            <span style={{ color: "var(--texto-suave)" }}>
              {conforto == null ? "sem dados" : conforto >= 80 ? "Bom" : conforto >= 50 ? "Atenção" : "Crítico"}
            </span>
          </div>
          <div className="barra">
            {Array.from({ length: 48 }).map((_, i) => (
              <i key={i} style={{ background: `hsl(${(i / 47) * 120}, 72%, 52%)`, opacity: conforto != null && (i / 47) * 100 > conforto ? 0.3 : 1 }} />
            ))}
            {conforto != null && <span className="marcador" style={{ left: `${conforto}%` }} />}
          </div>
          <div className="rodape">
            <span>
              {conforto == null ? "Aguardando leituras." : `${conforto}% das últimas leituras dentro da faixa da cultura.`}
            </span>
            <span className="tag-ia cinza" title="Modelo preditivo de janela de colheita">2ª entrega</span>
          </div>
        </section>

        <section className="pl-cartao">
          <CondicaoClimatica
            serie={historico}
            faixaDe={(loteId, campo) => {
              const lote = lotes.find((l) => l.id === loteId);
              const c = lote && culturaDe(lote.culturaId);
              if (!c) return null;
              return campo === "umidade" ? { min: c.umidadeMin, max: c.umidadeMax } : { min: c.temperaturaMin, max: c.temperaturaMax };
            }}
          />
        </section>

        <section className="pl-cartao">
          <h3>Alertas pendentes</h3>
          <div className="lista-alertas">
            {alertas.filter((a) => talhoes.some((t) => t.id === a.talhaoId)).length === 0 && <p className="vazio">Nenhum alerta pendente.</p>}
            {alertas
              .filter((a) => talhoes.some((t) => t.id === a.talhaoId))
              .slice(0, 5)
              .map((a) => (
                <div className="item" key={a.id}>
                  <span className={`badge ${a.nivel.toLowerCase()}`}>{a.nivel.toLowerCase()}</span>
                  <div>
                    {a.descricao}
                    <small>{new Date(a.dataHora).toLocaleString("pt-BR")}</small>
                  </div>
                </div>
              ))}
          </div>
        </section>
      </aside>

      {selecionado && <CardTalhao t={selecionado} cultura={culturaDe(selecionado.culturaId)} historico={historico} ultima={ultimaPorSensor} onFechar={() => setLoteSel(null)} />}

      <div className="legenda">
        {Object.keys(COR_RISCO).map((k) => (
          <span key={k} style={{ ["--c" as any]: COR_RISCO[k] }}>{ROTULO_RISCO[k]}</span>
        ))}
      </div>
    </div>
  );
}

