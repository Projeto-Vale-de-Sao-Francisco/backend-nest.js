import { useNavigate, Link } from "react-router-dom";
import Cabecalho from "../Cabecalho";
import Icon from "../Icon";
import { limparSessao, usuarioAtual } from "../api";
import { CADASTROS } from "../nav";
import { ehAdmin, rotuloPerfil } from "../perfil";

export default function Cadastros() {
  const navigate = useNavigate();
  const admin = ehAdmin();
  const usuario = usuarioAtual();
  const grupos = ["Produção", "Comercial", "Administração"].filter((g) => CADASTROS.some((c) => c.grupo === g && (!c.admin || admin)));

  function sair() {
    limparSessao();
    navigate("/login");
  }

  return (
    <div>
      <Cabecalho
        titulo="Cadastros"
        subtitulo={admin ? "Cadastre e gerencie a estrutura do sistema." : "Consulte a estrutura do sistema. Os cadastros são feitos pelo administrador."}
      />

      {grupos.map((g) => (
        <section key={g} className="hub-grupo">
          <h3>{g}</h3>
          <div className="hub-grade">
            {CADASTROS.filter((c) => c.grupo === g && (!c.admin || admin)).map((c) => (
              <Link key={c.to} to={c.to} className="hub-card">
                <span className="hub-icone"><Icon nome={c.icone} /></span>
                <b>{c.rotulo}</b>
                <small>{c.descricao}</small>
              </Link>
            ))}
          </div>
        </section>
      ))}

      <section className="hub-grupo">
        <h3>Minha conta</h3>
        <div className="hub-grade">
          <Link to="/perfil" className="hub-card">
            <span className="hub-icone"><Icon nome="perfil" /></span>
            <b>Meu perfil</b>
            <small>{usuario?.nomeCompleto} · {rotuloPerfil(usuario?.perfil)}</small>
          </Link>
          <button className="hub-card" onClick={sair}>
            <span className="hub-icone"><Icon nome="sair" /></span>
            <b>Sair</b>
            <small>Encerrar a sessão neste aparelho</small>
          </button>
        </div>
      </section>
    </div>
  );
}
