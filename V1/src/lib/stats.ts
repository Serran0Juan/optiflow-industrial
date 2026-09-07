/**
 * Utilidades estadisticas del modelo.
 *
 * Se implementan a mano y sin dependencias para que el calculo sea explicito y
 * auditable: cada formula que usa el proyecto tiene que poder leerse.
 *
 * Convencion de nivel de servicio: el caso trabaja con niveles discretos
 * asociados a multiplos de sigma, igual que la bibliografia de la materia
 * (1 sigma = 84,13%, 2 sigma = 97,72%, 3 sigma = 99,87%). Al ser un conjunto
 * cerrado de opciones no hace falta invertir la normal numericamente: el valor
 * de Z se toma de una tabla, que es exacta y determinista.
 */

/** Media aritmetica. Devuelve 0 para una muestra vacia. */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

/**
 * Desvio estandar muestral (denominador n - 1).
 *
 * Se usa el estimador muestral y no el poblacional porque las series del caso
 * son una muestra del comportamiento del consumo, no la poblacion completa.
 * Con menos de dos observaciones no hay dispersion estimable y devuelve 0.
 */
export function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const average = mean(values);
  const sumSquares = values.reduce((acc, value) => acc + (value - average) ** 2, 0);
  return Math.sqrt(sumSquares / (values.length - 1));
}

/** Coeficiente de variacion: dispersion relativa a la media. */
export function coefficientOfVariation(values: number[]): number {
  const average = mean(values);
  if (average <= 0) return 0;
  return standardDeviation(values) / average;
}

/* ------------------------------------------------------------------ */
/* Nivel de servicio y factor de seguridad Z                           */
/* ------------------------------------------------------------------ */

export interface ServiceLevelOption {
  id: string;
  /** Probabilidad de no quebrar durante el ciclo de reposicion (0-1). */
  probability: number;
  /** Factor de seguridad de la normal estandar. */
  z: number;
  label: string;
}

/**
 * Niveles de servicio disponibles, con su Z exacto.
 *
 * Los tres multiplos de sigma son los que usa la materia; los intermedios
 * (90%, 95%, 99%) se agregan porque son los que se negocian en la practica con
 * el area comercial.
 */
export const SERVICE_LEVELS: ServiceLevelOption[] = [
  { id: "s1", probability: 0.8413, z: 1.0, label: "84,13% (1 sigma)" },
  { id: "s1-5", probability: 0.9332, z: 1.5, label: "93,32% (1,5 sigma)" },
  { id: "s95", probability: 0.95, z: 1.6449, label: "95,00%" },
  { id: "s2", probability: 0.9772, z: 2.0, label: "97,72% (2 sigma)" },
  { id: "s99", probability: 0.99, z: 2.3263, label: "99,00%" },
  { id: "s3", probability: 0.9987, z: 3.0, label: "99,87% (3 sigma)" },
];

const serviceLevelById: Record<string, ServiceLevelOption> = Object.fromEntries(
  SERVICE_LEVELS.map((level) => [level.id, level]),
);

export function serviceLevel(id: string): ServiceLevelOption {
  return serviceLevelById[id] ?? SERVICE_LEVELS[3];
}

/* ------------------------------------------------------------------ */
/* Desvio de la demanda durante el lead time                           */
/* ------------------------------------------------------------------ */

/**
 * Desvio estandar de la demanda durante un plazo de reposicion.
 *
 *   sigma_plazo = raiz( plazo x sigma_diario^2  +  media_diaria^2 x sigma_leadtime^2 )
 *
 * El primer termino es la variabilidad del consumo acumulada a lo largo del
 * plazo; el segundo es la variabilidad del propio plazo de entrega. Ignorar el
 * segundo termino es el error clasico que subdimensiona el stock de seguridad
 * cuando el proveedor es poco confiable.
 *
 * @param leadTimeDays      Plazo a cubrir, en dias habiles.
 * @param dailyMean         Consumo medio diario.
 * @param dailySigma        Desvio del consumo diario.
 * @param leadTimeSigmaDays Desvio del plazo de entrega, en dias habiles.
 */
export function demandSigmaOverLeadTime(
  leadTimeDays: number,
  dailyMean: number,
  dailySigma: number,
  leadTimeSigmaDays: number,
): number {
  const demandTerm = Math.max(0, leadTimeDays) * dailySigma ** 2;
  const leadTimeTerm = dailyMean ** 2 * leadTimeSigmaDays ** 2;
  return Math.sqrt(demandTerm + leadTimeTerm);
}
