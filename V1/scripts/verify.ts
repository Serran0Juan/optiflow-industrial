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

/* ------------------------------------------------------------------ */
/* V3 - ABC, stock de seguridad estadistico, OEE, Factory Physics y     */
/*      reglas de despacho                                              */
/* ------------------------------------------------------------------ */

import { classifiedMaterials, materialAbcProfiles } from "../src/lib/data/supply-catalog";
import { ABC_THRESHOLDS, SERVICE_LEVEL_POLICIES } from "../src/lib/data/supply-config";
import { buildFactoryPhysics } from "../src/lib/balance/factory-physics";
import { DISPATCH_RULES } from "../src/lib/planning/dispatch";
import { SERVICE_LEVELS } from "../src/lib/stats";

process.stdout.write("\n\nOptiFlow Industrial - verificacion de ABC, stock de seguridad y OEE\n");

/* --- Analisis ABC --- */
const abcCounts: Record<string, number> = { A: 0, B: 0, C: 0 };
const abcValue: Record<string, number> = { A: 0, B: 0, C: 0 };
for (const material of classifiedMaterials) {
  abcCounts[material.abc.abcClass] += 1;
  abcValue[material.abc.abcClass] += material.abc.valueShare;
}
process.stdout.write("\n=== [ABC] Clasificacion por consumo valorizado ===\n");
for (const abcClass of ["A", "B", "C"]) {
  line(
    `Clase ${abcClass}`,
    `${abcCounts[abcClass]} materiales | ${formatPercent(abcValue[abcClass], 1)} del valor`,
  );
}

/* La participacion acumulada debe llegar exactamente a 1 y ser monotona. */
const ranked = Object.values(materialAbcProfiles).sort((a, b) => a.rank - b.rank);
let monotonic = true;
for (let i = 1; i < ranked.length; i += 1) {
  if (ranked[i].cumulativeShare < ranked[i - 1].cumulativeShare - 1e-9) monotonic = false;
  if (ranked[i].dailyValue > ranked[i - 1].dailyValue + 1e-9) monotonic = false;
}
const totalShare = ranked.reduce((acc, item) => acc + item.valueShare, 0);
process.stdout.write(
  `\nPareto monotono y participaciones suman 1: ${
    monotonic && Math.abs(totalShare - 1) < 1e-9 ? "OK" : "FALLA"
  }\n`,
);

/* Los cortes tienen que respetarse: ningun material de clase A puede quedar por
   encima del umbral acumulado, salvo el primero del ranking. */
const cutsRespected = ranked.every(
  (item) =>
    item.rank === 1 ||
    (item.abcClass === "A" && item.cumulativeShare <= ABC_THRESHOLDS.a + 1e-9) ||
    (item.abcClass === "B" && item.cumulativeShare <= ABC_THRESHOLDS.b + 1e-9) ||
    item.abcClass === "C",
);
process.stdout.write(`Cortes ABC respetados: ${cutsRespected ? "OK" : "FALLA"}\n`);

/* --- Stock de seguridad estadistico --- */
process.stdout.write("\n=== [Stock de seguridad] Politicas de nivel de servicio ===\n");
for (const policy of SERVICE_LEVEL_POLICIES) {
  const result = runSupply(
    { ...DEFAULT_SUPPLY_SCENARIO, serviceLevelPolicyId: policy.id },
    { force: true },
  );
  line(
    policy.name,
    `${formatCurrency(result.kpis.safetyStockValue)} inmovilizados | criticos ${result.kpis.criticalMaterials} | compras ${formatCurrency(result.kpis.totalPurchaseCost)}`,
  );
}

/* Mas nivel de servicio tiene que costar mas stock: la curva debe ser creciente. */
const tradeoff = runSupply(DEFAULT_SUPPLY_SCENARIO, { force: true }).serviceLevelTradeoff;
const increasing = tradeoff.every(
  (point, index) => index === 0 || point.safetyStockValue >= tradeoff[index - 1].safetyStockValue,
);
process.stdout.write(
  `\nCurva nivel de servicio creciente (${tradeoff.length} puntos, Z de ${formatNumber(SERVICE_LEVELS[0].z, 2)} a ${formatNumber(SERVICE_LEVELS[SERVICE_LEVELS.length - 1].z, 2)}): ${increasing ? "OK" : "FALLA"}\n`,
);

/* El desvio se descompone en dos terminos que deben sumar 1. */
const baseSupply = runSupply(DEFAULT_SUPPLY_SCENARIO, { force: true });
const sharesOk = baseSupply.rows.every(
  (row) =>
    row.dailyConsumption <= 0 ||
    Math.abs(row.sigmaDemandShare + row.sigmaLeadTimeShare - 1) < 1e-3,
);
process.stdout.write(`Descomposicion del desvio suma 1: ${sharesOk ? "OK" : "FALLA"}\n`);

/* Cada politica de revision tiene que disparar el calculo que le corresponde. */
const policiesOk = baseSupply.rows.every((row) =>
  row.reviewPolicy === "continua" ? row.reviewPeriodDays === 1 : row.reviewPeriodDays > 1,
);
process.stdout.write(`Politica de revision coherente con la clase ABC: ${policiesOk ? "OK" : "FALLA"}\n`);

/* --- OEE --- */
process.stdout.write("\n=== [OEE] Capacidad efectiva del plan recomendado ===\n");
const oeeResult = runPlanning(DEFAULT_SCENARIO, { force: true }).oee;
for (const lineOee of oeeResult.lines) {
  line(
    lineOee.lineId,
    `OEE ${formatPercent(lineOee.oee, 1)} = A ${formatPercent(lineOee.availability, 1)} x P ${formatPercent(lineOee.performance, 1)} x Q ${formatPercent(lineOee.quality, 1)}`,
  );
}
line(
  "Planta",
  `OEE ${formatPercent(oeeResult.plant.oee, 1)} | linea mas baja: ${oeeResult.worstLineId}`,
);

/* El OEE y sus tres perdidas tienen que sumar exactamente 100 puntos. */
const oeeAddsUp = oeeResult.lines.every(
  (item) =>
    Math.abs(
      item.oee * 100 +
        item.availabilityLossPoints +
        item.performanceLossPoints +
        item.qualityLossPoints -
        100,
    ) < 1e-6,
);
process.stdout.write(`\nOEE mas perdidas suman 100 puntos: ${oeeAddsUp ? "OK" : "FALLA"}\n`);

const oeeBounded = oeeResult.lines.every(
  (item) =>
    item.availability >= 0 &&
    item.availability <= 1 &&
    item.performance >= 0 &&
    item.performance <= 1 &&
    item.quality > 0 &&
    item.quality <= 1,
);
process.stdout.write(`Componentes del OEE dentro de [0, 1]: ${oeeBounded ? "OK" : "FALLA"}\n`);

/* --- Factory Physics --- */
process.stdout.write("\n=== [Factory Physics] Ley de Little en el balance recomendado ===\n");
const physicsMetrics = runBalance(DEFAULT_BALANCE_SCENARIO, { force: true }).comparison.recommended
  .metrics;
const physics = buildFactoryPhysics(physicsMetrics);
line("Tasa de cuello de botella rb", `${formatNumber(physics.bottleneckRatePerHour, 1)} u/h`);
line("Tiempo neto de proceso T0", formatSeconds(physics.rawProcessSeconds));
line("WIP critico W0 = rb x T0", `${formatNumber(physics.criticalWip, 2)} u`);
line("Tiempo de flujo en W0", formatSeconds(physics.criticalFlowSeconds));

/* Ley de Little en el WIP critico: W0 = TH x TF con TH = rb y TF = T0. */
const littleOk =
  Math.abs(
    (physics.criticalThroughputPerHour / 3600) * physics.criticalFlowSeconds - physics.criticalWip,
  ) < 1e-6;
process.stdout.write(`\nLey de Little (WIP = TH x TF) en W0: ${littleOk ? "OK" : "FALLA"}\n`);

/* El mejor caso nunca puede quedar por debajo del peor caso practico. */
const boundsOk = physics.curve.every(
  (point) => point.bestThroughput >= point.practicalThroughput - 1e-9,
);
process.stdout.write(`Mejor caso siempre por encima del peor caso practico: ${boundsOk ? "OK" : "FALLA"}\n`);

/* El throughput nunca puede superar la tasa del cuello de botella. */
const rbOk = physics.curve.every(
  (point) => point.bestThroughput <= physics.bottleneckRatePerHour + 1e-6,
);
process.stdout.write(`Throughput acotado por rb: ${rbOk ? "OK" : "FALLA"}\n`);

/* --- Reglas de despacho --- */
process.stdout.write("\n=== [Despacho] Comparacion de reglas con capacidad -25% y demanda +20% ===\n");
const dispatchStress = { ...DEFAULT_SCENARIO, capacityReductionPct: 25, demandVariationPct: 20 };
for (const rule of DISPATCH_RULES) {
  const result = runPlanning({ ...dispatchStress, dispatchRule: rule.id }, { force: true });
  const evaluation = result.comparison.recommended;
  line(
    rule.name,
    `${formatCurrency(evaluation.costs.total)} | servicio ${formatPercent(evaluation.serviceLevel)} | setups ${evaluation.setupCount} | no atendidas ${formatNumber(evaluation.unmetUnits)}`,
  );
}

/* La regla por defecto tiene que reproducir el criterio historico: si esto
   falla, todos los resultados publicados del caso cambiaron. */
const defaultRun = runPlanning(DEFAULT_SCENARIO, { force: true });
const explicitRun = runPlanning({ ...DEFAULT_SCENARIO, dispatchRule: "riesgo" }, { force: true });
const defaultStable =
  defaultRun.comparison.recommended.costs.total === explicitRun.comparison.recommended.costs.total &&
  defaultRun.recommended.runs.length === explicitRun.recommended.runs.length;
process.stdout.write(
  `\nRegla por defecto equivale a "riesgo de cobertura": ${defaultStable ? "OK" : "FALLA"}\n`,
);

/* Las reglas alternativas tienen que producir planes realmente distintos. */
const dispatchStressCosts = DISPATCH_RULES.map(
  (rule) =>
    runPlanning({ ...dispatchStress, dispatchRule: rule.id }, { force: true }).comparison.recommended.costs
      .total,
);
const rulesDiffer = new Set(dispatchStressCosts).size > 1;
process.stdout.write(
  `Las reglas producen planes distintos bajo restriccion: ${rulesDiffer ? "OK" : "FALLA"}\n`,
);

/* Reproducibilidad de todo lo nuevo. */
const abcA = JSON.stringify(classifiedMaterials.map((m) => [m.id, m.abc.abcClass, m.abc.rank]));
const reproA = runSupply(DEFAULT_SUPPLY_SCENARIO, { force: true });
const reproB = runSupply(DEFAULT_SUPPLY_SCENARIO, { force: true });
const statsReproducible =
  abcA === JSON.stringify(classifiedMaterials.map((m) => [m.id, m.abc.abcClass, m.abc.rank])) &&
  JSON.stringify(reproA.rows.map((r) => [r.material.id, r.safetyStockUnits, r.reorderPoint])) ===
    JSON.stringify(reproB.rows.map((r) => [r.material.id, r.safetyStockUnits, r.reorderPoint]));
process.stdout.write(
  `Reproducibilidad de ABC y stock de seguridad: ${statsReproducible ? "OK" : "FALLA"}\n`,
);
