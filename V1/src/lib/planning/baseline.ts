import type { FamilyId, PlanRun, Product, ProductionPlan } from "@/lib/types";
import type { PlanningContext } from "./context";
import { assemblePlan, ceilToLot, floorToLot, pushOrMergeRun } from "./plan-utils";

/** Corrida minima para justificar un cambio de formato en el plan base. */
const MIN_RUN_MINUTES_AFTER_SETUP = 15;
/** Corrida minima util, igual que en el plan recomendado para comparar de igual a igual. */
const MIN_RUN_MINUTES = 10;

/**
 * PLAN BASE (referencia de comparacion).
 *
 * Reproduce una planificacion manual habitual en planta:
 *   - recorre los productos en orden comercial fijo (mayor volumen primero);
 *   - cubre unicamente la demanda del dia mas el stock de seguridad, sin mirar
 *     los dias siguientes;
 *   - produce siempre en la linea preferida del producto, sin balancear carga;
 *   - no evalua el costo del cambio de formato: si el orden comercial lo pide,
 *     cambia de familia (solo evita corridas menores a 15 minutos);
 *   - recurre a la hora extra cuando queda demanda del dia sin cubrir, sin
 *     comparar su costo contra el faltante que evita.
 *
 * Es deterministico: con el mismo escenario devuelve siempre el mismo plan.
 */
export function buildBaselinePlan(ctx: PlanningContext): ProductionPlan {
  const runs: PlanRun[] = [];
  const stock: Record<string, number> = { ...ctx.initialStock };
  const currentFamily: Record<string, FamilyId> = {};
  for (const line of ctx.lines) currentFamily[line.id] = line.initialFamilyId;

  const commercialOrder = [...ctx.products].sort((a, b) => a.commercialPriority - b.commercialPriority);
  const lineAssignments: Record<string, string> = Object.fromEntries(
    ctx.products.map((product) => [product.id, product.preferredLineId]),
  );

  for (const day of ctx.days) {
    const regularRemaining: Record<string, number> = {};
    const overtimeRemaining: Record<string, number> = {};
    const sequence: Record<string, number> = {};
    for (const line of ctx.lines) {
      regularRemaining[line.id] = ctx.regularCapacity[line.id][day.index];
      overtimeRemaining[line.id] = ctx.overtimeCapacity[line.id][day.index];
      sequence[line.id] = 0;
    }

    const schedule = (
      product: Product,
      neededUnits: number,
      budgetMinutes: number,
      reasonBuilder: (setup: number) => string,
      allowShortRun = false,
    ): boolean => {
      const lineId = product.preferredLineId;
      const unitsPerMinute = ctx.rate(lineId, product.id);
      if (unitsPerMinute <= 0) return false;

      const setup =
        currentFamily[lineId] === product.familyId
          ? 0
          : ctx.setupMinutes(lineId, currentFamily[lineId], product.familyId);
      const available = budgetMinutes - setup;
      if (available <= 0) return false;

      const desired = ceilToLot(neededUnits, product.lotSize);
      const feasible = floorToLot(available * unitsPerMinute, product.lotSize);
      const units = Math.min(desired, feasible);
      if (units <= 0) return false;

      const runMinutes = units / unitsPerMinute;
      // Unicas reglas de sentido comun del plan base: no cambiar de formato para
      // una corrida ridiculamente corta y no programar corridas testimoniales.
      if (setup > 0 && runMinutes < MIN_RUN_MINUTES_AFTER_SETUP) return false;
      if (!allowShortRun && runMinutes < MIN_RUN_MINUTES) return false;

      const created = pushOrMergeRun(runs, {
        dayIndex: day.index,
        lineId,
        productId: product.id,
        familyId: product.familyId,
        sequence: sequence[lineId],
        units,
        runMinutes,
        setupMinutes: setup,
        overtimeMinutes: 0,
        reason: reasonBuilder(setup),
      });
      if (created) sequence[lineId] += 1;

      const consumed = setup + runMinutes;
      const fromRegular = Math.min(regularRemaining[lineId], consumed);
      regularRemaining[lineId] -= fromRegular;
      overtimeRemaining[lineId] = Math.max(0, overtimeRemaining[lineId] - (consumed - fromRegular));
      currentFamily[lineId] = product.familyId;
      stock[product.id] += units;
      return true;
    };

    /* Pasada 1: programa el dia en jornada normal, en orden comercial. */
    for (const product of commercialOrder) {
      const demandToday = ctx.demand[product.id][day.index];
      const safetyTarget = product.safetyStockDays * ctx.averageDailyDemand[product.id];
      const need = demandToday + safetyTarget - stock[product.id];
      if (need < product.lotSize * 0.25) continue;
      schedule(product, need, regularRemaining[product.preferredLineId], (setup) =>
        setup > 0
          ? `Orden comercial #${product.commercialPriority}: se cambia formato a ${product.familyId} sin evaluar su costo.`
          : `Orden comercial #${product.commercialPriority}: cubre demanda del dia mas stock de seguridad.`,
      );
    }

    /* Pasada 2: si quedo demanda del dia sin cubrir, se recurre a hora extra. */
    for (const product of commercialOrder) {
      const shortage = ctx.demand[product.id][day.index] - stock[product.id];
      if (shortage <= 0) continue;
      const lineId = product.preferredLineId;
      if (overtimeRemaining[lineId] <= 0) continue;
      schedule(
        product,
        shortage,
        regularRemaining[lineId] + overtimeRemaining[lineId],
        () => `Hora extra para completar el programa del dia (sin analisis costo-beneficio).`,
        true,
      );
    }

    for (const product of ctx.products) {
      stock[product.id] = Math.max(0, stock[product.id] - ctx.demand[product.id][day.index]);
    }
  }

  return assemblePlan({
    id: "base",
    label: "Plan base",
    description:
      "Planificacion secuencial por orden comercial, sin agrupamiento de familias, sin balanceo de lineas y sin evaluacion economica de setups ni horas extra.",
    runs,
    lineAssignments,
    notes: [
      "Recorre los 18 productos en orden comercial fijo (mayor volumen proyectado primero).",
      "Cubre demanda del dia mas stock de seguridad; no mira los dias siguientes.",
      "Cada producto se fabrica siempre en su linea preferida, sin balanceo de carga.",
      "Solo evita cambios de formato cuando la corrida resultante seria menor a 15 minutos.",
      "Usa hora extra cuando queda demanda del dia sin cubrir, sin compararla con el faltante que evita.",
    ],
    ctx,
  });
}
