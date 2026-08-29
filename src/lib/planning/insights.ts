import { dataset } from "@/lib/data/dataset";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import type {
  MaterialCoverage,
  OperationalAlert,
  PlanComparison,
  PlanEvaluation,
  ProductionPlan,
} from "@/lib/types";
import type { PlanningContext } from "./context";

const SEVERITY_RANK: Record<OperationalAlert["severity"], number> = { alta: 0, media: 1, baja: 2 };

/**
 * Consumo de materias primas derivado del plan recomendado.
 * En la V1 el abastecimiento se verifica pero no restringe el plan: se informa
 * la cobertura resultante para que el planificador decida.
 */
export function buildMaterialCoverage(plan: ProductionPlan, ctx: PlanningContext): MaterialCoverage[] {
  const producedByProduct: Record<string, number> = {};
  for (const run of plan.runs) {
    producedByProduct[run.productId] = (producedByProduct[run.productId] ?? 0) + run.units;
  }

  const horizonDays = ctx.days.length;

  return dataset.rawMaterials.map((material) => {
    const bomLines = dataset.bom.filter((entry) => entry.materialId === material.id);
    const requiredUnits = bomLines.reduce(
      (acc, entry) => acc + entry.quantityPerUnit * (producedByProduct[entry.productId] ?? 0),
      0,
    );
    const dailyConsumption = requiredUnits / horizonDays;
    const closingStock = material.initialStock - requiredUnits;
    const coverageDays = dailyConsumption > 0 ? material.initialStock / dailyConsumption : 99;
    const supplier = dataset.suppliers.find((item) => item.id === material.supplierId)!;

    let status: MaterialCoverage["status"] = "ok";
    if (closingStock < 0 || coverageDays < material.minCoverageDays * 0.6) status = "critico";
    else if (coverageDays < material.minCoverageDays) status = "atencion";

    return {
      materialId: material.id,
      code: material.code,
      name: material.name,
      unit: material.unit,
      unitCost: material.unitCost,
      supplierId: material.supplierId,
      initialStock: material.initialStock,
      requiredUnits,
      closingStock,
      coverageDays,
      minCoverageDays: material.minCoverageDays,
      leadTimeDays: supplier.leadTimeDays,
      status,
    };
  });
}

export function buildAlerts(
  evaluation: PlanEvaluation,
  materials: MaterialCoverage[],
  ctx: PlanningContext,
): OperationalAlert[] {
  const alerts: OperationalAlert[] = [];

  for (const product of ctx.products) {
    const rows = evaluation.productDays.filter((row) => row.productId === product.id);
    const unmet = rows.reduce((acc, row) => acc + row.unmet, 0);
    const minCover = Math.min(...rows.map((row) => row.coverDays));
    const maxCover = Math.max(...rows.map((row) => row.coverDays));

    if (unmet > 0) {
      const firstDay = rows.find((row) => row.unmet > 0)!;
      alerts.push({
        id: `stockout-${product.id}`,
        severity: "alta",
        category: "Faltante",
        entity: `${product.sku} - ${product.name}`,
        message: `${formatNumber(unmet)} unidades sin atender a partir del ${ctx.days[firstDay.dayIndex].label}.`,
        recommendation:
          "Revisar capacidad de la linea asignada o adelantar produccion el dia previo.",
        impact: unmet * ctx.stockoutCostPerUnit(product.id),
      });
    } else if (minCover < product.safetyStockDays) {
      alerts.push({
        id: `cover-${product.id}`,
        severity: "media",
        category: "Cobertura",
        entity: `${product.sku} - ${product.name}`,
        message: `La cobertura baja a ${formatNumber(minCover, 1)} dias, por debajo del stock de seguridad de ${formatNumber(product.safetyStockDays, 1)} dias.`,
        recommendation: "Reforzar el lote del dia siguiente si aparece capacidad libre.",
        impact: 0,
      });
    }

    if (maxCover > product.maxCoverDays + 1) {
      alerts.push({
        id: `overstock-${product.id}`,
        severity: "baja",
        category: "Inventario",
        entity: `${product.sku} - ${product.name}`,
        message: `Cobertura maxima de ${formatNumber(maxCover, 1)} dias, por encima del objetivo de ${formatNumber(product.maxCoverDays, 1)} dias.`,
        recommendation: "Reducir el lote o postergar la corrida para liberar capital de trabajo.",
        impact:
          (maxCover - product.maxCoverDays) *
          ctx.averageDailyDemand[product.id] *
          product.holdingCostPerUnitPerDay,
      });
    }
  }

  for (const lineResult of evaluation.lines) {
    const line = ctx.lineById[lineResult.lineId];
    if (lineResult.overtimeMinutes > 0) {
      alerts.push({
        id: `overtime-${line.id}`,
        severity: "media",
        category: "Capacidad",
        entity: line.name,
        message: `${formatNumber(lineResult.overtimeMinutes / 60, 1)} horas extra programadas en la semana.`,
        recommendation: "Evaluar adelantar produccion a dias con capacidad ociosa.",
        impact: (lineResult.overtimeMinutes / 60) * line.overtimeCostPerHour,
      });
    } else if (lineResult.utilization > 0.97) {
      alerts.push({
        id: `saturated-${line.id}`,
        severity: "media",
        category: "Capacidad",
        entity: line.name,
        message: `Utilizacion de ${formatPercent(lineResult.utilization, 0)} sin margen para imprevistos.`,
        recommendation: "Mantener un colchon de capacidad o derivar carga a otra linea.",
        impact: 0,
      });
    }
  }

  for (const event of dataset.availabilityEvents) {
    if (event.availabilityFactor <= 0.85) {
      alerts.push({
        id: `availability-${event.lineId}-${event.dayIndex}`,
        severity: "media",
        category: "Disponibilidad",
        entity: ctx.lineById[event.lineId].name,
        message: `${event.reason}: disponibilidad reducida a ${formatPercent(event.availabilityFactor, 0)} el ${ctx.days[event.dayIndex].label}.`,
        recommendation: "Anticipar la carga de ese dia en la jornada previa.",
        impact: 0,
      });
    }
  }

  for (const material of materials) {
    if (material.status === "ok") continue;
    const supplier = dataset.suppliers.find((item) => item.id === material.supplierId)!;
    alerts.push({
      id: `material-${material.materialId}`,
      severity: material.status === "critico" ? "alta" : "media",
      category: "Abastecimiento",
      entity: `${material.code} - ${material.name}`,
      message:
        material.closingStock < 0
          ? `El plan consume ${formatNumber(-material.closingStock)} ${material.unit} mas de lo que hay en stock (cobertura de ${formatNumber(material.coverageDays, 1)} dias, lead time de ${material.leadTimeDays} dias con ${supplier.name}).`
          : `Cobertura de ${formatNumber(material.coverageDays, 1)} dias frente a un minimo de ${formatNumber(material.minCoverageDays, 0)} dias y un lead time de ${material.leadTimeDays} dias (${supplier.name}).`,
      recommendation:
        supplier.reliability < 0.9
          ? "Confirmar entrega con el proveedor: confiabilidad historica simulada por debajo del 90%."
          : "Emitir pedido de reposicion dentro de la semana.",
      impact: Math.max(0, -material.closingStock) * material.unitCost,
    });
  }

  return alerts.sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      b.impact - a.impact ||
      a.id.localeCompare(b.id),
  );
}

/**
 * Resumen de decisiones generado de forma determinista a partir de los
 * resultados del plan. No interviene ningun modelo de lenguaje: el mismo
 * escenario produce siempre exactamente el mismo texto.
 */
export function buildDecisionSummary(
  comparison: PlanComparison,
  recommendedPlan: ProductionPlan,
  ctx: PlanningContext,
): string[] {
  const { base, recommended } = comparison;
  const decisions: string[] = [];

  decisions.push(
    comparison.improves
      ? `El plan recomendado cuesta ${formatCurrency(recommended.costs.total)} frente a ${formatCurrency(base.costs.total)} del plan base: ${formatCurrency(comparison.costDelta)} menos (${formatNumber(comparison.costDeltaPct, 1)}%).`
      : `En este escenario el plan recomendado no mejora al plan base: cuesta ${formatCurrency(Math.abs(comparison.costDelta))} mas (${formatNumber(Math.abs(comparison.costDeltaPct), 1)}%). Se informa como empeoramiento del escenario.`,
  );

  const criticos = ctx.products
    .filter((product) => ctx.initialStock[product.id] / ctx.averageDailyDemand[product.id] < 1)
    .sort(
      (a, b) =>
        ctx.initialStock[a.id] / ctx.averageDailyDemand[a.id] -
        ctx.initialStock[b.id] / ctx.averageDailyDemand[b.id],
    );
  if (criticos.length > 0) {
    decisions.push(
      `Se priorizaron ${criticos.length} SKU con menos de un dia de cobertura inicial (${criticos
        .slice(0, 3)
        .map((product) => product.sku)
        .join(", ")}${criticos.length > 3 ? ", entre otros" : ""}), programandolos en los primeros dias del horizonte.`,
    );
  }

  const setupDelta = base.setupCount - recommended.setupCount;
  decisions.push(
    setupDelta > 0
      ? `Se agruparon corridas por familia: ${recommended.setupCount} cambios de formato contra ${base.setupCount} del plan base (${setupDelta} menos, ${formatNumber(base.setupHours - recommended.setupHours, 1)} horas de linea recuperadas).`
      : `Los cambios de formato se mantienen en ${recommended.setupCount} (plan base: ${base.setupCount}): en este escenario el agrupamiento por familia no deja margen adicional.`,
  );

  decisions.push(
    recommended.overtimeHours > 0
      ? `Se habilitaron ${formatNumber(recommended.overtimeHours, 1)} horas extra (${formatCurrency(recommended.costs.overtime)}) solo donde el faltante evitado superaba su costo; el plan base usa ${formatNumber(base.overtimeHours, 1)} horas.`
      : `El plan recomendado no requiere horas extra (el plan base usa ${formatNumber(base.overtimeHours, 1)} horas).`,
  );

  const unmetProducts = ctx.products
    .map((product) => ({
      product,
      unmet: recommended.productDays
        .filter((row) => row.productId === product.id)
        .reduce((acc, row) => acc + row.unmet, 0),
    }))
    .filter((item) => item.unmet > 0)
    .sort((a, b) => b.unmet - a.unmet);

  decisions.push(
    unmetProducts.length > 0
      ? `Nivel de servicio ${formatPercent(recommended.serviceLevel)} (plan base ${formatPercent(base.serviceLevel)}): quedan ${formatNumber(recommended.unmetUnits)} unidades sin atender, concentradas en ${unmetProducts
          .slice(0, 2)
          .map((item) => item.product.sku)
          .join(" y ")}.`
      : `Nivel de servicio ${formatPercent(recommended.serviceLevel)}: el plan cubre toda la demanda proyectada del horizonte (plan base ${formatPercent(base.serviceLevel)}).`,
  );

  const bottleneck = [...recommended.lines].sort((a, b) => b.utilization - a.utilization)[0];
  decisions.push(
    `Cuello de botella de la semana: ${ctx.lineById[bottleneck.lineId].name} al ${formatPercent(bottleneck.utilization, 0)} de utilizacion con ${bottleneck.setupCount} cambios de formato.`,
  );

  const reassignments = recommendedPlan.notes.find((note) => note.startsWith("Productos reasignados"));
  if (reassignments) decisions.push(reassignments);

  return decisions;
}
