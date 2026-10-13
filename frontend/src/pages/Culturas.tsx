import { useEffect, useState } from "react";
import NovoRegistro from "../NovoRegistro";
import Cabecalho from "../Cabecalho";
import { api } from "../api";
import { ehAdmin } from "../perfil";

const vazio = { nome: "", variedade: "", temperaturaMin: "", temperaturaMax: "", umidadeMin: "", umidadeMax: "", cicloMedioDias: "" };

export default function Culturas() {
  const [culturas, setCulturas] = useState<any[]>([]);
  const [novo, setNovo] = useState(vazio);

  async function carregar() {
    setCulturas(await api.culturas());
  }
  useEffect(() => { carregar(); }, []);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    await api.criarCultura({
      nome: novo.nome,
      variedade: novo.variedade || undefined,
      temperaturaMin: Number(novo.temperaturaMin),
      temperaturaMax: Number(novo.temperaturaMax),
      umidadeMin: Number(novo.umidadeMin),
      umidadeMax: Number(novo.umidadeMax),
      cicloMedioDias: novo.cicloMedioDias ? Number(novo.cicloMedioDias) : undefined,
    });
    setNovo(vazio);
    carregar();
  }

  return (
    <div>
      <Cabecalho titulo="Culturas" subtitulo="Faixas ideais de temperatura e umidade usadas para gerar os alertas." />
      {ehAdmin() && (
      <NovoRegistro rotulo="Nova cultura">
        <form className="linha" onSubmit={criar}>
          <label>Nome <input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} placeholder="Manga" required /></label>
          <label>Variedade <input value={novo.variedade} onChange={(e) => setNovo({ ...novo, variedade: e.target.value })} placeholder="Tommy Atkins" /></label>
          <label>Temp. mín (°C) <input type="number" step="0.1" value={novo.temperaturaMin} onChange={(e) => setNovo({ ...novo, temperaturaMin: e.target.value })} required /></label>
          <label>Temp. máx (°C) <input type="number" step="0.1" value={novo.temperaturaMax} onChange={(e) => setNovo({ ...novo, temperaturaMax: e.target.value })} required /></label>
          <label>Umid. mín (%) <input type="number" step="0.1" value={novo.umidadeMin} onChange={(e) => setNovo({ ...novo, umidadeMin: e.target.value })} required /></label>
          <label>Umid. máx (%) <input type="number" step="0.1" value={novo.umidadeMax} onChange={(e) => setNovo({ ...novo, umidadeMax: e.target.value })} required /></label>
          <label>Ciclo (dias) <input type="number" value={novo.cicloMedioDias} onChange={(e) => setNovo({ ...novo, cicloMedioDias: e.target.value })} /></label>
          <button type="submit">Cadastrar cultura</button>
        </form>
      </NovoRegistro>
      )}

      <div className="painel">
        <table>
          <thead><tr><th>Nome</th><th>Variedade</th><th>Faixa temp.</th><th>Faixa umid.</th><th>Ciclo</th></tr></thead>
          <tbody>
            {culturas.map((c) => (
              <tr key={c.id}>
                <td>{c.nome}</td>
                <td>{c.variedade ?? "—"}</td>
                <td>{c.temperaturaMin}°C – {c.temperaturaMax}°C</td>
                <td>{c.umidadeMin}% – {c.umidadeMax}%</td>
                <td>{c.cicloMedioDias ? `${c.cicloMedioDias} dias` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
