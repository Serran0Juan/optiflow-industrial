/**
 * Caso de linea de ensamble listo para consumir, con sus indices derivados.
 *
 * El dataset se valida al construirse: si una precedencia apunta a una tarea
 * inexistente, si hay un ciclo o si la asignacion inicial rompe una precedencia,
 * el modulo falla en build en lugar de producir un balance invalido.
 */
import {
  BASE_DAILY_DEMAND_UNITS,
  BASE_SHIFT_COUNT,
  BASE_SHIFT_MINUTES,
  INITIAL_STATION_COUNT,
  LINE_CASE_ID,
  LINE_CASE_NAME,
  LINE_CASE_PRODUCT,
  STAGES,
  STATION_COST_PER_HOUR,
  TASK_SEEDS,
  UNMET_UNIT_COST,
} from "./line-config";
import type { AssemblyLineCase, AssemblyTask, StageId, TaskStage } from "@/lib/types";

function buildCase(): AssemblyLineCase {
  const ids = new Set(TASK_SEEDS.map((task) => task.id));

  for (const task of TASK_SEEDS) {
    for (const predecessorId of task.predecessorIds) {
      if (!ids.has(predecessorId)) {
        throw new Error(`Precedencia inexistente: ${task.id} depende de ${predecessorId}`);
      }
    }
    if (task.standardSeconds <= 0) {
      throw new Error(`Tiempo estandar invalido en ${task.id}`);
    }
  }

  // Orden topologico por conteo de predecesoras (Kahn): detecta ciclos.
  const pending = new Map(TASK_SEEDS.map((task) => [task.id, task.predecessorIds.length]));
  const successors = new Map<string, string[]>(TASK_SEEDS.map((task) => [task.id, []]));
  for (const task of TASK_SEEDS) {
    for (const predecessorId of task.predecessorIds) {
      successors.get(predecessorId)!.push(task.id);
    }
  }
  const queue = TASK_SEEDS.filter((task) => task.predecessorIds.length === 0).map((task) => task.id);
  let visited = 0;
  while (queue.length > 0) {
    const current = queue.shift()!;
    visited += 1;
    for (const next of successors.get(current)!) {
      const remaining = pending.get(next)! - 1;
      pending.set(next, remaining);
      if (remaining === 0) queue.push(next);
    }
  }
  if (visited !== TASK_SEEDS.length) {
    throw new Error("El grafo de precedencias contiene un ciclo");
  }

  const stationOf = new Map(TASK_SEEDS.map((task) => [task.id, task.initialStationIndex]));
  for (const task of TASK_SEEDS) {
    for (const predecessorId of task.predecessorIds) {
      if (stationOf.get(predecessorId)! > task.initialStationIndex) {
        throw new Error(
          `La asignacion inicial rompe la precedencia ${predecessorId} -> ${task.id}`,
        );
      }
    }
  }

  return {
    id: LINE_CASE_ID,
    name: LINE_CASE_NAME,
    description:
      "Linea sincronica de 16 tareas repartidas en preparacion, ensamble, llenado, control de calidad y embalaje.",
    product: LINE_CASE_PRODUCT,
    stages: STAGES,
    tasks: TASK_SEEDS,
    initialStationCount: INITIAL_STATION_COUNT,
    baseDailyDemandUnits: BASE_DAILY_DEMAND_UNITS,
    baseShiftMinutes: BASE_SHIFT_MINUTES,
    baseShiftCount: BASE_SHIFT_COUNT,
    stationCostPerHour: STATION_COST_PER_HOUR,
    unmetUnitCost: UNMET_UNIT_COST,
  };
}

export const assemblyLine: AssemblyLineCase = buildCase();

export const tasksById: Record<string, AssemblyTask> = Object.fromEntries(
  assemblyLine.tasks.map((task) => [task.id, task]),
);

export const stagesById: Record<StageId, TaskStage> = Object.fromEntries(
  assemblyLine.stages.map((stage) => [stage.id, stage]),
) as Record<StageId, TaskStage>;

/** Sucesoras directas de cada tarea. */
export const directSuccessors: Record<string, string[]> = (() => {
  const map: Record<string, string[]> = Object.fromEntries(
    assemblyLine.tasks.map((task) => [task.id, [] as string[]]),
  );
  for (const task of assemblyLine.tasks) {
    for (const predecessorId of task.predecessorIds) {
      map[predecessorId].push(task.id);
    }
  }
  return map;
})();

/**
 * Cierre transitivo de sucesoras: todas las tareas que dependen, directa o
 * indirectamente, de cada tarea. Es la base del peso posicional.
 */
export const successorClosure: Record<string, string[]> = (() => {
  const cache: Record<string, Set<string>> = {};

  function resolve(taskId: string): Set<string> {
    const cached = cache[taskId];
    if (cached) return cached;
    const result = new Set<string>();
    cache[taskId] = result;
    for (const successorId of directSuccessors[taskId]) {
      result.add(successorId);
      for (const deep of resolve(successorId)) result.add(deep);
    }
    return result;
  }

  return Object.fromEntries(
    assemblyLine.tasks.map((task) => [task.id, [...resolve(task.id)].sort()]),
  );
})();

export const PRECEDENCE_COUNT = assemblyLine.tasks.reduce(
  (acc, task) => acc + task.predecessorIds.length,
  0,
);
