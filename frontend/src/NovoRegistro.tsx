import { useState } from "react";

// Painel de cadastro: aberto no desktop; no celular fica recolhido atras de um botao para a lista aparecer primeiro.
export default function NovoRegistro({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="painel novo-registro">
      <button type="button" className="secundario abrir-registro" onClick={() => setAberto(!aberto)} aria-expanded={aberto}>
        {aberto ? "Fechar" : `+ ${rotulo}`}
      </button>
      <div className={`corpo-registro ${aberto ? "aberto" : ""}`}>{children}</div>
    </div>
  );
}
