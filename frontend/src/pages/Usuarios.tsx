import { useEffect, useState } from "react";
import NovoRegistro from "../NovoRegistro";
import Cabecalho from "../Cabecalho";
import { api, usuarioAtual } from "../api";
import { ROTULO_PERFIL } from "../perfil";

const vazio = { nomeCompleto: "", cpf: "", email: "", telefone: "", senha: "", perfil: "COMUM", vinculo: "" };

export default function Usuarios() {
  const eu = usuarioAtual();
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [novo, setNovo] = useState(vazio);
  const [erro, setErro] = useState("");

  async function carregar() { setUsuarios(await api.usuarios()); }
  useEffect(() => { carregar().catch((e) => setErro(e.message)); }, []);

  async function agir(fn: () => Promise<unknown>) {
    setErro("");
    try { await fn(); await carregar(); } catch (e: any) { setErro(e.message); }
  }

  function criar(e: React.FormEvent) {
    e.preventDefault();
    agir(async () => {
      await api.criarUsuario({ ...novo, cpf: novo.cpf.replace(/\D/g, ""), telefone: novo.telefone || undefined, vinculo: novo.vinculo || undefined });
      setNovo(vazio);
    });
  }

  const set = (campo: keyof typeof vazio) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setNovo({ ...novo, [campo]: e.target.value });

  return (
    <div>
      <Cabecalho titulo="Usuários" subtitulo="Contas e perfis de acesso do Chico Talhão." />
      {erro && <div className="erro">{erro}</div>}
      <NovoRegistro rotulo="Novo usuário administrador">
        <form className="linha" onSubmit={criar}>
          <label>Nome completo <input value={novo.nomeCompleto} onChange={set("nomeCompleto")} required minLength={2} /></label>
          <label>CPF <input value={novo.cpf} onChange={set("cpf")} inputMode="numeric" required /></label>
          <label>E-mail <input type="email" value={novo.email} onChange={set("email")} required /></label>
          <label>Telefone <input value={novo.telefone} onChange={set("telefone")} /></label>
          <label>Senha inicial <input type="password" value={novo.senha} onChange={set("senha")} minLength={8} required autoComplete="new-password" /></label>
          <label>Perfil <select value={novo.perfil} onChange={set("perfil")}>{Object.entries(ROTULO_PERFIL).map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></label>
          <label>Vínculo <input value={novo.vinculo} onChange={set("vinculo")} placeholder="opcional" /></label>
          <button type="submit">Cadastrar usuário</button>
        </form>
      </NovoRegistro>
      <div className="painel">
        <table>
          <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Vínculo</th><th>Status</th><th></th></tr></thead>
          <tbody>{usuarios.map((u) => (
            <tr key={u.id}>
              <td>{u.nomeCompleto}</td><td>{u.email}</td>
              <td><select aria-label={`Perfil de ${u.nomeCompleto}`} value={u.perfil} disabled={u.id === eu?.id} onChange={(e) => agir(() => api.atualizarUsuario(u.id, { tipo: e.target.value }))}>{Object.entries(ROTULO_PERFIL).map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></td>
              <td>{u.vinculo || "—"}</td>
              <td><span className={`badge ${u.status === "ATIVO" ? "ativo" : "inativo"}`}>{String(u.status || "ATIVO").toLowerCase()}</span></td>
              <td>{u.id !== eu?.id && <button className="secundario" onClick={() => agir(() => api.atualizarUsuario(u.id, { status: u.status === "ATIVO" ? "INATIVO" : "ATIVO" }))}>{u.status === "ATIVO" ? "Inativar" : "Ativar"}</button>}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
