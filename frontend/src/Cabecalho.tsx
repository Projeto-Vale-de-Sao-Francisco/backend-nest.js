// Cabecalho padrao de todas as telas: titulo, descricao curta e acoes opcionais a direita.
export default function Cabecalho({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children?: React.ReactNode }) {
  return (
    <header className="cabecalho-pagina">
      <div>
        <h2>{titulo}</h2>
        {subtitulo && <p>{subtitulo}</p>}
      </div>
      {children && <div className="acoes-pagina">{children}</div>}
    </header>
  );
}
