import { useEffect, useState } from "react";
import NovoRegistro from "../NovoRegistro";
import Cabecalho from "../Cabecalho";
import { api } from "../api";
import { ehAdmin } from "../perfil";

export default function Logistica() {
  const [operacoes, setOperacoes] = useState<any[]>([]);
  const [novo, setNovo] = useState({ empresaId: "", colheitaId: "", origem: "", destino: "", modal: "MARITIMO", transportadora: "", dataPrevista: "", tempoEstimadoHoras: "", custoEstimado: "" });
  const [erro, setErro] = useState("");
  const podeGerir = ehAdmin();

  async function carregar() {
    setOperacoes(await api.logistica());
  }
  useEffect(() => { carregar(); }, []);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    try {
      await api.criarLogistica({
        empresaId: Number(novo.empresaId),
        colheitaId: Number(novo.colheitaId),
        origem: novo.origem,
        destino: novo.destino,
        modal: novo.modal,
        transportadora: novo.transportadora || undefined,
        dataPrevista: novo.dataPrevista || undefined,
        tempoEstimadoHoras: novo.tempoEstimadoHoras ? Number(novo.tempoEstimadoHoras) : undefined,
        custoEstimado: novo.custoEstimado ? Number(novo.custoEstimado) : undefined,
      });
      setNovo({ ...novo, origem: "", destino: "", transportadora: "", dataPrevista: "", tempoEstimadoHoras: "", custoEstimado: "" });
      carregar();
    } catch (err: any) {
      setErro(err.message);
    }
  }

  return (
    <div>
      <Cabecalho titulo="Logística e Exportação" subtitulo="Operações de transporte e exportação da produção." />
      {podeGerir && <NovoRegistro rotulo="Nova operação">
        {erro && <div className="erro">{erro}</div>}
        <form className="linha" onSubmit={criar}>
          <label>ID da empresa <input type="number" min="1" value={novo.empresaId} onChange={(e) => setNovo({ ...novo, empresaId: e.target.value })} required /></label>
          <label>ID da colheita <input type="number" min="1" value={novo.colheitaId} onChange={(e) => setNovo({ ...novo, colheitaId: e.target.value })} required /></label>
          <label>Origem <input value={novo.origem} onChange={(e) => setNovo({ ...novo, origem: e.target.value })} placeholder="Petrolina/PE" required /></label>
          <label>Destino <input value={novo.destino} onChange={(e) => setNovo({ ...novo, destino: e.target.value })} placeholder="Rotterdam" required /></label>
          <label>Modal
            <select value={novo.modal} onChange={(e) => setNovo({ ...novo, modal: e.target.value })}>
              <option value="MARITIMO">marítimo</option>
              <option value="AEREO">aéreo</option>
              <option value="RODOVIARIO">rodoviário</option>
            </select>
          </label>
          <label>Transportadora <input value={novo.transportadora} onChange={(e) => setNovo({ ...novo, transportadora: e.target.value })} /></label>
          <label>Data prevista <input type="date" value={novo.dataPrevista} onChange={(e) => setNovo({ ...novo, dataPrevista: e.target.value })} /></label>
          <label>Tempo estimado (h) <input type="number" min="0" value={novo.tempoEstimadoHoras} onChange={(e) => setNovo({ ...novo, tempoEstimadoHoras: e.target.value })} /></label>
          <label>Custo (R$) <input type="number" step="any" value={novo.custoEstimado} onChange={(e) => setNovo({ ...novo, custoEstimado: e.target.value })} /></label>
          <button type="submit">Registrar operação</button>
        </form>
      </NovoRegistro>}

      <div className="painel">
        <table>
          <thead><tr><th>Colheita</th><th>Origem</th><th>Destino</th><th>Modal</th><th>Transportadora</th><th>Custo</th><th>Situação</th></tr></thead>
          <tbody>
            {operacoes.map((o) => (
              <tr key={o.id}>
                <td>{o.colheita?.talhaoCultura?.talhao?.nome ?? `#${o.colheitaId}`}</td>
                <td>{o.origem}</td>
                <td>{o.destino}</td>
                <td>{o.modal}</td>
                <td>{o.transportadora ?? "—"}</td>
                <td>{o.custoEstimado != null ? `R$ ${o.custoEstimado.toLocaleString("pt-BR")}` : "—"}</td>
                <td><span className="badge ativo">{String(o.situacao).toLowerCase()}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
