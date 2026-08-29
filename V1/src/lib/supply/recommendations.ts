/**
 * Motor de recomendaciones de compra.
 *
 * Es un motor de reglas determinista: dado un escenario, cada material recibe
 * siempre la misma accion, con el mismo texto. No interviene ningun modelo de
 * lenguaje, ningun servicio externo y ninguna fuente de aleatoriedad. Todos los
 * textos se arman con los numeros calculados, por lo que cambian cuando cambia
 * el escenario.
 */
import { MATERIAL_CATEGORY_LABELS, SUPPLY_REVIEW_PERIOD_DAYS } from "@/lib/data/supply-config";
import { formatCurrency, formatNumber } from "@/lib/format";
import type {
  MaterialSupplyRow,
  SupplyAction,
  SupplyConfidence,
  SupplyRecommendation,
} from "@/lib/types";
import type { SupplyContext } from "./context";
import { decisionDeadline, NO_CONSUMPTION_COVERAGE, RISK_RANK } from "./metrics";

export const SUPPLY_ACTION_LABELS: Record<SupplyAction, string> = {
  "comprar-urgente": "Comprar de forma urgente",
  "anticipar-orden": "Anticipar o reprogramar orden",
  "compra-normal": "Emitir compra normal",
  "consolidar-compra": "Consolidar compra con otros materiales",
  monitorear: "Monitorear",
  "no-comprar": "No comprar",
};

/** Acciones que requieren una decision humana antes de ejecutarse. */
export const ACTIONABLE_ACTIONS: SupplyAction[] = [
  "comprar-urgente",
  "anticipar-orden",
  "compra-normal",
  "consolidar-compra",
];

const ACTION_RANK: Record<SupplyAction, number> = {
  "comprar-urgente": 0,
  "anticipar-orden": 1,
  "compra-normal": 2,
  "consolidar-compra": 3,
  monitorear: 4,
  "no-comprar": 5,
};

/** Cobertura formateada, contemplando el caso sin consumo. */
function coverageText(row: MaterialSupplyRow): string {
  return row.coverageDays === NO_CONSUMPTION_COVERAGE
    ? "sin consumo en el horizonte"
    : `${formatNumber(row.coverageDays, 1)} dias de cobertura`;
}

function quantityText(row: MaterialSupplyRow): string {
  return `${formatNumber(row.suggestedQuantity)} ${row.material.unit}`;
}

/**
 * Nivel de confianza de la recomendacion.
 *
 * Refleja la calidad de los datos simulados que sostienen el calculo
 * (confiabilidad del proveedor, estado de las ordenes abiertas y existencia de
 * consumo), NO la certeza de un modelo estadistico ni de una IA.
 */
function assessConfidence(
  row: MaterialSupplyRow,
  ctx: SupplyContext,
): { confidence: SupplyConfidence; confidenceReason: string } {
  const orders = ctx.ordersOf(row.material.id);
  const pendingOrders = orders.filter((order) => order.order.status === "pendiente");
  const delayedOrders = orders.filter((order) => order.order.status === "retrasada");

  if (row.dailyConsumption <= 0) {
    return {
      confidence: "baja",
      confidenceReason:
        "El material no registra consumo en el horizonte: no hay base de calculo suficiente para sostener una recomendacion.",
    };
  }

  if (row.effectiveReliability < 0.8 || pendingOrders.length > 0) {
    return {
      confidence: "baja",
      confidenceReason:
        row.effectiveReliability < 0.8
          ? `La confiabilidad simulada del proveedor es de ${formatNumber(row.effectiveReliability * 100, 0)}%: la fecha de entrega es el dato mas debil del calculo.`
          : `Hay ${pendingOrders.length} orden(es) pendiente(s) de confirmacion: la cantidad que realmente llegara no esta cerrada.`,
    };
  }

  if (row.effectiveReliability < 0.9 || delayedOrders.length > 0) {
    return {
      confidence: "media",
      confidenceReason:
        delayedOrders.length > 0
          ? `El material tiene ${delayedOrders.length} orden(es) retrasada(s): la fecha de reposicion depende de una renegociacion con el proveedor.`
          : `La confiabilidad simulada del proveedor es de ${formatNumber(row.effectiveReliability * 100, 0)}%, por debajo del 90% que el caso considera estable.`,
    };
  }

  return {
    confidence: "alta",
    confidenceReason:
      "Consumo derivado de la lista de materiales, proveedor confiable en el caso simulado y sin ordenes en discusion.",
  };
}

/** Elige la accion principal del material segun reglas explicitas y excluyentes. */
function decideAction(
  row: MaterialSupplyRow,
  ctx: SupplyContext,
  consolidateWith: string[],
): SupplyAction {
  if (row.dailyConsumption <= 0) return "no-comprar";

  if (row.suggestedQuantity <= 0) {
    return row.risk === "bajo" ? "no-comprar" : "monitorear";
  }

  /* Una orden abierta se puede anticipar o reprogramar si existe y todavia no
     es abastecimiento firme dentro del horizonte, o si llega despues de la
     fecha en que el stock se agota. */
  const reschedulable = ctx
    .ordersOf(row.material.id)
    .some(
      (order) =>
        !order.countsAsFirm || order.arrivalDayOffset + 1 > row.daysToStockout,
    );

  if ((row.risk === "critico" || row.risk === "alto") && reschedulable) return "anticipar-orden";
  if (row.risk === "critico") return "comprar-urgente";
  if (row.risk === "alto" || row.risk === "medio") return "compra-normal";
  /* Solo se consolida lo que no tiene urgencia alguna: riesgo bajo con otro
     material del mismo proveedor esperando reposicion. */
  return consolidateWith.length > 0 ? "consolidar-compra" : "compra-normal";
}

/** Razon explicable de la accion, construida con los numeros del escenario. */
function buildReason(row: MaterialSupplyRow, action: SupplyAction, consolidateWith: string[]): string {
  const material = `${row.material.code} (${row.material.name})`;
  const supplier = row.supplier.name;
  const lead = formatNumber(row.effectiveLeadTimeDays);

  switch (action) {
    case "comprar-urgente":
      return `${material} tiene ${coverageText(row)} y ${supplier} necesita ${lead} dias habiles para reponer. ${row.riskRule} Se recomienda emitir una compra urgente de ${quantityText(row)} para evitar una restriccion de produccion dentro del horizonte simulado.`;
    case "anticipar-orden":
      return `${material} tiene ${coverageText(row)} frente a un lead time de ${lead} dias habiles y ya existe una orden abierta con ${supplier} que no cubre esa fecha. ${row.riskRule} Conviene renegociar la fecha de esa orden antes de emitir una compra nueva de ${quantityText(row)}.`;
    case "compra-normal":
      return `${material} cae por debajo de su punto de pedido (${formatNumber(row.reorderPoint)} ${row.material.unit} contra un stock de ${formatNumber(row.stockOnHand)} ${row.material.unit}). ${row.riskRule} Emitir una compra de ${quantityText(row)} a ${supplier} dentro del ciclo normal de ${SUPPLY_REVIEW_PERIOD_DAYS} dias de revision.`;
    case "consolidar-compra":
      return `${material} necesita reponerse (${quantityText(row)}) sin urgencia: ${row.riskRule.toLowerCase()} Como ${supplier} tambien abastece ${consolidateWith.join(", ")}, conviene consolidar el pedido en una sola orden y aprovechar la condicion de compra "${row.supplier.paymentTerms}".`;
    case "monitorear":
      return `${material} todavia no requiere compra: el stock de ${formatNumber(row.stockOnHand)} ${row.material.unit} supera el punto de pedido de ${formatNumber(row.reorderPoint)} ${row.material.unit}. ${row.riskRule} Se mantiene en seguimiento porque el margen es acotado.`;
    case "no-comprar":
    default:
      return row.dailyConsumption <= 0
        ? `${material} no registra consumo en el horizonte de ${row.projection.length} dias habiles, por lo que no corresponde comprar.`
        : `${material} tiene ${coverageText(row)} y stock por encima del punto de pedido (${formatNumber(row.reorderPoint)} ${row.material.unit}). ${row.riskRule} No corresponde emitir compra en este ciclo.`;
  }
}

/** Consecuencia de no actuar, valorizada con el margen de contribucion perdido. */
function buildConsequence(row: MaterialSupplyRow, action: SupplyAction, deadlineDate: string): string {
  if (action === "no-comprar" || action === "monitorear") {
    return row.shortfallUnits > 0
      ? `Si el consumo se sostiene, el stock proyectado cierra en ${formatNumber(row.projectedStock)} ${row.material.unit} y aparece un faltante de ${formatNumber(row.shortfallUnits)} ${row.material.unit} al final del horizonte.`
      : `Sin cambios en la demanda, el material cierra el horizonte con ${formatNumber(row.projectedStock)} ${row.material.unit} disponibles: no hay impacto economico estimado.`;
  }

  if (row.shortfallUnits <= 0) {
    return `Postergar la decision mas alla del ${deadlineDate} deja al material sin margen frente al lead time de ${formatNumber(row.effectiveLeadTimeDays)} dias habiles: cualquier desvio de demanda o de entrega se traduce en parada de linea.`;
  }

  return `Si la compra no se decide antes del ${deadlineDate}, faltan ${formatNumber(row.shortfallUnits)} ${row.material.unit} en el horizonte, equivalentes a ${formatNumber(row.productUnitsAtRisk)} unidades de producto terminado que no se podrian fabricar (${formatCurrency(row.inactionCost)} de margen de contribucion).`;
}

/** Construye las recomendaciones de todos los materiales, ordenadas por gravedad. */
export function buildRecommendations(
  rows: MaterialSupplyRow[],
  ctx: SupplyContext,
): SupplyRecommendation[] {
  /* Candidatos a consolidacion: otros materiales del mismo proveedor que
     tambien necesitan reposicion en este ciclo. */
  const needsPurchaseBySupplier = new Map<string, string[]>();
  for (const row of rows) {
    if (row.suggestedQuantity <= 0) continue;
    const list = needsPurchaseBySupplier.get(row.supplier.id);
    if (list) list.push(row.material.code);
    else needsPurchaseBySupplier.set(row.supplier.id, [row.material.code]);
  }

  const recommendations = rows.map((row) => {
    const consolidateWith = (needsPurchaseBySupplier.get(row.supplier.id) ?? []).filter(
      (code) => code !== row.material.code,
    );
    const action = decideAction(row, ctx, consolidateWith);
    const deadline = decisionDeadline(row);
    const { confidence, confidenceReason } = assessConfidence(row, ctx);

    return {
      materialId: row.material.id,
      materialCode: row.material.code,
      materialName: row.material.name,
      category: row.material.category,
      action,
      actionLabel: SUPPLY_ACTION_LABELS[action],
      risk: row.risk,
      reason: buildReason(row, action, consolidateWith),
      quantity: ACTIONABLE_ACTIONS.includes(action) ? row.suggestedQuantity : 0,
      unit: row.material.unit,
      supplierId: row.supplier.id,
      supplierName: row.supplier.name,
      decisionDeadline: deadline.date,
      daysToDeadline: deadline.days,
      estimatedCost: ACTIONABLE_ACTIONS.includes(action) ? row.purchaseCost : 0,
      consequence: buildConsequence(row, action, deadline.date),
      inactionCost: row.inactionCost,
      confidence,
      confidenceReason,
      consolidateWith,
    } satisfies SupplyRecommendation;
  });

  return recommendations.sort(
    (a, b) =>
      RISK_RANK[a.risk] - RISK_RANK[b.risk] ||
      ACTION_RANK[a.action] - ACTION_RANK[b.action] ||
      b.inactionCost - a.inactionCost ||
      a.materialCode.localeCompare(b.materialCode),
  );
}

/** Lectura operativa del escenario, generada de forma determinista. */
export function buildSupplyInsights(
  rows: MaterialSupplyRow[],
  recommendations: SupplyRecommendation[],
  ctx: SupplyContext,
): string[] {
  const insights: string[] = [];
  const critical = rows.filter((row) => row.risk === "critico");
  const high = rows.filter((row) => row.risk === "alto");

  insights.push(
    critical.length > 0
      ? `${critical.length} de ${rows.length} materiales quedan en riesgo critico en un horizonte de ${ctx.horizonDays} dias habiles: ${critical
          .slice(0, 3)
          .map((row) => row.material.code)
          .join(", ")}${critical.length > 3 ? ", entre otros" : ""}.`
      : `Ningun material queda en riesgo critico en el horizonte de ${ctx.horizonDays} dias habiles: el stock y las ordenes firmes cubren el consumo proyectado.`,
  );

  const worst = [...rows]
    .filter((row) => row.coverageDays !== NO_CONSUMPTION_COVERAGE)
    .sort((a, b) => a.coverageDays - b.coverageDays)[0];
  if (worst) {
    insights.push(
      `El material con menor cobertura es ${worst.material.code} (${worst.material.name}): ${formatNumber(worst.coverageDays, 1)} dias frente a un lead time de ${formatNumber(worst.effectiveLeadTimeDays)} dias habiles de ${worst.supplier.name}.`,
    );
  }

  const delayed = ctx.orders.filter((order) => order.order.status === "retrasada");
  insights.push(
    delayed.length > 0
      ? `Hay ${delayed.length} orden(es) de compra retrasada(s) por un total de ${formatCurrency(delayed.reduce((acc, order) => acc + order.order.cost, 0))}; la mas critica es ${delayed[0].order.id} de ${delayed[0].supplierName} (${delayed[0].delayDays} dias sobre lo comprometido).`
      : "Ninguna orden de compra abierta figura retrasada en este escenario.",
  );

  const urgent = recommendations.filter((item) => item.action === "comprar-urgente");
  const reschedule = recommendations.filter((item) => item.action === "anticipar-orden");
  insights.push(
    urgent.length + reschedule.length > 0
      ? `El motor propone ${urgent.length} compra(s) urgente(s) y ${reschedule.length} reprogramacion(es) de ordenes ya emitidas, por ${formatCurrency(
          [...urgent, ...reschedule].reduce((acc, item) => acc + item.estimatedCost, 0),
        )} en total.`
      : "No hay compras urgentes: las reposiciones sugeridas entran en el ciclo normal de compras.",
  );

  const inaction = rows.reduce((acc, row) => acc + row.inactionCost, 0);
  const purchase = recommendations.reduce((acc, item) => acc + item.estimatedCost, 0);
  insights.push(
    inaction > 0
      ? `Comprar lo recomendado cuesta ${formatCurrency(purchase)}; no actuar deja ${formatCurrency(inaction)} de margen de contribucion expuesto por faltantes de material.`
      : `Comprar lo recomendado cuesta ${formatCurrency(purchase)} y no hay margen expuesto: en este escenario ninguna materia prima proyecta faltante.`,
  );

  const consolidations = recommendations.filter((item) => item.action === "consolidar-compra");
  if (consolidations.length > 0) {
    insights.push(
      `${consolidations.length} reposicion(es) sin urgencia se pueden consolidar con otros materiales del mismo proveedor, evitando ordenes chicas contra minimos de compra.`,
    );
  }

  const lowConfidence = recommendations.filter((item) => item.confidence === "baja");
  if (lowConfidence.length > 0) {
    insights.push(
      `${lowConfidence.length} recomendacion(es) tienen confianza baja por calidad de datos del caso simulado (${lowConfidence
        .slice(0, 3)
        .map((item) => item.materialCode)
        .join(", ")}): conviene revisarlas manualmente antes de aprobar.`,
    );
  }

  const categories = new Map<string, number>();
  for (const row of rows) {
    if (row.risk !== "critico" && row.risk !== "alto") continue;
    const label = MATERIAL_CATEGORY_LABELS[row.material.category];
    categories.set(label, (categories.get(label) ?? 0) + 1);
  }
  if (categories.size > 0) {
    const ranked = [...categories.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    insights.push(
      `El riesgo se concentra en ${ranked[0][0].toLowerCase()} (${ranked[0][1]} material(es) en riesgo alto o critico) sobre un total de ${high.length + critical.length} materiales comprometidos.`,
    );
  }

  return insights;
}
