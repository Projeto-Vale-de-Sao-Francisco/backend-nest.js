import { useEffect, useState } from "react";
import Cabecalho from "../Cabecalho";
import { useNavigate } from "react-router-dom";
import { api, limparSessao } from "../api";
import { rotuloPerfil } from "../perfil";

const DESCRICAO: Record<string, string> = {
  ADMINISTRADOR: "Cadastra e administra o sistema todo; vê todas as empresas e propriedades.",
  GESTOR: "Acompanha as propriedades das empresas a que está vinculado, em modo consulta.",
  TECNICO: "Acompanha o monitoramento das propriedades vinculadas, em modo consulta.",
  AGRICULTOR: "Acompanha o monitoramento das propriedades vinculadas, em modo consulta.",
};

export default function MeuPerfil() {
  const navigate = useNavigate();
  const [u, setU] = useState<any>(null);
  const [erro, setErro] = useState("");

  useEffect(() => { api.me().then(setU).catch((e) => setErro(e.message)); }, []);

  function sair() {
    limparSessao();
    navigate("/login");
  }

  if (erro) return <div className="erro">{erro}</div>;
  if (!u) return <p className="vazio">Carregando...</p>;

  return (
    <div>
      <Cabecalho titulo="Meu perfil" subtitulo="Seus dados de acesso e vínculos." />
      <div className="painel">
        <div className="perfil-topo">
          <div className="avatar">{u.nomeCompleto.slice(0, 1)}</div>
          <div>
            <b style={{ fontSize: 18 }}>{u.nomeCompleto}</b>
            <div><span className="badge ativo">{rotuloPerfil(u.perfil)}</span></div>
          </div>
        </div>
        <p className="vazio">{DESCRICAO[u.perfil]}</p>
        <table>
          <tbody>
            <tr><td>E-mail</td><td>{u.email}</td></tr>
            <tr><td>CPF</td><td>{u.cpf}</td></tr>
            <tr><td>Telefone</td><td>{u.telefone ?? "—"}</td></tr>
            <tr><td>Status</td><td>{u.status.toLowerCase()}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="painel">
        <h3>Vínculos</h3>
        <p style={{ margin: "0 0 6px" }}><b>Empresas:</b> {u.empresas.length ? u.empresas.map((e: any) => e.nomeFantasia || e.razaoSocial).join(", ") : "nenhuma"}</p>
        <p style={{ margin: 0 }}><b>Propriedades vinculadas:</b> {u.propriedades.length ? u.propriedades.map((p: any) => p.nome).join(", ") : "nenhuma"}</p>
      </div>

      <button className="secundario" onClick={sair}>Sair do sistema</button>
    </div>
  );
}
