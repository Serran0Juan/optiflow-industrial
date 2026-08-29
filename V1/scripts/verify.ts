/**
 * Verificacion de reproducibilidad y coherencia del caso simulado.
 * Ejecutar con: npm run verify
 *
 * Recalcula los tres presets y algunos escenarios extremos, e imprime los KPI
 * de ambos planes. Sirve para comprobar que el modelo responde a los cambios de
 * escenario y que el resultado es identico entre ejecuciones.
 */
import { dataset } from "../src/lib/data/dataset";
import { formatCurrency, formatNumber, formatPercent } from "../src/lib/format";
import { runPlanning } from "../src/lib/planning";
import { SCENARIO_PRESETS, DEFAULT_SCENARIO } from "../src/lib/planning/scenarios";
import type { Scenario } from "../src/lib/types";

function line(label: string, value: string): void {
  process.stdout.write(`  ${label.padEnd(34)} ${value}\n`);
}

function report(name: string, scenario: Scenario): void {
  const result = runPlanning(scenario, { force: true });
  const { base, recommended } = result.comparison;
  process.stdout.write(`\n=== ${name} ===\n`);
  line("Demanda total (u)", formatNumber(base.totalDemandUnits));
  line("Costo total base", formatCurrency(base.costs.total));
  line("Costo total recomendado", formatCurrency(recommended.costs.total));
  line(
    "Diferencia (base - recomendado)",
    `${formatCurrency(result.comparison.costDelta)} (${formatNumber(result.comparison.costDeltaPct, 1)}%)`,
  );
  line("Nivel de servicio base / rec.", `${formatPercent(base.serviceLevel)} / ${formatPercent(recommended.serviceLevel)}`);
  line("Setups base / rec.", `${base.setupCount} / ${recommended.setupCount}`);
  line(
    "Horas extra base / rec.",
    `${formatNumber(base.overtimeHours, 1)} / ${formatNumber(recommended.overtimeHours, 1)}`,
  );
  line(
    "Utilizacion base / rec.",
    `${formatPercent(base.utilization, 0)} / ${formatPercent(recommended.utilization, 0)}`,
  );
  line(
    "Unidades no atendidas base/rec.",
    `${formatNumber(base.unmetUnits)} / ${formatNumber(recommended.unmetUnits)}`,
  );
  line(
    "Costos rec. (setup/HE/inv/falt)",
    [
      formatCurrency(recommended.costs.setup),
      formatCurrency(recommended.costs.overtime),
      formatCurrency(recommended.costs.holding),
      formatCurrency(recommended.costs.stockout),
    ].join(" | "),
  );
  line(
    "Costos base (setup/HE/inv/falt)",
    [
      formatCurrency(base.costs.setup),
      formatCurrency(base.costs.overtime),
      formatCurrency(base.costs.holding),
      formatCurrency(base.costs.stockout),
    ].join(" | "),
  );
  line("Alertas generadas", String(result.alerts.length));
  line("Materias primas en riesgo", String(result.materials.filter((m) => m.status !== "ok").length));
}

process.stdout.write("OptiFlow Industrial - verificacion del caso simulado\n");
process.stdout.write(`Semilla: ${dataset.seed} | Productos: ${dataset.products.length} | Lineas: ${dataset.lines.length}\n`);
process.stdout.write(
  `Capacidad regular semanal: ${formatNumber(
    dataset.lines.reduce((acc, l) => acc + l.regularMinutesPerDay * dataset.planningDays.length, 0),
  )} min\n`,
);

for (const preset of SCENARIO_PRESETS) {
  report(preset.name, preset.scenario);
}

report("Caida de demanda -20%", { ...DEFAULT_SCENARIO, demandVariationPct: -20 });
report("Sin horas extra", { ...DEFAULT_SCENARIO, allowOvertime: false });
report("Setups +100%", { ...DEFAULT_SCENARIO, setupTimeIncreasePct: 100 });
report("Faltante x3", { ...DEFAULT_SCENARIO, stockoutCostMultiplier: 3 });
report("Capacidad -40%", { ...DEFAULT_SCENARIO, capacityReductionPct: 40 });

const first = runPlanning(DEFAULT_SCENARIO, { force: true });
const second = runPlanning(DEFAULT_SCENARIO, { force: true });
const reproducible =
  first.comparison.recommended.costs.total === second.comparison.recommended.costs.total &&
  first.recommended.runs.length === second.recommended.runs.length;
process.stdout.write(`\nReproducibilidad (dos corridas identicas): ${reproducible ? "OK" : "FALLA"}\n`);

/* ------------------------------------------------------------------ */
/* V1.1 - Balanceo de linea                                            */
/* ------------------------------------------------------------------ */

import { assemblyLine } from "../src/lib/data/assembly-line";
import { runBalance } from "../src/lib/balance";
import { BALANCE_PRESETS, DEFAULT_BALANCE_SCENARIO } from "../src/lib/balance/scenarios";
import { formatSeconds } from "../src/lib/format";
import type { BalanceScenario } from "../src/lib/types";

function reportBalance(name: string, scenario: BalanceScenario): void {
  const result = runBalance(scenario, { force: true });
  const { initial, recommended } = result.comparison;
  process.stdout.write(`\n=== [Balanceo] ${name} ===\n`);
  line("Demanda diaria (u)", formatNumber(initial.metrics.dailyDemandUnits));
  line("Tiempo disponible diario", `${formatNumber(initial.metrics.availableSeconds / 3600, 2)} h`);
  line("Takt time", formatSeconds(initial.metrics.taktSeconds));
  line("Contenido total de trabajo", formatSeconds(initial.metrics.totalWorkSeconds));
  line("Estaciones teoricas minimas", formatNumber(initial.metrics.theoreticalMinStations));
  line(
    "Estaciones inicial / recomendado",
    `${initial.metrics.stationCount} / ${recommended.metrics.stationCount}`,
  );
  line(
    "Tiempo de ciclo inicial / rec.",
    `${formatSeconds(initial.metrics.cycleSeconds)} / ${formatSeconds(recommended.metrics.cycleSeconds)}`,
  );
  line(
    "Capacidad diaria inicial / rec.",
    `${formatNumber(initial.metrics.dailyCapacityUnits)} / ${formatNumber(recommended.metrics.dailyCapacityUnits)} u`,
  );
  line(
    "Eficiencia inicial / recomendado",
    `${formatPercent(initial.metrics.lineEfficiency)} / ${formatPercent(recommended.metrics.lineEfficiency)}`,
  );
  line(
    "Perdida por desbalance ini / rec.",
    `${formatPercent(initial.metrics.balanceLoss)} / ${formatPercent(recommended.metrics.balanceLoss)}`,
  );
  line(
    "Cuello de botella ini / rec.",
    `E${initial.metrics.bottleneckStationIndex} / E${recommended.metrics.bottleneckStationIndex}`,
  );
  line(
    "No atendidas ini / rec. (u)",
    `${formatNumber(initial.metrics.unmetUnits)} / ${formatNumber(recommended.metrics.unmetUnits)}`,
  );
  line(
    "Costo total ini / rec.",
    `${formatCurrency(initial.cost.total)} / ${formatCurrency(recommended.cost.total)}`,
  );
  line(
    "Diferencia (inicial - recomendado)",
    `${formatCurrency(result.comparison.costDelta)} (${formatNumber(result.comparison.costDeltaPct, 1)}%)`,
  );
  line(
    "Cargas recomendadas (s)",
    recommended.stations.map((s) => formatNumber(s.loadSeconds, 1)).join(" | "),
  );
}

process.stdout.write("\n\nOptiFlow Industrial - verificacion del modulo de balanceo de linea\n");
process.stdout.write(
  `Caso: ${assemblyLine.id} | Tareas: ${assemblyLine.tasks.length} | Etapas: ${assemblyLine.stages.length}\n`,
);

for (const preset of BALANCE_PRESETS) {
  reportBalance(preset.name, preset.scenario);
}

reportBalance("Estable + estacion adicional", {
  ...DEFAULT_BALANCE_SCENARIO,
  extraStation: true,
});
reportBalance("Demanda -20%", { ...DEFAULT_BALANCE_SCENARIO, demandVariationPct: -20 });
reportBalance("Un solo turno", { ...DEFAULT_BALANCE_SCENARIO, shiftCount: 1 });
reportBalance("Tres turnos + demanda +30%", {
  ...DEFAULT_BALANCE_SCENARIO,
  shiftCount: 3,
  demandVariationPct: 30,
});
reportBalance("Tiempos estandar +20%", {
  ...DEFAULT_BALANCE_SCENARIO,
  taskTimeVariationPct: 20,
});

const balanceA = runBalance(DEFAULT_BALANCE_SCENARIO, { force: true });
const balanceB = runBalance(DEFAULT_BALANCE_SCENARIO, { force: true });
const balanceReproducible =
  balanceA.comparison.recommended.cost.total === balanceB.comparison.recommended.cost.total &&
  balanceA.comparison.recommended.metrics.cycleSeconds ===
    balanceB.comparison.recommended.metrics.cycleSeconds &&
  JSON.stringify(balanceA.taskRows.map((row) => row.recommendedStation)) ===
    JSON.stringify(balanceB.taskRows.map((row) => row.recommendedStation));
process.stdout.write(
  `\nReproducibilidad del balanceo (dos corridas identicas): ${balanceReproducible ? "OK" : "FALLA"}\n`,
);

/* ------------------------------------------------------------------ */
/* V2 - Torre de abastecimiento                                        */
/* ------------------------------------------------------------------ */

import {
  openPurchaseOrders,
  supplyBom,
  supplyMaterials,
  supplySuppliers,
} from "../src/lib/data/supply-catalog";
import { runSupply } from "../src/lib/supply";
import { NO_CONSUMPTION_COVERAGE } from "../src/lib/supply/metrics";
import { ACTIONABLE_ACTIONS } from "../src/lib/supply/recommendations";
import { DEFAULT_SUPPLY_SCENARIO, SUPPLY_PRESETS } from "../src/lib/supply/scenarios";
import type { SupplyAction, SupplyRiskLevel, SupplyScenario } from "../src/lib/types";

function countBy<T extends string>(values: T[]): string {
  const counts: Partial<Record<T, number>> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return Object.entries(counts)
    .map(([key, count]) => `${key}=${count}`)
    .join(" ");
}

function reportSupply(name: string, scenario: SupplyScenario): void {
  const result = runSupply(scenario, { force: true });
  const withConsumption = result.rows.filter(
    (row) => row.coverageDays !== NO_CONSUMPTION_COVERAGE,
  );
  const worst = [...withConsumption].sort((a, b) => a.coverageDays - b.coverageDays)[0];

  process.stdout.write(`\n=== [Abastecimiento] ${name} ===\n`);
  line("Horizonte (dias habiles)", `${scenario.horizonDays} (${result.startDate} a ${result.endDate})`);
  line("Materiales por riesgo", countBy(result.rows.map((row) => row.risk as SupplyRiskLevel)));
  line("Acciones recomendadas", countBy(result.recommendations.map((item) => item.action as SupplyAction)));
  line("Cobertura promedio", `${formatNumber(result.kpis.averageCoverageDays, 1)} dias`);
  line(
    "Menor cobertura",
    `${worst.material.code} ${formatNumber(worst.coverageDays, 1)} d (lead time ${worst.effectiveLeadTimeDays} d)`,
  );
  line("Bajo punto de pedido", `${result.kpis.materialsBelowReorderPoint} de ${result.rows.length}`);
  line("Ordenes retrasadas", `${result.kpis.delayedOrders} de ${result.orders.length}`);
  line("Valor de inventario", formatCurrency(result.kpis.inventoryValue));
  line("Costo de compras sugeridas", formatCurrency(result.kpis.totalPurchaseCost));
  line("Costo estimado en riesgo", formatCurrency(result.kpis.costAtRisk));
  line("Requieren decision humana", String(result.kpis.actionableRecommendations));
  line(
    "Unidades de producto en riesgo",
    formatNumber(result.rows.reduce((acc, row) => acc + row.productUnitsAtRisk, 0)),
  );
}

process.stdout.write("\n\nOptiFlow Industrial - verificacion de la Torre de abastecimiento\n");
process.stdout.write(
  `Materiales: ${supplyMaterials.length} | Proveedores: ${supplySuppliers.length} | Lineas de BOM: ${supplyBom.length} | Ordenes abiertas: ${openPurchaseOrders.length}\n`,
);

for (const preset of SUPPLY_PRESETS) {
  reportSupply(preset.name, preset.scenario);
}

reportSupply("Horizonte corto (7 dias)", { ...DEFAULT_SUPPLY_SCENARIO, horizonDays: 7 });
reportSupply("Horizonte largo (30 dias)", { ...DEFAULT_SUPPLY_SCENARIO, horizonDays: 30 });
reportSupply("Caida de demanda -20%", { ...DEFAULT_SUPPLY_SCENARIO, demandVariationPct: -20 });
reportSupply("Retraso maximo (10 dias)", { ...DEFAULT_SUPPLY_SCENARIO, supplierDelayDays: 10 });
reportSupply("Scrap +10%", { ...DEFAULT_SUPPLY_SCENARIO, scrapPct: 10 });

/* Coherencia estructural del caso: cada linea de BOM, cada material y cada
   orden deben referenciar entidades que existen. */
const materialIds = new Set(supplyMaterials.map((material) => material.id));
const supplierIds = new Set(supplySuppliers.map((supplier) => supplier.id));
const bomOk = supplyBom.every((linea) => materialIds.has(linea.materialId));
const materialSupplierOk = supplyMaterials.every((material) => supplierIds.has(material.supplierId));
const ordersOk = openPurchaseOrders.every(
  (order) => materialIds.has(order.materialId) && supplierIds.has(order.supplierId),
);
const everyMaterialUsed = supplyMaterials.every((material) =>
  supplyBom.some((linea) => linea.materialId === material.id),
);
process.stdout.write(
  `\nCoherencia del caso (BOM / materiales / ordenes / uso): ${
    bomOk && materialSupplierOk && ordersOk && everyMaterialUsed ? "OK" : "FALLA"
  }\n`,
);

/* Cada material recibe exactamente una accion principal. */
const baseline = runSupply(DEFAULT_SUPPLY_SCENARIO, { force: true });
const oneActionPerMaterial =
  baseline.recommendations.length === baseline.rows.length &&
  new Set(baseline.recommendations.map((item) => item.materialId)).size === baseline.rows.length;
process.stdout.write(
  `Una accion principal por material: ${oneActionPerMaterial ? "OK" : "FALLA"}\n`,
);

/* Las acciones accionables siempre proponen una cantidad y un costo. */
const actionableConsistent = baseline.recommendations
  .filter((item) => ACTIONABLE_ACTIONS.includes(item.action))
  .every((item) => item.quantity > 0 && item.estimatedCost > 0);
process.stdout.write(
  `Acciones con cantidad y costo asociados: ${actionableConsistent ? "OK" : "FALLA"}\n`,
);

/* Ningun material con consumo puede tener cobertura infinita ni NaN. */
const coverageSafe = baseline.rows.every(
  (row) =>
    (row.dailyConsumption > 0 && Number.isFinite(row.coverageDays)) ||
    (row.dailyConsumption === 0 && row.coverageDays === NO_CONSUMPTION_COVERAGE),
);
process.stdout.write(`Cobertura sin division por cero: ${coverageSafe ? "OK" : "FALLA"}\n`);

/* Reproducibilidad: dos corridas del mismo escenario deben ser identicas. */
const supplyA = runSupply(DEFAULT_SUPPLY_SCENARIO, { force: true });
const supplyB = runSupply(DEFAULT_SUPPLY_SCENARIO, { force: true });
const supplyReproducible =
  JSON.stringify(supplyA.rows.map((row) => [row.material.id, row.risk, row.suggestedQuantity])) ===
    JSON.stringify(supplyB.rows.map((row) => [row.material.id, row.risk, row.suggestedQuantity])) &&
  JSON.stringify(supplyA.recommendations.map((item) => [item.materialId, item.action, item.reason])) ===
    JSON.stringify(supplyB.recommendations.map((item) => [item.materialId, item.action, item.reason]));
process.stdout.write(
  `Reproducibilidad del abastecimiento (dos corridas identicas): ${supplyReproducible ? "OK" : "FALLA"}\n`,
);

/* El escenario debe mover los resultados: mas demanda no puede dejar todo igual. */
const stressed = runSupply(
  { ...DEFAULT_SUPPLY_SCENARIO, demandVariationPct: 30, scrapPct: 10 },
  { force: true },
);
const scenarioSensitive =
  stressed.kpis.averageCoverageDays < baseline.kpis.averageCoverageDays &&
  stressed.kpis.totalPurchaseCost > baseline.kpis.totalPurchaseCost;
process.stdout.write(
  `Sensibilidad al escenario (mas demanda reduce cobertura y sube compras): ${
    scenarioSensitive ? "OK" : "FALLA"
  }\n`,
);
