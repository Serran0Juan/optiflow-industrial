/**
 * Parametros del caso simulado de balanceo de linea (V1.1).
 *
 * Linea de ensamble de envases dosificadores para productos de limpieza.
 * Todos los tiempos, costos y volumenes son sinteticos y fijos: no dependen de
 * ningun generador aleatorio, de modo que el caso es identico en cada ejecucion.
 */
import type { AssemblyTask, TaskStage } from "@/lib/types";

/** Identificador del caso, usado en titulos y documentacion. */
export const LINE_CASE_ID = "LN-DOSI-01";
export const LINE_CASE_NAME = "Linea de ensamble de envases dosificadores";
export const LINE_CASE_PRODUCT = "Envase dosificador de 500 ml para limpiadores liquidos";

/** Demanda diaria de referencia del programa comercial (unidades). */
export const BASE_DAILY_DEMAND_UNITS = 900;

/**
 * Minutos productivos de un turno: jornada de 8 h menos refrigerio, arranque,
 * limpieza de fin de turno y reuniones de piso.
 */
export const BASE_SHIFT_MINUTES = 450;
export const BASE_SHIFT_COUNT = 2;

/**
 * Costo horario cargado de una estacion (operario, puesto y servicios).
 * Supuesto del caso, en pesos argentinos simulados.
 */
export const STATION_COST_PER_HOUR = 14500;

/**
 * Costo de una unidad de demanda que la linea no alcanza a producir.
 * Supuesto del caso: margen de contribucion perdido por unidad.
 */
export const UNMET_UNIT_COST = 2800;

export const STAGES: TaskStage[] = [
  {
    id: "PRE",
    name: "Preparacion",
    description: "Alimentacion e inspeccion de envases y componentes.",
    color: "#b0c0d0",
    badgeClass: "bg-steel-100 text-steel-700 ring-steel-200",
  },
  {
    id: "ENS",
    name: "Ensamble",
    description: "Armado del dosificador y cierre del envase.",
    color: "#4d74a1",
    badgeClass: "bg-navy-50 text-navy-700 ring-navy-200",
  },
  {
    id: "LLE",
    name: "Llenado",
    description: "Dosificacion volumetrica del producto liquido.",
    color: "#234269",
    badgeClass: "bg-navy-100 text-navy-800 ring-navy-300",
  },
  {
    id: "CAL",
    name: "Control de calidad",
    description: "Verificaciones en proceso y control final.",
    color: "#1f9569",
    badgeClass: "bg-positive-50 text-positive-700 ring-positive-200",
  },
  {
    id: "EMB",
    name: "Embalaje",
    description: "Etiquetado, encajonado y paletizado.",
    color: "#7f93a8",
    badgeClass: "bg-white text-steel-600 ring-steel-300",
  },
];

/**
 * Las 16 tareas de la linea con sus precedencias y la asignacion inicial.
 *
 * La asignacion inicial (`initialStationIndex`) reproduce como suele armarse una
 * linea en la practica: bloques por etapa, en el orden en que ocurre el proceso,
 * sin nivelar la carga entre puestos. Respeta las precedencias pero concentra
 * 61 s en la estacion 2 y deja la estacion 6 con 20 s: es el desbalance que el
 * modulo mide y compara.
 */
export const TASK_SEEDS: AssemblyTask[] = [
  {
    id: "T01",
    code: "T01",
    name: "Alimentar envase a la cinta",
    stageId: "PRE",
    standardSeconds: 16,
    predecessorIds: [],
    initialStationIndex: 0,
  },
  {
    id: "T02",
    code: "T02",
    name: "Inspeccionar envase (rebabas y fisuras)",
    stageId: "PRE",
    standardSeconds: 13,
    predecessorIds: ["T01"],
    initialStationIndex: 0,
  },
  {
    id: "T03",
    code: "T03",
    name: "Soplado y limpieza interior",
    stageId: "PRE",
    standardSeconds: 10,
    predecessorIds: ["T02"],
    initialStationIndex: 0,
  },
  {
    id: "T04",
    code: "T04",
    name: "Alimentar tapas y cuerpos de dosificador",
    stageId: "PRE",
    standardSeconds: 14,
    predecessorIds: [],
    initialStationIndex: 0,
  },
  {
    id: "T05",
    code: "T05",
    name: "Preensamblar cuerpo del dosificador",
    stageId: "ENS",
    standardSeconds: 27,
    predecessorIds: ["T04"],
    initialStationIndex: 1,
  },
  {
    id: "T06",
    code: "T06",
    name: "Insertar tubo de succion a medida",
    stageId: "ENS",
    standardSeconds: 22,
    predecessorIds: ["T05"],
    initialStationIndex: 1,
  },
  {
    id: "T07",
    code: "T07",
    name: "Verificar carrera del pulsador",
    stageId: "CAL",
    standardSeconds: 12,
    predecessorIds: ["T06"],
    initialStationIndex: 1,
  },
  {
    id: "T08",
    code: "T08",
    name: "Posicionar envase bajo la boquilla",
    stageId: "LLE",
    standardSeconds: 9,
    predecessorIds: ["T03"],
    initialStationIndex: 2,
  },
  {
    id: "T09",
    code: "T09",
    name: "Dosificar producto (llenado volumetrico)",
    stageId: "LLE",
    standardSeconds: 31,
    predecessorIds: ["T08"],
    initialStationIndex: 2,
  },
  {
    id: "T10",
    code: "T10",
    name: "Verificar nivel y purgar goteo",
    stageId: "LLE",
    standardSeconds: 15,
    predecessorIds: ["T09"],
    initialStationIndex: 2,
  },
  {
    id: "T11",
    code: "T11",
    name: "Colocar dosificador y roscar tapa",
    stageId: "ENS",
    standardSeconds: 19,
    predecessorIds: ["T07", "T10"],
    initialStationIndex: 3,
  },
  {
    id: "T12",
    code: "T12",
    name: "Torquear tapa al par especificado",
    stageId: "ENS",
    standardSeconds: 17,
    predecessorIds: ["T11"],
    initialStationIndex: 3,
  },
  {
    id: "T13",
    code: "T13",
    name: "Control de torque y hermeticidad",
    stageId: "CAL",
    standardSeconds: 21,
    predecessorIds: ["T12"],
    initialStationIndex: 3,
  },
  {
    id: "T14",
    code: "T14",
    name: "Colocar etiqueta frontal y dorsal",
    stageId: "EMB",
    standardSeconds: 18,
    predecessorIds: ["T13"],
    initialStationIndex: 4,
  },
  {
    id: "T15",
    code: "T15",
    name: "Empaquetar en caja de 12 unidades",
    stageId: "EMB",
    standardSeconds: 24,
    predecessorIds: ["T14"],
    initialStationIndex: 4,
  },
  {
    id: "T16",
    code: "T16",
    name: "Paletizar y flejar",
    stageId: "EMB",
    standardSeconds: 20,
    predecessorIds: ["T15"],
    initialStationIndex: 5,
  },
];

export const INITIAL_STATION_COUNT = 6;
