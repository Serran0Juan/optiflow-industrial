/**
 * Calculos de abastecimiento por material.
 *
 * Todas las formulas del modulo viven aca y estan expuestas de forma explicita
 * en la pagina de Metodologia. No hay valores de negocio escritos a mano: los
 * parametros salen de `supply-config.ts` y el escenario llega por contexto.
 *
 *   Consumo proyectado = demanda diaria x BOM x dias del horizonte x (1 + scrap)
 *   Stock proyectado   = stock disponible + ordenes firmes del horizonte - consumo
 *   Cobertura (dias)   = stock disponible / consumo diario proyectado
 *   Punto de pedido    = (consumo diario x lead time promedio) + stock de seguridad
 *   Cantidad sugerida  = consumo durante (lead time + revision) + stock de seguridad
 *                        - stock disponible - ordenes firmes, ajustada al minimo
 *                        de compra del proveedor
 */
import { materialImpactProfiles, supplyDayAt } from "@/lib/data/supply-catalog";
import {
  LOW_RELIABILITY_THRESHOLD,
  SUPPLY_REVIEW_PERIOD_DAYS,
} from "@/lib/data/supply-config";
import type {
  MaterialSupplyRow,
  ProjectedStockPoint,
  SupplyMaterial,
  SupplyRiskLevel,
} from "@/lib/types";
import type { SupplyContext } from "./context";

/** Cobertura que se informa cuando un material no tiene consumo en el horizonte. */
export const NO_CONSUMPTION_COVERAGE = Number.POSITIVE_INFINITY;

const EPSILON = 1e-9;

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Redondea hacia arriba al multiplo de la cantidad minima del proveedor. */
function roundUpToMultiple(value: number, multiple: number): number {
  if (multiple <= 0) return Math.ceil(value);
  return Math.ceil(value / multiple - EPSILON) * multiple;
}

/**
 * Evolucion diaria del stock proyectado dentro del horizonte.
 * Cada dia se reciben primero las ordenes firmes y luego se descuenta el
 * consumo, que es el orden habitual en una planta: la recepcion abastece la
 * produccion del mismo dia.
 */
function buildProjection(
  material: SupplyMaterial,
  dailyConsumption: number,
  receiptsByDay: Map<number, number>,
  ctx: SupplyContext,
): ProjectedStockPoint[] {
  const points: ProjectedStockPoint[] = [];
  let stock = material.stockOnHand;

  for (const day of ctx.days) {
    const received = receiptsByDay.get(day.index) ?? 0;
    stock = stock + received - dailyConsumption;
    points.push({
      dayOffset: day.index,
      date: day.date,
      label: day.label,
      stock: round(stock, 2),
      coverageDays:
        dailyConsumption > EPSILON ? round(stock / dailyConsumption, 2) : NO_CONSUMPTION_COVERAGE,
      received: round(received, 2),
    });
  }

  return points;
}

/**
 * Clasificacion de riesgo con reglas explicitas, evaluadas en orden de gravedad.
 *
 * La distincion importante es entre un quiebre EVITABLE y uno INEVITABLE. Que el
 * stock proyectado cierre negativo solo significa que hay que comprar durante el
 * horizonte: es la situacion normal de cualquier material que no se stockea por
 * un mes. El riesgo critico aparece cuando el material se agota ANTES de la
 * primera entrega factible, es decir cuando comprar hoy ya no llega a tiempo.
 */
function classifyRisk(input: {
  dailyConsumption: number;
  projectedStock: number;
  coverageDays: number;
  daysToStockout: number;
  daysToNextSupply: number;
  effectiveLeadTimeDays: number;
  effectiveMaxLeadTimeDays: number;
  effectiveReliability: number;
  stockOnHand: number;
  reorderPoint: number;
  hasDelayedOrder: boolean;
}): { risk: SupplyRiskLevel; riskRule: string } {
  if (input.dailyConsumption <= EPSILON) {
    return {
      risk: "bajo",
      riskRule: "El material no registra consumo en el horizonte analizado.",
    };
  }

  if (input.daysToStockout <= input.daysToNextSupply + EPSILON) {
    return {
      risk: "critico",
      riskRule: `El stock se agota el dia ${round(input.daysToStockout, 0)} del horizonte y la proxima entrega factible recien llega el dia ${round(input.daysToNextSupply, 0)}: el quiebre ya no se puede evitar comprando hoy.`,
    };
  }

  if (input.coverageDays < input.effectiveLeadTimeDays - EPSILON) {
    return {
      risk: "alto",
      riskRule: `La cobertura (${round(input.coverageDays, 1)} dias) es menor que el lead time del proveedor (${round(input.effectiveLeadTimeDays, 1)} dias): solo las ordenes ya en camino evitan el quiebre.`,
    };
  }

  if (input.hasDelayedOrder) {
    return {
      risk: "alto",
      riskRule: "El proveedor tiene una orden abierta retrasada para este material.",
    };
  }

  if (input.coverageDays < input.effectiveMaxLeadTimeDays - EPSILON) {
    return {
      risk: "medio",
      riskRule: `Cobertura ajustada: alcanza el lead time promedio pero no el lead time maximo simulado (${round(input.effectiveMaxLeadTimeDays, 1)} dias).`,
    };
  }

  if (input.effectiveReliability < LOW_RELIABILITY_THRESHOLD) {
    return {
      risk: "medio",
      riskRule: `Proveedor de baja confiabilidad (${round(input.effectiveReliability * 100, 0)}%, umbral ${LOW_RELIABILITY_THRESHOLD * 100}%).`,
    };
  }

  if (input.stockOnHand < input.reorderPoint - EPSILON) {
    return {
      risk: "medio",
      riskRule: "El stock disponible cayo por debajo del punto de pedido.",
    };
  }

  if (input.projectedStock < 0) {
    return {
      risk: "bajo",
      riskRule: `El stock proyectado cierra negativo (${round(input.projectedStock, 0)}), pero la cobertura actual supera el lead time: alcanza con emitir la compra dentro del ciclo normal.`,
    };
  }

  return {
    risk: "bajo",
    riskRule: "Cobertura suficiente frente al lead time y ordenes en camino confirmadas.",
  };
}

/** Calcula la fila completa de un material para el escenario activo. */
export function buildMaterialRow(material: SupplyMaterial, ctx: SupplyContext): MaterialSupplyRow {
  const supplier = ctx.supplierOf(material);
  const dailyConsumption = ctx.dailyConsumption[material.id];
  const projectedConsumption = dailyConsumption * ctx.horizonDays;

  const effectiveLeadTimeDays = ctx.leadTimeOf(supplier);
  const effectiveMaxLeadTimeDays = ctx.maxLeadTimeOf(supplier);
  const effectiveReliability = ctx.reliabilityOf(supplier);

  const orders = ctx.ordersOf(material.id);
  const firmOrders = orders.filter((row) => row.countsAsFirm);
  const incomingFirmUnits = firmOrders.reduce((acc, row) => acc + row.order.quantity, 0);
  const incomingAtRiskUnits = orders
    .filter((row) => row.withinHorizon && !row.countsAsFirm)
    .reduce((acc, row) => acc + row.order.quantity, 0);
  const hasDelayedOrder = orders.some(
    (row) => row.order.status === "retrasada" || row.delayDays > 0,
  );

  const receiptsByDay = new Map<number, number>();
  for (const row of firmOrders) {
    receiptsByDay.set(
      row.arrivalDayOffset,
      (receiptsByDay.get(row.arrivalDayOffset) ?? 0) + row.order.quantity,
    );
  }

  const projectedStock = material.stockOnHand + incomingFirmUnits - projectedConsumption;
  const coverageDays =
    dailyConsumption > EPSILON
      ? material.stockOnHand / dailyConsumption
      : NO_CONSUMPTION_COVERAGE;
  const safetyStockUnits = material.safetyStockDays * dailyConsumption;
  const reorderPoint = dailyConsumption * effectiveLeadTimeDays + safetyStockUnits;

  const projection = buildProjection(material, dailyConsumption, receiptsByDay, ctx);
  const stockoutPoint = projection.find((point) => point.stock < 0);
  const daysToStockout = stockoutPoint
    ? stockoutPoint.dayOffset + 1
    : Number.POSITIVE_INFINITY;

  /* Proxima entrega factible: la orden firme mas cercana o, si no hay ninguna,
     una compra nueva emitida hoy, que tarda un lead time completo. */
  const nextFirmArrival = firmOrders.length > 0 ? firmOrders[0].arrivalDayOffset + 1 : Infinity;
  const daysToNextSupply = Math.min(nextFirmArrival, effectiveLeadTimeDays);

  const { risk, riskRule } = classifyRisk({
    dailyConsumption,
    projectedStock,
    coverageDays,
    daysToStockout,
    daysToNextSupply,
    effectiveLeadTimeDays,
    effectiveMaxLeadTimeDays,
    effectiveReliability,
    stockOnHand: material.stockOnHand,
    reorderPoint,
    hasDelayedOrder,
  });

  /* Cantidad sugerida: cubre el consumo durante el lead time mas el ciclo de
     revision de compras y repone el stock de seguridad, descontando lo que ya
     hay en planta y lo que llega en firme. Nunca queda por debajo del faltante
     proyectado ni de la cantidad minima del proveedor. */
  const shortfallUnits = Math.max(0, -projectedStock);
  const netRequirement =
    dailyConsumption * (effectiveLeadTimeDays + SUPPLY_REVIEW_PERIOD_DAYS) +
    safetyStockUnits -
    material.stockOnHand -
    incomingFirmUnits;
  const rawRequirement = Math.max(netRequirement, shortfallUnits);
  const suggestedQuantity =
    rawRequirement > EPSILON ? roundUpToMultiple(rawRequirement, supplier.minOrderQuantity) : 0;

  const supplierUnitPrice = material.unitCost * supplier.priceFactor;
  const profile = materialImpactProfiles[material.id];

  return {
    material,
    supplier,
    projectedConsumption: round(projectedConsumption, 2),
    dailyConsumption: round(dailyConsumption, 3),
    stockOnHand: material.stockOnHand,
    incomingFirmUnits: round(incomingFirmUnits, 2),
    incomingAtRiskUnits: round(incomingAtRiskUnits, 2),
    projectedStock: round(projectedStock, 2),
    coverageDays: coverageDays === NO_CONSUMPTION_COVERAGE ? coverageDays : round(coverageDays, 2),
    safetyStockUnits: round(safetyStockUnits, 2),
    effectiveLeadTimeDays,
    effectiveMaxLeadTimeDays,
    effectiveReliability: round(effectiveReliability, 4),
    reorderPoint: round(reorderPoint, 2),
    daysToStockout,
    daysToNextSupply: round(daysToNextSupply, 2),
    hasDelayedOrder,
    risk,
    riskRule,
    suggestedQuantity: round(suggestedQuantity, 2),
    purchaseCost: Math.round(suggestedQuantity * supplierUnitPrice),
    supplierUnitPrice: round(supplierUnitPrice, 2),
    shortfallUnits: round(shortfallUnits, 2),
    productUnitsAtRisk: Math.round(shortfallUnits * profile.productUnitsPerMaterialUnit),
    inactionCost: Math.round(shortfallUnits * profile.marginPerMaterialUnit),
    inventoryValue: Math.round(material.stockOnHand * material.unitCost),
    projection,
    topProducts: profile.topProducts,
  };
}

/** Fecha limite de decision: cuanto se puede esperar sin perder el lead time. */
export function decisionDeadline(row: MaterialSupplyRow): { date: string; days: number } {
  const slack =
    row.coverageDays === NO_CONSUMPTION_COVERAGE
      ? row.effectiveLeadTimeDays
      : row.coverageDays - row.effectiveLeadTimeDays;
  const days = Math.max(0, Math.floor(slack));
  return { date: supplyDayAt(days).date, days };
}

/** Orden de gravedad usado para ordenar filas y recomendaciones. */
export const RISK_RANK: Record<SupplyRiskLevel, number> = {
  critico: 0,
  alto: 1,
  medio: 2,
  bajo: 3,
};
