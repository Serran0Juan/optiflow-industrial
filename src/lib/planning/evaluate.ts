import type {
  CostBreakdown,
  DayResult,
  LineResult,
  PlanEvaluation,
  PlanComparison,
  ProductDayResult,
  ProductionPlan,
} from "@/lib/types";
import type { PlanningContext } from "./context";

/**
 * MODELO ECONOMICO
 *
 *   costo_setup     = SUM(minutos_setup / 60) x costo_horario_setup(linea)
 *   costo_hora_extra= SUM(minutos_hora_extra / 60) x costo_hora_extra(linea)
 *   costo_inventario= SUM(stock_final(producto, dia) x costo_mantener(producto))
 *   costo_faltante  = SUM(unidades_no_atendidas x costo_faltante(producto))
 *   costo_total     = suma de los cuatro componentes
 *
 * Secuencia diaria supuesta: la produccion del dia queda disponible el mismo dia
 * y la demanda se atiende al cierre. La demanda no atendida se pierde (no se
 * arrastra como pedido pendiente).
 */
export function evaluatePlan(plan: ProductionPlan, ctx: PlanningContext): PlanEvaluation {
  const producedIndex: Record<string, number> = {};
  for (const run of plan.runs) {
    const key = `${run.productId}:${run.dayIndex}`;
    producedIndex[key] = (producedIndex[key] ?? 0) + run.units;
  }

  const productDays: ProductDayResult[] = [];
  let holdingCost = 0;
  let stockoutCost = 0;
  let totalDemandUnits = 0;
  let shippedUnits = 0;
  let producedUnits = 0;
  let unmetUnits = 0;
  let closingInventoryUnits = 0;
  let coverSum = 0;

  for (const product of ctx.products) {
    let opening = ctx.initialStock[product.id];
    const averageDemand = ctx.averageDailyDemand[product.id];
    for (const day of ctx.days) {
      const demand = ctx.demand[product.id][day.index];
      const produced = producedIndex[`${product.id}:${day.index}`] ?? 0;
      const available = opening + produced;
      const shipped = Math.min(demand, available);
      const unmet = demand - shipped;
      const closing = available - shipped;
      const coverDays = averageDemand > 0 ? closing / averageDemand : 0;

      holdingCost += closing * product.holdingCostPerUnitPerDay;
      stockoutCost += unmet * ctx.stockoutCostPerUnit(product.id);
      totalDemandUnits += demand;
      shippedUnits += shipped;
      producedUnits += produced;
      unmetUnits += unmet;

      productDays.push({
        productId: product.id,
        dayIndex: day.index,
        openingStock: opening,
        demand,
        produced,
        shipped,
        unmet,
        closingStock: closing,
        coverDays,
      });

      opening = closing;
    }
    closingInventoryUnits += opening;
    coverSum += averageDemand > 0 ? opening / averageDemand : 0;
  }

  let setupCost = 0;
  let overtimeCost = 0;
  let setupMinutes = 0;
  let overtimeMinutes = 0;
  let setupCount = 0;
  let usedMinutes = 0;
  let regularCapacityMinutes = 0;
  let regularUsedMinutes = 0;

  const lineTotals: Record<string, LineResult> = {};
  for (const line of ctx.lines) {
    lineTotals[line.id] = {
      lineId: line.id,
      usedMinutes: 0,
      runMinutes: 0,
      setupMinutes: 0,
      regularCapacityMinutes: 0,
      overtimeMinutes: 0,
      setupCount: 0,
      utilization: 0,
    };
  }

  for (const lineDay of plan.lineDays) {
    const line = ctx.lineById[lineDay.lineId];
    const lineOvertime = lineDay.overtimeMinutes;
    setupCost += (lineDay.setupMinutes / 60) * line.setupCostPerHour;
    overtimeCost += (lineOvertime / 60) * line.overtimeCostPerHour;
    setupMinutes += lineDay.setupMinutes;
    overtimeMinutes += lineOvertime;
    setupCount += lineDay.setupCount;
    usedMinutes += lineDay.usedMinutes;
    regularCapacityMinutes += lineDay.regularCapacityMinutes;
    regularUsedMinutes += Math.min(lineDay.usedMinutes, lineDay.regularCapacityMinutes);

    const totals = lineTotals[lineDay.lineId];
    totals.usedMinutes += lineDay.usedMinutes;
    totals.runMinutes += lineDay.runMinutes;
    totals.setupMinutes += lineDay.setupMinutes;
    totals.regularCapacityMinutes += lineDay.regularCapacityMinutes;
    totals.overtimeMinutes += lineOvertime;
    totals.setupCount += lineDay.setupCount;
  }

  for (const totals of Object.values(lineTotals)) {
    totals.utilization =
      totals.regularCapacityMinutes > 0
        ? Math.min(totals.usedMinutes, totals.regularCapacityMinutes) / totals.regularCapacityMinutes
        : 0;
  }

  const costs: CostBreakdown = {
    setup: setupCost,
    overtime: overtimeCost,
    holding: holdingCost,
    stockout: stockoutCost,
    total: setupCost + overtimeCost + holdingCost + stockoutCost,
  };

  const days: DayResult[] = ctx.days.map((day) => {
    const dayProducts = productDays.filter((item) => item.dayIndex === day.index);
    const dayLines = plan.lineDays.filter((item) => item.dayIndex === day.index);

    const dayHolding = dayProducts.reduce(
      (acc, item) => acc + item.closingStock * ctx.productById[item.productId].holdingCostPerUnitPerDay,
      0,
    );
    const dayStockout = dayProducts.reduce(
      (acc, item) => acc + item.unmet * ctx.stockoutCostPerUnit(item.productId),
      0,
    );
    const daySetup = dayLines.reduce(
      (acc, item) => acc + (item.setupMinutes / 60) * ctx.lineById[item.lineId].setupCostPerHour,
      0,
    );
    const dayOvertime = dayLines.reduce(
      (acc, item) => acc + (item.overtimeMinutes / 60) * ctx.lineById[item.lineId].overtimeCostPerHour,
      0,
    );

    return {
      dayIndex: day.index,
      demandUnits: dayProducts.reduce((acc, item) => acc + item.demand, 0),
      producedUnits: dayProducts.reduce((acc, item) => acc + item.produced, 0),
      unmetUnits: dayProducts.reduce((acc, item) => acc + item.unmet, 0),
      closingInventoryUnits: dayProducts.reduce((acc, item) => acc + item.closingStock, 0),
      closingInventoryValue: dayProducts.reduce(
        (acc, item) => acc + item.closingStock * ctx.productById[item.productId].unitCost,
        0,
      ),
      setupCount: dayLines.reduce((acc, item) => acc + item.setupCount, 0),
      overtimeMinutes: dayLines.reduce((acc, item) => acc + item.overtimeMinutes, 0),
      costs: {
        setup: daySetup,
        overtime: dayOvertime,
        holding: dayHolding,
        stockout: dayStockout,
        total: daySetup + dayOvertime + dayHolding + dayStockout,
      },
    };
  });

  return {
    planId: plan.id,
    label: plan.label,
    costs,
    serviceLevel: totalDemandUnits > 0 ? shippedUnits / totalDemandUnits : 1,
    totalDemandUnits,
    producedUnits,
    unmetUnits,
    setupCount,
    setupHours: setupMinutes / 60,
    overtimeHours: overtimeMinutes / 60,
    utilization: regularCapacityMinutes > 0 ? regularUsedMinutes / regularCapacityMinutes : 0,
    usedMinutes,
    regularCapacityMinutes,
    averageCoverDays: coverSum / ctx.products.length,
    closingInventoryUnits,
    productDays,
    lines: Object.values(lineTotals),
    days,
  };
}

/**
 * Comparacion entre plan base y plan recomendado.
 * `costDelta` es la unica definicion de "costo evitado" que usa la aplicacion:
 * costo total del plan base menos costo total del plan recomendado.
 * Si el resultado es negativo, el escenario empeora y asi se informa.
 */
export function comparePlans(base: PlanEvaluation, recommended: PlanEvaluation): PlanComparison {
  const costDelta = base.costs.total - recommended.costs.total;
  return {
    base,
    recommended,
    costDelta,
    costDeltaPct: base.costs.total > 0 ? (costDelta / base.costs.total) * 100 : 0,
    improves: costDelta > 0,
    serviceLevelDelta: recommended.serviceLevel - base.serviceLevel,
    setupDelta: recommended.setupCount - base.setupCount,
    overtimeHoursDelta: recommended.overtimeHours - base.overtimeHours,
    unmetUnitsDelta: recommended.unmetUnits - base.unmetUnits,
  };
}
