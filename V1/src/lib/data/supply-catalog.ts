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
import { coefficientOfVariation, standardDeviation } from "@/lib/stats";
import { roundTo } from "@/lib/rng";
import { baseForecast } from "@/lib/planning/forecast";
import type {
  AbcClass,
  ClassifiedMaterial,
  MaterialAbcProfile,
  PlanningDay,
  Product,
  PurchaseOrder,
  SupplyMaterial,
  SupplySupplier,
} from "@/lib/types";
import { BOM_BY_FAMILY } from "./config";
import { dataset } from "./dataset";
import {
  ABC_THRESHOLDS,
  CONSUMPTION_SIGMA_WINDOW_DAYS,
  MAX_LEAD_TIME_PERCENTILE_Z,
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

/* ------------------------------------------------------------------ */
/* Variabilidad del consumo y clasificacion ABC                        */
/* ------------------------------------------------------------------ */

/**
 * Serie historica de consumo diario de un material.
 *
 * El historial del caso registra demanda de producto terminado, no consumo de
 * materia prima. Para obtener la serie del material se explota la lista de
 * materiales dia por dia: el consumo del dia d es la suma, sobre todos los
 * productos, de su demanda ese dia por su consumo unitario del material.
 *
 * Esto importa: el desvio resultante NO es la suma de los desvios de cada
 * producto. Los picos de un producto se compensan con los valles de otro, de
 * modo que un material compartido por muchos SKU tiene menos variabilidad
 * relativa que cada SKU por separado. Es el mismo efecto que sostiene el
 * pooling de inventarios.
 */
function buildConsumptionSeries(materialId: string): number[] {
  const lines = bomLinesForMaterial(materialId);
  if (lines.length === 0) return [];

  const demandByProductDay = new Map<string, number>();
  for (const record of dataset.demandHistory) {
    demandByProductDay.set(`${record.productId}:${record.dayIndex}`, record.units);
  }

  const firstDay = Math.max(0, dataset.historyDays.length - CONSUMPTION_SIGMA_WINDOW_DAYS);
  const series: number[] = [];
  for (let day = firstDay; day < dataset.historyDays.length; day += 1) {
    let consumption = 0;
    for (const line of lines) {
      consumption +=
        line.quantityPerUnit * (demandByProductDay.get(`${line.productId}:${day}`) ?? 0);
    }
    series.push(consumption);
  }
  return series;
}

/** Series de consumo historico por material, calculadas una sola vez. */
const consumptionSeries: Record<string, number[]> = Object.fromEntries(
  SUPPLY_MATERIAL_SEEDS.map((seed) => [seed.code, buildConsumptionSeries(seed.code)]),
);

/**
 * Analisis ABC sobre el consumo valorizado (Pareto).
 *
 * Criterio de valorizacion: consumo diario base por costo unitario. Se usa el
 * consumo base y no el del escenario a proposito: la clasificacion ABC es una
 * decision de politica que se revisa cada varios meses, no algo que deba
 * cambiar cada vez que alguien mueve un control del simulador.
 */
function buildAbcProfiles(): Record<string, MaterialAbcProfile> {
  const valued = SUPPLY_MATERIAL_SEEDS.map((seed) => ({
    materialId: seed.code,
    dailyValue: baseDailyConsumptionByMaterial[seed.code] * seed.unitCost,
  })).sort((a, b) => b.dailyValue - a.dailyValue || a.materialId.localeCompare(b.materialId));

  const total = valued.reduce((acc, item) => acc + item.dailyValue, 0);
  const profiles: Record<string, MaterialAbcProfile> = {};

  let cumulative = 0;
  valued.forEach((item, index) => {
    const valueShare = total > 0 ? item.dailyValue / total : 0;
    cumulative += valueShare;

    /* El corte se evalua sobre el acumulado INCLUYENDO al material: asi el
       material que cruza el 80% queda dentro de la clase A y no fuera. */
    const abcClass: AbcClass =
      cumulative <= ABC_THRESHOLDS.a + 1e-9
        ? "A"
        : cumulative <= ABC_THRESHOLDS.b + 1e-9
          ? "B"
          : "C";

    const series = consumptionSeries[item.materialId] ?? [];
    const dailySigma = standardDeviation(series);

    profiles[item.materialId] = {
      materialId: item.materialId,
      abcClass,
      rank: index + 1,
      dailyValue: item.dailyValue,
      valueShare,
      cumulativeShare: cumulative,
      dailySigma,
      consumptionCv: coefficientOfVariation(series),
    };
  });

  /* El primer material del ranking siempre es clase A, aunque por si solo ya
     supere el corte del 80%: no tendria sentido que el material que mas pesa
     quedara clasificado como B. */
  const first = valued[0];
  if (first) profiles[first.materialId].abcClass = "A";

  return profiles;
}

export const materialAbcProfiles: Record<string, MaterialAbcProfile> = buildAbcProfiles();

/** Materias primas con su clase ABC y su variabilidad ya incorporadas. */
export const classifiedMaterials: ClassifiedMaterial[] = supplyMaterials.map((material) => ({
  ...material,
  abc: materialAbcProfiles[material.id],
}));

/**
 * Desvio del plazo de entrega de un proveedor, en dias habiles.
 *
 * El caso no guarda un historial de entregas, asi que el desvio se deriva de
 * dos datos que si tiene, con supuestos explicitos:
 *
 *   1. El lead time maximo simulado se interpreta como el percentil 95 de la
 *      distribucion de plazos, de donde sigma = (LT_max - LT_medio) / 1,645.
 *   2. Ese desvio se escala por la confiabilidad del proveedor: un proveedor
 *      que cumple el 79% de las veces es mas erratico que uno que cumple el
 *      96%, aun con el mismo rango de plazos.
 */
export function leadTimeSigma(supplier: SupplySupplier): number {
  const spread = Math.max(0, supplier.maxLeadTimeDays - supplier.leadTimeDays);
  const base = spread / MAX_LEAD_TIME_PERCENTILE_Z;
  return supplier.reliability > 0 ? base / supplier.reliability : base;
}
