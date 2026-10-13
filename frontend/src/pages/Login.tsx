import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, salvarSessao } from "../api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const navigate = useNavigate();

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      const resposta = await api.login(email, senha);
      salvarSessao(resposta.token, resposta.usuario);
      navigate("/");
    } catch (err: any) {
      setErro(err.message || "Não foi possível entrar.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="tela-login">
      <form className="cartao-login" onSubmit={entrar}>
        <div className="logo-login">S</div>
        <h1>SIVALE</h1>
        <p className="sub">Monitoramento climático e logístico — Vale do São Francisco</p>
        {erro && <div className="erro">{erro}</div>}
        <label>E-mail</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label>Senha</label>
        <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
        <button type="submit" disabled={carregando}>{carregando ? "Entrando..." : "Entrar"}</button>
        <p className="dica">Use as credenciais fornecidas pelo administrador do Chico Talhão.</p>
      </form>
    </div>
  );
}
