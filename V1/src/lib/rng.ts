/**
 * Generador pseudoaleatorio con semilla (mulberry32).
 * Se usa para que todo el dataset simulado sea reproducible: misma semilla,
 * mismos datos, mismos resultados de planificacion en cualquier maquina.
 */
export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Numero real uniforme en [min, max). */
export function randomBetween(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** Entero uniforme en [min, max]. */
export function randomInt(rng: () => number, min: number, max: number): number {
  return Math.floor(min + rng() * (max - min + 1));
}

/** Elige un elemento de la lista de forma determinista. */
export function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)] as T;
}

/** Ruido normal estandar aproximado (suma de uniformes, Irwin-Hall). */
export function gaussian(rng: () => number): number {
  return (rng() + rng() + rng() + rng() + rng() + rng() - 3) / Math.sqrt(0.5);
}

/** Redondea al multiplo indicado (usado para lotes y unidades). */
export function roundTo(value: number, multiple: number): number {
  if (multiple <= 0) return Math.round(value);
  return Math.round(value / multiple) * multiple;
}
