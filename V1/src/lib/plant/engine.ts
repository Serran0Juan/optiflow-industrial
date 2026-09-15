import { dataset, productsById } from "@/lib/data/dataset";
import type { PlanRun } from "@/lib/types";
import { normalizePlantScenario, PLANT_LINE_LAYOUTS, PLANT_REGULAR_MINUTES } from "./config";
import type {
  PlantEvent,
  PlantFrame,
  PlantLineConfig,
  PlantLineFrame,
  PlantScenario,
  PlantSimulation,
  PlantSimulationInput,
  PlantStageFrame,
  PlantState,
  PlantTotals,
} from "./types";

const EPSILON = 1e-8;
const STAGE_IDS = ["feed", "process", "quality", "packing"];
// Only the source pace is constrained by the selected plan. These secondary
// stage speeds and finite buffers are explicit assumptions of the visual model.
const STAGE_RATE_FACTORS = [1, 1, 1.1, 1.12];

interface Packet {
  runIndex: number;
  units: number;
}

interface LineRuntime {
  config: PlantLineConfig;
  runs: PlanRun[];
  rates: number[];
  releasedByRun: number[];
  cursor: number;
  setupRemaining: number;
  setupStarted: boolean;
  buffers: Packet[][];
  capacities: number[];
  stages: PlantStageFrame[];
  state: PlantState;
  released: number;
  produced: number;
  rejected: number;
  dispatched: number;
  blockedMinutes: number;
  downtimeMinutes: number;
  setupMinutes: number;
  productiveMinutes: number;
  materialWaitingMinutes: number;
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const queueUnits = (buffer: Packet[]) => sum(buffer.map((packet) => packet.units));
const processWip = (line: LineRuntime) => sum(line.buffers.slice(0, 3).map(queueUnits));
const finishedUnits = (line: LineRuntime) => queueUnits(line.buffers[3]);
const isComplete = (line: LineRuntime) => line.cursor >= line.runs.length && processWip(line) <= EPSILON;

function appendPacket(buffer: Packet[], runIndex: number, units: number): void {
  if (units <= EPSILON) return;
  const last = buffer[buffer.length - 1];
  if (last?.runIndex === runIndex) last.units += units;
  else buffer.push({ runIndex, units });
}

function removeUnits(buffer: Packet[], quantity: number): void {
  let remaining = quantity;
  while (remaining > EPSILON && buffer.length > 0) {
    const packet = buffer[0];
    const taken = Math.min(remaining, packet.units);
    packet.units -= taken;
    remaining -= taken;
    if (packet.units <= EPSILON) buffer.shift();
  }
}

/**
 * Calendar placement is illustrative: half of unavailable regular minutes is
 * centered at 10:00 and half at 18:00. The duration comes from plan.lineDays,
 * preserving scenario capacity reductions and known availability events.
 */
function hasPlannedPause(line: LineRuntime, minute: number): boolean {
  if (minute >= PLANT_REGULAR_MINUTES) return false;
  const firstLength = Math.floor(line.config.plannedUnavailableMinutes / 2);
  const secondLength = line.config.plannedUnavailableMinutes - firstLength;
  const firstStart = Math.floor((PLANT_REGULAR_MINUTES / 2 - firstLength) / 2);
  const secondStart = PLANT_REGULAR_MINUTES / 2 + Math.floor((PLANT_REGULAR_MINUTES / 2 - secondLength) / 2);
  return (minute >= firstStart && minute < firstStart + firstLength)
    || (minute >= secondStart && minute < secondStart + secondLength);
}

function rateFor(line: LineRuntime, runIndex: number, stage: number, scenario: PlantScenario): number {
  return (line.rates[runIndex] ?? 0) * STAGE_RATE_FACTORS[stage] * scenario.speedPct / 100;
}

function makeRuntime(input: PlantSimulationInput, scenario: PlantScenario): LineRuntime[] {
  return dataset.lines.map((definition) => {
    const lineDay = input.plan.lineDays.find((item) => item.dayIndex === input.dayIndex && item.lineId === definition.id);
    const runs = input.plan.runs
      .filter((run) => run.dayIndex === input.dayIndex && run.lineId === definition.id && run.units > 0)
      .map((run) => ({ ...run }))
      .sort((left, right) => left.sequence - right.sequence);
    for (const run of runs) {
      if (!Number.isFinite(run.units) || !Number.isFinite(run.runMinutes) || run.runMinutes <= 0
        || !Number.isFinite(run.setupMinutes) || run.setupMinutes < 0) {
        throw new Error(`Corrida inválida en ${definition.id}: unidades, minutos y cambio deben ser finitos y no negativos.`);
      }
    }
    const layout = PLANT_LINE_LAYOUTS[definition.id];
    const regularCapacityMinutes = Math.max(0, Math.min(PLANT_REGULAR_MINUTES,
      Math.floor(lineDay?.regularCapacityMinutes ?? definition.regularMinutesPerDay)));
    const overtimeMinutes = Math.min(definition.maxOvertimeMinutesPerDay,
      Math.max(0, lineDay?.overtimeMinutes ?? sum(runs.map((run) => run.overtimeMinutes))));
    const config: PlantLineConfig = {
      lineId: definition.id,
      name: layout.name,
      color: layout.color,
      stages: [...layout.stages],
      regularCapacityMinutes,
      plannedUnavailableMinutes: PLANT_REGULAR_MINUTES - regularCapacityMinutes,
      overtimeMinutes,
      plannedUnits: sum(runs.map((run) => run.units)),
      firstPassYield: Math.max(0, definition.firstPassYield - scenario.qualityLossPct / 100),
    };
    const rates = runs.map((run) => run.units / run.runMinutes);
    const bufferCapacity = Math.max(1, Math.max(1, ...rates) * scenario.bufferCapacityMinutes);
    return {
      config,
      runs,
      rates,
      releasedByRun: runs.map(() => 0),
      cursor: 0,
      setupRemaining: runs[0]?.setupMinutes ?? 0,
      setupStarted: false,
      buffers: [[], [], [], []],
      capacities: [bufferCapacity, bufferCapacity, bufferCapacity, bufferCapacity],
      stages: STAGE_IDS.map((id, index) => ({
        id, name: config.stages[index], state: "idle", queue: 0,
        capacity: bufferCapacity, progress: 0, rate: rateForInitial(rates[0] ?? 0, index, scenario),
      })),
      state: runs.length === 0 ? "finished" : "idle",
      released: 0,
      produced: 0,
      rejected: 0,
      dispatched: 0,
      blockedMinutes: 0,
      downtimeMinutes: 0,
      setupMinutes: 0,
      productiveMinutes: 0,
      materialWaitingMinutes: 0,
    };
  });
}

function rateForInitial(rate: number, stage: number, scenario: PlantScenario): number {
  return rate * STAGE_RATE_FACTORS[stage] * scenario.speedPct / 100;
}

/**
 * FIFO transfer of fluid units, spending at most the available machine time.
 * Packets preserve their run identity, so a later slower product cannot change
 * the rate applied to work already in the process. Rejections occur once, at QC.
 */
function processStage(line: LineRuntime, stage: number, availableTime: number, scenario: PlantScenario): void {
  const upstream = line.buffers[stage - 1];
  const downstream = line.buffers[stage];
  const frame = line.stages[stage];
  const yieldFactor = stage === 2 ? line.config.firstPassYield : 1;
  let remainingTime = availableTime;
  let moved = 0;
  while (remainingTime > EPSILON && upstream.length > 0) {
    const head = upstream[0];
    const rate = rateFor(line, head.runIndex, stage, scenario);
    const free = Math.max(0, line.capacities[stage] - queueUnits(downstream));
    frame.rate = rate;
    const limitBySpace = yieldFactor > EPSILON ? free / yieldFactor : Number.POSITIVE_INFINITY;
    const quantity = Math.min(head.units, remainingTime * rate, limitBySpace);
    if (quantity <= EPSILON || rate <= EPSILON) break;
    const good = quantity * yieldFactor;
    appendPacket(downstream, head.runIndex, good);
    removeUnits(upstream, quantity);
    remainingTime -= quantity / rate;
    moved += quantity;
    if (stage === 2) line.rejected += quantity - good;
    if (stage === 3) line.produced += good;
  }
  frame.progress = Math.min(1, Math.max(0, availableTime - remainingTime));
  const blocked = upstream.length > 0 && yieldFactor > EPSILON
    && line.capacities[stage] - queueUnits(downstream) <= EPSILON;
  frame.state = blocked ? "blocked" : moved > EPSILON ? "running" : "idle";
}

function feedLine(line: LineRuntime, availableTime: number, scenario: PlantScenario, minute: number): void {
  const frame = line.stages[0];
  if (line.cursor >= line.runs.length) return;
  if (minute < scenario.materialDelayMinutes) {
    frame.state = "material";
    line.materialWaitingMinutes += availableTime;
    return;
  }
  let remainingTime = availableTime;
  let setupTime = 0;
  let productionTime = 0;
  while (remainingTime > EPSILON && line.cursor < line.runs.length) {
    const run = line.runs[line.cursor];
    if (line.setupRemaining > EPSILON) {
      // A family change begins only once the previous process WIP has drained.
      // Packaged units may remain in the independent dispatch area.
      if (!line.setupStarted && processWip(line) > EPSILON) break;
      line.setupStarted = true;
      const used = Math.min(remainingTime, line.setupRemaining);
      line.setupRemaining -= used;
      remainingTime -= used;
      setupTime += used;
      line.setupMinutes += used;
      if (remainingTime <= EPSILON) break;
    }
    const free = Math.max(0, line.capacities[0] - queueUnits(line.buffers[0]));
    const rate = rateFor(line, line.cursor, 0, scenario);
    frame.rate = rate;
    const quantity = Math.min(run.units - line.releasedByRun[line.cursor], remainingTime * rate, free);
    if (quantity <= EPSILON) break;
    appendPacket(line.buffers[0], line.cursor, quantity);
    line.releasedByRun[line.cursor] += quantity;
    line.released += quantity;
    remainingTime -= quantity / rate;
    productionTime += quantity / rate;
    if (run.units - line.releasedByRun[line.cursor] <= EPSILON) {
      line.cursor += 1;
      line.setupRemaining = line.runs[line.cursor]?.setupMinutes ?? 0;
      line.setupStarted = false;
    }
  }
  line.productiveMinutes += productionTime;
  frame.progress = Math.min(1, productionTime);
  const blocked = line.cursor < line.runs.length
    && line.capacities[0] - queueUnits(line.buffers[0]) <= EPSILON;
  frame.state = blocked ? "blocked" : setupTime > EPSILON ? "setup" : productionTime > EPSILON ? "running" : "idle";
}

/** Fair, proportional withdrawal from the three finished-goods queues. */
function dispatch(lines: LineRuntime[], scenario: PlantScenario): number {
  const queues = lines.map(finishedUnits);
  const totalQueue = sum(queues);
  const dispatched = Math.min(totalQueue, scenario.dispatchCapacityPerHour / 60);
  if (dispatched <= EPSILON) return 0;
  for (let index = 0; index < lines.length; index += 1) {
    const quantity = dispatched * queues[index] / totalQueue;
    removeUnits(lines[index].buffers[3], quantity);
    lines[index].dispatched += quantity;
  }
  return dispatched;
}

function stepLine(line: LineRuntime, minute: number, scenario: PlantScenario): void {
  for (const stage of line.stages) {
    stage.state = "idle";
    stage.progress = 0;
  }
  if (isComplete(line)) {
    line.state = "finished";
    line.stages.forEach((stage) => { stage.state = "finished"; });
    return;
  }
  const availableTime = Math.min(1, Math.max(0, PLANT_REGULAR_MINUTES + line.config.overtimeMinutes - minute));
  const incident = line.config.lineId === scenario.downtimeLineId
    && minute >= scenario.downtimeStartMinute
    && minute < scenario.downtimeStartMinute + scenario.downtimeMinutes;
  if (availableTime <= EPSILON) {
    line.state = "closed";
    line.stages.forEach((stage) => { stage.state = "closed"; });
    return;
  }
  if (hasPlannedPause(line, minute) || incident) {
    line.state = "downtime";
    line.downtimeMinutes += availableTime;
    line.stages.forEach((stage) => { stage.state = "downtime"; });
    return;
  }
  // Downstream-first ordering guarantees at least one time step per transfer;
  // newly released material cannot appear as finished goods in the same minute.
  for (let stage = 3; stage >= 1; stage -= 1) processStage(line, stage, availableTime, scenario);
  feedLine(line, availableTime, scenario, minute);
  if (line.stages.some((stage) => stage.state === "blocked")) {
    line.state = "blocked";
    line.blockedMinutes += availableTime;
  } else if (line.stages[0].state === "setup") line.state = "setup";
  else if (line.stages[0].state === "material") line.state = "material";
  else if (isComplete(line)) line.state = "finished";
  else if (line.stages.some((stage) => stage.state === "running")) line.state = "running";
  else line.state = "idle";
}

function snapshotLine(line: LineRuntime): PlantLineFrame {
  // Finished-goods inventory is no longer active production. While draining
  // before a format change, identify the old run still inside the machines.
  const activePacket = line.buffers[1][0] ?? line.buffers[2][0] ?? line.buffers[0][0];
  const waitingForDrain = line.setupRemaining > EPSILON && !line.setupStarted && processWip(line) > EPSILON;
  const runIndex = line.cursor < line.runs.length && !waitingForDrain ? line.cursor : activePacket?.runIndex;
  const run = runIndex === undefined ? undefined : line.runs[runIndex];
  return {
    lineId: line.config.lineId,
    name: line.config.name,
    state: line.state,
    productId: run?.productId ?? null,
    productName: run ? productsById[run.productId]?.name ?? run.productId : line.runs.length === 0 ? "Sin corridas programadas" : "Secuencia finalizada",
    plannedUnits: line.config.plannedUnits,
    released: line.released,
    produced: line.produced,
    rejected: line.rejected,
    dispatched: line.dispatched,
    wip: processWip(line),
    finishedStock: finishedUnits(line),
    stages: line.stages.map((stage, index) => ({ ...stage, queue: queueUnits(line.buffers[index]) })),
    runProgress: run && runIndex !== undefined ? Math.min(1, line.releasedByRun[runIndex] / run.units) : 1,
  };
}

function snapshot(minute: number, lines: LineRuntime[], dispatchRate: number): PlantFrame {
  const lineFrames = lines.map(snapshotLine);
  const totals: PlantTotals = {
    released: sum(lineFrames.map((line) => line.released)),
    produced: sum(lineFrames.map((line) => line.produced)),
    rejected: sum(lineFrames.map((line) => line.rejected)),
    dispatched: sum(lineFrames.map((line) => line.dispatched)),
    wip: sum(lineFrames.map((line) => line.wip)),
    finishedStock: sum(lineFrames.map((line) => line.finishedStock)),
  };
  return { minute, lines: lineFrames, totals, dispatchRate, dispatchQueue: totals.finishedStock };
}

function stateEvent(line: LineRuntime, previous: PlantState, minute: number, scenario: PlantScenario): PlantEvent | null {
  if (line.state === previous) return null;
  const lineId = line.config.lineId;
  const messages: Partial<Record<PlantState, { type: PlantEvent["type"]; message: string }>> = {
    setup: { type: "setup", message: `${lineId}: cambio de formato según la secuencia del plan.` },
    material: { type: "material", message: `${lineId}: alimentación detenida hasta recibir insumos.` },
    blocked: { type: "blocked", message: `${lineId}: una etapa espera espacio en la cola de salida.` },
    finished: { type: "complete", message: `${lineId}: proceso finalizado; las unidades conformes pasan a despacho.` },
    closed: { type: "shift", message: `${lineId}: termina el tiempo habilitado por el plan.` },
    downtime: {
      type: "downtime",
      message: lineId === scenario.downtimeLineId && minute >= scenario.downtimeStartMinute
        && minute < scenario.downtimeStartMinute + scenario.downtimeMinutes
        ? `${lineId}: parada extraordinaria del escenario.`
        : `${lineId}: pausa que representa los minutos no disponibles del plan.`,
    },
  };
  if (messages[line.state]) return { minute, lineId, ...messages[line.state]! };
  if (["downtime", "material", "blocked", "setup"].includes(previous)) {
    return { minute, lineId, type: "shift", message: `${lineId}: se reanuda el flujo de producción.` };
  }
  return null;
}

/**
 * Deterministic, minute-step fluid-flow model for a single selected plan day.
 * Three independent product streams share dispatch, never an invented L3→L1
 * bill of materials. All opening WIP/finished stock is zero. Plan run quantities
 * cap released input; QC can reduce final good output, without changing the
 * underlying planner (whose production quantities do not model scrap).
 */
export function runPlantSimulation(input: PlantSimulationInput): PlantSimulation {
  if (!Number.isInteger(input.dayIndex) || !dataset.planningDays.some((day) => day.index === input.dayIndex)) {
    throw new Error("Elegí un día válido del horizonte de planificación.");
  }
  const scenario = normalizePlantScenario(input.scenario);
  const lines = makeRuntime(input, scenario);
  const horizonMinutes = PLANT_REGULAR_MINUTES + Math.ceil(Math.max(0, ...lines.map((line) => line.config.overtimeMinutes)));
  const events: PlantEvent[] = [{ minute: 0, lineId: null, type: "shift", message: "06:00 · Comienza la jornada con las colas vacías." }];
  const frames: PlantFrame[] = [snapshot(0, lines, 0)];
  for (let minute = 0; minute < horizonMinutes; minute += 1) {
    const dispatchRate = dispatch(lines, scenario);
    for (const line of lines) {
      const previous = line.state;
      stepLine(line, minute, scenario);
      const event = stateEvent(line, previous, minute, scenario);
      // An end-of-minute frame and its event always use the same visible time.
      if (event) events.push({ ...event, minute: minute + 1 });
    }
    frames.push(snapshot(minute + 1, lines, dispatchRate));
  }
  // At the endpoint all allocated time has elapsed. Preserve the last interval's
  // counters while making closure visible and stopping machine animation.
  for (const line of lines) {
    if (!isComplete(line) && line.state !== "closed") {
      line.state = "closed";
      line.stages.forEach((stage) => { stage.state = "closed"; stage.progress = 0; });
      events.push({ minute: horizonMinutes, lineId: line.config.lineId, type: "shift", message: `${line.config.lineId}: termina el tiempo habilitado por el plan.` });
    }
  }
  frames[frames.length - 1] = snapshot(horizonMinutes, lines, frames[frames.length - 1].dispatchRate);
  events.push({ minute: horizonMinutes, lineId: null, type: "shift", message: "Fin de la jornada simulada: se conservan las colas pendientes." });
  const final = frames[frames.length - 1];
  const plannedUnits = sum(lines.map((line) => line.config.plannedUnits));
  return {
    dayIndex: input.dayIndex,
    planId: input.plan.id,
    horizonMinutes,
    plannedUnits,
    scenario,
    lines: lines.map((line) => line.config),
    frames,
    events,
    summary: {
      ...final.totals,
      plannedUnits,
      completionPct: plannedUnits > 0 ? final.totals.produced / plannedUnits * 100 : 100,
      dispatchPct: plannedUnits > 0 ? final.totals.dispatched / plannedUnits * 100 : 100,
      peakWip: Math.max(...frames.map((frame) => frame.totals.wip)),
      blockedMinutes: sum(lines.map((line) => line.blockedMinutes)),
      downtimeMinutes: sum(lines.map((line) => line.downtimeMinutes)),
      lines: lines.map((line, index) => ({
        ...final.lines[index],
        blockedMinutes: line.blockedMinutes,
        downtimeMinutes: line.downtimeMinutes,
        setupMinutes: line.setupMinutes,
        productiveMinutes: line.productiveMinutes,
        materialWaitingMinutes: line.materialWaitingMinutes,
        completionPct: line.config.plannedUnits > 0 ? line.produced / line.config.plannedUnits * 100 : 100,
      })),
    },
  };
}
