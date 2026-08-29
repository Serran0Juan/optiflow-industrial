import type { SupplyScenario, SupplyScenarioPreset } from "@/lib/types";
import { clamp } from "@/lib/utils";
import { SUPPLY_HORIZON_OPTIONS } from "@/lib/data/supply-config";

/**
 * Escenarios de la Torre de abastecimiento.
 *
 * El modulo mantiene su propio estado de escenario, independiente del simulador
 * global del planificador. La razon es de acoplamiento: el escenario global
 * modela capacidad de linea, setups y costo de faltante de producto terminado,
 * variables que no intervienen en una decision de compra. Lo que si se
 * reutiliza es la demanda: el consumo de materia prima parte del mismo
 * pronostico base que alimenta el plan de produccion (ver supply-catalog).
 */

export const SUPPLY_LIMITS = {
  demandVariationPct: { min: -20, max: 30, step: 5 },
  supplierDelayDays: { min: 0, max: 10, step: 1 },
  reliabilityVariationPoints: { min: -20, max: 10, step: 5 },
  scrapPct: { min: 0, max: 10, step: 1 },
} as const;

export const DEFAULT_SUPPLY_SCENARIO: SupplyScenario = {
  demandVariationPct: 0,
  supplierDelayDays: 0,
  reliabilityVariationPoints: 0,
  scrapPct: 0,
  horizonDays: 14,
};

export const SUPPLY_PRESETS: SupplyScenarioPreset[] = [
  {
    id: "estable",
    name: "Operacion estable",
    description:
      "Programa normal: demanda segun pronostico, proveedores cumpliendo su lead time comprometido y scrap dentro de lo esperado.",
    scenario: { ...DEFAULT_SUPPLY_SCENARIO },
  },
  {
    id: "demanda-elevada",
    name: "Demanda elevada",
    description:
      "Campana comercial: la demanda sube 25% y el scrap crece al 4% por trabajar la linea a mayor ritmo. El consumo se acelera y la cobertura cae.",
    scenario: {
      demandVariationPct: 25,
      supplierDelayDays: 0,
      reliabilityVariationPoints: 0,
      scrapPct: 4,
      horizonDays: 14,
    },
  },
  {
    id: "proveedor-retrasado",
    name: "Proveedor retrasado",
    description:
      "Conflicto logistico: todos los proveedores suman 3 dias habiles de lead time y su confiabilidad cae 10 puntos. Las ordenes abiertas llegan mas tarde.",
    scenario: {
      demandVariationPct: 0,
      supplierDelayDays: 3,
      reliabilityVariationPoints: -10,
      scrapPct: 0,
      horizonDays: 14,
    },
  },
  {
    id: "riesgo-quiebre",
    name: "Riesgo de quiebre",
    description:
      "Peor combinacion del caso: demanda 30% mayor, 8 dias habiles de retraso, confiabilidad 20 puntos menor, 8% de scrap y horizonte de 30 dias.",
    scenario: {
      demandVariationPct: 30,
      supplierDelayDays: 8,
      reliabilityVariationPoints: -20,
      scrapPct: 8,
      horizonDays: 30,
    },
  },
];

function snap(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** Acota y discretiza el escenario para que dos entradas equivalentes den el mismo resultado. */
export function normalizeSupplyScenario(scenario: SupplyScenario): SupplyScenario {
  const horizonDays = SUPPLY_HORIZON_OPTIONS.includes(
    scenario.horizonDays as (typeof SUPPLY_HORIZON_OPTIONS)[number],
  )
    ? scenario.horizonDays
    : DEFAULT_SUPPLY_SCENARIO.horizonDays;

  return {
    demandVariationPct: clamp(
      snap(scenario.demandVariationPct, SUPPLY_LIMITS.demandVariationPct.step),
      SUPPLY_LIMITS.demandVariationPct.min,
      SUPPLY_LIMITS.demandVariationPct.max,
    ),
    supplierDelayDays: clamp(
      Math.round(scenario.supplierDelayDays),
      SUPPLY_LIMITS.supplierDelayDays.min,
      SUPPLY_LIMITS.supplierDelayDays.max,
    ),
    reliabilityVariationPoints: clamp(
      snap(scenario.reliabilityVariationPoints, SUPPLY_LIMITS.reliabilityVariationPoints.step),
      SUPPLY_LIMITS.reliabilityVariationPoints.min,
      SUPPLY_LIMITS.reliabilityVariationPoints.max,
    ),
    scrapPct: clamp(
      Math.round(scenario.scrapPct),
      SUPPLY_LIMITS.scrapPct.min,
      SUPPLY_LIMITS.scrapPct.max,
    ),
    horizonDays,
  };
}

export function matchSupplyPreset(scenario: SupplyScenario): SupplyScenarioPreset | undefined {
  return SUPPLY_PRESETS.find(
    (preset) =>
      preset.scenario.demandVariationPct === scenario.demandVariationPct &&
      preset.scenario.supplierDelayDays === scenario.supplierDelayDays &&
      preset.scenario.reliabilityVariationPoints === scenario.reliabilityVariationPoints &&
      preset.scenario.scrapPct === scenario.scrapPct &&
      preset.scenario.horizonDays === scenario.horizonDays,
  );
}
