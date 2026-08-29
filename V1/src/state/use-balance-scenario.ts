"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BALANCE_PRESETS, DEFAULT_BALANCE_SCENARIO, matchBalancePreset, runBalance } from "@/lib/balance";
import type { BalanceResult, BalanceScenario } from "@/lib/types";

export const CUSTOM_BALANCE_PRESET_ID = "personalizado";

interface BalanceComputation {
  version: number;
  ms: number;
}

export interface BalanceScenarioState {
  scenario: BalanceScenario;
  result: BalanceResult;
  presetId: string;
  computation: BalanceComputation | null;
  updateScenario: (patch: Partial<BalanceScenario>) => void;
  applyPreset: (presetId: string) => void;
  recalculate: () => void;
  reset: () => void;
}

/**
 * Estado del escenario de balanceo.
 *
 * El calculo es una funcion pura y determinista, asi que vive en un useMemo: el
 * mismo escenario produce el mismo balance en el servidor y en el navegador. El
 * detalle de tiempos se publica despues del montaje porque depende del reloj de
 * la maquina y no debe formar parte del HTML renderizado en el servidor.
 */
export function useBalanceScenario(): BalanceScenarioState {
  const [scenario, setScenario] = useState<BalanceScenario>(DEFAULT_BALANCE_SCENARIO);
  const [version, setVersion] = useState(0);
  const [computation, setComputation] = useState<BalanceComputation | null>(null);

  const result = useMemo(() => runBalance(scenario, { force: version > 0 }), [scenario, version]);

  useEffect(() => {
    setComputation({ version, ms: result.computedInMs });
  }, [result, version]);

  const updateScenario = useCallback((patch: Partial<BalanceScenario>) => {
    setScenario((current) => ({ ...current, ...patch }));
  }, []);

  const applyPreset = useCallback((presetId: string) => {
    const preset = BALANCE_PRESETS.find((item) => item.id === presetId);
    if (preset) setScenario({ ...preset.scenario });
  }, []);

  const recalculate = useCallback(() => setVersion((current) => current + 1), []);

  const reset = useCallback(() => setScenario({ ...DEFAULT_BALANCE_SCENARIO }), []);

  return {
    scenario,
    result,
    presetId: matchBalancePreset(scenario)?.id ?? CUSTOM_BALANCE_PRESET_ID,
    computation,
    updateScenario,
    applyPreset,
    recalculate,
    reset,
  };
}
