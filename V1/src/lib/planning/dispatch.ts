/**
 * Reglas de despacho (secuenciamiento) del plan recomendado.
 *
 * Dentro de cada bloque de familia, el planificador tiene que decidir en que
 * orden atender los productos. Ninguna regla es optima para todos los
 * objetivos a la vez: cada una favorece uno y cede en otro. Ofrecerlas como
 * alternativas comparables es mas honesto que presentar una sola como "la
 * correcta".
 *
 *   Riesgo de cobertura : atiende primero al que menos dias de stock le quedan.
 *                         Favorece el nivel de servicio. Es la regla por defecto
 *                         del proyecto y la que usa el plan recomendado.
 *   EDD                 : Earliest Due Date. Atiende primero al que quiebra
 *                         antes segun el perfil diario de demanda. Minimiza
 *                         tardanzas.
 *   SPT                 : Shortest Process Time. Atiende primero al trabajo mas
 *                         corto. Minimiza el tiempo de flujo medio y mantiene
 *                         alta la utilizacion, a costa de postergar los trabajos
 *                         largos.
 *   Ratio critico       : dias hasta el quiebre dividido por dias de trabajo
 *                         pendientes. Menor a 1 significa que el trabajo va a
 *                         salir tarde. Pondera urgencia contra carga.
 *
 * La diferencia entre "riesgo de cobertura" y EDD no es cosmetica: la primera
 * usa la demanda media diaria, la segunda recorre el perfil real dia por dia.
 * Con demanda estacional pueden ordenar distinto.
 */
import type { Product } from "@/lib/types";

export type DispatchRule = "riesgo" | "edd" | "spt" | "ratio-critico";

export interface DispatchRuleOption {
  id: DispatchRule;
  name: string;
  description: string;
  /** Objetivo que la regla favorece, para mostrarlo en la interfaz. */
  favors: string;
}

export const DISPATCH_RULES: DispatchRuleOption[] = [
  {
    id: "riesgo",
    name: "Riesgo de cobertura",
    description:
      "Ordena por dias de cobertura restantes y desempata por el riesgo economico de faltante de los proximos dos dias.",
    favors: "Nivel de servicio",
  },
  {
    id: "edd",
    name: "EDD (fecha mas temprana)",
    description:
      "Ordena por el dia en que el producto quiebra segun el perfil diario de demanda acumulada, no segun la demanda media.",
    favors: "Tardanzas",
  },
  {
    id: "spt",
    name: "SPT (trabajo mas corto)",
    description:
      "Ordena por los minutos de linea que exige la corrida del dia: primero los trabajos cortos.",
    favors: "Tiempo de flujo",
  },
  {
    id: "ratio-critico",
    name: "Ratio critico",
    description:
      "Ordena por dias hasta el quiebre sobre dias de trabajo pendientes. Por debajo de 1 el trabajo ya no llega a tiempo.",
    favors: "Urgencia ponderada por carga",
  },
];

/** Funciones que la regla necesita para poder ordenar los productos. */
export interface DispatchInputs {
  /** Dias de cobertura restantes segun la demanda media diaria. */
  coverDays: (product: Product) => number;
  /** Riesgo economico de faltante en los proximos dos dias. */
  riskTwoDays: (product: Product) => number;
  /** Dia del horizonte en que el producto quiebra segun el perfil diario. */
  daysToStockout: (product: Product) => number;
  /** Minutos de linea que exige la corrida del dia. */
  processMinutes: (product: Product) => number;
  /** Dias de trabajo pendientes equivalentes a esos minutos. */
  processDays: (product: Product) => number;
}

/**
 * Devuelve el comparador correspondiente a la regla elegida.
 *
 * El comparador de "riesgo" reproduce exactamente el criterio historico del
 * planificador: cambiar la regla por defecto alteraria todos los resultados ya
 * publicados del caso.
 */
export function dispatchComparator(
  rule: DispatchRule,
  inputs: DispatchInputs,
): (a: Product, b: Product) => number {
  switch (rule) {
    case "edd":
      return (a, b) =>
        inputs.daysToStockout(a) - inputs.daysToStockout(b) ||
        inputs.coverDays(a) - inputs.coverDays(b) ||
        a.id.localeCompare(b.id);

    case "spt":
      return (a, b) =>
        inputs.processMinutes(a) - inputs.processMinutes(b) ||
        inputs.coverDays(a) - inputs.coverDays(b) ||
        a.id.localeCompare(b.id);

    case "ratio-critico":
      return (a, b) => criticalRatio(a, inputs) - criticalRatio(b, inputs) || a.id.localeCompare(b.id);

    case "riesgo":
    default:
      return (a, b) =>
        inputs.coverDays(a) - inputs.coverDays(b) ||
        inputs.riskTwoDays(b) - inputs.riskTwoDays(a) ||
        a.id.localeCompare(b.id);
  }
}

/**
 * Ratio critico = dias hasta el quiebre / dias de trabajo pendientes.
 * Por debajo de 1 el trabajo no llega a tiempo; por debajo de 0 ya esta
 * atrasado. Se acota el divisor para no dividir por cero cuando la corrida es
 * despreciable.
 */
export function criticalRatio(product: Product, inputs: DispatchInputs): number {
  const work = Math.max(0.05, inputs.processDays(product));
  return inputs.daysToStockout(product) / work;
}

export function dispatchRuleOption(rule: DispatchRule): DispatchRuleOption {
  return DISPATCH_RULES.find((item) => item.id === rule) ?? DISPATCH_RULES[0];
}
