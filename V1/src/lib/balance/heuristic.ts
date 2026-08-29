/**
 * Heuristica de balanceo por peso posicional (Ranked Positional Weight).
 *
 * Es una heuristica constructiva golosa: ordena las tareas por su peso
 * posicional y las va cargando en la estacion abierta mientras entren en el
 * limite de ciclo y sus predecesoras ya esten asignadas. No es un optimizador:
 * el resultado se presenta siempre como "balance recomendado por heuristica".
 */
import { assemblyLine, successorClosure } from "@/lib/data/assembly-line";
import type { AssemblyTask } from "@/lib/types";
import type { BalanceContext } from "./metrics";

const EPS = 1e-9;

export interface StationDraft {
  tasks: AssemblyTask[];
  loadSeconds: number;
}

/**
 * 1. Peso posicional = tiempo propio + tiempo de todas sus sucesoras
 * (directas e indirectas). Mide cuanto trabajo queda "colgando" de la tarea.
 */
export function positionalWeights(ctx: BalanceContext): Record<string, number> {
  const weights: Record<string, number> = {};
  for (const task of assemblyLine.tasks) {
    const successorTime = successorClosure[task.id].reduce(
      (acc, successorId) => acc + ctx.secondsOf(successorId),
      0,
    );
    weights[task.id] = ctx.secondsOf(task.id) + successorTime;
  }
  return weights;
}

/**
 * 2. Orden de prioridad: peso posicional descendente.
 * El desempate por codigo de tarea mantiene el resultado determinista.
 */
export function priorityOrder(ctx: BalanceContext): AssemblyTask[] {
  const weights = positionalWeights(ctx);
  return [...assemblyLine.tasks].sort(
    (a, b) => weights[b.id] - weights[a.id] || a.id.localeCompare(b.id),
  );
}

/**
 * 3 a 5. Asigna las tareas a estaciones respetando precedencias y el limite de
 * ciclo. Cada vez que coloca una tarea vuelve a recorrer la lista desde la de
 * mayor peso, porque esa asignacion pudo habilitar tareas antes bloqueadas.
 * Cuando ninguna tarea elegible entra en el remanente, abre una estacion nueva.
 */
export function assignStations(
  ctx: BalanceContext,
  cycleLimitSeconds: number,
  ordered: AssemblyTask[],
): StationDraft[] {
  // El limite nunca puede ser menor que la tarea mas larga: si lo fuera, esa
  // tarea no entraria en ninguna estacion y el bucle no terminaria.
  const limit = Math.max(cycleLimitSeconds, ctx.maxTaskSeconds);
  const assigned = new Set<string>();
  const stations: StationDraft[] = [];

  while (assigned.size < ordered.length) {
    const station: StationDraft = { tasks: [], loadSeconds: 0 };
    let placedSomething = true;

    while (placedSomething) {
      placedSomething = false;
      for (const task of ordered) {
        if (assigned.has(task.id)) continue;
        // Precedencia: todas las predecesoras deben estar ya asignadas, sea en
        // una estacion anterior o antes en esta misma estacion.
        if (!task.predecessorIds.every((id) => assigned.has(id))) continue;
        const seconds = ctx.secondsOf(task.id);
        if (station.loadSeconds + seconds > limit + EPS) continue;

        station.tasks.push(task);
        station.loadSeconds += seconds;
        assigned.add(task.id);
        placedSomething = true;
        break;
      }
    }

    if (station.tasks.length === 0) {
      throw new Error("No se pudo asignar ninguna tarea: limite de ciclo invalido");
    }
    stations.push(station);
  }

  return stations;
}

export interface RecommendedBalance {
  stations: StationDraft[];
  /** Limite de ciclo con el que se construyo la solucion entregada. */
  appliedCycleLimit: number;
  /** Estaciones que devolvio la primera pasada, con el takt como limite. */
  baselineStationCount: number;
  /** Estaciones objetivo tras aplicar (o no) la estacion adicional. */
  targetStationCount: number;
  smoothed: boolean;
}

/**
 * Construye el balance recomendado en dos pasadas.
 *
 * Pasada 1: se asigna con el takt time como limite de ciclo. Es la referencia
 * de cuantas estaciones hacen falta para sostener la demanda.
 *
 * Pasada 2 (suavizado): con esa cantidad de estaciones fija, se busca el menor
 * tiempo de ciclo entero que siga entrando en ellas. Reparte la carga, baja el
 * cuello de botella y sube la capacidad sin agregar personal. Si el escenario
 * habilita una estacion adicional, el objetivo pasa a ser una estacion mas, lo
 * que permite apuntar a un ciclo mas corto.
 */
export function buildRecommendedBalance(ctx: BalanceContext): RecommendedBalance {
  const ordered = priorityOrder(ctx);
  const baseLimit = Math.max(ctx.taktSeconds, ctx.maxTaskSeconds);
  const baseline = assignStations(ctx, baseLimit, ordered);
  const baselineCycle = Math.max(...baseline.map((station) => station.loadSeconds));
  const targetStationCount = baseline.length + (ctx.scenario.extraStation ? 1 : 0);

  const lowerBound = Math.max(
    Math.ceil(ctx.maxTaskSeconds),
    Math.ceil(ctx.totalWorkSeconds / targetStationCount),
  );
  const upperBound = Math.ceil(baselineCycle);

  for (let limit = lowerBound; limit < upperBound; limit += 1) {
    const candidate = assignStations(ctx, limit, ordered);
    if (candidate.length <= targetStationCount) {
      return {
        stations: candidate,
        appliedCycleLimit: limit,
        baselineStationCount: baseline.length,
        targetStationCount,
        smoothed: true,
      };
    }
  }

  return {
    stations: baseline,
    appliedCycleLimit: Math.round(baseLimit * 10) / 10,
    baselineStationCount: baseline.length,
    targetStationCount,
    smoothed: false,
  };
}

/** Distribucion inicial del caso: bloques por etapa, sin nivelar la carga. */
export function buildInitialStations(ctx: BalanceContext): StationDraft[] {
  const stations: StationDraft[] = Array.from(
    { length: assemblyLine.initialStationCount },
    () => ({ tasks: [], loadSeconds: 0 }),
  );

  for (const task of assemblyLine.tasks) {
    const station = stations[task.initialStationIndex];
    station.tasks.push(task);
    station.loadSeconds += ctx.secondsOf(task.id);
  }

  return stations.filter((station) => station.tasks.length > 0);
}
