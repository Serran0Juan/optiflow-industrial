import type { PlanningResult, Scenario } from "@/lib/types";
import { buildPlanningContext } from "./context";
import { buildBaselinePlan } from "./baseline";
import { comparePlans, evaluatePlan } from "./evaluate";
import { buildRecommendedPlan } from "./heuristic";
import { buildAlerts, buildDecisionSummary, buildMaterialCoverage } from "./insights";
import { normalizeScenario } from "./scenarios";

export type { PlanningContext } from "./context";
export { buildPlanningContext } from "./context";
export { SCENARIO_PRESETS, DEFAULT_SCENARIO, SCENARIO_LIMITS, matchPreset, normalizeScenario } from "./scenarios";
export { baseForecast } from "./forecast";

const cache = new Map<string, PlanningResult>();
const CACHE_LIMIT = 40;

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

/**
 * Ejecuta el ciclo completo de planificacion para un escenario:
 * contexto -> plan base -> plan recomendado -> evaluacion economica ->
 * comparacion -> abastecimiento -> alertas -> resumen de decisiones.
 *
 * Es una funcion pura y determinista: el mismo escenario devuelve siempre el
 * mismo resultado, por eso puede cachearse sin riesgo.
 */
export function runPlanning(scenario: Scenario, options: { force?: boolean } = {}): PlanningResult {
  const normalized = normalizeScenario(scenario);
  const key = JSON.stringify(normalized);
  if (!options.force) {
    const cached = cache.get(key);
    if (cached) return cached;
  }

  const started = now();
  const ctx = buildPlanningContext(normalized);
  const basePlan = buildBaselinePlan(ctx);
  const recommendedPlan = buildRecommendedPlan(ctx);
  const baseEvaluation = evaluatePlan(basePlan, ctx);
  const recommendedEvaluation = evaluatePlan(recommendedPlan, ctx);
  const comparison = comparePlans(baseEvaluation, recommendedEvaluation);
  const materials = buildMaterialCoverage(recommendedPlan, ctx);
  const alerts = buildAlerts(recommendedEvaluation, materials, ctx);
  const decisions = buildDecisionSummary(comparison, recommendedPlan, ctx);

  const result: PlanningResult = {
    scenario: normalized,
    days: ctx.days,
    forecast: ctx.demand,
    base: basePlan,
    recommended: recommendedPlan,
    comparison,
    alerts,
    decisions,
    materials,
    computedInMs: now() - started,
  };

  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(key, result);
  return result;
}
