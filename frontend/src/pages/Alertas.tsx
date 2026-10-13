import { useEffect, useState } from "react";
import Cabecalho from "../Cabecalho";
import { api } from "../api";

export default function Alertas() {
  const [alertas, setAlertas] = useState<any[]>([]);

  async function carregar() {
    setAlertas(await api.alertas());
  }

  useEffect(() => { carregar(); }, []);

  async function resolver(id: number) {
    await api.resolverAlerta(id);
    carregar();
  }

  return (
    <div>
      <Cabecalho titulo="Alertas Climáticos" subtitulo="Leituras fora da faixa ideal e dispositivos sem comunicação." />
      <div className="painel">
        <table>
          <thead><tr><th>Nível</th><th>Talhão</th><th>Cultura</th><th>Descrição</th><th>Data/Hora</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {alertas.map((a) => (
              <tr key={a.id}>
                <td><span className={`badge ${a.nivel.toLowerCase()}`}>{a.nivel.toLowerCase()}</span></td>
                <td>{a.talhao?.nome ?? "—"}</td>
                <td>{a.talhao?.cultura?.nome ?? "—"}</td>
                <td>{a.descricao}</td>
                <td>{new Date(a.dataHora).toLocaleString("pt-BR")}</td>
                <td>{a.resolvido ? <span className="badge ativo">resolvido</span> : <span className="badge atencao">pendente</span>}</td>
                <td>{!a.resolvido && <button className="secundario" onClick={() => resolver(a.id)}>Marcar como resolvido</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
