import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, NavLink, useLocation, useNavigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Culturas from "./pages/Culturas";
import Talhoes from "./pages/Talhoes";
import Dispositivos from "./pages/Dispositivos";
import Mercado from "./pages/Mercado";
import Logistica from "./pages/Logistica";
import Alertas from "./pages/Alertas";
import Historico from "./pages/Historico";
import Usuarios from "./pages/Usuarios";
import MeuPerfil from "./pages/MeuPerfil";
import Cadastros from "./pages/Cadastros";
import Icon from "./Icon";
import { api, estaAutenticado, limparSessao, usuarioAtual } from "./api";
import { CADASTROS, MENU, dentroDeCadastros } from "./nav";
import { ehAdmin, rotuloPerfil } from "./perfil";

function RotaProtegida({ children }: { children: JSX.Element }) {
  if (!estaAutenticado()) return <Navigate to="/login" replace />;
  return children;
}

// Telas de gestao de usuarios e de produtores/empresas: so o Administrador.
function SoAdmin({ children }: { children: JSX.Element }) {
  return ehAdmin() ? children : <Navigate to="/" replace />;
}

// Em telas estreitas as tabelas viram cartoes; o CSS usa data-label de cada celula.
function useRotulosDeTabela(chave: string) {
  useEffect(() => {
    function marcar() {
      document.querySelectorAll("table").forEach((t) => {
        const cab = Array.from(t.querySelectorAll("thead th")).map((th) => th.textContent ?? "");
        t.querySelectorAll("tbody tr").forEach((tr) =>
          Array.from(tr.children).forEach((td, i) => td.setAttribute("data-label", cab[i] ?? ""))
        );
      });
    }
    marcar();
    const obs = new MutationObserver(marcar);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, [chave]);
}

// Preferencia do usuario: menu so com icones no desktop (lembrada neste aparelho).
function useMenuRecolhido() {
  const [preferencia, setPreferencia] = useState(() => {
    try { return localStorage.getItem("sivale_menu_recolhido") === "1"; } catch { return false; }
  });
  const [estreita, setEstreita] = useState(() => window.matchMedia("(max-width: 1100px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1100px)");
    const ouvir = () => setEstreita(mq.matches);
    mq.addEventListener("change", ouvir);
    return () => mq.removeEventListener("change", ouvir);
  }, []);
  function alternar() {
    setPreferencia((p) => {
      try { localStorage.setItem("sivale_menu_recolhido", p ? "0" : "1"); } catch { /* sem armazenamento: vale so nesta sessao */ }
      return !p;
    });
  }
  return { recolhido: preferencia || estreita, alternar };
}

// Contador de alertas pendentes no menu (atualiza a cada 30 s).
function useAlertasPendentes() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const carregar = () => api.alertas({ resolvido: "false" }).then((a: any[]) => setN(a.length)).catch(() => {});
    carregar();
    const t = setInterval(carregar, 30000);
    return () => clearInterval(t);
  }, []);
  return n;
}

function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const usuario = usuarioAtual();
  const pendentes = useAlertasPendentes();
  const { recolhido, alternar } = useMenuRecolhido();
  const admin = ehAdmin();
  const cheio = pathname === "/";
  const abas = CADASTROS.filter((c) => !c.admin || admin);

  useRotulosDeTabela(pathname);

  async function sair() {
    try {
      await api.logout();
    } finally {
      limparSessao();
      navigate("/login");
    }
  }

  // "Cadastros" fica ativo em todas as telas filhas (propriedades, talhoes, mercado...).
  const ativo = (to: string) => (to === "/cadastros" ? dentroDeCadastros(pathname) : to === "/" ? pathname === "/" : pathname.startsWith(to));
  const inicial = (usuario?.nomeCompleto ?? "?").slice(0, 1);

  return (
    <div className={`layout ${recolhido ? "recolhido" : ""}`}>
      <aside className="lateral" aria-label="Menu principal">
        <NavLink to="/" className="marca" aria-label="SIVALE">
          <span className="logo">S</span>
          <div><b>SIVALE</b><small>Vale do São Francisco</small></div>
        </NavLink>

        <button className="alternar-menu" onClick={alternar} aria-label={recolhido ? "Expandir menu" : "Recolher menu"} title={recolhido ? "Expandir menu" : "Recolher menu"} aria-expanded={!recolhido}>
          <Icon nome={recolhido ? "expandir" : "recolher"} tamanho={16} />
        </button>

        <nav className="menu">
          {MENU.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.to === "/"} className={`menu-item ${ativo(i.to) ? "ativo" : ""}`} data-rotulo={i.rotulo}>
              <Icon nome={i.icone} />
              <span className="rotulo-menu">{i.rotulo}</span>
              {i.to === "/alertas" && pendentes > 0 && <span className="num">{pendentes > 99 ? "99+" : pendentes}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="rodape-menu">
          <NavLink to="/perfil" className={`usuario-card ${pathname === "/perfil" ? "ativo" : ""}`} data-rotulo="Meu perfil">
            <span className="avatar-mini">{inicial}</span>
            <span className="rotulo-menu">
              <b>{usuario?.nomeCompleto ?? "Usuário"}</b>
              <small>{rotuloPerfil(usuario?.perfil)}</small>
            </span>
          </NavLink>
          <button className="menu-item sair" onClick={sair} data-rotulo="Sair">
            <Icon nome="sair" />
            <span className="rotulo-menu">Sair</span>
          </button>
        </div>
      </aside>

      <main className={`conteudo ${cheio ? "cheio" : ""}`}>
        {dentroDeCadastros(pathname) && pathname !== "/cadastros" && (
          <nav className="abas" aria-label="Cadastros">
            <NavLink to="/cadastros" className="aba voltar" aria-label="Voltar para Cadastros"><Icon nome="cadastros" tamanho={16} /></NavLink>
            {abas.map((a) => (
              <NavLink key={a.to} to={a.to} className={({ isActive }) => `aba ${isActive ? "ativo" : ""}`}>{a.rotulo}</NavLink>
            ))}
          </nav>
        )}
        {children}
      </main>

      <nav className="nav-inferior" aria-label="Menu principal">
        {MENU.map((i) => (
          <NavLink key={i.to} to={i.to} end={i.to === "/"} className={ativo(i.to) ? "ativo" : ""}>
            <span className="icone-nav">
              <Icon nome={i.icone} />
              {i.to === "/alertas" && pendentes > 0 && <span className="num">{pendentes > 99 ? "99+" : pendentes}</span>}
            </span>
            {i.rotulo}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export default function App() {
  const protegida = (el: JSX.Element, soAdmin = false) => (
    <RotaProtegida>
      <Layout>{soAdmin ? <SoAdmin>{el}</SoAdmin> : el}</Layout>
    </RotaProtegida>
  );
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={protegida(<Dashboard />)} />
        <Route path="/historico" element={protegida(<Historico />)} />
        <Route path="/alertas" element={protegida(<Alertas />)} />
        <Route path="/cadastros" element={protegida(<Cadastros />)} />
        <Route path="/talhoes" element={protegida(<Talhoes />)} />
        <Route path="/culturas" element={protegida(<Culturas />)} />
        <Route path="/dispositivos" element={protegida(<Dispositivos />)} />
        <Route path="/mercado" element={protegida(<Mercado />)} />
        <Route path="/logistica" element={protegida(<Logistica />)} />
        <Route path="/usuarios" element={protegida(<Usuarios />, true)} />
        <Route path="/perfil" element={protegida(<MeuPerfil />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
