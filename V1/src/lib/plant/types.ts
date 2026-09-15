import type { ProductionPlan } from "@/lib/types";

export type PlantState = "running" | "setup" | "downtime" | "material" | "blocked" | "idle" | "finished" | "closed";

export interface PlantScenario {
  speedPct: number;
  materialDelayMinutes: number;
  downtimeLineId: string;
  downtimeStartMinute: number;
  downtimeMinutes: number;
  dispatchCapacityPerHour: number;
  bufferCapacityMinutes: number;
  /** Additional percentage points rejected above each line's configured loss. */
  qualityLossPct: number;
}

export interface PlantLineConfig {
  lineId: string;
  name: string;
  color: string;
  stages: string[];
  regularCapacityMinutes: number;
  plannedUnavailableMinutes: number;
  overtimeMinutes: number;
  plannedUnits: number;
  firstPassYield: number;
}

export interface PlantTotals {
  released: number;
  /** Good units that have completed packaging, including units already dispatched. */
  produced: number;
  rejected: number;
  dispatched: number;
  /** Units in the first three process buffers; excludes packaged finished stock. */
  wip: number;
  finishedStock: number;
}

export interface PlantStageFrame {
  id: string;
  name: string;
  state: PlantState;
  /** Units waiting at the stage's output. */
  queue: number;
  capacity: number;
  /** Fraction of a minute spent processing in the latest interval, from zero to one. */
  progress: number;
  rate: number;
}

export interface PlantLineFrame extends PlantTotals {
  lineId: string;
  name: string;
  state: PlantState;
  productId: string | null;
  productName: string;
  plannedUnits: number;
  stages: PlantStageFrame[];
  runProgress: number;
}

export interface PlantFrame {
  /** Elapsed minutes from 06:00. Shows the interval just completed; the last frame shows closure. */
  minute: number;
  lines: PlantLineFrame[];
  totals: PlantTotals;
  /** Units dispatched during the last minute. */
  dispatchRate: number;
  dispatchQueue: number;
}

export interface PlantEvent {
  minute: number;
  lineId: string | null;
  type: "setup" | "downtime" | "material" | "blocked" | "complete" | "shift";
  message: string;
}

export interface PlantLineSummary extends PlantLineFrame {
  blockedMinutes: number;
  downtimeMinutes: number;
  setupMinutes: number;
  productiveMinutes: number;
  materialWaitingMinutes: number;
  completionPct: number;
}

export interface PlantSummary extends PlantTotals {
  plannedUnits: number;
  completionPct: number;
  dispatchPct: number;
  peakWip: number;
  blockedMinutes: number;
  downtimeMinutes: number;
  lines: PlantLineSummary[];
}

export interface PlantSimulation {
  dayIndex: number;
  planId: ProductionPlan["id"];
  horizonMinutes: number;
  plannedUnits: number;
  scenario: PlantScenario;
  lines: PlantLineConfig[];
  frames: PlantFrame[];
  events: PlantEvent[];
  summary: PlantSummary;
}

export interface PlantSimulationInput {
  plan: ProductionPlan;
  dayIndex: number;
  scenario?: Partial<PlantScenario>;
}
