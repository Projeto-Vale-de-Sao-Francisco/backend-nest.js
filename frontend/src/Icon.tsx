// Um desenho diferente para cada destino do sistema (nenhum ícone repetido).
const CAMINHOS: Record<string, string> = {
  mapa: "M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15",
  paineis: "M4 20V10M10 20V4M16 20v-8M22 20H2",
  historico: "M3 3v18h18M7 15l4-4 3 3 5-6",
  alertas: "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0",
  cadastros: "M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  propriedades: "M3 21V9l9-6 9 6v12zM9 21v-6h6v6",
  talhoes: "M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z",
  culturas: "M12 22V12M12 12C12 7 8 4 3 4c0 5 3 8 9 8zM12 14c0-4 3-7 9-7 0 5-3 8-9 8z",
  sensores: "M5 12a7 7 0 0 1 14 0M8.5 12a3.5 3.5 0 0 1 7 0M12 12v.01M12 16v5",
  mercado: "M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8zM7 7h.01",
  logistica: "M1 6h13v10H1zM14 10h5l3 3v3h-8zM6 19.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM18 19.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
  empresas: "M3 21h18M6 21V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v16M14 9h4a1 1 0 0 1 1 1v11M9 8h2M9 12h2M9 16h2",
  usuarios: "M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM21 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  perfil: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  sair: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  recolher: "M11 17l-5-5 5-5M18 17l-5-5 5-5",
  expandir: "M13 17l5-5-5-5M6 17l5-5-5-5",
  exportar: "M12 3v12M7 8l5-5 5 5M5 21h14",
};

export default function Icon({ nome, tamanho = 22 }: { nome: string; tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={CAMINHOS[nome] ?? ""} />
    </svg>
  );
}
