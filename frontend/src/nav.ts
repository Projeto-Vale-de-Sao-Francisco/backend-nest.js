export interface ItemCadastro {
  to: string;
  rotulo: string;
  icone: string;
  descricao: string;
  grupo: "Produção" | "Comercial" | "Administração";
  admin?: boolean;
}

// Telas que ficam dentro de "Cadastros" (hub + abas). Administracao so aparece para o Administrador.
export const CADASTROS: ItemCadastro[] = [
  { to: "/talhoes", rotulo: "Talhões", icone: "talhoes", grupo: "Produção", descricao: "Divisões de cada propriedade e a cultura plantada" },
  { to: "/culturas", rotulo: "Culturas", icone: "culturas", grupo: "Produção", descricao: "Faixas ideais de temperatura e umidade" },
  { to: "/dispositivos", rotulo: "Dispositivos", icone: "sensores", grupo: "Produção", descricao: "ESP32, sensores, chaves e última leitura" },
  { to: "/mercado", rotulo: "Mercado", icone: "mercado", grupo: "Comercial", descricao: "Preços e demanda por cultura e destino" },
  { to: "/logistica", rotulo: "Logística", icone: "logistica", grupo: "Comercial", descricao: "Operações de transporte para exportação" },
  { to: "/usuarios", rotulo: "Usuários", icone: "usuarios", grupo: "Administração", admin: true, descricao: "Contas e perfis de acesso" },
];

export const MENU = [
  { to: "/", rotulo: "Mapa", icone: "mapa" },
  { to: "/historico", rotulo: "Histórico", icone: "historico" },
  { to: "/alertas", rotulo: "Alertas", icone: "alertas" },
  { to: "/cadastros", rotulo: "Cadastros", icone: "cadastros" },
];

export const dentroDeCadastros = (caminho: string) =>
  caminho === "/cadastros" || CADASTROS.some((c) => caminho === c.to);
