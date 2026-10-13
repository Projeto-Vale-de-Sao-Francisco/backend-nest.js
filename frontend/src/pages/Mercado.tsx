import { useEffect, useState } from "react";
import NovoRegistro from "../NovoRegistro";
import Cabecalho from "../Cabecalho";
import { api } from "../api";
import { ehAdmin } from "../perfil";

export default function Mercado() {
  const [dados, setDados] = useState<any[]>([]);
  const [culturas, setCulturas] = useState<any[]>([]);
  const hoje = () => new Date().toISOString().slice(0, 10);
  const [novo, setNovo] = useState({ culturaId: "", mercadoDestino: "", precoMedio: "", moeda: "USD", demandaEstimada: "", dataReferencia: hoje() });
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [atualizando, setAtualizando] = useState(false);
  const podeGerir = ehAdmin();

  async function carregar() {
    const [d, c] = await Promise.all([api.mercado(), api.culturas()]);
    setDados(d);
    setCulturas(c);
    if (!novo.culturaId && c[0]) setNovo((n) => ({ ...n, culturaId: String(c[0].id) }));
  }
  useEffect(() => { carregar(); }, []);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    try {
      await api.criarValorMercado({
        culturaId: Number(novo.culturaId),
        mercadoDestino: novo.mercadoDestino,
        precoMedio: Number(novo.precoMedio),
        moeda: novo.moeda,
        dataReferencia: novo.dataReferencia,
        demandaEstimada: novo.demandaEstimada || undefined,
      });
      setNovo({ ...novo, mercadoDestino: "", precoMedio: "", demandaEstimada: "" });
      carregar();
    } catch (err: any) {
      setErro(err.message);
    }
  }

  async function atualizar() {
    setErro("");
    setAviso("");
    setAtualizando(true);
    try {
      const r = await api.atualizarMercado();
      setAviso(`${r.inseridos} valores novos e ${r.atualizados} atualizados${r.ignorados ? ` (${r.ignorados} ignorados: cultura ou dados inválidos)` : ""}.`);
      carregar();
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setAtualizando(false);
    }
  }

  function nomeCultura(id: number) {
    return culturas.find((c) => c.id === id)?.nome ?? id;
  }

  return (
    <div>
      <Cabecalho titulo="Dados de Mercado" subtitulo="Preços e demanda por cultura e destino de exportação.">
        {podeGerir && <button onClick={atualizar} disabled={atualizando}>{atualizando ? "Atualizando..." : "Atualizar valores"}</button>}
      </Cabecalho>
      {aviso && <div className="aviso">{aviso}</div>}
      {!podeGerir && erro && <div className="erro">{erro}</div>}
      {podeGerir && <NovoRegistro rotulo="Novo valor">
        {erro && <div className="erro">{erro}</div>}
        <form className="linha" onSubmit={criar}>
          <label>Cultura
            <select value={novo.culturaId} onChange={(e) => setNovo({ ...novo, culturaId: e.target.value })}>
              {culturas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </label>
          <label>Mercado destino <input value={novo.mercadoDestino} onChange={(e) => setNovo({ ...novo, mercadoDestino: e.target.value })} placeholder="União Europeia" required /></label>
          <label>Preço médio <input type="number" step="0.01" value={novo.precoMedio} onChange={(e) => setNovo({ ...novo, precoMedio: e.target.value })} required /></label>
          <label>Moeda
            <select value={novo.moeda} onChange={(e) => setNovo({ ...novo, moeda: e.target.value })}>
              <option value="USD">USD</option>
              <option value="BRL">BRL</option>
              <option value="EUR">EUR</option>
            </select>
          </label>
          <label>Demanda
            <select value={novo.demandaEstimada} onChange={(e) => setNovo({ ...novo, demandaEstimada: e.target.value })}>
              <option value="">—</option>
              <option value="baixa">baixa</option>
              <option value="média">média</option>
              <option value="alta">alta</option>
            </select>
          </label>
          <label>Data de referência <input type="date" value={novo.dataReferencia} onChange={(e) => setNovo({ ...novo, dataReferencia: e.target.value })} required /></label>
          <button type="submit">Registrar</button>
        </form>
      </NovoRegistro>}

      <div className="painel">
        <table>
          <thead><tr><th>Cultura</th><th>Mercado destino</th><th>Preço médio</th><th>Demanda</th><th>Referência</th></tr></thead>
          <tbody>
            {dados.map((d) => (
              <tr key={d.id}>
                <td>{d.cultura?.nome ?? nomeCultura(d.culturaId)}</td>
                <td>{d.mercadoDestino}</td>
                <td>{d.moeda} {d.precoMedio}</td>
                <td>{d.demandaEstimada ?? "—"}</td>
                <td>{new Date(d.dataReferencia).toLocaleDateString("pt-BR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
