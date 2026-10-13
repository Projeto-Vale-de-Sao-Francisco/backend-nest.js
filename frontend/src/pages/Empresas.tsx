import { useEffect, useState } from "react";
import NovoRegistro from "../NovoRegistro";
import Cabecalho from "../Cabecalho";
import { api } from "../api";
import { ehAdmin } from "../perfil";

const vazio = { razaoSocial: "", nomeFantasia: "", cpfCnpj: "", telefone: "", email: "", cidade: "", estado: "", responsavel: "" };

export default function Empresas() {
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [novo, setNovo] = useState(vazio);
  const [erro, setErro] = useState("");
  const podeCriar = ehAdmin();

  async function carregar() {
    setEmpresas(await api.empresas());
  }
  useEffect(() => { carregar(); }, []);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    const limpo = Object.fromEntries(Object.entries(novo).filter(([, v]) => v !== ""));
    try {
      await api.criarEmpresa({ ...limpo, cpfCnpj: novo.cpfCnpj.replace(/\D/g, "") });
      setNovo(vazio);
      carregar();
    } catch (err: any) {
      setErro(err.message);
    }
  }

  const set = (campo: keyof typeof vazio) => (e: React.ChangeEvent<HTMLInputElement>) => setNovo({ ...novo, [campo]: e.target.value });

  return (
    <div>
      <Cabecalho titulo="Produtores e Empresas" subtitulo="Produtores, cooperativas e exportadoras que usam a plataforma." />
      {podeCriar && (
        <NovoRegistro rotulo="Nova empresa">
          {erro && <div className="erro">{erro}</div>}
          <form className="linha" onSubmit={criar}>
            <label>Razão social / nome <input value={novo.razaoSocial} onChange={set("razaoSocial")} required /></label>
            <label>Nome fantasia <input value={novo.nomeFantasia} onChange={set("nomeFantasia")} /></label>
            <label>CPF/CNPJ <input value={novo.cpfCnpj} onChange={set("cpfCnpj")} inputMode="numeric" required /></label>
            <label>Telefone <input value={novo.telefone} onChange={set("telefone")} /></label>
            <label>E-mail <input type="email" value={novo.email} onChange={set("email")} /></label>
            <label>Cidade <input value={novo.cidade} onChange={set("cidade")} /></label>
            <label>UF <input value={novo.estado} onChange={set("estado")} maxLength={2} /></label>
            <label>Responsável <input value={novo.responsavel} onChange={set("responsavel")} /></label>
            <button type="submit">Cadastrar</button>
          </form>
        </NovoRegistro>
      )}

      <div className="painel">
        <table>
          <thead><tr><th>Razão social</th><th>CPF/CNPJ</th><th>Cidade</th><th>Responsável</th><th>Propriedades</th><th>Usuários</th><th>Status</th></tr></thead>
          <tbody>
            {empresas.map((e) => (
              <tr key={e.id}>
                <td>{e.nomeFantasia ? `${e.nomeFantasia} · ${e.razaoSocial}` : e.razaoSocial}</td>
                <td>{e.cpfCnpj}</td>
                <td>{e.cidade ? `${e.cidade}/${e.estado ?? ""}` : "—"}</td>
                <td>{e.responsavel ?? "—"}</td>
                <td>{e._count?.propriedade ?? 0}</td>
                <td>{e._count?.usuario ?? 0}</td>
                <td><span className={`badge ${e.status === "ATIVO" ? "ativo" : "inativo"}`}>{e.status.toLowerCase()}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
