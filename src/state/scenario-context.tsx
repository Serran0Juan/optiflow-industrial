"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_SCENARIO, matchPreset, runPlanning, SCENARIO_PRESETS } from "@/lib/planning";
import type { PlanningResult, Scenario } from "@/lib/types";

export const CUSTOM_PRESET_ID = "personalizado";

interface ComputationInfo {
  version: number;
  ms: number;
  runs: number;
}

interface ScenarioContextValue {
  scenario: Scenario;
  result: PlanningResult;
  presetId: string;
  version: number;
  computation: ComputationInfo | null;
  updateScenario: (patch: Partial<Scenario>) => void;
  applyPreset: (presetId: string) => void;
  recalculate: () => void;
  reset: () => void;
}

const ScenarioContext = createContext<ScenarioContextValue | null>(null);

/**
 * Estado global del escenario activo.
 *
 * La planificacion es una funcion pura y determinista, asi que se recalcula en
 * un useMemo: no hace falta ningun servicio externo ni estado asincrono. El
 * mismo escenario produce el mismo plan en el servidor y en el cliente.
 */
export function ScenarioProvider({ children }: { children: ReactNode }) {
  const [scenario, setScenario] = useState<Scenario>(DEFAULT_SCENARIO);
  const [version, setVersion] = useState(0);
  const [computation, setComputation] = useState<ComputationInfo | null>(null);

  const result = useMemo(
    () => runPlanning(scenario, { force: version > 0 }),
    [scenario, version],
  );

  // El detalle del calculo se publica despues del montaje: depende del reloj de
  // la maquina y no debe formar parte del HTML renderizado en el servidor.
  useEffect(() => {
    setComputation({ version, ms: result.computedInMs, runs: result.recommended.runs.length });
  }, [result, version]);

  const updateScenario = useCallback((patch: Partial<Scenario>) => {
    setScenario((current) => ({ ...current, ...patch }));
  }, []);

  const applyPreset = useCallback((presetId: string) => {
    const preset = SCENARIO_PRESETS.find((item) => item.id === presetId);
    if (preset) setScenario({ ...preset.scenario });
  }, []);

  const recalculate = useCallback(() => setVersion((current) => current + 1), []);

  const reset = useCallback(() => setScenario({ ...DEFAULT_SCENARIO }), []);

  const value = useMemo<ScenarioContextValue>(
    () => ({
      scenario,
      result,
      presetId: matchPreset(scenario)?.id ?? CUSTOM_PRESET_ID,
      version,
      computation,
      updateScenario,
      applyPreset,
      recalculate,
      reset,
    }),
    [scenario, result, version, computation, updateScenario, applyPreset, recalculate, reset],
  );

  return <ScenarioContext.Provider value={value}>{children}</ScenarioContext.Provider>;
}

export function useScenario(): ScenarioContextValue {
  const context = useContext(ScenarioContext);
  if (!context) throw new Error("useScenario debe usarse dentro de ScenarioProvider");
  return context;
}
