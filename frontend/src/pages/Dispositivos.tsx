import { useEffect, useState } from "react";
import NovoRegistro from "../NovoRegistro";
import Cabecalho from "../Cabecalho";
import { api } from "../api";
import { ehAdmin } from "../perfil";

const vazio = { talhaoId: "", codigo: "", nome: "", latitude: "", longitude: "" };
export default function Dispositivos() {
  const [dispositivos, setDispositivos] = useState<any[]>([]);
  const [talhoes, setTalhoes] = useState<any[]>([]);
  const [novo, setNovo] = useState(vazio);
  const [erro, setErro] = useState("");
  const podeGerir = ehAdmin();

  async function carregar() {
    const [d, t] = await Promise.all([api.dispositivos(), api.talhoes()]);
    setDispositivos(d);
    setTalhoes(t);
    setNovo((n) => ({ ...n, talhaoId: n.talhaoId || String(t[0]?.id ?? "") }));
  }
  useEffect(() => { carregar(); }, []);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    try {
      await api.criarDispositivo({
        talhaoId: Number(novo.talhaoId),
        propriedadeId: talhoes.find((t) => t.id === Number(novo.talhaoId))?.propriedadeId,
        codigo: novo.codigo,
        modelo: novo.nome || "ESP32",
        tipoSensor: "TEMPERATURA_UMIDADE",
        status: "ATIVO",
      });
      setNovo({ ...vazio, talhaoId: novo.talhaoId });
      carregar();
    } catch (err: any) {
      setErro(err.message);
    }
  }

  async function alternar(d: any) {
    try {
      await api.atualizarDispositivo(d.id, { status: d.status === "ATIVO" ? "INATIVO" : "ATIVO" });
      carregar();
    } catch (err: any) {
      setErro(err.message);
    }
  }

  const set = (campo: keyof typeof vazio) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setNovo({ ...novo, [campo]: e.target.value });
  const nomeTalhao = (id: number) => talhoes.find((t) => t.id === id)?.nome ?? id;

  return (
    <div>
      <Cabecalho titulo="Dispositivos IoT" subtitulo="ESP32 instalados nos talhões e a última leitura de cada um." />
      {erro && <div className="erro">{erro}</div>}
      {podeGerir && (
        <NovoRegistro rotulo="Novo dispositivo">
          <form className="linha" onSubmit={criar}>
            <label>Talhão
              <select value={novo.talhaoId} onChange={set("talhaoId")}>
                {talhoes.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </label>
            <label>Código <input value={novo.codigo} onChange={set("codigo")} placeholder="ESP32-04" required /></label>
            <label>Modelo <input value={novo.nome} onChange={set("nome")} placeholder="ESP32" /></label>
            <label>Latitude <input type="number" step="any" value={novo.latitude} onChange={set("latitude")} /></label>
            <label>Longitude <input type="number" step="any" value={novo.longitude} onChange={set("longitude")} /></label>
            <button type="submit">Cadastrar dispositivo</button>
          </form>
        </NovoRegistro>
      )}

      <div className="painel">
        <table>
          <thead><tr><th>Código</th><th>Talhão</th><th>Sensores</th><th>Última leitura</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {dispositivos.map((d) => (
              <tr key={d.id}>
                <td>{d.codigo}</td>
                <td>{nomeTalhao(d.talhaoId)}</td>
                <td>{(d.sensores ?? d.sensor)?.map((s: any) => s.tipo).join(", ") || "—"}</td>
                <td>{d.ultimaMedicao ? `${d.ultimaMedicao.temperatura}°C · ${d.ultimaMedicao.umidade}% · há ${d.minutosDesdeUltimaMedicao < 60 ? `${d.minutosDesdeUltimaMedicao} min` : `${Math.floor(d.minutosDesdeUltimaMedicao / 60)} h`}` : "sem leituras"}{d.semComunicacao && d.status === "ATIVO" && <> <span className="badge critico">sem comunicação</span></>}</td>
                <td><span className={`badge ${d.status === "ATIVO" ? "ativo" : "inativo"}`}>{d.status.toLowerCase()}</span></td>
                <td>{podeGerir && <button className="secundario" onClick={() => alternar(d)}>{d.status === "ATIVO" ? "Inativar" : "Ativar"}</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
