/**
 * Modelo de dominio de OptiFlow Industrial.
 * Todos los datos son SIMULADOS y se generan de forma determinista (ver src/lib/data).
 */

import type { DispatchRule } from "./planning/dispatch";

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
  /**
   * Rendimiento de primera pasada: fraccion de unidades que sale conforme sin
   * retrabajo. Es un parametro de planta usado UNICAMENTE para el indicador
   * OEE; el plan de produccion no modela scrap, por lo que no afecta ni las
   * unidades programadas ni los costos.
   */
  firstPassYield: number;
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
  /**
   * Regla de secuenciamiento del plan recomendado dentro de cada bloque de
   * familia. El valor por defecto ("riesgo") es el criterio historico del
   * planificador; las demas se ofrecen como alternativas comparables.
   */
  dispatchRule: DispatchRule;
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

/* ------------------------------------------------------------------ */
/* OEE - Overall Equipment Effectiveness                               */
/* ------------------------------------------------------------------ */

export interface LineOee {
  lineId: string;
  lineName: string;
  /** Jornada teorica de la linea en el horizonte (minutos). */
  plannedCalendarMinutes: number;
  /** Minutos realmente habilitados tras eventos de disponibilidad y escenario. */
  availableMinutes: number;
  /** Minutos habilitados menos cambios de formato. */
  operatingMinutes: number;
  /** Minutos efectivamente produciendo. */
  runMinutes: number;
  setupMinutes: number;
  availability: number;
  performance: number;
  quality: number;
  oee: number;
  /** Puntos de OEE perdidos por cada componente, sobre 100. */
  availabilityLossPoints: number;
  performanceLossPoints: number;
  qualityLossPoints: number;
}

export interface OeeResult {
  lines: LineOee[];
  /** OEE de la planta, ponderado por el tiempo calendario de cada linea. */
  plant: {
    availability: number;
    performance: number;
    quality: number;
    oee: number;
    plannedCalendarMinutes: number;
    operatingMinutes: number;
    runMinutes: number;
  };
  /** Cuello de botella del OEE: la linea con el indicador mas bajo. */
  worstLineId: string;
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
  /** Capacidad efectiva del plan recomendado medida como OEE. */
  oee: OeeResult;
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

/* ================================================================== */
/* V2 - Torre de control de abastecimiento                             */
/* Traduce la demanda y el plan de produccion a consumo de materias    */
/* primas, evalua cobertura y riesgo de quiebre y recomienda acciones  */
/* de compra. Todo el modulo es determinista: mismo escenario, mismo   */
/* resultado, sin aleatoriedad por ejecucion.                          */
/* ================================================================== */

export type MaterialCategory =
  | "producto-base"
  | "aditivo"
  | "envase"
  | "cierre"
  | "etiqueta"
  | "embalaje";

export type SupplyRiskLevel = "critico" | "alto" | "medio" | "bajo";

export type SupplierRiskLevel = "alto" | "medio" | "bajo";

export type PurchaseOrderStatus = "en-transito" | "retrasada" | "confirmada" | "pendiente";

export type SupplyAction =
  | "comprar-urgente"
  | "anticipar-orden"
  | "compra-normal"
  | "consolidar-compra"
  | "monitorear"
  | "no-comprar";

/** Materia prima con los atributos que necesita la torre de abastecimiento. */
export interface SupplyMaterial {
  id: string;
  code: string;
  name: string;
  category: MaterialCategory;
  unit: string;
  /** Stock disponible en planta al inicio del horizonte. */
  stockOnHand: number;
  /** Colchon objetivo expresado en dias de consumo. */
  safetyStockDays: number;
  /** Costo unitario simulado del material en stock (ARS por unidad de medida). */
  unitCost: number;
  /** Criticidad tecnica del material para la produccion. */
  criticality: "alta" | "media" | "baja";
  supplierId: string;
}

/** Materia prima con su clasificacion ABC y su variabilidad ya calculadas. */
export interface ClassifiedMaterial extends SupplyMaterial {
  abc: MaterialAbcProfile;
}

/** Proveedor con las condiciones comerciales del caso simulado. */
export interface SupplySupplier {
  id: string;
  name: string;
  /** Lead time promedio comprometido, en dias habiles. */
  leadTimeDays: number;
  /** Peor lead time observado en el caso simulado, en dias habiles. */
  maxLeadTimeDays: number;
  /** Confiabilidad de entrega simulada (0-1). */
  reliability: number;
  /** Cantidad minima de compra, expresada en la unidad del material. */
  minOrderQuantity: number;
  /** Recargo o descuento sobre el costo unitario del material en stock. */
  priceFactor: number;
  /** Condicion comercial de compra. */
  paymentTerms: string;
  riskLevel: SupplierRiskLevel;
}

/** Orden de compra abierta del caso simulado. */
export interface PurchaseOrder {
  id: string;
  supplierId: string;
  materialId: string;
  quantity: number;
  /** Fecha de emision (ISO). */
  issuedDate: string;
  /** Fecha comprometida por el proveedor. */
  promisedDate: string;
  /** Fecha estimada de llegada segun el seguimiento simulado. */
  estimatedDate: string;
  status: PurchaseOrderStatus;
  /** Costo total simulado de la orden (ARS). */
  cost: number;
  /** Riesgo de retraso simulado (0-1). */
  delayRisk: number;
}

/* ------------------------------------------------------------------ */
/* Clasificacion ABC y politicas de reposicion                         */
/* ------------------------------------------------------------------ */

export type AbcClass = "A" | "B" | "C";

/** Politica de reposicion: revision continua (Q, r) o periodica (S, R). */
export type ReviewPolicy = "continua" | "periodica";

/** Resultado del analisis ABC y de la estimacion de variabilidad del consumo. */
export interface MaterialAbcProfile {
  materialId: string;
  abcClass: AbcClass;
  /** Posicion en el ranking de consumo valorizado (1 = el que mas pesa). */
  rank: number;
  /** Consumo valorizado por dia habil (ARS). */
  dailyValue: number;
  /** Participacion del material en el consumo valorizado total (0-1). */
  valueShare: number;
  /** Participacion acumulada en el orden del Pareto (0-1). */
  cumulativeShare: number;
  /** Desvio estandar del consumo diario, estimado del historial de demanda. */
  dailySigma: number;
  /** Coeficiente de variacion del consumo diario (sigma / media). */
  consumptionCv: number;
}

/* ------------------------------------------------------------------ */
/* Escenario del modulo                                                */
/* ------------------------------------------------------------------ */

export interface SupplyScenario {
  /** Variacion aplicada a la demanda que alimenta el consumo (-20 a +30). */
  demandVariationPct: number;
  /** Dias habiles de retraso adicional sobre el lead time de todo proveedor. */
  supplierDelayDays: number;
  /** Variacion en puntos porcentuales sobre la confiabilidad (-20 a +10). */
  reliabilityVariationPoints: number;
  /** Consumo adicional por scrap y mermas de proceso (0 a 10). */
  scrapPct: number;
  /** Horizonte de analisis en dias habiles (7, 14 o 30). */
  horizonDays: number;
  /** Politica de nivel de servicio por clase ABC (ver SERVICE_LEVEL_POLICIES). */
  serviceLevelPolicyId: string;
}

export interface SupplyScenarioPreset {
  id: string;
  name: string;
  description: string;
  scenario: SupplyScenario;
}

/* ------------------------------------------------------------------ */
/* Calculo por material                                                */
/* ------------------------------------------------------------------ */

/** Un punto de la evolucion diaria del stock proyectado de un material. */
export interface ProjectedStockPoint {
  dayOffset: number;
  date: string;
  /** Etiqueta corta del dia, para los ejes de los graficos. */
  label: string;
  /** Stock al cierre del dia, en la unidad del material. */
  stock: number;
  /** Stock al cierre expresado en dias de consumo. */
  coverageDays: number;
  /** Unidades recibidas ese dia por ordenes en camino. */
  received: number;
}

/** Orden abierta ya evaluada contra el escenario activo. */
export interface OpenOrderRow {
  order: PurchaseOrder;
  materialCode: string;
  materialName: string;
  supplierName: string;
  /** Dias de retraso estimados frente a la fecha prometida. */
  delayDays: number;
  /** Fecha de llegada estimada con el retraso del escenario aplicado. */
  adjustedArrivalDate: string;
  /** Dias habiles desde el inicio del horizonte hasta la llegada estimada. */
  arrivalDayOffset: number;
  /** La orden llega dentro del horizonte analizado. */
  withinHorizon: boolean;
  /** La orden se computa como abastecimiento firme del horizonte. */
  countsAsFirm: boolean;
  /** Descripcion determinista del impacto potencial de la orden. */
  impact: string;
}

/** Resultado completo del calculo de abastecimiento para un material. */
export interface MaterialSupplyRow {
  material: SupplyMaterial;
  supplier: SupplySupplier;
  /** Consumo total del horizonte segun la BOM, con scrap y demanda del escenario. */
  projectedConsumption: number;
  /** Consumo medio por dia habil del horizonte. */
  dailyConsumption: number;
  stockOnHand: number;
  /** Unidades que llegan dentro del horizonte por ordenes firmes. */
  incomingFirmUnits: number;
  /** Unidades comprometidas en ordenes que no se computan como firmes. */
  incomingAtRiskUnits: number;
  /** stock disponible + ordenes firmes del horizonte - consumo proyectado. */
  projectedStock: number;
  /** stock disponible / consumo diario proyectado (dias habiles). */
  coverageDays: number;
  /** Clasificacion ABC y variabilidad del consumo de este material. */
  abc: MaterialAbcProfile;
  /** Politica de reposicion que le corresponde a su clase ABC. */
  reviewPolicy: ReviewPolicy;
  /** Periodo de revision S, en dias habiles (1 en la politica continua). */
  reviewPeriodDays: number;
  /** Nivel de servicio exigido a este material (0-1). */
  serviceLevel: number;
  /** Factor de seguridad Z asociado al nivel de servicio. */
  serviceLevelZ: number;
  /** Desvio del consumo diario (unidades/dia habil). */
  dailySigma: number;
  /** Desvio del plazo de entrega del proveedor, en dias habiles. */
  leadTimeSigmaDays: number;
  /** Desvio de la demanda durante el plazo de reposicion de la politica. */
  sigmaOverLeadTime: number;
  /** Parte del desvio explicada por la variabilidad del consumo (0-1). */
  sigmaDemandShare: number;
  /** Parte del desvio explicada por la variabilidad del plazo de entrega (0-1). */
  sigmaLeadTimeShare: number;
  /** Existencia + ordenado en firme - comprometido. */
  inventoryPosition: number;
  /** Unidades comprometidas por reservas (0 en el caso: no hay reservas). */
  committedUnits: number;
  /** Punto de pedido r, solo en la politica continua. */
  reorderPointContinuous: number;
  /** Techo de stock R, solo en la politica periodica. */
  stockCeiling: number;
  /** Lote Q de la politica continua. */
  orderQuantity: number;
  /** Stock de seguridad expresado en unidades del material. */
  safetyStockUnits: number;
  /** Lead time promedio con el retraso del escenario aplicado. */
  effectiveLeadTimeDays: number;
  /** Lead time maximo con el retraso del escenario aplicado. */
  effectiveMaxLeadTimeDays: number;
  /** Confiabilidad del proveedor ajustada por el escenario (0-1). */
  effectiveReliability: number;
  /** (consumo diario x lead time promedio) + stock de seguridad. */
  reorderPoint: number;
  /** Dias habiles hasta agotar el stock disponible (Infinity si no hay consumo). */
  daysToStockout: number;
  /** Dias hasta la proxima entrega factible: orden firme mas cercana o compra nueva. */
  daysToNextSupply: number;
  /** El material tiene al menos una orden abierta retrasada. */
  hasDelayedOrder: boolean;
  risk: SupplyRiskLevel;
  /** Regla textual que determino el nivel de riesgo. */
  riskRule: string;
  /** Cantidad de compra sugerida, ya ajustada al minimo del proveedor. */
  suggestedQuantity: number;
  /** Costo de la compra sugerida (cantidad x precio del proveedor). */
  purchaseCost: number;
  /** Precio unitario del proveedor (costo del material x factor de precio). */
  supplierUnitPrice: number;
  /** Faltante de material dentro del horizonte (0 si no hay quiebre). */
  shortfallUnits: number;
  /** Unidades de producto terminado que no se podrian fabricar por ese faltante. */
  productUnitsAtRisk: number;
  /** Costo estimado de no actuar (margen de contribucion perdido). */
  inactionCost: number;
  /** Valorizacion del stock disponible. */
  inventoryValue: number;
  projection: ProjectedStockPoint[];
  /** Productos terminados que consumen este material, por participacion. */
  topProducts: Array<{ sku: string; sharePct: number }>;
}

/* ------------------------------------------------------------------ */
/* Motor de recomendaciones                                            */
/* ------------------------------------------------------------------ */

export type SupplyConfidence = "alta" | "media" | "baja";

export interface SupplyRecommendation {
  materialId: string;
  materialCode: string;
  materialName: string;
  category: MaterialCategory;
  action: SupplyAction;
  /** Etiqueta en espanol de la accion recomendada. */
  actionLabel: string;
  risk: SupplyRiskLevel;
  /** Razon explicable construida con los numeros del escenario. */
  reason: string;
  quantity: number;
  unit: string;
  supplierId: string;
  supplierName: string;
  /** Fecha limite para decidir sin perder el lead time (ISO). */
  decisionDeadline: string;
  /** Dias habiles disponibles antes de la fecha limite. */
  daysToDeadline: number;
  estimatedCost: number;
  /** Que ocurre si la decision no se toma dentro del plazo. */
  consequence: string;
  /** Costo estimado de no actuar (ARS). */
  inactionCost: number;
  confidence: SupplyConfidence;
  /** Por que la confianza es esa: calidad de los datos simulados, no IA. */
  confidenceReason: string;
  /** Otros materiales del mismo proveedor con los que conviene consolidar. */
  consolidateWith: string[];
}

/** Un punto de la curva nivel de servicio vs capital inmovilizado. */
export interface ServiceLevelTradeoffPoint {
  label: string;
  probability: number;
  z: number;
  /** Valorizacion del stock de seguridad total exigido por ese nivel. */
  safetyStockValue: number;
  /** true si es el nivel que la politica activa aplica a la clase A. */
  isActiveForClassA: boolean;
}

export interface SupplyKpis {
  criticalMaterials: number;
  highRiskMaterials: number;
  /** Cobertura promedio de los materiales con consumo en el horizonte. */
  averageCoverageDays: number;
  inventoryValue: number;
  costAtRisk: number;
  delayedOrders: number;
  /** Recomendaciones que piden una decision humana (accion distinta de no comprar). */
  actionableRecommendations: number;
  /** Valorizacion del stock de seguridad exigido por la politica activa. */
  safetyStockValue: number;
  materialsBelowReorderPoint: number;
  totalPurchaseCost: number;
}

export interface SupplyResult {
  scenario: SupplyScenario;
  /** Primer dia del horizonte (ISO). */
  startDate: string;
  /** Ultimo dia del horizonte (ISO). */
  endDate: string;
  rows: MaterialSupplyRow[];
  orders: OpenOrderRow[];
  recommendations: SupplyRecommendation[];
  kpis: SupplyKpis;
  /** Curva de nivel de servicio contra capital inmovilizado en stock de seguridad. */
  serviceLevelTradeoff: ServiceLevelTradeoffPoint[];
  /** Lectura operativa determinista del escenario. */
  insights: string[];
  computedInMs: number;
}

/* ------------------------------------------------------------------ */
/* Intervencion humana (HITL)                                          */
/* ------------------------------------------------------------------ */

export type DecisionStatus = "pendiente" | "aprobada" | "rechazada" | "revision";

export interface SupplyDecision {
  materialId: string;
  status: DecisionStatus;
  note: string;
  /** Momento de la decision (ISO completo, generado en el navegador). */
  updatedAt: string;
}

export interface DecisionLogEntry {
  id: string;
  timestamp: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  /** Accion recomendada por el motor en el momento de decidir. */
  recommendedAction: string;
  risk: SupplyRiskLevel;
  user: string;
  status: DecisionStatus;
  note: string;
  /** Impacto estimado registrado junto con la decision (ARS). */
  estimatedImpact: number;
}
