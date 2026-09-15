/** Behavior checks for the plant's flow model. Run: npm run verify:plant. */
import assert from "node:assert/strict";
import { dataset } from "../src/lib/data/dataset";
import { DEFAULT_SCENARIO, runPlanning } from "../src/lib/planning";
import { DEFAULT_PLANT_SCENARIO, PLANT_PRESETS, runPlantSimulation } from "../src/lib/plant";
import type { PlantSimulation } from "../src/lib/plant";
import type { PlanRun, ProductionPlan } from "../src/lib/types";

const EPSILON = 0.00001;
let frameChecks = 0;

function near(actual: number, expected: number, message: string): void {
  assert.ok(Math.abs(actual - expected) < EPSILON, `${message}: ${actual} vs. ${expected}`);
}

function checkFlow(result: PlantSimulation): void {
  assert.equal(result.frames.length, result.horizonMinutes + 1);
  assert.equal(result.frames[0].totals.released, 0);
  for (let index = 0; index < result.frames.length; index += 1) {
    const frame = result.frames[index];
    assert.equal(frame.minute, index);
    assert.ok(frame.dispatchRate <= result.scenario.dispatchCapacityPerHour / 60 + EPSILON);
    near(frame.totals.released, frame.totals.produced + frame.totals.rejected + frame.totals.wip, "Conservación de flujo total");
    near(frame.totals.produced, frame.totals.dispatched + frame.totals.finishedStock, "Conservación de despacho");
    near(frame.dispatchQueue, frame.totals.finishedStock, "Cola común de despacho");
    for (const [lineIndex, line] of frame.lines.entries()) {
      assert.ok(line.released <= line.plannedUnits + EPSILON, "No se libera más que el plan");
      near(line.released, line.produced + line.rejected + line.wip, "Conservación por línea");
      near(line.produced, line.dispatched + line.finishedStock, "Stock terminado por línea");
      near(line.wip, line.stages.slice(0, 3).reduce((total, stage) => total + stage.queue, 0), "WIP respeta buffers");
      near(line.finishedStock, line.stages[3].queue, "Último buffer contiene producto terminado");
      for (const stage of line.stages) {
        assert.ok(stage.queue >= -EPSILON && stage.queue <= stage.capacity + EPSILON, "Buffer finito sin negativos");
        assert.ok(stage.progress >= 0 && stage.progress <= 1);
      }
      for (const key of ["released", "produced", "rejected", "dispatched"] as const) {
        assert.ok(Number.isFinite(line[key]) && line[key] >= -EPSILON);
        if (index > 0) assert.ok(line[key] + EPSILON >= result.frames[index - 1].lines[lineIndex][key], "Contador monótono");
      }
      if (index > 0 && index < result.horizonMinutes && ["closed", "downtime"].includes(line.state)) {
        near(line.released, result.frames[index - 1].lines[lineIndex].released, "Sin alimentación en una parada");
        near(line.produced, result.frames[index - 1].lines[lineIndex].produced, "Sin producción en una parada");
      }
    }
    frameChecks += 1;
  }
}

function makePlan(units: number, rate = 10, setupMinutes = 0, overtimeMinutes = 0): ProductionPlan {
  const product = dataset.products.find((item) => item.familyId === "LIQ")!;
  const run: PlanRun = {
    dayIndex: 0, lineId: "L1", productId: product.id, familyId: "LIQ", sequence: 0,
    units, runMinutes: units / rate, setupMinutes, overtimeMinutes, reason: "Caso de verificación",
  };
  return {
    id: "base", label: "Verificación", description: "", runs: units > 0 ? [run] : [],
    lineDays: [{
      dayIndex: 0, lineId: "L1", runs: units > 0 ? [run] : [], runMinutes: run.runMinutes,
      setupMinutes, usedMinutes: run.runMinutes + setupMinutes, regularCapacityMinutes: 960,
      overtimeMinutes, setupCount: setupMinutes > 0 ? 1 : 0, utilization: 0,
      openingFamilyId: "LIQ",
    }],
    lineAssignments: {}, notes: [],
  };
}

// Ground-truth examples establish meanings independently of the implementation.
const tinyPlan = makePlan(100);
const before = JSON.stringify(tinyPlan);
const tiny = runPlantSimulation({ plan: tinyPlan, dayIndex: 0 });
checkFlow(tiny);
assert.equal(JSON.stringify(tinyPlan), before, "La simulación no modifica el plan");
near(tiny.summary.released, 100, "Se liberan exactamente las 100 unidades");
near(tiny.summary.produced, 98.8, "Calidad L1 aplica 98,8% una única vez");
near(tiny.summary.rejected, 1.2, "El rechazo sale del flujo");
near(tiny.summary.dispatched, 98.8, "Las unidades conformes llegan a despacho");
assert.equal(tiny.frames[3].totals.produced, 0, "No hay teletransporte entre cuatro etapas");
assert.ok(tiny.frames[4].totals.produced > 0);
assert.equal(tiny.frames[4].totals.dispatched, 0, "Despacho requiere su siguiente paso");
assert.ok(tiny.frames[5].totals.dispatched > 0);
assert.deepEqual(tiny, runPlantSimulation({ plan: tinyPlan, dayIndex: 0 }), "Determinismo completo de frames y eventos");

const setup = runPlantSimulation({ plan: makePlan(100, 10, 20), dayIndex: 0 });
assert.equal(setup.frames[20].totals.released, 0);
assert.ok(setup.frames[21].totals.released > 0);
near(setup.summary.lines[0].setupMinutes, 20, "Cambio de formato consume tiempo");

const delayed = runPlantSimulation({ plan: tinyPlan, dayIndex: 0, scenario: { materialDelayMinutes: 100 } });
assert.equal(delayed.frames[100].totals.released, 0);
assert.ok(delayed.frames[101].totals.released > 0);
near(delayed.summary.lines[0].materialWaitingMinutes, 100, "Espera real de insumos");

const rejected = runPlantSimulation({ plan: tinyPlan, dayIndex: 0, scenario: { qualityLossPct: 100 } });
checkFlow(rejected);
near(rejected.summary.rejected, 100, "Rechazo total no bloquea falsamente control de calidad");
assert.equal(rejected.summary.produced, 0);

const closedDispatch = runPlantSimulation({ plan: makePlan(10000), dayIndex: 0, scenario: { dispatchCapacityPerHour: 0 } });
checkFlow(closedDispatch);
assert.equal(closedDispatch.summary.dispatched, 0);
assert.ok(closedDispatch.summary.blockedMinutes > 0, "Un despacho cerrado bloquea aguas arriba");
assert.ok(closedDispatch.summary.released < 10000, "Los buffers llenos frenan la alimentación");
assert.ok(closedDispatch.summary.finishedStock > 0);
assert.equal(closedDispatch.summary.lines[0].state, "closed", "El último instante cierra una línea incompleta");
assert.ok(closedDispatch.summary.lines[0].stages.every((stage) => stage.state === "closed" && stage.progress === 0));
for (const event of closedDispatch.events.filter((item) => item.type === "blocked" && item.minute < closedDispatch.horizonMinutes)) {
  assert.equal(closedDispatch.frames[event.minute].lines.find((line) => line.lineId === event.lineId)?.state, "blocked", "Eventos y estado visual usan el mismo instante");
}

const overtime = runPlantSimulation({ plan: makePlan(10000, 10, 0, 60), dayIndex: 0 });
assert.equal(overtime.horizonMinutes, 1020, "Se utiliza sólo la hora extra ya prevista en el plan");
assert.ok(overtime.frames[961].totals.released > overtime.frames[960].totals.released);

const empty = runPlantSimulation({ plan: makePlan(0), dayIndex: 0 });
checkFlow(empty);
assert.equal(empty.summary.plannedUnits, 0);
assert.equal(empty.summary.released, 0);
assert.equal(empty.summary.completionPct, 100);

// Integration covers both real plan sequences, all five days and every incident.
const planning = runPlanning(DEFAULT_SCENARIO);
for (const plan of [planning.base, planning.recommended]) {
  for (const day of dataset.planningDays) {
    for (const preset of PLANT_PRESETS) {
      const result = runPlantSimulation({ plan, dayIndex: day.index, scenario: preset.scenario });
      checkFlow(result);
      near(result.plannedUnits, plan.runs.filter((run) => run.dayIndex === day.index).reduce((total, run) => total + run.units, 0), "Se usa el día y plan elegidos");
    }
  }
}

const busyPlan = makePlan(20000, 25);
const normal = runPlantSimulation({ plan: busyPlan, dayIndex: 0 });
const stopped = runPlantSimulation({ plan: busyPlan, dayIndex: 0, scenario: {
  downtimeLineId: "L1", downtimeStartMinute: 100, downtimeMinutes: 300,
} });
checkFlow(stopped);
assert.ok(stopped.summary.produced < normal.summary.produced, "La parada reduce producción cuando no hay holgura suficiente");
assert.equal(stopped.frames[400].totals.released, stopped.frames[100].totals.released, "La parada dura el intervalo completo");

const faster = runPlantSimulation({ plan: makePlan(24000, 25), dayIndex: 0, scenario: { speedPct: 130 } });
const slower = runPlantSimulation({ plan: makePlan(24000, 25), dayIndex: 0, scenario: { speedPct: 50 } });
assert.ok(faster.summary.produced > slower.summary.produced, "Cambiar velocidad cambia el flujo real");
assert.equal(faster.summary.plannedUnits, slower.summary.plannedUnits, "Velocidad no inventa demanda");
assert.ok(runPlantSimulation({ plan: tinyPlan, dayIndex: 0, scenario: {
  speedPct: Number.NaN, bufferCapacityMinutes: Number.POSITIVE_INFINITY,
} }).summary.produced > 0, "Se normalizan controles no finitos");
assert.throws(() => runPlantSimulation({ plan: tinyPlan, dayIndex: -1 }));
assert.equal(DEFAULT_PLANT_SCENARIO.speedPct, 100, "No se modifican los valores iniciales");

process.stdout.write(`Planta: OK · ${frameChecks.toLocaleString("es-AR")} instantes verificados; flujo, buffers, calidad, paradas, despacho, planes y reproducibilidad.\n`);
