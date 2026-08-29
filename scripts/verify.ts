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
