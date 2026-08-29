/**
 * Catalogo derivado de la Torre de abastecimiento (V2).
 *
 * Toma las constantes de `supply-config.ts` y las convierte en el dataset que
 * consume el modulo: materias primas con stock dimensionado, proveedores,
 * lista de materiales completa por producto y ordenes de compra abiertas con
 * fechas reales del calendario.
 *
 * Todo se calcula una sola vez por proceso y es completamente determinista: no
 * interviene ningun generador aleatorio, por lo que servidor y navegador ven
 * exactamente los mismos numeros.
 */
import { businessDaysBefore, businessDaysFrom } from "@/lib/dates";
import { roundTo } from "@/lib/rng";
import { baseForecast } from "@/lib/planning/forecast";
import type {
  PlanningDay,
  Product,
  PurchaseOrder,
  SupplyMaterial,
  SupplySupplier,
} from "@/lib/types";
import { BOM_BY_FAMILY } from "./config";
import { dataset } from "./dataset";
import {
  PURCHASE_ORDER_SEEDS,
  SUPPLY_BOM_BY_SKU,
  SUPPLY_BOM_EXTRA_BY_FAMILY,
  SUPPLY_MATERIAL_SEEDS,
  SUPPLY_START_DATE,
  SUPPLY_SUPPLIER_SEEDS,
} from "./supply-config";

/** Linea de la lista de materiales ampliada de la V2. */
export interface SupplyBomLine {
  productId: string;
  sku: string;
  materialId: string;
  quantityPerUnit: number;
}

/* ------------------------------------------------------------------ */
/* Calendario del modulo (dias habiles)                                */
/* ------------------------------------------------------------------ */

/** Cantidad de dias habiles que se precalculan hacia adelante y hacia atras. */
const FORWARD_DAYS = 45;
const BACKWARD_DAYS = 20;

const forwardDays: PlanningDay[] = businessDaysFrom(SUPPLY_START_DATE, FORWARD_DAYS);
const backwardDays: PlanningDay[] = businessDaysBefore(SUPPLY_START_DATE, BACKWARD_DAYS);

/**
 * Traduce un desplazamiento en dias habiles respecto del inicio del horizonte a
 * un dia del calendario. El offset 0 es el primer dia del horizonte.
 */
export function supplyDayAt(offset: number): PlanningDay {
  if (offset >= 0) {
    const day = forwardDays[Math.min(offset, forwardDays.length - 1)];
    return { ...day, index: offset };
  }
  const fromEnd = backwardDays.length + offset; // offset negativo
  const day = backwardDays[Math.max(0, fromEnd)];
  return { ...day, index: offset };
}

/** Los `count` dias habiles del horizonte, empezando en el inicio del modulo. */
export function supplyHorizonDays(count: number): PlanningDay[] {
  return forwardDays.slice(0, count).map((day, index) => ({ ...day, index }));
}

/* ------------------------------------------------------------------ */
/* Proveedores                                                         */
/* ------------------------------------------------------------------ */

export const supplySuppliers: SupplySupplier[] = SUPPLY_SUPPLIER_SEEDS.map((seed) => ({ ...seed }));

export const supplySuppliersById: Record<string, SupplySupplier> = Object.fromEntries(
  supplySuppliers.map((supplier) => [supplier.id, supplier]),
);

/* ------------------------------------------------------------------ */
/* Lista de materiales ampliada                                        */
/* ------------------------------------------------------------------ */

function buildBom(): SupplyBomLine[] {
  const lines: SupplyBomLine[] = [];

  for (const product of dataset.products) {
    const override = SUPPLY_BOM_BY_SKU[product.sku];
    const removed = new Set(override?.remove ?? []);
    const quantities = new Map<string, number>();

    for (const entry of BOM_BY_FAMILY[product.familyId]) {
      if (removed.has(entry.code)) continue;
      quantities.set(entry.code, (quantities.get(entry.code) ?? 0) + entry.quantityPerUnit);
    }
    for (const entry of SUPPLY_BOM_EXTRA_BY_FAMILY[product.familyId]) {
      if (removed.has(entry.code)) continue;
      quantities.set(entry.code, (quantities.get(entry.code) ?? 0) + entry.quantityPerUnit);
    }
    for (const entry of override?.add ?? []) {
      quantities.set(entry.code, (quantities.get(entry.code) ?? 0) + entry.quantityPerUnit);
    }

    for (const [materialId, quantityPerUnit] of quantities) {
      lines.push({ productId: product.id, sku: product.sku, materialId, quantityPerUnit });
    }
  }

  return lines;
}

export const supplyBom: SupplyBomLine[] = buildBom();

const bomByMaterial = new Map<string, SupplyBomLine[]>();
for (const line of supplyBom) {
  const list = bomByMaterial.get(line.materialId);
  if (list) list.push(line);
  else bomByMaterial.set(line.materialId, [line]);
}

/** Lineas de BOM que consumen un material, ordenadas por codigo de producto. */
export function bomLinesForMaterial(materialId: string): SupplyBomLine[] {
  return bomByMaterial.get(materialId) ?? [];
}

/* ------------------------------------------------------------------ */
/* Demanda base y consumo base por material                            */
/* ------------------------------------------------------------------ */

/**
 * Demanda diaria base por producto, en unidades por dia habil.
 *
 * Se reutiliza el pronostico del planificador (media ponderada con decaimiento
 * lineal de los ultimos 20 dias habiles) para que el consumo de materia prima
 * derive de la misma demanda que alimenta el plan de produccion. Es una lectura:
 * el modulo no modifica el pronostico ni el estado del planificador.
 */
export const baseDailyDemandByProduct: Record<string, number> = Object.fromEntries(
  dataset.products.map((product) => [
    product.id,
    baseForecast[product.id].weightedRecentAverage,
  ]),
);

/** Consumo diario base por material, sin escenario aplicado (unidades/dia habil). */
export const baseDailyConsumptionByMaterial: Record<string, number> = Object.fromEntries(
  SUPPLY_MATERIAL_SEEDS.map((seed) => [
    seed.code,
    bomLinesForMaterial(seed.code).reduce(
      (acc, line) => acc + line.quantityPerUnit * baseDailyDemandByProduct[line.productId],
      0,
    ),
  ]),
);

/* ------------------------------------------------------------------ */
/* Materias primas                                                     */
/* ------------------------------------------------------------------ */

/**
 * Stock inicial = consumo diario base x cobertura inicial definida en el caso.
 * Es el mismo criterio de dimensionamiento que usa la V1 para sus doce
 * materiales, extendido a los cinco que agrega la V2.
 */
export const supplyMaterials: SupplyMaterial[] = SUPPLY_MATERIAL_SEEDS.map((seed) => ({
  id: seed.code,
  code: seed.code,
  name: seed.name,
  category: seed.category,
  unit: seed.unit,
  stockOnHand: roundTo(baseDailyConsumptionByMaterial[seed.code] * seed.initialCoverDays, 10),
  safetyStockDays: seed.safetyStockDays,
  unitCost: seed.unitCost,
  criticality: seed.criticality,
  supplierId: seed.supplierId,
}));

export const supplyMaterialsById: Record<string, SupplyMaterial> = Object.fromEntries(
  supplyMaterials.map((material) => [material.id, material]),
);

/* ------------------------------------------------------------------ */
/* Impacto de un faltante sobre el producto terminado                  */
/* ------------------------------------------------------------------ */

export interface MaterialImpactProfile {
  /** Unidades de producto terminado que se pierden por cada unidad faltante. */
  productUnitsPerMaterialUnit: number;
  /** Margen de contribucion perdido por cada unidad de material faltante (ARS). */
  marginPerMaterialUnit: number;
  /** Participacion de cada producto en el consumo del material. */
  topProducts: Array<{ sku: string; sharePct: number }>;
}

/**
 * Perfil de impacto de cada material.
 *
 * Un faltante se reparte entre los productos que consumen el material, en
 * proporcion a su consumo. Para cada producto, el faltante asignado se divide
 * por su consumo unitario para obtener las unidades que no se podrian fabricar,
 * y esas unidades se valorizan con el margen de contribucion del producto.
 */
function buildImpactProfiles(): Record<string, MaterialImpactProfile> {
  const productById: Record<string, Product> = Object.fromEntries(
    dataset.products.map((product) => [product.id, product]),
  );

  const profiles: Record<string, MaterialImpactProfile> = {};

  for (const material of supplyMaterials) {
    const lines = bomLinesForMaterial(material.id);
    const consumptionByLine = lines.map((line) => ({
      line,
      consumption: line.quantityPerUnit * baseDailyDemandByProduct[line.productId],
    }));
    const total = consumptionByLine.reduce((acc, item) => acc + item.consumption, 0);

    if (total <= 0) {
      profiles[material.id] = {
        productUnitsPerMaterialUnit: 0,
        marginPerMaterialUnit: 0,
        topProducts: [],
      };
      continue;
    }

    let productUnitsPerMaterialUnit = 0;
    let marginPerMaterialUnit = 0;
    for (const item of consumptionByLine) {
      const share = item.consumption / total;
      const unitsPerMaterialUnit = share / item.line.quantityPerUnit;
      productUnitsPerMaterialUnit += unitsPerMaterialUnit;
      marginPerMaterialUnit +=
        unitsPerMaterialUnit * productById[item.line.productId].contributionMargin;
    }

    const topProducts = [...consumptionByLine]
      .sort(
        (a, b) => b.consumption - a.consumption || a.line.sku.localeCompare(b.line.sku),
      )
      .slice(0, 3)
      .map((item) => ({
        sku: item.line.sku,
        sharePct: (item.consumption / total) * 100,
      }));

    profiles[material.id] = {
      productUnitsPerMaterialUnit,
      marginPerMaterialUnit,
      topProducts,
    };
  }

  return profiles;
}

export const materialImpactProfiles: Record<string, MaterialImpactProfile> = buildImpactProfiles();

/* ------------------------------------------------------------------ */
/* Ordenes de compra abiertas                                          */
/* ------------------------------------------------------------------ */

/**
 * Ordenes abiertas del caso. La cantidad se expresa en dias de consumo base y
 * se convierte a unidades aca; el costo usa el precio del proveedor, es decir el
 * costo del material afectado por su factor de precio.
 */
export const openPurchaseOrders: PurchaseOrder[] = PURCHASE_ORDER_SEEDS.map((seed) => {
  const material = supplyMaterialsById[seed.materialCode];
  const supplier = supplySuppliersById[seed.supplierId];
  const quantity = roundTo(
    baseDailyConsumptionByMaterial[seed.materialCode] * seed.quantityCoverDays,
    10,
  );
  return {
    id: seed.id,
    supplierId: seed.supplierId,
    materialId: seed.materialCode,
    quantity,
    issuedDate: supplyDayAt(seed.issuedDayOffset).date,
    promisedDate: supplyDayAt(seed.promisedDayOffset).date,
    estimatedDate: supplyDayAt(seed.estimatedDayOffset).date,
    status: seed.status,
    cost: Math.round(quantity * material.unitCost * supplier.priceFactor),
    delayRisk: seed.delayRisk,
  };
});

/** Ordenes abiertas de un material, ordenadas por llegada estimada. */
export function ordersForMaterial(materialId: string): PurchaseOrder[] {
  return openPurchaseOrders
    .filter((order) => order.materialId === materialId)
    .sort((a, b) => a.estimatedDate.localeCompare(b.estimatedDate) || a.id.localeCompare(b.id));
}

/** Desplazamiento en dias habiles de una orden respecto del inicio del horizonte. */
export const orderOffsets: Record<string, { promised: number; estimated: number }> =
  Object.fromEntries(
    PURCHASE_ORDER_SEEDS.map((seed) => [
      seed.id,
      { promised: seed.promisedDayOffset, estimated: seed.estimatedDayOffset },
    ]),
  );
