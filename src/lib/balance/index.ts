/**
 * Punto de entrada del modulo de balanceo de linea.
 *
 * `runBalance` es una funcion pura: dado un escenario devuelve siempre el mismo
 * resultado, en el servidor y en el navegador. El cache evita recalcular al
 * navegar entre secciones; `force` lo saltea cuando el usuario pide recalcular.
 */
import { assemblyLine } from "@/lib/data/assembly-line";
import type { BalanceComparison, BalanceResult, BalanceScenario, BalanceTaskRow } from "@/lib/types";
import { buildRecommendedBalance, buildInitialStations, positionalWeights } from "./heuristic";
import { buildBalanceInsights } from "./insights";
import { buildBalanceContext, buildLayout, round1 } from "./metrics";
import { normalizeBalanceScenario } from "./scenarios";

export * from "./metrics";
export * from "./heuristic";
export * from "./scenarios";
export { buildBalanceInsights } from "./insights";

const CACHE_LIMIT = 40;
const cache = new Map<string, BalanceResult>();

function stationIndexOf(
  stations: Array<{ tasks: Array<{ id: string }> }>,
  taskId: string,
): number {
  for (let i = 0; i < stations.length; i += 1) {
    if (stations[i].tasks.some((task) => task.id === taskId)) return i + 1;
  }
  return 0;
}

export function runBalance(
  scenario: BalanceScenario,
  options: { force?: boolean } = {},
): BalanceResult {
  const normalized = normalizeBalanceScenario(scenario);
  const key = JSON.stringify(normalized);
  if (!options.force) {
    const cached = cache.get(key);
    if (cached) return cached;
  }

  const startedAt = Date.now();
  const ctx = buildBalanceContext(normalized);

  const initialStations = buildInitialStations(ctx);
  const initial = buildLayout(
    "inicial",
    "Distribucion inicial",
    "Asignacion historica de la planta: las tareas se agrupan por etapa del proceso, en el orden en que ocurren, sin nivelar la carga entre puestos.",
    initialStations,
    [
      `Reparte las ${assemblyLine.tasks.length} tareas en ${initialStations.length} estaciones siguiendo los bloques de etapa definidos en el caso.`,
      "Respeta las precedencias, pero no compara la carga de cada estacion contra el takt time.",
      "Se mantiene fija en todos los escenarios: es el punto de comparacion del modulo.",
    ],
    ctx,
  );

  const recommended = buildRecommendedBalance(ctx);
  const recommendedNotes = [
    "Prioriza las tareas por peso posicional: tiempo propio mas el de todas sus sucesoras.",
    `Respeta las ${assemblyLine.tasks.reduce((acc, task) => acc + task.predecessorIds.length, 0)} relaciones de precedencia: ninguna tarea se asigna antes que sus predecesoras.`,
    `Primera pasada con el takt time como limite de ciclo (${round1(ctx.taktSeconds)} s): ${recommended.baselineStationCount} estaciones.`,
  ];
  if (recommended.smoothed) {
    recommendedNotes.push(
      `Pasada de suavizado: se busco el menor tiempo de ciclo que sigue entrando en ${recommended.targetStationCount} estaciones y se aplico un limite de ${recommended.appliedCycleLimit} s.`,
    );
  } else {
    recommendedNotes.push(
      "La pasada de suavizado no encontro un ciclo mas corto que entre en la misma cantidad de estaciones: se conserva el resultado de la primera pasada.",
    );
  }
  if (normalized.extraStation) {
    recommendedNotes.push(
      `Estacion adicional habilitada: el objetivo paso a ${recommended.targetStationCount} estaciones para acortar el tiempo de ciclo.`,
    );
  }
  recommendedNotes.push(
    "Es una recomendacion heuristica, no un optimo matematico garantizado.",
  );

  const recommendedLayout = buildLayout(
    "recomendado",
    "Balance recomendado",
    "Asignacion construida con la regla del peso posicional (RPW) respetando todas las precedencias y el takt time del escenario.",
    recommended.stations,
    recommendedNotes,
    ctx,
  );

  const weights = positionalWeights(ctx);
  const taskRows: BalanceTaskRow[] = assemblyLine.tasks.map((task) => ({
    task,
    seconds: ctx.secondsOf(task.id),
    positionalWeight: round1(weights[task.id]),
    initialStation: task.initialStationIndex + 1,
    recommendedStation: stationIndexOf(recommended.stations, task.id),
  }));

  const costDelta = initial.cost.total - recommendedLayout.cost.total;
  const comparison: BalanceComparison = {
    initial,
    recommended: recommendedLayout,
    costDelta,
    costDeltaPct: initial.cost.total > 0 ? (costDelta / initial.cost.total) * 100 : 0,
    improves: costDelta > 0,
    efficiencyDeltaPoints:
      (recommendedLayout.metrics.lineEfficiency - initial.metrics.lineEfficiency) * 100,
    cycleDeltaSeconds: round1(
      recommendedLayout.metrics.cycleSeconds - initial.metrics.cycleSeconds,
    ),
    capacityDeltaUnits:
      recommendedLayout.metrics.dailyCapacityUnits - initial.metrics.dailyCapacityUnits,
    stationDelta: recommendedLayout.metrics.stationCount - initial.metrics.stationCount,
    unmetDeltaUnits: recommendedLayout.metrics.unmetUnits - initial.metrics.unmetUnits,
  };

  const result: BalanceResult = {
    scenario: normalized,
    taskRows,
    comparison,
    insights: buildBalanceInsights(comparison, ctx),
    computedInMs: Date.now() - startedAt,
  };

  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(key, result);
  return result;
}
