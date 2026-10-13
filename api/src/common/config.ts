// Regras ajustaveis por ambiente (valores padrao pensados para o simulador de 30 s).
export const LIMITE_SEM_COMUNICACAO_MIN = Number(process.env.LIMITE_SEM_COMUNICACAO_MIN ?? 30);

// Score de prioridade do ranking de alertas por talhao (P2): pendentes ponderados pelo nivel.
export const PESO_ALERTA = {
  CRITICO: Number(process.env.PESO_ALERTA_CRITICO ?? 5),
  ATENCAO: Number(process.env.PESO_ALERTA_ATENCAO ?? 2),
} as const;
