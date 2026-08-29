/**
 * Parametros del caso simulado de la Torre de abastecimiento (V2).
 *
 * Este archivo contiene UNICAMENTE constantes de negocio: catalogo de materias
 * primas, condiciones comerciales de los proveedores, ampliacion de la lista de
 * materiales y ordenes de compra abiertas. No hay logica de calculo aca y
 * ningun valor se escribe dentro de los componentes.
 *
 * Convencion de plazos: TODOS los plazos del modulo (lead times, coberturas,
 * horizontes, vencimientos de ordenes) se expresan en DIAS HABILES de planta,
 * igual que el horizonte del planificador. Asi la cobertura de un material y el
 * lead time de su proveedor son directamente comparables.
 *
 * El modulo extiende los datos de la V1 en lugar de duplicarlos: reutiliza
 * MATERIAL_SEEDS, SUPPLIER_SEEDS y BOM_BY_FAMILY, y agrega lo que la V1 no
 * modelaba (cierres, film, pallet, potes, categorias y condiciones de compra).
 * Los objetos originales no se modifican, por lo que el planificador, el
 * inventario y el balanceo siguen viendo exactamente los mismos numeros.
 */
import type {
  FamilyId,
  MaterialCategory,
  PurchaseOrderStatus,
  SupplierRiskLevel,
} from "@/lib/types";
import { MATERIAL_SEEDS, PLANNING_START_DATE, SUPPLIER_SEEDS } from "./config";

/** Primer dia habil del horizonte de la torre: el mismo que el del plan. */
export const SUPPLY_START_DATE = PLANNING_START_DATE;

/** Horizontes de analisis disponibles, en dias habiles. */
export const SUPPLY_HORIZON_OPTIONS = [7, 14, 30] as const;

/**
 * Ciclo de revision de compras: cada cuantos dias habiles el area de compras
 * vuelve a mirar el tablero. La cantidad sugerida cubre el lead time mas este
 * periodo, para no tener que comprar el mismo material dos veces seguidas.
 */
export const SUPPLY_REVIEW_PERIOD_DAYS = 5;

/**
 * Umbral de confiabilidad por debajo del cual un proveedor se considera de baja
 * confiabilidad para la clasificacion de riesgo.
 */
export const LOW_RELIABILITY_THRESHOLD = 0.9;

/** Etiquetas en espanol de las categorias de material. */
export const MATERIAL_CATEGORY_LABELS: Record<MaterialCategory, string> = {
  "producto-base": "Producto base",
  aditivo: "Fragancia o aditivo",
  envase: "Envase",
  cierre: "Tapa o dosificador",
  etiqueta: "Etiqueta",
  embalaje: "Caja, film o pallet",
};

/** Etiquetas en espanol de los estados de una orden de compra. */
export const PURCHASE_ORDER_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  "en-transito": "En transito",
  retrasada: "Retrasada",
  confirmada: "Confirmada",
  pendiente: "Pendiente",
};

/* ------------------------------------------------------------------ */
/* 1. Proveedores                                                      */
/* ------------------------------------------------------------------ */

export interface SupplySupplierSeed {
  id: string;
  name: string;
  leadTimeDays: number;
  maxLeadTimeDays: number;
  reliability: number;
  minOrderQuantity: number;
  /** Multiplicador sobre el costo unitario del material en stock. */
  priceFactor: number;
  paymentTerms: string;
  riskLevel: SupplierRiskLevel;
}

/**
 * Condiciones comerciales por proveedor.
 * Los cinco primeros amplian los proveedores de la V1 (mismo id, mismo nombre,
 * mismo lead time y misma confiabilidad); S6 es nuevo y abastece el dosificador.
 */
const SUPPLIER_TERMS: Record<
  string,
  Omit<SupplySupplierSeed, "id" | "name" | "leadTimeDays" | "reliability">
> = {
  S1: {
    maxLeadTimeDays: 7,
    minOrderQuantity: 1000,
    priceFactor: 1.04,
    paymentTerms: "30 dias fecha factura",
    riskLevel: "bajo",
  },
  S2: {
    maxLeadTimeDays: 12,
    minOrderQuantity: 150,
    priceFactor: 1.09,
    paymentTerms: "50% anticipo, 50% contra entrega",
    riskLevel: "medio",
  },
  S3: {
    maxLeadTimeDays: 20,
    minOrderQuantity: 2500,
    priceFactor: 1.06,
    paymentTerms: "60 dias fecha factura",
    riskLevel: "alto",
  },
  S4: {
    maxLeadTimeDays: 6,
    minOrderQuantity: 10000,
    priceFactor: 1.02,
    paymentTerms: "15 dias fecha factura",
    riskLevel: "bajo",
  },
  S5: {
    maxLeadTimeDays: 9,
    minOrderQuantity: 500,
    priceFactor: 1.05,
    paymentTerms: "30 dias fecha factura",
    riskLevel: "medio",
  },
};

export const SUPPLY_SUPPLIER_SEEDS: SupplySupplierSeed[] = [
  ...SUPPLIER_SEEDS.map((supplier) => ({
    id: supplier.id,
    name: supplier.name,
    leadTimeDays: supplier.leadTimeDays,
    reliability: supplier.reliability,
    ...SUPPLIER_TERMS[supplier.id],
  })),
  {
    id: "S6",
    name: "Componentes Plasticos Cuyo S.R.L.",
    leadTimeDays: 8,
    maxLeadTimeDays: 14,
    reliability: 0.79,
    minOrderQuantity: 2000,
    priceFactor: 1.11,
    paymentTerms: "Pago anticipado",
    riskLevel: "alto",
  },
];

/* ------------------------------------------------------------------ */
/* 2. Catalogo de materias primas                                      */
/* ------------------------------------------------------------------ */

export interface SupplyMaterialSeed {
  code: string;
  name: string;
  category: MaterialCategory;
  unit: string;
  unitCost: number;
  supplierId: string;
  /** Cobertura inicial en dias habiles de consumo base: define el stock. */
  initialCoverDays: number;
  /** Colchon objetivo en dias habiles de consumo. */
  safetyStockDays: number;
  criticality: "alta" | "media" | "baja";
}

/**
 * Clasificacion de las doce materias primas que ya existian en la V1.
 * Codigo, nombre, unidad, costo, proveedor y cobertura inicial se toman de
 * MATERIAL_SEEDS: aca solo se agrega lo que la torre necesita y la V1 no tenia.
 */
const V1_MATERIAL_EXTRAS: Record<
  string,
  { category: MaterialCategory; safetyStockDays: number; criticality: "alta" | "media" | "baja" }
> = {
  "MP-01": { category: "producto-base", safetyStockDays: 3, criticality: "alta" },
  "MP-02": { category: "producto-base", safetyStockDays: 3, criticality: "alta" },
  "MP-03": { category: "aditivo", safetyStockDays: 4, criticality: "media" },
  "MP-04": { category: "producto-base", safetyStockDays: 3, criticality: "media" },
  "MP-05": { category: "aditivo", safetyStockDays: 4, criticality: "alta" },
  "MP-06": { category: "producto-base", safetyStockDays: 3, criticality: "media" },
  "MP-07": { category: "envase", safetyStockDays: 6, criticality: "alta" },
  "MP-08": { category: "envase", safetyStockDays: 6, criticality: "alta" },
  "MP-09": { category: "aditivo", safetyStockDays: 5, criticality: "baja" },
  "MP-10": { category: "envase", safetyStockDays: 2, criticality: "alta" },
  "MP-11": { category: "etiqueta", safetyStockDays: 2, criticality: "media" },
  "MP-12": { category: "embalaje", safetyStockDays: 3, criticality: "media" },
};

/** Materias primas que la V2 agrega al caso (cierres, envase de crema, embalaje). */
const NEW_MATERIAL_SEEDS: SupplyMaterialSeed[] = [
  {
    code: "MP-13",
    name: "Tapa rosca 28 mm con precinto",
    category: "cierre",
    unit: "u",
    unitCost: 62,
    supplierId: "S4",
    initialCoverDays: 6.0,
    safetyStockDays: 2,
    criticality: "alta",
  },
  {
    code: "MP-14",
    name: "Dosificador gatillo 500 ml",
    category: "cierre",
    unit: "u",
    unitCost: 268,
    supplierId: "S6",
    initialCoverDays: 4.0,
    safetyStockDays: 3,
    criticality: "alta",
  },
  {
    code: "MP-15",
    name: "Film stretch 23 micrones",
    category: "embalaje",
    unit: "kg",
    unitCost: 3150,
    supplierId: "S5",
    initialCoverDays: 9.0,
    safetyStockDays: 3,
    criticality: "baja",
  },
  {
    code: "MP-16",
    name: "Pallet de madera 1,00 x 1,20 m",
    category: "embalaje",
    unit: "u",
    unitCost: 14800,
    supplierId: "S5",
    initialCoverDays: 5.0,
    safetyStockDays: 2,
    criticality: "baja",
  },
  {
    code: "MP-17",
    name: "Pote PP 500 g con tapa",
    category: "envase",
    unit: "u",
    unitCost: 186,
    supplierId: "S3",
    initialCoverDays: 7.5,
    safetyStockDays: 5,
    criticality: "alta",
  },
];

/** Las 17 materias primas del caso: las 12 de la V1 mas las 5 de la V2. */
export const SUPPLY_MATERIAL_SEEDS: SupplyMaterialSeed[] = [
  ...MATERIAL_SEEDS.map((material) => ({
    code: material.code,
    name: material.name,
    unit: material.unit,
    unitCost: material.unitCost,
    supplierId: material.supplierId,
    initialCoverDays: material.initialCoverDays,
    ...V1_MATERIAL_EXTRAS[material.code],
  })),
  ...NEW_MATERIAL_SEEDS,
];

/* ------------------------------------------------------------------ */
/* 3. Ampliacion de la lista de materiales (BOM)                       */
/* ------------------------------------------------------------------ */

/**
 * Consumo adicional por familia, en unidades de material por unidad de producto
 * terminado. Se suma a BOM_BY_FAMILY de la V1, que ya cubre producto base,
 * fragancia, preforma, etiqueta y caja.
 *
 * Embalaje: una caja lleva 12 unidades (0,084 cajas por unidad, valor de la V1),
 * un pallet lleva 80 cajas (0,00104 pallets por unidad) y cada pallet consume
 * 0,25 kg de film (0,00026 kg por unidad).
 */
export const SUPPLY_BOM_EXTRA_BY_FAMILY: Record<
  FamilyId,
  Array<{ code: string; quantityPerUnit: number }>
> = {
  LIQ: [
    { code: "MP-13", quantityPerUnit: 1 },
    { code: "MP-15", quantityPerUnit: 0.00026 },
    { code: "MP-16", quantityPerUnit: 0.00104 },
  ],
  CRE: [
    { code: "MP-17", quantityPerUnit: 1 },
    { code: "MP-15", quantityPerUnit: 0.00026 },
    { code: "MP-16", quantityPerUnit: 0.00104 },
  ],
  ENV: [
    { code: "MP-15", quantityPerUnit: 0.00018 },
    { code: "MP-16", quantityPerUnit: 0.00072 },
  ],
};

/**
 * Consumos especificos de un SKU que no se explican por su familia.
 * Solo los tres productos que se envasan con gatillo dosificador lo consumen;
 * los dos liquidos que lo llevan no usan la tapa rosca comun de su familia.
 */
export interface SkuBomOverride {
  /** Materiales que este SKU consume ademas de los de su familia. */
  add: Array<{ code: string; quantityPerUnit: number }>;
  /** Materiales de la familia que este SKU no consume. */
  remove: string[];
}

export const SUPPLY_BOM_BY_SKU: Record<string, SkuBomOverride> = {
  "LIQ-105": { add: [{ code: "MP-14", quantityPerUnit: 1 }], remove: ["MP-13"] },
  "LIQ-106": { add: [{ code: "MP-14", quantityPerUnit: 1 }], remove: ["MP-13"] },
  "CRE-204": { add: [{ code: "MP-14", quantityPerUnit: 1 }], remove: [] },
};

/* ------------------------------------------------------------------ */
/* 4. Ordenes de compra abiertas                                       */
/* ------------------------------------------------------------------ */

export interface PurchaseOrderSeed {
  id: string;
  supplierId: string;
  materialCode: string;
  /** Cantidad expresada en dias habiles de consumo base del material. */
  quantityCoverDays: number;
  /** Dias habiles de emision respecto del inicio del horizonte (negativo = pasado). */
  issuedDayOffset: number;
  /** Dia habil comprometido por el proveedor, respecto del inicio del horizonte. */
  promisedDayOffset: number;
  /** Dia habil de llegada estimada segun el seguimiento simulado. */
  estimatedDayOffset: number;
  status: PurchaseOrderStatus;
  delayRisk: number;
}

/**
 * Ordenes abiertas al inicio del horizonte. Cada una referencia un material y un
 * proveedor existentes, y su cantidad se expresa en dias de consumo para que
 * siga siendo coherente si cambia el dimensionamiento de la demanda.
 *
 * Solo las ordenes confirmadas o en transito se computan como abastecimiento
 * firme: las retrasadas y las pendientes son, justamente, el riesgo del caso.
 */
export const PURCHASE_ORDER_SEEDS: PurchaseOrderSeed[] = [
  {
    id: "OC-2026-041",
    supplierId: "S1",
    materialCode: "MP-02",
    quantityCoverDays: 8,
    issuedDayOffset: -6,
    promisedDayOffset: 2,
    estimatedDayOffset: 2,
    status: "confirmada",
    delayRisk: 0.1,
  },
  {
    id: "OC-2026-042",
    supplierId: "S6",
    materialCode: "MP-14",
    quantityCoverDays: 10,
    issuedDayOffset: -5,
    promisedDayOffset: 3,
    estimatedDayOffset: 7,
    status: "retrasada",
    delayRisk: 0.75,
  },
  {
    id: "OC-2026-043",
    supplierId: "S3",
    materialCode: "MP-07",
    quantityCoverDays: 12,
    issuedDayOffset: -9,
    promisedDayOffset: 4,
    estimatedDayOffset: 6,
    status: "en-transito",
    delayRisk: 0.35,
  },
  {
    id: "OC-2026-044",
    supplierId: "S4",
    materialCode: "MP-10",
    quantityCoverDays: 6,
    issuedDayOffset: -2,
    promisedDayOffset: 1,
    estimatedDayOffset: 1,
    status: "en-transito",
    delayRisk: 0.15,
  },
  {
    id: "OC-2026-045",
    supplierId: "S2",
    materialCode: "MP-05",
    quantityCoverDays: 14,
    issuedDayOffset: -4,
    promisedDayOffset: 8,
    estimatedDayOffset: 11,
    status: "retrasada",
    delayRisk: 0.6,
  },
  {
    id: "OC-2026-046",
    supplierId: "S5",
    materialCode: "MP-12",
    quantityCoverDays: 9,
    issuedDayOffset: -3,
    promisedDayOffset: 5,
    estimatedDayOffset: 5,
    status: "confirmada",
    delayRisk: 0.12,
  },
  {
    id: "OC-2026-047",
    supplierId: "S3",
    materialCode: "MP-17",
    quantityCoverDays: 15,
    issuedDayOffset: -1,
    promisedDayOffset: 13,
    estimatedDayOffset: 13,
    status: "pendiente",
    delayRisk: 0.4,
  },
  {
    id: "OC-2026-048",
    supplierId: "S4",
    materialCode: "MP-13",
    quantityCoverDays: 7,
    issuedDayOffset: -1,
    promisedDayOffset: 4,
    estimatedDayOffset: 4,
    status: "confirmada",
    delayRisk: 0.1,
  },
  {
    id: "OC-2026-049",
    supplierId: "S5",
    materialCode: "MP-16",
    quantityCoverDays: 20,
    issuedDayOffset: -8,
    promisedDayOffset: 2,
    estimatedDayOffset: 9,
    status: "retrasada",
    delayRisk: 0.55,
  },
  {
    id: "OC-2026-050",
    supplierId: "S1",
    materialCode: "MP-01",
    quantityCoverDays: 5,
    issuedDayOffset: 0,
    promisedDayOffset: 6,
    estimatedDayOffset: 6,
    status: "pendiente",
    delayRisk: 0.2,
  },
];
