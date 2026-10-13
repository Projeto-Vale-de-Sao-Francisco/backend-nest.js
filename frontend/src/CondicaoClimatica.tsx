import { useState } from "react";
import { fmt } from "./geo";

type Campo = "umidade" | "temperatura";
const UNIDADE: Record<Campo, string> = { umidade: "%", temperatura: "°C" };

function cor(v: number, min: number, max: number) {
  if (v >= min && v <= max) return "#22a05a";
  const fora = v < min ? min - v : v - max;
  return fora <= (max - min) * 0.15 ? "#f59e0b" : "#e03a3a";
}

// faixaDe(loteId) devolve {min,max} da cultura do lote para o campo escolhido.
export default function CondicaoClimatica({
  serie,
  faixaDe,
}: {
  serie: any[];
  faixaDe: (loteId: number, campo: Campo) => { min: number; max: number } | null;
}) {
  const [campo, setCampo] = useState<Campo>("umidade");
  const [foco, setFoco] = useState<number | null>(null);
  const pontos = serie.slice(-24);
  const W = 400, H = 120, PAD = 14;

  const valores = pontos.map((p) => p[campo] as number);
  const min = Math.min(...valores), max = Math.max(...valores);
  const y = (v: number) => (max === min ? H / 2 : H - PAD - ((v - min) / (max - min)) * (H - 2 * PAD));
  const larg = pontos.length ? W / pontos.length : W;
  const ativo = foco != null ? pontos[foco] : null;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: 17 }}>Condição climática</h3>
        <div className="seletor">
          {(["umidade", "temperatura"] as Campo[]).map((c) => (
            <button key={c} className={c === campo ? "on" : ""} onClick={() => setCampo(c)}>
              {c === "umidade" ? "Umidade" : "Temp."}
            </button>
          ))}
        </div>
      </div>

      {pontos.length === 0 ? (
        <p className="vazio">Sem leituras no período.</p>
      ) : (
        <div className="degraus" onPointerLeave={() => setFoco(null)}>
          {ativo && (
            <div className="dica-degrau" style={{ left: `${((foco! + 0.5) / pontos.length) * 100}%` }}>
              {fmt(ativo[campo], campo === "umidade" ? 0 : 1)}{UNIDADE[campo]}
            </div>
          )}
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height="120">
            {[0.25, 0.5, 0.75].map((f) => (
              <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="#e5e7e6" strokeDasharray="3 4" />
            ))}
            {pontos.map((p, i) => {
              const f = faixaDe(p.loteId, campo);
              const v = p[campo] as number;
              const c = f ? cor(v, f.min, f.max) : "#9ca3af";
              return (
                <g key={i} onPointerMove={() => setFoco(i)} onPointerDown={() => setFoco(i)}>
                  <rect x={i * larg} y={0} width={larg} height={H} fill={foco === i ? "#22a05a" : "transparent"} opacity={0.12} />
                  <rect x={i * larg + 1} y={y(v) - 2.5} width={Math.max(larg - 2, 2)} height={5} rx={2.5} fill={c} />
                </g>
              );
            })}
          </svg>
          <div className="eixo-x">
            {[0, Math.floor(pontos.length / 2), pontos.length - 1].map((i) => (
              <span key={i}>{new Date(pontos[i].dataHora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
