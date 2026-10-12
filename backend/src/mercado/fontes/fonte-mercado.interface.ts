export interface RegistroMercado {
  mercadoDestino: string;
  paisDestino: string;
  preco: string;
  moeda: 'USD';
  unidadeMedida: 'kg';
  dataReferencia: Date;
  demandaEstimada: number;
}

export interface CulturaMercado {
  id: number;
  nome: string;
}

export interface OpcoesFonteMercado {
  forcar?: boolean;
}

export interface FonteMercado {
  readonly id: string;
  readonly nome: string;
  suporta: (cultura: CulturaMercado) => boolean;
  buscar: (
    cultura: CulturaMercado,
    opcoes?: OpcoesFonteMercado,
  ) => Promise<RegistroMercado[]>;
}
