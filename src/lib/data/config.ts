import type { FamilyId, ProductFamily } from "@/lib/types";

/**
 * Parametros del caso industrial SIMULADO.
 * Cambiar la semilla regenera un dataset distinto pero igualmente reproducible.
 */
export const SIMULATION_SEED = 20260302;

/** Primer dia habil del horizonte de planificacion (lunes). */
export const PLANNING_START_DATE = "2026-03-02";
export const PLANNING_HORIZON_DAYS = 5;
export const HISTORY_BUSINESS_DAYS = 90;

/** Tasa anual de costo de mantener inventario (financiero + almacenamiento). */
export const ANNUAL_HOLDING_RATE = 0.45;
export const BUSINESS_DAYS_PER_YEAR = 250;

/** Fraccion del costo unitario que representa el margen perdido por faltante. */
export const CONTRIBUTION_MARGIN_RATE = 0.35;
/** Penalidad comercial adicional por unidad no atendida. */
export const STOCKOUT_PENALTY_RATE = 0.12;

export const FAMILIES: ProductFamily[] = [
  {
    id: "LIQ",
    name: "Liquidos de limpieza",
    shortName: "Liquidos",
    description: "Lavandinas, detergentes y desinfectantes envasados en linea de llenado.",
    color: "#2f5583",
    badgeClass: "bg-navy-50 text-navy-700 ring-1 ring-inset ring-navy-200",
  },
  {
    id: "CRE",
    name: "Cremas y geles",
    shortName: "Cremas",
    description: "Productos de alta viscosidad que requieren dosificacion y mezclado previo.",
    color: "#1f9569",
    badgeClass: "bg-positive-50 text-positive-700 ring-1 ring-inset ring-positive-200",
  },
  {
    id: "ENV",
    name: "Envases plasticos",
    shortName: "Envases",
    description: "Botellas, bidones y tapas producidas por inyeccion y soplado.",
    color: "#5c718a",
    badgeClass: "bg-steel-100 text-steel-700 ring-1 ring-inset ring-steel-300",
  },
];

export interface LineDefinition {
  id: string;
  name: string;
  description: string;
  shiftsPerDay: number;
  hoursPerShift: number;
  plannedDowntimeMinutesPerDay: number;
  maxOvertimeMinutesPerDay: number;
  overtimeCostPerHour: number;
  setupCostPerHour: number;
  familiesAllowed: FamilyId[];
  initialFamilyId: FamilyId;
  /** Carga objetivo con la que se dimensiona la demanda del caso. */
  targetLoad: number;
}

export const LINE_DEFINITIONS: LineDefinition[] = [
  {
    id: "L1",
    name: "Linea 1 - Envasado de liquidos",
    description: "Llenadora rotativa de alta velocidad para liquidos de baja viscosidad.",
    shiftsPerDay: 2,
    hoursPerShift: 8,
    plannedDowntimeMinutesPerDay: 45,
    maxOvertimeMinutesPerDay: 120,
    overtimeCostPerHour: 148000,
    setupCostPerHour: 38000,
    familiesAllowed: ["LIQ", "CRE"],
    initialFamilyId: "LIQ",
    targetLoad: 0.80,
  },
  {
    id: "L2",
    name: "Linea 2 - Multiproducto",
    description: "Linea flexible que puede correr las tres familias con menor velocidad.",
    shiftsPerDay: 2,
    hoursPerShift: 8,
    plannedDowntimeMinutesPerDay: 60,
    maxOvertimeMinutesPerDay: 120,
    overtimeCostPerHour: 162000,
    setupCostPerHour: 46000,
    familiesAllowed: ["LIQ", "CRE", "ENV"],
    initialFamilyId: "CRE",
    targetLoad: 0.78,
  },
  {
    id: "L3",
    name: "Linea 3 - Inyeccion y soplado",
    description: "Inyectora y sopladora de envases; corre cremas solo como respaldo.",
    shiftsPerDay: 2,
    hoursPerShift: 8,
    plannedDowntimeMinutesPerDay: 50,
    maxOvertimeMinutesPerDay: 120,
    overtimeCostPerHour: 176000,
    setupCostPerHour: 54000,
    familiesAllowed: ["ENV", "CRE"],
    initialFamilyId: "ENV",
    targetLoad: 0.82,
  },
];

/**
 * Minutos de cambio de formato por linea y transicion de familia.
 * Dentro de la misma familia el cambio menor ya esta contemplado en la parada
 * planificada de la jornada, por eso vale 0.
 */
export const SETUP_MATRIX: Record<string, Record<string, number>> = {
  L1: { "LIQ>LIQ": 0, "CRE>CRE": 0, "LIQ>CRE": 42, "CRE>LIQ": 36 },
  L2: {
    "LIQ>LIQ": 0,
    "CRE>CRE": 0,
    "ENV>ENV": 0,
    "LIQ>CRE": 48,
    "CRE>LIQ": 44,
    "LIQ>ENV": 55,
    "ENV>LIQ": 58,
    "CRE>ENV": 52,
    "ENV>CRE": 56,
  },
  L3: { "ENV>ENV": 0, "CRE>CRE": 0, "ENV>CRE": 62, "CRE>ENV": 58 },
};

/** Velocidad base (unidades/minuto) por linea y familia. */
export const RATE_BY_LINE_FAMILY: Record<string, Partial<Record<FamilyId, [number, number]>>> = {
  L1: { LIQ: [58, 78], CRE: [24, 34] },
  L2: { LIQ: [46, 60], CRE: [21, 29], ENV: [62, 80] },
  L3: { ENV: [82, 112], CRE: [16, 22] },
};

/**
 * Asignacion de linea preferida por producto (indice dentro de la familia).
 * Se elige a proposito una mezcla de familias por linea: si cada linea corriera
 * una sola familia, el problema de secuenciamiento no existiria.
 */
export const PREFERRED_LINE_BY_FAMILY: Record<FamilyId, string[]> = {
  LIQ: ["L1", "L1", "L2", "L1", "L2", "L1"],
  CRE: ["L2", "L1", "L3", "L2", "L1", "L3"],
  ENV: ["L3", "L3", "L2", "L3", "L2", "L3"],
};

export interface ProductSeed {
  sku: string;
  name: string;
  familyId: FamilyId;
  unitCost: number;
  lotSize: number;
}

export const PRODUCT_SEEDS: ProductSeed[] = [
  { sku: "LIQ-101", name: "Lavandina concentrada 1 L", familyId: "LIQ", unitCost: 780, lotSize: 500 },
  { sku: "LIQ-102", name: "Lavandina tradicional 2 L", familyId: "LIQ", unitCost: 1050, lotSize: 500 },
  { sku: "LIQ-103", name: "Detergente limon 750 ml", familyId: "LIQ", unitCost: 920, lotSize: 500 },
  { sku: "LIQ-104", name: "Detergente ultra 1,25 L", familyId: "LIQ", unitCost: 1340, lotSize: 250 },
  { sku: "LIQ-105", name: "Desinfectante pisos 900 ml", familyId: "LIQ", unitCost: 1180, lotSize: 250 },
  { sku: "LIQ-106", name: "Limpiador multiuso 500 ml", familyId: "LIQ", unitCost: 860, lotSize: 500 },
  { sku: "CRE-201", name: "Crema limpiadora 500 g", familyId: "CRE", unitCost: 1420, lotSize: 250 },
  { sku: "CRE-202", name: "Gel desengrasante 750 g", familyId: "CRE", unitCost: 1680, lotSize: 250 },
  { sku: "CRE-203", name: "Jabon en crema 300 g", familyId: "CRE", unitCost: 990, lotSize: 250 },
  { sku: "CRE-204", name: "Gel sanitizante 250 ml", familyId: "CRE", unitCost: 1260, lotSize: 250 },
  { sku: "CRE-205", name: "Pasta limpiametales 200 g", familyId: "CRE", unitCost: 1520, lotSize: 100 },
  { sku: "CRE-206", name: "Crema pulidora 400 g", familyId: "CRE", unitCost: 1380, lotSize: 250 },
  { sku: "ENV-301", name: "Botella PET 1 L", familyId: "ENV", unitCost: 320, lotSize: 1000 },
  { sku: "ENV-302", name: "Botella PET 2 L", familyId: "ENV", unitCost: 470, lotSize: 1000 },
  { sku: "ENV-303", name: "Bidon HDPE 5 L", familyId: "ENV", unitCost: 980, lotSize: 500 },
  { sku: "ENV-304", name: "Tapa rosca 28 mm", familyId: "ENV", unitCost: 95, lotSize: 2000 },
  { sku: "ENV-305", name: "Gatillo pulverizador", familyId: "ENV", unitCost: 410, lotSize: 1000 },
  { sku: "ENV-306", name: "Envase gel 500 ml", familyId: "ENV", unitCost: 355, lotSize: 1000 },
];

export interface SupplierSeed {
  id: string;
  name: string;
  leadTimeDays: number;
  reliability: number;
  deliveriesPerWeek: number;
}

export const SUPPLIER_SEEDS: SupplierSeed[] = [
  { id: "S1", name: "Quimica del Litoral S.A.", leadTimeDays: 4, reliability: 0.96, deliveriesPerWeek: 2 },
  { id: "S2", name: "Insumos Rosario SRL", leadTimeDays: 7, reliability: 0.88, deliveriesPerWeek: 1 },
  { id: "S3", name: "Polimeros Andinos S.A.", leadTimeDays: 12, reliability: 0.82, deliveriesPerWeek: 1 },
  { id: "S4", name: "Envases y Etiquetas del Sur", leadTimeDays: 3, reliability: 0.94, deliveriesPerWeek: 3 },
  { id: "S5", name: "Distribuidora Pampa", leadTimeDays: 5, reliability: 0.91, deliveriesPerWeek: 2 },
];

export interface MaterialSeed {
  code: string;
  name: string;
  unit: string;
  unitCost: number;
  supplierId: string;
  /** Cobertura inicial expresada en dias de consumo del horizonte. */
  initialCoverDays: number;
  minCoverageDays: number;
}

export const MATERIAL_SEEDS: MaterialSeed[] = [
  { code: "MP-01", name: "Hipoclorito de sodio 10%", unit: "L", unitCost: 310, supplierId: "S1", initialCoverDays: 6.5, minCoverageDays: 5 },
  { code: "MP-02", name: "Tensioactivo LESS 70%", unit: "kg", unitCost: 1450, supplierId: "S1", initialCoverDays: 4.2, minCoverageDays: 5 },
  { code: "MP-03", name: "Fragancia limon", unit: "kg", unitCost: 6800, supplierId: "S2", initialCoverDays: 9.0, minCoverageDays: 8 },
  { code: "MP-04", name: "Soda caustica escamas", unit: "kg", unitCost: 890, supplierId: "S1", initialCoverDays: 7.4, minCoverageDays: 5 },
  { code: "MP-05", name: "Espesante carbomero", unit: "kg", unitCost: 9200, supplierId: "S2", initialCoverDays: 5.1, minCoverageDays: 8 },
  { code: "MP-06", name: "Alcohol etilico 96", unit: "L", unitCost: 1620, supplierId: "S5", initialCoverDays: 6.0, minCoverageDays: 6 },
  { code: "MP-07", name: "Resina PET grado botella", unit: "kg", unitCost: 1980, supplierId: "S3", initialCoverDays: 8.8, minCoverageDays: 13 },
  { code: "MP-08", name: "Resina HDPE soplado", unit: "kg", unitCost: 1740, supplierId: "S3", initialCoverDays: 11.5, minCoverageDays: 13 },
  { code: "MP-09", name: "Masterbatch color", unit: "kg", unitCost: 5400, supplierId: "S3", initialCoverDays: 14.0, minCoverageDays: 13 },
  { code: "MP-10", name: "Preforma PET 28 mm", unit: "u", unitCost: 78, supplierId: "S4", initialCoverDays: 3.6, minCoverageDays: 4 },
  { code: "MP-11", name: "Etiqueta autoadhesiva", unit: "u", unitCost: 42, supplierId: "S4", initialCoverDays: 7.2, minCoverageDays: 4 },
  { code: "MP-12", name: "Caja corrugada x12", unit: "u", unitCost: 640, supplierId: "S5", initialCoverDays: 5.5, minCoverageDays: 6 },
];

/** Consumo de materia prima por unidad de producto terminado, por familia. */
export const BOM_BY_FAMILY: Record<FamilyId, Array<{ code: string; quantityPerUnit: number }>> = {
  LIQ: [
    { code: "MP-01", quantityPerUnit: 0.62 },
    { code: "MP-02", quantityPerUnit: 0.045 },
    { code: "MP-03", quantityPerUnit: 0.004 },
    { code: "MP-10", quantityPerUnit: 1 },
    { code: "MP-11", quantityPerUnit: 1 },
    { code: "MP-12", quantityPerUnit: 0.084 },
  ],
  CRE: [
    { code: "MP-02", quantityPerUnit: 0.09 },
    { code: "MP-04", quantityPerUnit: 0.031 },
    { code: "MP-05", quantityPerUnit: 0.012 },
    { code: "MP-06", quantityPerUnit: 0.055 },
    { code: "MP-11", quantityPerUnit: 1 },
    { code: "MP-12", quantityPerUnit: 0.084 },
  ],
  ENV: [
    { code: "MP-07", quantityPerUnit: 0.026 },
    { code: "MP-08", quantityPerUnit: 0.018 },
    { code: "MP-09", quantityPerUnit: 0.0015 },
  ],
};

export interface AvailabilityEventSeed {
  lineId: string;
  dayIndex: number;
  availabilityFactor: number;
  reason: string;
}

/** Eventos de menor disponibilidad conocidos al momento de planificar. */
export const AVAILABILITY_EVENT_SEEDS: AvailabilityEventSeed[] = [
  { lineId: "L1", dayIndex: 0, availabilityFactor: 0.95, reason: "Puesta a punto de arranque semanal" },
  { lineId: "L2", dayIndex: 2, availabilityFactor: 0.82, reason: "Mantenimiento preventivo programado" },
  { lineId: "L3", dayIndex: 3, availabilityFactor: 0.9, reason: "Cambio y calibracion de molde" },
  { lineId: "L1", dayIndex: 4, availabilityFactor: 0.93, reason: "Auditoria interna de calidad" },
];

/** Factores de estacionalidad semanal usados al simular el historial de demanda. */
export const WEEKDAY_DEMAND_FACTOR: Record<number, number> = {
  1: 1.12,
  2: 1.04,
  3: 0.97,
  4: 1.0,
  5: 0.87,
};
