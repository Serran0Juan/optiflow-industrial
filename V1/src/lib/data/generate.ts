import { businessDaysBefore, businessDaysFrom } from "@/lib/dates";
import { createRng, gaussian, randomBetween, roundTo } from "@/lib/rng";
import type {
  AvailabilityEvent,
  BomLine,
  Dataset,
  DemandRecord,
  LineProductRate,
  Product,
  ProductionLine,
  RawMaterial,
  SetupTimeEntry,
  Supplier,
} from "@/lib/types";
import {
  ANNUAL_HOLDING_RATE,
  AVAILABILITY_EVENT_SEEDS,
  BOM_BY_FAMILY,
  BUSINESS_DAYS_PER_YEAR,
  CONTRIBUTION_MARGIN_RATE,
  FAMILIES,
  HISTORY_BUSINESS_DAYS,
  LINE_DEFINITIONS,
  MATERIAL_SEEDS,
  PLANNING_HORIZON_DAYS,
  PLANNING_START_DATE,
  PREFERRED_LINE_BY_FAMILY,
  PRODUCT_SEEDS,
  RATE_BY_LINE_FAMILY,
  SETUP_MATRIX,
  STOCKOUT_PENALTY_RATE,
  SUPPLIER_SEEDS,
  WEEKDAY_DEMAND_FACTOR,
} from "./config";

/**
 * Construye el dataset industrial simulado completo a partir de una semilla.
 *
 * El dimensionamiento de la demanda no es arbitrario: se calibra para que cada
 * linea quede cargada al `targetLoad` definido en la configuracion. Esa carga
 * (84-88%) es lo que hace que los cambios de formato y las horas extra sean
 * decisiones economicas relevantes y no ruido.
 */
export function generateDataset(seed: number): Dataset {
  const rng = createRng(seed);

  const historyDays = businessDaysBefore(PLANNING_START_DATE, HISTORY_BUSINESS_DAYS);
  const planningDays = businessDaysFrom(PLANNING_START_DATE, PLANNING_HORIZON_DAYS);

  const lines: ProductionLine[] = LINE_DEFINITIONS.map((definition) => ({
    id: definition.id,
    name: definition.name,
    description: definition.description,
    shiftsPerDay: definition.shiftsPerDay,
    hoursPerShift: definition.hoursPerShift,
    plannedDowntimeMinutesPerDay: definition.plannedDowntimeMinutesPerDay,
    regularMinutesPerDay:
      definition.shiftsPerDay * definition.hoursPerShift * 60 - definition.plannedDowntimeMinutesPerDay,
    maxOvertimeMinutesPerDay: definition.maxOvertimeMinutesPerDay,
    overtimeCostPerHour: definition.overtimeCostPerHour,
    setupCostPerHour: definition.setupCostPerHour,
    familiesAllowed: definition.familiesAllowed,
    initialFamilyId: definition.initialFamilyId,
  }));

  /* ---------------------------------------------------------------- */
  /* 1. Productos, lineas habilitadas y velocidades                     */
  /* ---------------------------------------------------------------- */

  const familyCounters: Record<string, number> = { LIQ: 0, CRE: 0, ENV: 0 };
  const rates: LineProductRate[] = [];

  const draft = PRODUCT_SEEDS.map((seedProduct, index) => {
    const familyIndex = familyCounters[seedProduct.familyId]++;
    const preferredLineId = PREFERRED_LINE_BY_FAMILY[seedProduct.familyId][familyIndex];
    const eligibleLines = lines.filter((line) => line.familiesAllowed.includes(seedProduct.familyId));

    const productId = `P${String(index + 1).padStart(2, "0")}`;
    for (const line of eligibleLines) {
      const range = RATE_BY_LINE_FAMILY[line.id][seedProduct.familyId];
      if (!range) continue;
      rates.push({
        lineId: line.id,
        productId,
        unitsPerMinute: Number(randomBetween(rng, range[0], range[1]).toFixed(2)),
      });
    }

    return {
      id: productId,
      seedProduct,
      preferredLineId,
      alternateLineIds: eligibleLines.map((line) => line.id).filter((id) => id !== preferredLineId),
      loadWeight: randomBetween(rng, 0.72, 1.38),
      trend: randomBetween(rng, -0.08, 0.16),
      noise: randomBetween(rng, 0.07, 0.15),
      weekdayTweak: randomBetween(rng, -0.05, 0.05),
      safetyStockDays: Number(randomBetween(rng, 0.8, 1.4).toFixed(2)),
      maxCoverDays: Number(randomBetween(rng, 2.8, 3.8).toFixed(2)),
      coverDays: Number(randomBetween(rng, 1.1, 2.9).toFixed(2)),
      spikeThreshold: randomBetween(rng, 0.955, 0.98),
    };
  });

  /* Se fuerzan tres productos con cobertura inicial critica para que el caso
     tenga un riesgo de quiebre real que la heuristica deba priorizar. */
  const criticalIndexes = [2, 9, 14];
  for (const index of criticalIndexes) {
    draft[index].coverDays = Number(randomBetween(rng, 0.35, 0.75).toFixed(2));
  }

  const rateOf = (lineId: string, productId: string): number =>
    rates.find((rate) => rate.lineId === lineId && rate.productId === productId)?.unitsPerMinute ?? 0;

  /* ---------------------------------------------------------------- */
  /* 2. Calibracion de la demanda base segun la carga objetivo por linea */
  /* ---------------------------------------------------------------- */

  const baseDemandByProduct: Record<string, number> = {};
  for (const definition of LINE_DEFINITIONS) {
    const line = lines.find((item) => item.id === definition.id)!;
    const assigned = draft.filter((item) => item.preferredLineId === definition.id);
    const weightTotal = assigned.reduce((acc, item) => acc + item.loadWeight, 0);
    const targetMinutes = line.regularMinutesPerDay * definition.targetLoad;

    for (const item of assigned) {
      const minutesForProduct = (targetMinutes * item.loadWeight) / weightTotal;
      const unitsPerMinute = rateOf(definition.id, item.id);
      baseDemandByProduct[item.id] = roundTo(minutesForProduct * unitsPerMinute, 10);
    }
  }

  /* ---------------------------------------------------------------- */
  /* 3. Historial de demanda (90 dias habiles)                          */
  /* ---------------------------------------------------------------- */

  const demandHistory: DemandRecord[] = [];
  for (const item of draft) {
    const base = baseDemandByProduct[item.id];
    for (const day of historyDays) {
      const weekdayFactor = (WEEKDAY_DEMAND_FACTOR[day.weekday] ?? 1) + item.weekdayTweak;
      const trendFactor = 1 + item.trend * (day.index / HISTORY_BUSINESS_DAYS);
      const noiseFactor = 1 + gaussian(rng) * item.noise;
      const spike = rng() > item.spikeThreshold ? randomBetween(rng, 1.25, 1.6) : 1;
      const units = Math.max(0, roundTo(base * weekdayFactor * trendFactor * noiseFactor * spike, 10));
      demandHistory.push({
        productId: item.id,
        dayIndex: day.index,
        date: day.date,
        weekday: day.weekday,
        units,
      });
    }
  }

  /* ---------------------------------------------------------------- */
  /* 4. Productos finales (stock inicial, costos y prioridad comercial)  */
  /* ---------------------------------------------------------------- */

  const averageDailyDemand: Record<string, number> = {};
  for (const item of draft) {
    const last20 = demandHistory
      .filter((record) => record.productId === item.id && record.dayIndex >= HISTORY_BUSINESS_DAYS - 20)
      .map((record) => record.units);
    averageDailyDemand[item.id] = last20.reduce((acc, value) => acc + value, 0) / last20.length;
  }

  /* La prioridad comercial del plan base es "atender primero lo que mas se
     vende": un criterio real de planta, pero ciego al costo de cambio. */
  const commercialOrder = [...draft].sort(
    (a, b) => averageDailyDemand[b.id] - averageDailyDemand[a.id] || a.id.localeCompare(b.id),
  );

  const products: Product[] = draft.map((item) => {
    const { seedProduct } = item;
    return {
      id: item.id,
      sku: seedProduct.sku,
      name: seedProduct.name,
      familyId: seedProduct.familyId,
      unitCost: seedProduct.unitCost,
      contributionMargin: Math.round(seedProduct.unitCost * CONTRIBUTION_MARGIN_RATE),
      stockoutPenaltyPerUnit: Math.round(seedProduct.unitCost * STOCKOUT_PENALTY_RATE),
      holdingCostPerUnitPerDay: Number(
        ((seedProduct.unitCost * ANNUAL_HOLDING_RATE) / BUSINESS_DAYS_PER_YEAR).toFixed(3),
      ),
      initialStock: roundTo(averageDailyDemand[item.id] * item.coverDays, 10),
      safetyStockDays: item.safetyStockDays,
      maxCoverDays: item.maxCoverDays,
      lotSize: seedProduct.lotSize,
      preferredLineId: item.preferredLineId,
      alternateLineIds: item.alternateLineIds,
      commercialPriority: commercialOrder.findIndex((candidate) => candidate.id === item.id) + 1,
    };
  });

  /* ---------------------------------------------------------------- */
  /* 5. Cambios de formato y disponibilidad                             */
  /* ---------------------------------------------------------------- */

  const setupTimes: SetupTimeEntry[] = [];
  for (const line of lines) {
    for (const from of line.familiesAllowed) {
      for (const to of line.familiesAllowed) {
        const minutes = SETUP_MATRIX[line.id][`${from}>${to}`] ?? 0;
        setupTimes.push({ lineId: line.id, fromFamily: from, toFamily: to, minutes });
      }
    }
  }

  const availabilityEvents: AvailabilityEvent[] = AVAILABILITY_EVENT_SEEDS.map((event) => ({ ...event }));

  /* ---------------------------------------------------------------- */
  /* 6. Materias primas, BOM y proveedores                              */
  /* ---------------------------------------------------------------- */

  const suppliers: Supplier[] = SUPPLIER_SEEDS.map((supplier) => ({ ...supplier }));

  const bom: BomLine[] = [];
  for (const product of products) {
    for (const entry of BOM_BY_FAMILY[product.familyId]) {
      bom.push({
        productId: product.id,
        materialId: entry.code,
        quantityPerUnit: entry.quantityPerUnit,
      });
    }
  }

  const rawMaterials: RawMaterial[] = MATERIAL_SEEDS.map((material) => {
    const dailyConsumption = bom
      .filter((entry) => entry.materialId === material.code)
      .reduce((acc, entry) => acc + entry.quantityPerUnit * averageDailyDemand[entry.productId], 0);
    return {
      id: material.code,
      code: material.code,
      name: material.name,
      unit: material.unit,
      unitCost: material.unitCost,
      initialStock: roundTo(dailyConsumption * material.initialCoverDays, 10),
      supplierId: material.supplierId,
      minCoverageDays: material.minCoverageDays,
    };
  });

  return {
    seed,
    generatedAt: PLANNING_START_DATE,
    families: FAMILIES,
    products,
    lines,
    rates,
    setupTimes,
    demandHistory,
    historyDays,
    planningDays,
    availabilityEvents,
    suppliers,
    rawMaterials,
    bom,
  };
}
