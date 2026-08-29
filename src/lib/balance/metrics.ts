/**
 * Formulas del modulo de balanceo de linea.
 *
 * Cada funcion implementa uno de los calculos declarados en la metodologia y se
 * reutiliza tal cual para la distribucion inicial y para el balance recomendado,
 * de modo que la comparacion entre ambos use exactamente el mismo modelo.
 */
import { assemblyLine } from "@/lib/data/assembly-line";
import type {
  AssemblyTask,
  BalanceCost,
  BalanceLayout,
  BalanceLayoutId,
  BalanceMetrics,
  BalanceScenario,
  BalanceStation,
  StationTask,
} from "@/lib/types";

/** Redondeo a decima de segundo, estable frente a errores de punto flotante. */
export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Contexto derivado del escenario: entra a todos los calculos posteriores. */
export interface BalanceContext {
  scenario: BalanceScenario;
  tasks: AssemblyTask[];
  /** Tiempo estandar de la tarea con la variacion del escenario aplicada. */
  secondsOf: (taskId: string) => number;
  availableSeconds: number;
  dailyDemandUnits: number;
  taktSeconds: number;
  totalWorkSeconds: number;
  maxTaskSeconds: number;
  theoreticalMinStations: number;
  stationCostPerHour: number;
  unmetUnitCost: number;
}

/** 1. Tiempo disponible diario = minutos por turno x 60 x cantidad de turnos. */
export function dailyAvailableSeconds(shiftMinutes: number, shiftCount: number): number {
  return shiftMinutes * 60 * shiftCount;
}

/** 2. Takt time = tiempo disponible diario / demanda diaria. */
export function taktTime(availableSeconds: number, dailyDemandUnits: number): number {
  if (dailyDemandUnits <= 0) return availableSeconds;
  return availableSeconds / dailyDemandUnits;
}

/** 4. Numero teorico minimo de estaciones = techo(contenido de trabajo / takt). */
export function theoreticalStations(totalWorkSeconds: number, taktSeconds: number): number {
  if (taktSeconds <= 0) return 1;
  return Math.max(1, Math.ceil(totalWorkSeconds / taktSeconds - 1e-9));
}

/** 6. Capacidad diaria = tiempo disponible diario / tiempo de ciclo. */
export function dailyCapacity(availableSeconds: number, cycleSeconds: number): number {
  if (cycleSeconds <= 0) return 0;
  return Math.floor(availableSeconds / cycleSeconds);
}

/** 7. Eficiencia de linea = contenido de trabajo / (estaciones x tiempo de ciclo). */
export function lineEfficiency(
  totalWorkSeconds: number,
  stationCount: number,
  cycleSeconds: number,
): number {
  const denominator = stationCount * cycleSeconds;
  if (denominator <= 0) return 0;
  return totalWorkSeconds / denominator;
}

export function buildBalanceContext(scenario: BalanceScenario): BalanceContext {
  const timeFactor = 1 + scenario.taskTimeVariationPct / 100;
  // Se redondea a decima de segundo: mantiene el calculo determinista y evita
  // arrastrar decimales largos a las tablas y a los graficos.
  const seconds: Record<string, number> = Object.fromEntries(
    assemblyLine.tasks.map((task) => [task.id, round1(task.standardSeconds * timeFactor)]),
  );

  const availableSeconds = dailyAvailableSeconds(scenario.shiftMinutes, scenario.shiftCount);
  const dailyDemandUnits = Math.round(
    assemblyLine.baseDailyDemandUnits * (1 + scenario.demandVariationPct / 100),
  );
  const totalWorkSeconds = round1(
    assemblyLine.tasks.reduce((acc, task) => acc + seconds[task.id], 0),
  );
  const maxTaskSeconds = Math.max(...assemblyLine.tasks.map((task) => seconds[task.id]));
  const taktSeconds = taktTime(availableSeconds, dailyDemandUnits);

  return {
    scenario,
    tasks: assemblyLine.tasks,
    secondsOf: (taskId: string) => seconds[taskId],
    availableSeconds,
    dailyDemandUnits,
    taktSeconds,
    totalWorkSeconds,
    maxTaskSeconds,
    theoreticalMinStations: theoreticalStations(totalWorkSeconds, taktSeconds),
    stationCostPerHour: assemblyLine.stationCostPerHour,
    unmetUnitCost: assemblyLine.unmetUnitCost,
  };
}

/**
 * Costo economico estimado del escenario.
 *
 * El total suma unicamente dos conceptos: las estaciones que hay que pagar todo
 * el dia y las unidades de demanda que la linea no llega a producir. El costo
 * del tiempo ocioso NO se suma aparte: es la porcion del costo de estaciones que
 * se paga sin agregar valor, y se informa como indicador para no contar dos
 * veces el mismo peso.
 */
export function evaluateCost(metrics: BalanceMetrics, ctx: BalanceContext): BalanceCost {
  const stationHours = (metrics.stationCount * ctx.availableSeconds) / 3600;
  const stationCost = stationHours * ctx.stationCostPerHour;
  const idleCost = stationCost * metrics.balanceLoss;
  const unmetCost = metrics.unmetUnits * ctx.unmetUnitCost;
  const total = stationCost + unmetCost;

  return {
    stationCost,
    idleCost,
    productiveCost: stationCost - idleCost,
    unmetCost,
    total,
    costPerDeliveredUnit: metrics.deliveredUnits > 0 ? total / metrics.deliveredUnits : 0,
  };
}

/** Aplica los calculos 3, 5, 6, 7, 8, 9 y 10 sobre una asignacion concreta. */
export function evaluateStations(
  stations: Array<{ tasks: AssemblyTask[]; loadSeconds: number }>,
  ctx: BalanceContext,
): { stations: BalanceStation[]; metrics: BalanceMetrics } {
  const cycleSeconds = round1(Math.max(...stations.map((station) => station.loadSeconds)));
  const stationCount = stations.length;
  const efficiency = lineEfficiency(ctx.totalWorkSeconds, stationCount, cycleSeconds);
  const capacityUnits = dailyCapacity(ctx.availableSeconds, cycleSeconds);
  const deliveredUnits = Math.min(capacityUnits, ctx.dailyDemandUnits);

  // El cuello de botella es la estacion de mayor carga; ante empate gana la
  // primera del recorrido, que es la que fija el ritmo aguas abajo.
  let bottleneckIndex = 0;
  for (let i = 1; i < stations.length; i += 1) {
    if (stations[i].loadSeconds > stations[bottleneckIndex].loadSeconds + 1e-9) bottleneckIndex = i;
  }

  const detailed: BalanceStation[] = stations.map((station, index) => {
    const tasks: StationTask[] = station.tasks.map((task) => ({
      taskId: task.id,
      code: task.code,
      name: task.name,
      stageId: task.stageId,
      seconds: ctx.secondsOf(task.id),
    }));
    return {
      index: index + 1,
      label: `Estacion ${index + 1}`,
      tasks,
      loadSeconds: round1(station.loadSeconds),
      idleSeconds: round1(cycleSeconds - station.loadSeconds),
      taktRatio: ctx.taktSeconds > 0 ? station.loadSeconds / ctx.taktSeconds : 0,
      isBottleneck: index === bottleneckIndex,
    };
  });

  const metrics: BalanceMetrics = {
    stationCount,
    cycleSeconds,
    totalWorkSeconds: ctx.totalWorkSeconds,
    taktSeconds: ctx.taktSeconds,
    availableSeconds: ctx.availableSeconds,
    dailyDemandUnits: ctx.dailyDemandUnits,
    theoreticalMinStations: ctx.theoreticalMinStations,
    dailyCapacityUnits: capacityUnits,
    lineEfficiency: efficiency,
    balanceLoss: 1 - efficiency,
    idleSecondsPerCycle: round1(stationCount * cycleSeconds - ctx.totalWorkSeconds),
    capacityGapUnits: capacityUnits - ctx.dailyDemandUnits,
    deliveredUnits,
    unmetUnits: Math.max(0, ctx.dailyDemandUnits - capacityUnits),
    bottleneckStationIndex: bottleneckIndex + 1,
  };

  return { stations: detailed, metrics };
}

export function buildLayout(
  id: BalanceLayoutId,
  label: string,
  description: string,
  stations: Array<{ tasks: AssemblyTask[]; loadSeconds: number }>,
  notes: string[],
  ctx: BalanceContext,
): BalanceLayout {
  const evaluated = evaluateStations(stations, ctx);
  return {
    id,
    label,
    description,
    stations: evaluated.stations,
    metrics: evaluated.metrics,
    cost: evaluateCost(evaluated.metrics, ctx),
    notes,
  };
}
