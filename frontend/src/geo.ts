export type Ponto = [number, number];

// O banco guarda so lat/long do sensor e da propriedade, entao o talhao e desenhado
// como um quadrado com a area do lote (ha), centrado no sensor.
export function quadradoDaArea(lat: number, lng: number, areaHa: number | null | undefined): Ponto[] {
  const ha = areaHa && areaHa > 0 ? areaHa : 5;
  const metade = Math.sqrt(ha * 10000) / 2;
  const dLat = metade / 111320;
  const dLng = metade / (111320 * Math.cos((lat * Math.PI) / 180));
  return [
    [lat + dLat, lng - dLng],
    [lat + dLat, lng + dLng],
    [lat - dLat, lng + dLng],
    [lat - dLat, lng - dLng],
  ];
}

export function dentroDaFaixa(v: number, min: number, max: number) {
  return v >= min && v <= max;
}

export function percentualNaFaixa(leituras: any[], cultura: any): number | null {
  if (!leituras.length || !cultura) return null;
  const ok = leituras.filter(
    (l) =>
      dentroDaFaixa(l.temperatura, cultura.temperaturaMin, cultura.temperaturaMax) &&
      dentroDaFaixa(l.umidade, cultura.umidadeMin, cultura.umidadeMax)
  ).length;
  return Math.round((ok / leituras.length) * 100);
}

export function estatistica(valores: number[]) {
  if (!valores.length) return { media: null as number | null, max: null as number | null, min: null as number | null };
  const soma = valores.reduce((s, v) => s + v, 0);
  return { media: soma / valores.length, max: Math.max(...valores), min: Math.min(...valores) };
}

export const fmt = (v: number | null | undefined, casas = 1) => (v == null ? "—" : v.toFixed(casas).replace(".", ","));

export const fmtData = (s?: string | null) =>
  s ? new Date(s.length <= 10 ? `${s}T00:00:00` : s).toLocaleDateString("pt-BR") : "—";
