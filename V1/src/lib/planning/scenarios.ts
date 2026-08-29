import type { Scenario, ScenarioPreset } from "@/lib/types";
import { clamp } from "@/lib/utils";

export const SCENARIO_LIMITS = {
  demandVariationPct: { min: -20, max: 30, step: 5 },
  capacityReductionPct: { min: 0, max: 40, step: 5 },
  setupTimeIncreasePct: { min: 0, max: 100, step: 10 },
  stockoutCostMultiplier: { min: 1, max: 3, step: 0.25 },
} as const;

export const DEFAULT_SCENARIO: Scenario = {
  demandVariationPct: 0,
  capacityReductionPct: 0,
  setupTimeIncreasePct: 0,
  stockoutCostMultiplier: 1,
  allowOvertime: true,
};

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: "estable",
    name: "Operacion estable",
    description:
      "Semana normal: demanda segun pronostico, capacidad completa y horas extra habilitadas.",
    scenario: { ...DEFAULT_SCENARIO },
  },
  {
    id: "pico",
    name: "Pico de demanda",
    description:
      "Campana comercial: la demanda sube 25% y el faltante penaliza 1,5 veces mas que en una semana normal.",
    scenario: {
      demandVariationPct: 25,
      capacityReductionPct: 0,
      setupTimeIncreasePct: 0,
      stockoutCostMultiplier: 1.5,
      allowOvertime: true,
    },
  },
  {
    id: "restriccion",
    name: "Restriccion de capacidad",
    description:
      "Falta de personal y demoras de mantenimiento: 20% menos de capacidad, setups 30% mas largos y sin horas extra.",
    scenario: {
      demandVariationPct: 5,
      capacityReductionPct: 20,
      setupTimeIncreasePct: 30,
      stockoutCostMultiplier: 1,
      allowOvertime: false,
    },
  },
];

export function normalizeScenario(scenario: Scenario): Scenario {
  return {
    demandVariationPct: clamp(
      Math.round(scenario.demandVariationPct),
      SCENARIO_LIMITS.demandVariationPct.min,
      SCENARIO_LIMITS.demandVariationPct.max,
    ),
    capacityReductionPct: clamp(
      Math.round(scenario.capacityReductionPct),
      SCENARIO_LIMITS.capacityReductionPct.min,
      SCENARIO_LIMITS.capacityReductionPct.max,
    ),
    setupTimeIncreasePct: clamp(
      Math.round(scenario.setupTimeIncreasePct),
      SCENARIO_LIMITS.setupTimeIncreasePct.min,
      SCENARIO_LIMITS.setupTimeIncreasePct.max,
    ),
    stockoutCostMultiplier: clamp(
      Math.round(scenario.stockoutCostMultiplier * 100) / 100,
      SCENARIO_LIMITS.stockoutCostMultiplier.min,
      SCENARIO_LIMITS.stockoutCostMultiplier.max,
    ),
    allowOvertime: scenario.allowOvertime,
  };
}

export function matchPreset(scenario: Scenario): ScenarioPreset | undefined {
  return SCENARIO_PRESETS.find(
    (preset) =>
      preset.scenario.demandVariationPct === scenario.demandVariationPct &&
      preset.scenario.capacityReductionPct === scenario.capacityReductionPct &&
      preset.scenario.setupTimeIncreasePct === scenario.setupTimeIncreasePct &&
      preset.scenario.stockoutCostMultiplier === scenario.stockoutCostMultiplier &&
      preset.scenario.allowOvertime === scenario.allowOvertime,
  );
}
