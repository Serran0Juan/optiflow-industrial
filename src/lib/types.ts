/**
 * Modelo de dominio de OptiFlow Industrial.
 * Todos los datos son SIMULADOS y se generan de forma determinista (ver src/lib/data).
 */

export type FamilyId = "LIQ" | "CRE" | "ENV";

export interface ProductFamily {
  id: FamilyId;
  name: string;
  shortName: string;
  description: string;
  /** Color hexadecimal usado en graficos y etiquetas de familia. */
  color: string;
  /** Clases utilitarias de Tailwind para chips/badges de familia. */
  badgeClass: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  familyId: FamilyId;
  /** Costo estandar de produccion (ARS/unidad simulado). */
  unitCost: number;
  /** Margen de contribucion perdido si no se atiende la demanda (ARS/unidad). */
  contributionMargin: number;
  /** Penalidad comercial adicional por unidad no atendida (ARS/unidad). */
  stockoutPenaltyPerUnit: number;
  /** Costo de mantener una unidad en stock un dia habil (ARS/unidad/dia). */
  holdingCostPerUnitPerDay: number;
  /** Stock de producto terminado al inicio del horizonte (unidades). */
  initialStock: number;
  /** Dias de demanda que se busca mantener como colchon. */
  safetyStockDays: number;
  /** Cobertura maxima tolerada antes de considerar inventario excesivo. */
  maxCoverDays: number;
  /** Multiplo de lote de produccion (unidades). */
  lotSize: number;
  /** Linea que la planta usa por defecto para este producto. */
  preferredLineId: string;
  /** Lineas alternativas habilitadas (mismo producto, otra velocidad). */
  alternateLineIds: string[];
  /** Orden comercial fijo (1 = se atiende primero en el plan base). */
  commercialPriority: number;
}

export interface ProductionLine {
  id: string;
  name: string;
  description: string;
  shiftsPerDay: number;
  hoursPerShift: number;
  /** Paradas planificadas (limpieza, arranque) descontadas de la jornada. */
  plannedDowntimeMinutesPerDay: number;
  /** Minutos productivos de jornada normal por dia habil. */
  regularMinutesPerDay: number;
  /** Tope de minutos de hora extra por dia. */
  maxOvertimeMinutesPerDay: number;
  /** Costo de la hora extra (ARS/hora, dotacion completa de la linea). */
  overtimeCostPerHour: number;
  /** Costo horario del cambio de formato (mano de obra + material perdido). */
  setupCostPerHour: number;
  familiesAllowed: FamilyId[];
  /** Familia montada en la linea al cierre del periodo anterior. */
  initialFamilyId: FamilyId;
}

export interface LineProductRate {
  lineId: string;
  productId: string;
  /** Velocidad de produccion (unidades por minuto). */
  unitsPerMinute: number;
}

export interface SetupTimeEntry {
  lineId: string;
  fromFamily: FamilyId;
  toFamily: FamilyId;
  minutes: number;
}

export interface DemandRecord {
  productId: string;
  dayIndex: number;
  date: string;
  weekday: number;
  units: number;
}

export interface AvailabilityEvent {
  lineId: string;
  dayIndex: number;
  /** Factor de disponibilidad de la linea ese dia (1 = jornada completa). */
  availabilityFactor: number;
  reason: string;
}

export interface Supplier {
  id: string;
  name: string;
  leadTimeDays: number;
  /** Confiabilidad de entrega simulada (0-1). */
  reliability: number;
  /** Frecuencia de entregas por semana. */
  deliveriesPerWeek: number;
}

export interface RawMaterial {
  id: string;
  code: string;
  name: string;
  unit: string;
  unitCost: number;
  initialStock: number;
  supplierId: string;
  /** Cobertura minima deseada en dias habiles. */
  minCoverageDays: number;
}

export interface BomLine {
  productId: string;
  materialId: string;
  /** Consumo por unidad de producto terminado. */
  quantityPerUnit: number;
}

export interface PlanningDay {
  index: number;
  date: string;
  label: string;
  weekdayName: string;
  weekday: number;
}

export interface Dataset {
  seed: number;
  generatedAt: string;
  families: ProductFamily[];
  products: Product[];
  lines: ProductionLine[];
  rates: LineProductRate[];
  setupTimes: SetupTimeEntry[];
  demandHistory: DemandRecord[];
  historyDays: PlanningDay[];
  planningDays: PlanningDay[];
  availabilityEvents: AvailabilityEvent[];
  suppliers: Supplier[];
  rawMaterials: RawMaterial[];
  bom: BomLine[];
}

/* ------------------------------------------------------------------ */
/* Escenarios                                                          */
/* ------------------------------------------------------------------ */

export interface Scenario {
  /** Variacion aplicada a la demanda proyectada (-20 a +30). */
  demandVariationPct: number;
  /** Reduccion de capacidad disponible por linea (0 a 40). */
  capacityReductionPct: number;
  /** Aumento del tiempo de cambio de formato (0 a 100). */
  setupTimeIncreasePct: number;
  /** Multiplicador del costo de faltante (1 a 3). */
  stockoutCostMultiplier: number;
  /** Habilita el uso de horas extra en ambos planes. */
  allowOvertime: boolean;
}

export interface ScenarioPreset {
  id: string;
  name: string;
  description: string;
  scenario: Scenario;
}

/* ------------------------------------------------------------------ */
/* Plan de produccion                                                  */
/* ------------------------------------------------------------------ */

export type PlanId = "base" | "recommended";

export interface PlanRun {
  dayIndex: number;
  lineId: string;
  productId: string;
  familyId: FamilyId;
  sequence: number;
  units: number;
  runMinutes: number;
  setupMinutes: number;
  /** Minutos de esta corrida (setup + corrida) que caen en hora extra. */
  overtimeMinutes: number;
  /** Explicacion determinista de por que se programo esta corrida. */
  reason: string;
}

export interface PlanLineDay {
  dayIndex: number;
  lineId: string;
  runs: PlanRun[];
  runMinutes: number;
  setupMinutes: number;
  usedMinutes: number;
  regularCapacityMinutes: number;
  overtimeMinutes: number;
  setupCount: number;
  utilization: number;
  /** Familia montada en la linea al comenzar el dia. */
  openingFamilyId: FamilyId;
}

export interface ProductionPlan {
  id: PlanId;
  label: string;
  description: string;
  runs: PlanRun[];
  lineDays: PlanLineDay[];
  /** Asignacion producto -> linea usada por el planificador. */
  lineAssignments: Record<string, string>;
  notes: string[];
}

/* ------------------------------------------------------------------ */
/* Evaluacion economica                                                */
/* ------------------------------------------------------------------ */

export interface CostBreakdown {
  setup: number;
  overtime: number;
  holding: number;
  stockout: number;
  total: number;
}

export interface ProductDayResult {
  productId: string;
  dayIndex: number;
  openingStock: number;
  demand: number;
  produced: number;
  shipped: number;
  unmet: number;
  closingStock: number;
  coverDays: number;
}

export interface LineResult {
  lineId: string;
  usedMinutes: number;
  runMinutes: number;
  setupMinutes: number;
  regularCapacityMinutes: number;
  overtimeMinutes: number;
  setupCount: number;
  utilization: number;
}

export interface DayResult {
  dayIndex: number;
  demandUnits: number;
  producedUnits: number;
  unmetUnits: number;
  closingInventoryUnits: number;
  closingInventoryValue: number;
  setupCount: number;
  overtimeMinutes: number;
  costs: CostBreakdown;
}

export interface PlanEvaluation {
  planId: PlanId;
  label: string;
  costs: CostBreakdown;
  serviceLevel: number;
  totalDemandUnits: number;
  producedUnits: number;
  unmetUnits: number;
  setupCount: number;
  setupHours: number;
  overtimeHours: number;
  utilization: number;
  usedMinutes: number;
  regularCapacityMinutes: number;
  averageCoverDays: number;
  closingInventoryUnits: number;
  productDays: ProductDayResult[];
  lines: LineResult[];
  days: DayResult[];
}

export type AlertSeverity = "alta" | "media" | "baja";

export interface OperationalAlert {
  id: string;
  severity: AlertSeverity;
  category: string;
  entity: string;
  message: string;
  recommendation: string;
  /** Impacto economico estimado en ARS (0 si no aplica). */
  impact: number;
}

export interface MaterialCoverage {
  materialId: string;
  code: string;
  name: string;
  unit: string;
  unitCost: number;
  supplierId: string;
  initialStock: number;
  requiredUnits: number;
  closingStock: number;
  coverageDays: number;
  minCoverageDays: number;
  leadTimeDays: number;
  status: "ok" | "atencion" | "critico";
}

export interface PlanComparison {
  base: PlanEvaluation;
  recommended: PlanEvaluation;
  /** costo total plan base - costo total plan recomendado (puede ser negativo). */
  costDelta: number;
  costDeltaPct: number;
  improves: boolean;
  serviceLevelDelta: number;
  setupDelta: number;
  overtimeHoursDelta: number;
  unmetUnitsDelta: number;
}

export interface PlanningResult {
  scenario: Scenario;
  days: PlanningDay[];
  forecast: Record<string, number[]>;
  base: ProductionPlan;
  recommended: ProductionPlan;
  comparison: PlanComparison;
  alerts: OperationalAlert[];
  decisions: string[];
  materials: MaterialCoverage[];
  computedInMs: number;
}

/* ================================================================== */
/* V1.1 - Balanceo de linea de ensamble                                */
/* Caso simulado independiente del planificador semanal: una linea de  */
/* ensamble de envases dosificadores con tareas, precedencias y takt.  */
/* ================================================================== */

export type StageId = "PRE" | "ENS" | "LLE" | "CAL" | "EMB";

export interface TaskStage {
  id: StageId;
  name: string;
  description: string;
  /** Color hexadecimal usado en graficos y tarjetas de estacion. */
  color: string;
  /** Clases utilitarias de Tailwind para los chips de etapa. */
  badgeClass: string;
}

export interface AssemblyTask {
  id: string;
  code: string;
  name: string;
  stageId: StageId;
  /** Tiempo estandar base de la tarea, en segundos por unidad. */
  standardSeconds: number;
  /** Tareas que deben completarse antes o en la misma estacion. */
  predecessorIds: string[];
  /** Estacion (base 0) en la asignacion inicial desbalanceada. */
  initialStationIndex: number;
}

export interface AssemblyLineCase {
  id: string;
  name: string;
  description: string;
  product: string;
  stages: TaskStage[];
  tasks: AssemblyTask[];
  initialStationCount: number;
  baseDailyDemandUnits: number;
  /** Minutos productivos por turno (jornada menos paradas planificadas). */
  baseShiftMinutes: number;
  baseShiftCount: number;
  /** Costo horario cargado de un operario con su puesto (ARS simulados). */
  stationCostPerHour: number;
  /** Costo de una unidad de demanda que la linea no llega a producir. */
  unmetUnitCost: number;
}

export interface BalanceScenario {
  /** Variacion sobre la demanda diaria base (-20 a +30). */
  demandVariationPct: number;
  /** Minutos productivos por turno. */
  shiftMinutes: number;
  /** Cantidad de turnos por dia (1, 2 o 3). */
  shiftCount: number;
  /** Habilita una estacion adicional para bajar el tiempo de ciclo. */
  extraStation: boolean;
  /** Variacion sobre los tiempos estandar (-10 a +20). */
  taskTimeVariationPct: number;
}

export interface BalanceScenarioPreset {
  id: string;
  name: string;
  description: string;
  scenario: BalanceScenario;
}

export type BalanceLayoutId = "inicial" | "recomendado";

export interface StationTask {
  taskId: string;
  code: string;
  name: string;
  stageId: StageId;
  seconds: number;
}

export interface BalanceStation {
  index: number;
  label: string;
  tasks: StationTask[];
  /** Suma de los tiempos estandar asignados a la estacion. */
  loadSeconds: number;
  /** Ociosidad respecto del tiempo de ciclo de la linea. */
  idleSeconds: number;
  /** Carga como fraccion del takt time (puede superar 1). */
  taktRatio: number;
  isBottleneck: boolean;
}

export interface BalanceMetrics {
  stationCount: number;
  /** Mayor carga entre las estaciones: marca el ritmo real de la linea. */
  cycleSeconds: number;
  totalWorkSeconds: number;
  taktSeconds: number;
  availableSeconds: number;
  dailyDemandUnits: number;
  theoreticalMinStations: number;
  dailyCapacityUnits: number;
  lineEfficiency: number;
  balanceLoss: number;
  idleSecondsPerCycle: number;
  capacityGapUnits: number;
  deliveredUnits: number;
  unmetUnits: number;
  bottleneckStationIndex: number;
}

export interface BalanceCost {
  /** Costo diario de las estaciones/operarios asignados. */
  stationCost: number;
  /** Parte del costo de estaciones imputable al desbalance (no se suma aparte). */
  idleCost: number;
  productiveCost: number;
  unmetCost: number;
  /** costo de estaciones + costo de unidades no atendidas. */
  total: number;
  costPerDeliveredUnit: number;
}

export interface BalanceLayout {
  id: BalanceLayoutId;
  label: string;
  description: string;
  stations: BalanceStation[];
  metrics: BalanceMetrics;
  cost: BalanceCost;
  notes: string[];
}

export interface BalanceTaskRow {
  task: AssemblyTask;
  /** Tiempo estandar con la variacion del escenario aplicada. */
  seconds: number;
  positionalWeight: number;
  initialStation: number;
  recommendedStation: number;
}

export interface BalanceComparison {
  initial: BalanceLayout;
  recommended: BalanceLayout;
  /** costo total inicial - costo total recomendado (puede ser negativo). */
  costDelta: number;
  costDeltaPct: number;
  improves: boolean;
  /** Diferencias recomendado - inicial. */
  efficiencyDeltaPoints: number;
  cycleDeltaSeconds: number;
  capacityDeltaUnits: number;
  stationDelta: number;
  unmetDeltaUnits: number;
}

export interface BalanceResult {
  scenario: BalanceScenario;
  taskRows: BalanceTaskRow[];
  comparison: BalanceComparison;
  insights: string[];
  computedInMs: number;
}
