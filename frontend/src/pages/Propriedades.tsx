import { useEffect, useState } from "react";
import NovoRegistro from "../NovoRegistro";
import Cabecalho from "../Cabecalho";
import { api } from "../api";
import { ehAdmin } from "../perfil";

const vazio = { empresaId: "", nome: "", localizacao: "", municipio: "", estado: "", latitude: "", longitude: "", areaTotal: "" };
const num = (v: string) => (v === "" ? undefined : Number(v));

export default function Propriedades() {
  const [propriedades, setPropriedades] = useState<any[]>([]);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [novo, setNovo] = useState(vazio);
  const [erro, setErro] = useState("");
  const podeCriar = ehAdmin();

  async function carregar() {
    const [p, e] = await Promise.all([api.propriedades(), podeCriar ? api.empresas() : Promise.resolve([])]);
    setPropriedades(p);
    setEmpresas(e);
  }
  useEffect(() => { carregar(); }, []);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    try {
      await api.criarPropriedade({
        empresaId: novo.empresaId ? Number(novo.empresaId) : undefined,
        nome: novo.nome,
        localizacao: novo.localizacao,
        municipio: novo.municipio || undefined,
        estado: novo.estado || undefined,
        latitude: num(novo.latitude),
        longitude: num(novo.longitude),
        areaTotal: num(novo.areaTotal),
      });
      setNovo(vazio);
      carregar();
    } catch (err: any) {
      setErro(err.message);
    }
  }

  const set = (campo: keyof typeof vazio) => (e: React.ChangeEvent<HTMLInputElement>) => setNovo({ ...novo, [campo]: e.target.value });

  return (
    <div>
      <Cabecalho titulo="Propriedades Rurais" subtitulo="Fazendas e áreas produtivas monitoradas pela plataforma." />
      {podeCriar && (
        <NovoRegistro rotulo="Nova propriedade">
          {erro && <div className="erro">{erro}</div>}
          <form className="linha" onSubmit={criar}>
            <label>Produtor/empresa
              <select value={novo.empresaId} onChange={(e) => setNovo({ ...novo, empresaId: e.target.value })}>
                <option value="">—</option>
                {empresas.map((e) => <option key={e.id} value={e.id}>{e.nomeFantasia || e.razaoSocial}</option>)}
              </select>
            </label>
            <label>Nome <input value={novo.nome} onChange={set("nome")} required /></label>
            <label>Localização <input value={novo.localizacao} onChange={set("localizacao")} placeholder="Projeto Nilo Coelho" required /></label>
            <label>Município <input value={novo.municipio} onChange={set("municipio")} /></label>
            <label>UF <input value={novo.estado} onChange={set("estado")} maxLength={2} /></label>
            <label>Latitude <input type="number" step="any" value={novo.latitude} onChange={set("latitude")} /></label>
            <label>Longitude <input type="number" step="any" value={novo.longitude} onChange={set("longitude")} /></label>
            <label>Área (ha) <input type="number" step="any" value={novo.areaTotal} onChange={set("areaTotal")} /></label>
            <button type="submit">Adicionar propriedade</button>
          </form>
        </NovoRegistro>
      )}

      <div className="painel">
        <table>
          <thead><tr><th>Nome</th><th>Produtor</th><th>Município</th><th>UF</th><th>Área (ha)</th><th>Talhões</th><th>Status</th></tr></thead>
          <tbody>
            {propriedades.map((p) => (
              <tr key={p.id}>
                <td>{p.nome}</td>
                <td>{p.empresa?.nomeFantasia ?? p.empresa?.razaoSocial ?? "—"}</td>
                <td>{p.municipio ?? "—"}</td>
                <td>{p.estado ?? "—"}</td>
                <td>{p.areaTotal ?? "—"}</td>
                <td>{p._count?.talhao ?? 0}</td>
                <td><span className={`badge ${p.status === "ATIVO" ? "ativo" : "inativo"}`}>{p.status.toLowerCase()}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
