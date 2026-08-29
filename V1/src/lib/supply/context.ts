import {
  baseDailyConsumptionByMaterial,
  openPurchaseOrders,
  orderOffsets,
  supplyDayAt,
  supplyHorizonDays,
  supplyMaterials,
  supplySuppliersById,
} from "@/lib/data/supply-catalog";
import type {
  OpenOrderRow,
  PlanningDay,
  PurchaseOrder,
  SupplyMaterial,
  SupplyScenario,
  SupplySupplier,
} from "@/lib/types";
import { clamp } from "@/lib/utils";

/**
 * Contexto de abastecimiento: el caso simulado ya ajustado por el escenario
 * activo. Todas las funciones de calculo reciben este contexto, de modo que no
 * lean constantes globales por su cuenta y el resultado dependa unicamente del
 * escenario.
 */
export interface SupplyContext {
  scenario: SupplyScenario;
  /** Dias habiles del horizonte analizado. */
  days: PlanningDay[];
  horizonDays: number;
  startDate: string;
  endDate: string;
  materials: SupplyMaterial[];
  /** Consumo diario por material (unidades/dia habil) con demanda y scrap aplicados. */
  dailyConsumption: Record<string, number>;
  supplierOf: (material: SupplyMaterial) => SupplySupplier;
  /** Lead time promedio del proveedor con el retraso del escenario aplicado. */
  leadTimeOf: (supplier: SupplySupplier) => number;
  /** Lead time maximo del proveedor con el retraso del escenario aplicado. */
  maxLeadTimeOf: (supplier: SupplySupplier) => number;
  /** Confiabilidad del proveedor con la variacion del escenario aplicada. */
  reliabilityOf: (supplier: SupplySupplier) => number;
  /** Ordenes abiertas ya evaluadas contra el escenario. */
  orders: OpenOrderRow[];
  ordersOf: (materialId: string) => OpenOrderRow[];
}

/** Una orden se computa como abastecimiento firme si el proveedor la sostiene. */
function isFirmStatus(order: PurchaseOrder): boolean {
  return order.status === "confirmada" || order.status === "en-transito";
}

export function buildSupplyContext(scenario: SupplyScenario): SupplyContext {
  const days = supplyHorizonDays(scenario.horizonDays);
  const horizonDays = scenario.horizonDays;

  const demandFactor = 1 + scenario.demandVariationPct / 100;
  const scrapFactor = 1 + scenario.scrapPct / 100;

  const dailyConsumption: Record<string, number> = Object.fromEntries(
    supplyMaterials.map((material) => [
      material.id,
      baseDailyConsumptionByMaterial[material.id] * demandFactor * scrapFactor,
    ]),
  );

  const leadTimeOf = (supplier: SupplySupplier): number =>
    supplier.leadTimeDays + scenario.supplierDelayDays;
  const maxLeadTimeOf = (supplier: SupplySupplier): number =>
    supplier.maxLeadTimeDays + scenario.supplierDelayDays;
  const reliabilityOf = (supplier: SupplySupplier): number =>
    clamp(supplier.reliability + scenario.reliabilityVariationPoints / 100, 0.3, 1);

  const orders: OpenOrderRow[] = openPurchaseOrders
    .map((order) => {
      const offsets = orderOffsets[order.id];
      const arrivalDayOffset = offsets.estimated + scenario.supplierDelayDays;
      const delayDays = arrivalDayOffset - offsets.promised;
      const withinHorizon = arrivalDayOffset < horizonDays;
      const countsAsFirm = isFirmStatus(order) && withinHorizon;
      const material = supplyMaterials.find((item) => item.id === order.materialId)!;
      const supplier = supplySuppliersById[order.supplierId];

      return {
        order,
        materialCode: material.code,
        materialName: material.name,
        supplierName: supplier.name,
        delayDays,
        adjustedArrivalDate: supplyDayAt(arrivalDayOffset).date,
        arrivalDayOffset,
        withinHorizon,
        countsAsFirm,
        impact: buildOrderImpact(order, delayDays, withinHorizon, countsAsFirm, material),
      };
    })
    .sort(
      (a, b) =>
        b.delayDays - a.delayDays ||
        a.arrivalDayOffset - b.arrivalDayOffset ||
        a.order.id.localeCompare(b.order.id),
    );

  const ordersByMaterial = new Map<string, OpenOrderRow[]>();
  for (const row of orders) {
    const list = ordersByMaterial.get(row.order.materialId);
    if (list) list.push(row);
    else ordersByMaterial.set(row.order.materialId, [row]);
  }

  return {
    scenario,
    days,
    horizonDays,
    startDate: days[0].date,
    endDate: days[days.length - 1].date,
    materials: supplyMaterials,
    dailyConsumption,
    supplierOf: (material) => supplySuppliersById[material.supplierId],
    leadTimeOf,
    maxLeadTimeOf,
    reliabilityOf,
    orders,
    ordersOf: (materialId) => ordersByMaterial.get(materialId) ?? [],
  };
}

/** Texto determinista del impacto potencial de una orden abierta. */
function buildOrderImpact(
  order: PurchaseOrder,
  delayDays: number,
  withinHorizon: boolean,
  countsAsFirm: boolean,
  material: SupplyMaterial,
): string {
  if (countsAsFirm && delayDays <= 0) {
    return `Abastecimiento firme: sus ${material.unit === "u" ? "unidades" : material.unit} entran al stock proyectado del horizonte.`;
  }
  if (countsAsFirm && delayDays > 0) {
    return `Llega ${delayDays} dia(s) despues de lo comprometido: acorta el margen de cobertura de ${material.code} dentro del horizonte.`;
  }
  if (!withinHorizon) {
    return `Llega fuera del horizonte analizado: no se computa como abastecimiento y ${material.code} debe cubrirse con stock propio.`;
  }
  if (order.status === "retrasada") {
    return `Orden retrasada ${delayDays} dia(s): no se computa como firme, por lo que ${material.code} queda expuesto hasta que el proveedor confirme.`;
  }
  return `Orden pendiente de confirmacion: hasta que el proveedor la confirme, ${material.code} no puede contar con estas unidades.`;
}
