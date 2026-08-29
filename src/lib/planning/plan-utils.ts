import type { FamilyId, PlanId, PlanLineDay, PlanRun, ProductionPlan } from "@/lib/types";
import type { PlanningContext } from "./context";

interface AssembleParams {
  id: PlanId;
  label: string;
  description: string;
  runs: PlanRun[];
  lineAssignments: Record<string, string>;
  notes: string[];
  ctx: PlanningContext;
}

/**
 * Convierte una lista plana de corridas en un plan consolidado por linea y dia.
 *
 * El reparto entre jornada normal y hora extra se hace aca, en un unico lugar:
 * los minutos que exceden la capacidad regular de esa linea-dia se imputan como
 * hora extra en el orden en que fueron programados.
 */
export function assemblePlan({
  id,
  label,
  description,
  runs,
  lineAssignments,
  notes,
  ctx,
}: AssembleParams): ProductionPlan {
  const lineDays: PlanLineDay[] = [];
  const carriedFamily: Record<string, FamilyId> = {};
  for (const line of ctx.lines) carriedFamily[line.id] = line.initialFamilyId;

  for (const day of ctx.days) {
    for (const line of ctx.lines) {
      const dayRuns = runs
        .filter((run) => run.lineId === line.id && run.dayIndex === day.index)
        .sort((a, b) => a.sequence - b.sequence);

      const capacity = ctx.regularCapacity[line.id][day.index];
      let cumulative = 0;
      let runMinutes = 0;
      let setupMinutes = 0;
      let setupCount = 0;

      for (const run of dayRuns) {
        const total = run.setupMinutes + run.runMinutes;
        const overtimeStart = Math.max(cumulative, capacity);
        const overtimeEnd = Math.max(cumulative + total, capacity);
        run.overtimeMinutes = Math.max(0, overtimeEnd - overtimeStart);
        cumulative += total;
        runMinutes += run.runMinutes;
        setupMinutes += run.setupMinutes;
        if (run.setupMinutes > 0) setupCount += 1;
      }

      const usedMinutes = runMinutes + setupMinutes;
      lineDays.push({
        dayIndex: day.index,
        lineId: line.id,
        runs: dayRuns,
        runMinutes,
        setupMinutes,
        usedMinutes,
        regularCapacityMinutes: capacity,
        overtimeMinutes: Math.max(0, usedMinutes - capacity),
        setupCount,
        utilization: capacity > 0 ? Math.min(usedMinutes, capacity) / capacity : 0,
        openingFamilyId: carriedFamily[line.id],
      });

      const lastRun = dayRuns[dayRuns.length - 1];
      if (lastRun) carriedFamily[line.id] = lastRun.familyId;
    }
  }

  return { id, label, description, runs, lineDays, lineAssignments, notes };
}

/**
 * Agrega una corrida al plan consolidando con una corrida previa del mismo
 * producto en la misma linea y dia.
 *
 * Es una decision de modelado: dentro de una familia el cambio menor ya esta
 * contemplado en la parada planificada, asi que producir mas unidades del mismo
 * producto en el mismo dia es alargar la corrida, no abrir una nueva. Los
 * minutos y las unidades totales no cambian; solo se evita mostrar dos entradas
 * separadas para lo que en planta es una sola corrida.
 *
 * Devuelve true si se creo una corrida nueva (y por lo tanto avanza la secuencia).
 */
export function pushOrMergeRun(runs: PlanRun[], candidate: PlanRun): boolean {
  if (candidate.setupMinutes === 0) {
    const existing = runs.find(
      (run) =>
        run.dayIndex === candidate.dayIndex &&
        run.lineId === candidate.lineId &&
        run.productId === candidate.productId,
    );
    if (existing) {
      existing.units += candidate.units;
      existing.runMinutes += candidate.runMinutes;
      if (!existing.reason.includes(candidate.reason)) {
        existing.reason = `${existing.reason} ${candidate.reason}`;
      }
      return false;
    }
  }
  runs.push(candidate);
  return true;
}

/** Redondea hacia arriba al multiplo de lote. */
export function ceilToLot(units: number, lotSize: number): number {
  if (units <= 0) return 0;
  return Math.ceil(units / lotSize) * lotSize;
}

/** Redondea hacia abajo al multiplo de lote. */
export function floorToLot(units: number, lotSize: number): number {
  if (units <= 0) return 0;
  return Math.floor(units / lotSize) * lotSize;
}

/** Demanda acumulada de un producto entre dos dias del horizonte (inclusive). */
export function cumulativeDemand(
  ctx: PlanningContext,
  productId: string,
  fromDay: number,
  toDay: number,
): number {
  const series = ctx.demand[productId];
  let total = 0;
  for (let day = fromDay; day <= Math.min(toDay, series.length - 1); day += 1) {
    total += series[day];
  }
  return total;
}
