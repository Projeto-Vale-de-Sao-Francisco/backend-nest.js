export const CULTURAS_NCM: Readonly<Record<string, readonly string[]>> = {
  manga: ['08045020'],
  'uva fresca': ['08061000'],
};

export function normalizarNomeCultura(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}
