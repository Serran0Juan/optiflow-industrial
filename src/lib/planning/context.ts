import {
  dataset,
  getAvailabilityFactor,
  getBaseSetupMinutes,
  getLinesForProduct,
  getRate,
} from "@/lib/data/dataset";
import type { FamilyId, PlanningDay, Product, ProductionLine, Scenario } from "@/lib/types";
import { applyDemandVariation, baseForecast } from "./forecast";

/**
 * Contexto de planificacion: todo lo que los planificadores necesitan para
 * decidir, ya ajustado por el escenario elegido. Ambos planes (base y
 * recomendado) reciben exactamente el mismo contexto, de modo que la comparacion
 * sea justa.
 */
export interface PlanningContext {
  scenario: Scenario;
  days: PlanningDay[];
  products: Product[];
  lines: ProductionLine[];
  /** Demanda proyectada por producto y dia del horizonte. */
  demand: Record<string, number[]>;
  /** Demanda media diaria proyectada por producto. */
  averageDailyDemand: Record<string, number>;
  initialStock: Record<string, number>;
  /** Minutos de jornada normal disponibles por linea y dia. */
  regularCapacity: Record<string, number[]>;
  /** Minutos de hora extra habilitados por linea y dia. */
  overtimeCapacity: Record<string, number[]>;
  rate: (lineId: string, productId: string) => number;
  setupMinutes: (lineId: string, from: FamilyId, to: FamilyId) => number;
  /** Costo economico de dejar una unidad sin atender (ARS/unidad). */
  stockoutCostPerUnit: (productId: string) => number;
  holdingCostPerUnitPerDay: (productId: string) => number;
  eligibleLines: (productId: string) => string[];
  productById: Record<string, Product>;
  lineById: Record<string, ProductionLine>;
  totalDemandUnits: number;
  totalRegularCapacityMinutes: number;
}

export function buildPlanningContext(scenario: Scenario): PlanningContext {
  const demand = applyDemandVariation(baseForecast, scenario.demandVariationPct);
  const days = dataset.planningDays;

  const capacityFactor = 1 - scenario.capacityReductionPct / 100;
  const setupFactor = 1 + scenario.setupTimeIncreasePct / 100;

  const regularCapacity: Record<string, number[]> = {};
  const overtimeCapacity: Record<string, number[]> = {};
  for (const line of dataset.lines) {
    regularCapacity[line.id] = days.map((day) =>
      Math.floor(line.regularMinutesPerDay * getAvailabilityFactor(line.id, day.index) * capacityFactor),
    );
    overtimeCapacity[line.id] = days.map((day) =>
      scenario.allowOvertime
        ? Math.floor(line.maxOvertimeMinutesPerDay * getAvailabilityFactor(line.id, day.index))
        : 0,
    );
  }

  const productById: Record<string, Product> = Object.fromEntries(
    dataset.products.map((product) => [product.id, product]),
  );
  const lineById: Record<string, ProductionLine> = Object.fromEntries(
    dataset.lines.map((line) => [line.id, line]),
  );

  const averageDailyDemand: Record<string, number> = {};
  const initialStock: Record<string, number> = {};
  let totalDemandUnits = 0;
  for (const product of dataset.products) {
    const series = demand[product.id];
    const total = series.reduce((acc, value) => acc + value, 0);
    averageDailyDemand[product.id] = total / series.length;
    initialStock[product.id] = product.initialStock;
    totalDemandUnits += total;
  }

  const totalRegularCapacityMinutes = Object.values(regularCapacity)
    .flat()
    .reduce((acc, value) => acc + value, 0);

  return {
    scenario,
    days,
    products: dataset.products,
    lines: dataset.lines,
    demand,
    averageDailyDemand,
    initialStock,
    regularCapacity,
    overtimeCapacity,
    rate: getRate,
    setupMinutes: (lineId, from, to) => Math.round(getBaseSetupMinutes(lineId, from, to) * setupFactor),
    stockoutCostPerUnit: (productId) => {
      const product = productById[productId];
      return (
        (product.contributionMargin + product.stockoutPenaltyPerUnit) * scenario.stockoutCostMultiplier
      );
    },
    holdingCostPerUnitPerDay: (productId) => productById[productId].holdingCostPerUnitPerDay,
    eligibleLines: (productId) => getLinesForProduct(productById[productId]),
    productById,
    lineById,
    totalDemandUnits,
    totalRegularCapacityMinutes,
  };
}
