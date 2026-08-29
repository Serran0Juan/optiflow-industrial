import type { Dataset, FamilyId, Product, ProductFamily, ProductionLine } from "@/lib/types";
import { SIMULATION_SEED } from "./config";
import { generateDataset } from "./generate";

/**
 * Dataset unico de la aplicacion. Se genera una sola vez por proceso a partir
 * de una semilla fija, por lo que servidor y cliente ven exactamente los mismos
 * numeros.
 */
export const dataset: Dataset = generateDataset(SIMULATION_SEED);

export const productsById: Record<string, Product> = Object.fromEntries(
  dataset.products.map((product) => [product.id, product]),
);

export const linesById: Record<string, ProductionLine> = Object.fromEntries(
  dataset.lines.map((line) => [line.id, line]),
);

export const familiesById: Record<string, ProductFamily> = Object.fromEntries(
  dataset.families.map((family) => [family.id, family]),
);

const rateIndex: Record<string, number> = Object.fromEntries(
  dataset.rates.map((rate) => [`${rate.lineId}:${rate.productId}`, rate.unitsPerMinute]),
);

/** Velocidad (unidades/minuto). Devuelve 0 si la linea no puede correr el producto. */
export function getRate(lineId: string, productId: string): number {
  return rateIndex[`${lineId}:${productId}`] ?? 0;
}

const setupIndex: Record<string, number> = Object.fromEntries(
  dataset.setupTimes.map((entry) => [`${entry.lineId}:${entry.fromFamily}>${entry.toFamily}`, entry.minutes]),
);

/** Minutos base de cambio de formato (sin el ajuste del escenario). */
export function getBaseSetupMinutes(lineId: string, from: FamilyId, to: FamilyId): number {
  if (from === to) return 0;
  return setupIndex[`${lineId}:${from}>${to}`] ?? 0;
}

export function getAvailabilityFactor(lineId: string, dayIndex: number): number {
  const event = dataset.availabilityEvents.find(
    (item) => item.lineId === lineId && item.dayIndex === dayIndex,
  );
  return event ? event.availabilityFactor : 1;
}

export function getLinesForProduct(product: Product): string[] {
  return [product.preferredLineId, ...product.alternateLineIds];
}
