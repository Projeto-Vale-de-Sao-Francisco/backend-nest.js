import { useEffect, useState } from "react";
import NovoRegistro from "../NovoRegistro";
import Cabecalho from "../Cabecalho";
import { api } from "../api";
import { ehAdmin } from "../perfil";
import { fmtData } from "../geo";

const vazio = { propriedadeId: "", culturaId: "", nome: "", area: "", latitude: "", longitude: "", dataPlantio: "", previsaoColheita: "" };
const num = (v: string) => (v === "" ? undefined : Number(v));

export default function Talhoes() {
  const [talhoes, setTalhoes] = useState<any[]>([]);
  const [propriedades, setPropriedades] = useState<any[]>([]);
  const [culturas, setCulturas] = useState<any[]>([]);
  const [novo, setNovo] = useState(vazio);
  const [erro, setErro] = useState("");
  const podeCriar = ehAdmin();

  async function carregar() {
    const [t, p, c] = await Promise.all([api.talhoes(), api.propriedades(), api.culturas()]);
    setTalhoes(t);
    setPropriedades(p);
    setCulturas(c);
    setNovo((n) => ({ ...n, propriedadeId: n.propriedadeId || String(p[0]?.id ?? ""), culturaId: n.culturaId || String(c[0]?.id ?? "") }));
  }
  useEffect(() => { carregar(); }, []);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    try {
      await api.criarTalhao({
        propriedadeId: Number(novo.propriedadeId),
        culturaId: novo.culturaId ? Number(novo.culturaId) : undefined,
        nome: novo.nome,
        area: num(novo.area),
        latitude: num(novo.latitude),
        longitude: num(novo.longitude),
        dataPlantio: novo.dataPlantio || undefined,
        previsaoColheita: novo.previsaoColheita || undefined,
      });
      setNovo({ ...vazio, propriedadeId: novo.propriedadeId, culturaId: novo.culturaId });
      carregar();
    } catch (err: any) {
      setErro(err.message);
    }
  }

  const set = (campo: keyof typeof vazio) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setNovo({ ...novo, [campo]: e.target.value });
  const nomePropriedade = (id: number) => propriedades.find((p) => p.id === id)?.nome ?? id;

  return (
    <div>
      <Cabecalho titulo="Talhões" subtitulo="Divisões de cada propriedade e a cultura plantada em cada uma." />
      {podeCriar && (
        <NovoRegistro rotulo="Novo talhão">
          {erro && <div className="erro">{erro}</div>}
          <form className="linha" onSubmit={criar}>
            <label>Propriedade
              <select value={novo.propriedadeId} onChange={set("propriedadeId")}>
                {propriedades.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </label>
            <label>Cultura
              <select value={novo.culturaId} onChange={set("culturaId")}>
                <option value="">—</option>
                {culturas.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.variedade ? ` · ${c.variedade}` : ""}</option>)}
              </select>
            </label>
            <label>Nome <input value={novo.nome} onChange={set("nome")} placeholder="Talhão 42" required /></label>
            <label>Área (ha) <input type="number" step="any" value={novo.area} onChange={set("area")} /></label>
            <label>Latitude <input type="number" step="any" value={novo.latitude} onChange={set("latitude")} /></label>
            <label>Longitude <input type="number" step="any" value={novo.longitude} onChange={set("longitude")} /></label>
            <label>Plantio <input type="date" value={novo.dataPlantio} onChange={set("dataPlantio")} /></label>
            <label>Colheita prevista <input type="date" value={novo.previsaoColheita} onChange={set("previsaoColheita")} /></label>
            <button type="submit">Adicionar talhão</button>
          </form>
        </NovoRegistro>
      )}

      <div className="painel">
        <table>
          <thead><tr><th>Nome</th><th>Propriedade</th><th>Cultura</th><th>Área (ha)</th><th>Plantio</th><th>Colheita</th><th>Alertas</th><th>Status</th></tr></thead>
          <tbody>
            {talhoes.map((t) => (
              <tr key={t.id}>
                <td>{t.nome}</td>
                <td>{nomePropriedade(t.propriedadeId)}</td>
                <td>{t.cultura?.nome ?? "—"}</td>
                <td>{t.area ?? "—"}</td>
                <td>{fmtData(t.dataPlantio)}</td>
                <td>{fmtData(t.previsaoColheita)}</td>
                <td>{t._count?.alerta ? <span className="badge atencao">{t._count.alerta}</span> : "—"}</td>
                <td><span className={`badge ${t.status === "ATIVO" ? "ativo" : "inativo"}`}>{t.status.toLowerCase()}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
