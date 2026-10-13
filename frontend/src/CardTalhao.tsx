import { useState } from "react";
import { fmt, fmtData, percentualNaFaixa } from "./geo";

function useFavorito(id: number): [boolean, () => void] {
  const chave = `sivale_fav_${id}`;
  const [fav, setFav] = useState(() => localStorage.getItem(chave) === "1");
  return [
    fav,
    () =>
      setFav((f) => {
        localStorage.setItem(chave, f ? "0" : "1");
        return !f;
      }),
  ];
}

function Recolhivel({ titulo, aberto = false, children }: { titulo: string; aberto?: boolean; children: React.ReactNode }) {
  const [on, setOn] = useState(aberto);
  return (
    <div className="recolhivel">
      <button className="cab" onClick={() => setOn(!on)} aria-expanded={on}>
        {titulo}
        <span style={{ transform: on ? "rotate(180deg)" : "none" }}>⌃</span>
      </button>
      {on && <div className="corpo">{children}</div>}
    </div>
  );
}

export default function CardTalhao({ t, cultura, historico, ultima, onFechar }: any) {
  const [fav, alternarFav] = useFavorito(t.id);
  const leituras = historico.filter((h: any) => h.talhaoId === t.id).slice(-24);
  const saude = percentualNaFaixa(leituras, cultura);
  const recentes = t.sensores.map((s: any) => ultima[s.id]).filter(Boolean);
  const atual = recentes.sort((a: any, b: any) => (a.dataHora < b.dataHora ? 1 : -1))[0];
  const corSaude = saude == null ? "#9ca3af" : saude >= 80 ? "#22c55e" : saude >= 50 ? "#f59e0b" : "#dc2626";
  const textoSaude = saude == null ? "Sem dados" : saude >= 80 ? "Boa" : saude >= 50 ? "Regular" : "Ruim";

  let dica = "Sem leituras suficientes para recomendar.";
  if (atual && cultura) {
    if (atual.temperatura > cultura.temperaturaMax) dica = `Temperatura acima do ideal (${fmt(atual.temperatura)}°C > ${cultura.temperaturaMax}°C). Avalie irrigação e sombreamento.`;
    else if (atual.temperatura < cultura.temperaturaMin) dica = `Temperatura abaixo do ideal (${fmt(atual.temperatura)}°C < ${cultura.temperaturaMin}°C). Proteja a cultura do frio.`;
    else if (atual.umidade > cultura.umidadeMax) dica = `Umidade alta (${fmt(atual.umidade, 0)}%). Risco de doenças fúngicas e rachadura dos frutos.`;
    else if (atual.umidade < cultura.umidadeMin) dica = `Umidade baixa (${fmt(atual.umidade, 0)}%). Considere reforçar a irrigação.`;
    else dica = `Condições dentro da faixa ideal (${cultura.temperaturaMin}–${cultura.temperaturaMax}°C, ${cultura.umidadeMin}–${cultura.umidadeMax}%).`;
  }

  const hora = (d: string) => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="card-talhao" role="dialog" aria-label={`Talhão ${t.nome}`}>
      <button className="fechar" onClick={onFechar} aria-label="Fechar">×</button>
      <h3>
        {t.nome} : {cultura?.nome ?? "Sem cultura"}
        <button className={`estrela ${fav ? "on" : ""}`} onClick={alternarFav} aria-label="Favoritar talhão" aria-pressed={fav}>★</button>
      </h3>
      <div className="id">#LOTE-{t.id}{cultura?.variedade ? ` · ${cultura.variedade}` : ""} · {t.area ?? "—"} ha</div>
      <div className="duas">
        <div><span>Data de plantio</span><b>{fmtData(t.dataPlantio)}</b></div>
        <div><span>Colheita prevista</span><b>{fmtData(t.previsaoColheita)}</b></div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
        <span style={{ color: "var(--texto-suave)" }}>Saúde da cultura</span>
        <b>{textoSaude}</b>
      </div>
      <div className="saude"><i style={{ width: `${saude ?? 0}%`, background: corSaude }} /></div>

      <Recolhivel titulo="Leitura dos sensores" aberto>
        <div className="leitura">
          {atual ? (
            <>
              <div><span>Umidade</span><b>{fmt(atual.umidade, 0)}%</b></div>
              <div><span>Temperatura</span><b>{fmt(atual.temperatura)}°C</b></div>
              {atual.umidadeSolo != null && <div><span>Umidade do solo</span><b>{fmt(atual.umidadeSolo, 0)}%</b></div>}
              {atual.luminosidade != null && <div><span>Luminosidade</span><b>{fmt(atual.luminosidade, 0)} lx</b></div>}
              {atual.precipitacao != null && <div><span>Precipitação</span><b>{fmt(atual.precipitacao)} mm</b></div>}
              <div><span>Atualizado</span><b>{hora(atual.dataHora)}</b></div>
            </>
          ) : (
            <div><span>Sem leituras</span></div>
          )}
        </div>
      </Recolhivel>

      <Recolhivel titulo="Histórico do sensor">
        <div className="leitura">
          {leituras.length === 0 && <div><span>Sem leituras</span></div>}
          {[...leituras].reverse().slice(0, 8).map((l: any, i: number) => (
            <div key={i}><span>{hora(l.dataHora)}</span><b>{fmt(l.temperatura)}°C · {fmt(l.umidade, 0)}%</b></div>
          ))}
        </div>
      </Recolhivel>

      <div className="insight">
        <span className="tag-ia cinza">Regra</span>
        <b style={{ display: "block", margin: "8px 0 4px" }}>Recomendação</b>
        {dica}
      </div>
    </div>
  );
}
