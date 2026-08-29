import type { BalanceScenario, BalanceScenarioPreset } from "@/lib/types";
import { clamp } from "@/lib/utils";
import {
  BASE_SHIFT_COUNT,
  BASE_SHIFT_MINUTES,
} from "@/lib/data/line-config";

export const BALANCE_LIMITS = {
  demandVariationPct: { min: -20, max: 30, step: 5 },
  shiftMinutes: { min: 360, max: 480, step: 15 },
  taskTimeVariationPct: { min: -10, max: 20, step: 5 },
} as const;

export const SHIFT_COUNT_OPTIONS = [1, 2, 3] as const;

export const DEFAULT_BALANCE_SCENARIO: BalanceScenario = {
  demandVariationPct: 0,
  shiftMinutes: BASE_SHIFT_MINUTES,
  shiftCount: BASE_SHIFT_COUNT,
  extraStation: false,
  taskTimeVariationPct: 0,
};

export const BALANCE_PRESETS: BalanceScenarioPreset[] = [
  {
    id: "estable",
    name: "Operacion estable",
    description:
      "Programa normal: demanda de referencia, dos turnos completos y tiempos estandar sin desvio.",
    scenario: { ...DEFAULT_BALANCE_SCENARIO },
  },
  {
    id: "pico",
    name: "Pico de demanda",
    description:
      "Campana comercial: la demanda diaria sube 30% con el mismo tiempo disponible, por lo que el takt time se acorta.",
    scenario: {
      demandVariationPct: 30,
      shiftMinutes: BASE_SHIFT_MINUTES,
      shiftCount: BASE_SHIFT_COUNT,
      extraStation: false,
      taskTimeVariationPct: 0,
    },
  },
  {
    id: "restriccion",
    name: "Restriccion de capacidad",
    description:
      "Turnos acortados por mantenimiento y personal nuevo: 390 minutos utiles por turno, demanda 5% mayor y tiempos estandar 15% mas largos.",
    scenario: {
      demandVariationPct: 5,
      shiftMinutes: 390,
      shiftCount: BASE_SHIFT_COUNT,
      extraStation: false,
      taskTimeVariationPct: 15,
    },
  },
];

function snap(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export function normalizeBalanceScenario(scenario: BalanceScenario): BalanceScenario {
  return {
    demandVariationPct: clamp(
      snap(scenario.demandVariationPct, BALANCE_LIMITS.demandVariationPct.step),
      BALANCE_LIMITS.demandVariationPct.min,
      BALANCE_LIMITS.demandVariationPct.max,
    ),
    shiftMinutes: clamp(
      snap(scenario.shiftMinutes, BALANCE_LIMITS.shiftMinutes.step),
      BALANCE_LIMITS.shiftMinutes.min,
      BALANCE_LIMITS.shiftMinutes.max,
    ),
    shiftCount: clamp(Math.round(scenario.shiftCount), 1, 3),
    extraStation: scenario.extraStation,
    taskTimeVariationPct: clamp(
      snap(scenario.taskTimeVariationPct, BALANCE_LIMITS.taskTimeVariationPct.step),
      BALANCE_LIMITS.taskTimeVariationPct.min,
      BALANCE_LIMITS.taskTimeVariationPct.max,
    ),
  };
}

export function matchBalancePreset(scenario: BalanceScenario): BalanceScenarioPreset | undefined {
  return BALANCE_PRESETS.find(
    (preset) =>
      preset.scenario.demandVariationPct === scenario.demandVariationPct &&
      preset.scenario.shiftMinutes === scenario.shiftMinutes &&
      preset.scenario.shiftCount === scenario.shiftCount &&
      preset.scenario.extraStation === scenario.extraStation &&
      preset.scenario.taskTimeVariationPct === scenario.taskTimeVariationPct,
  );
}
