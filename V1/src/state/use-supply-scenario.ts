"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_SUPPLY_SCENARIO,
  matchSupplyPreset,
  runSupply,
  SUPPLY_PRESETS,
} from "@/lib/supply";
import type { SupplyResult, SupplyScenario } from "@/lib/types";

export const CUSTOM_SUPPLY_PRESET_ID = "personalizado";

interface SupplyComputation {
  version: number;
  ms: number;
}

export interface SupplyScenarioState {
  scenario: SupplyScenario;
  result: SupplyResult;
  presetId: string;
  computation: SupplyComputation | null;
  updateScenario: (patch: Partial<SupplyScenario>) => void;
  applyPreset: (presetId: string) => void;
  recalculate: () => void;
  reset: () => void;
}

/**
 * Estado del escenario de la Torre de abastecimiento.
 *
 * Se mantiene local al modulo, igual que el del balanceo de linea, para no
 * acoplar la decision de compra al simulador global del planificador: sus
 * variables (capacidad de linea, setups, multiplicador de faltante) no
 * intervienen en el calculo de cobertura ni en el punto de pedido. La demanda si
 * se comparte: el consumo de materia prima deriva del mismo pronostico base.
 *
 * El calculo es una funcion pura, asi que vive en un useMemo: el mismo escenario
 * produce el mismo resultado en el servidor y en el navegador. El detalle de
 * tiempos se publica despues del montaje porque depende del reloj de la maquina.
 */
export function useSupplyScenario(): SupplyScenarioState {
  const [scenario, setScenario] = useState<SupplyScenario>(DEFAULT_SUPPLY_SCENARIO);
  const [version, setVersion] = useState(0);
  const [computation, setComputation] = useState<SupplyComputation | null>(null);

  const result = useMemo(() => runSupply(scenario, { force: version > 0 }), [scenario, version]);

  useEffect(() => {
    setComputation({ version, ms: result.computedInMs });
  }, [result, version]);

  const updateScenario = useCallback((patch: Partial<SupplyScenario>) => {
    setScenario((current) => ({ ...current, ...patch }));
  }, []);

  const applyPreset = useCallback((presetId: string) => {
    const preset = SUPPLY_PRESETS.find((item) => item.id === presetId);
    if (preset) setScenario({ ...preset.scenario });
  }, []);

  const recalculate = useCallback(() => setVersion((current) => current + 1), []);

  const reset = useCallback(() => setScenario({ ...DEFAULT_SUPPLY_SCENARIO }), []);

  return {
    scenario,
    result,
    presetId: matchSupplyPreset(scenario)?.id ?? CUSTOM_SUPPLY_PRESET_ID,
    computation,
    updateScenario,
    applyPreset,
    recalculate,
    reset,
  };
}
