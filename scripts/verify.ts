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
