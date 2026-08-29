/**
 * Formateo numerico en formato es-AR implementado a mano.
 * No se usa `Intl.NumberFormat` a proposito: el ICU de Node y el del navegador
 * pueden diferir y generar diferencias de hidratacion en Next.js.
 */

function groupThousands(digits: string): string {
  let out = "";
  for (let i = 0; i < digits.length; i += 1) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ".";
    out += digits[i];
  }
  return out;
}

export function formatNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return "-";
  const negative = value < 0;
  const fixed = Math.abs(value).toFixed(decimals);
  const [intPart, decPart] = fixed.split(".");
  const grouped = groupThousands(intPart);
  const body = decPart ? `${grouped},${decPart}` : grouped;
  return negative ? `-${body}` : body;
}

/** Pesos argentinos simulados, sin decimales. */
export function formatCurrency(value: number): string {
  return `$ ${formatNumber(Math.round(value), 0)}`;
}

/** Version compacta para tarjetas KPI: $ 12,4 M / $ 845,0 k. */
export function formatCurrencyCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$ ${formatNumber(abs / 1_000_000, 2)} M`;
  if (abs >= 10_000) return `${sign}$ ${formatNumber(abs / 1000, 1)} k`;
  return `${sign}$ ${formatNumber(abs, 0)}`;
}

export function formatUnits(value: number): string {
  return `${formatNumber(Math.round(value), 0)} u`;
}

/** Recibe una fraccion (0-1) y la muestra como porcentaje. */
export function formatPercent(value: number, decimals = 1): string {
  return `${formatNumber(value * 100, decimals)}%`;
}

/** Recibe un valor ya expresado en puntos porcentuales. */
export function formatPercentPoints(value: number, decimals = 1): string {
  return `${formatNumber(value, decimals)}%`;
}

export function formatHours(minutes: number, decimals = 1): string {
  return `${formatNumber(minutes / 60, decimals)} h`;
}

export function formatSignedCurrency(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatCurrency(value)}`;
}

export function formatMinutes(value: number): string {
  return `${formatNumber(Math.round(value), 0)} min`;
}

/** Segundos por unidad: usado por el modulo de balanceo de linea. */
export function formatSeconds(value: number, decimals = 1): string {
  return `${formatNumber(value, decimals)} s`;
}
