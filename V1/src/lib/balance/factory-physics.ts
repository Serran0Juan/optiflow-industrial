/**
 * Leyes de Factory Physics aplicadas al caso de balanceo de linea.
 *
 * El modulo de balanceo ya calcula la carga de cada estacion, el tiempo de
 * ciclo y el contenido total de trabajo. Con esos mismos numeros se pueden
 * nombrar los dos descriptores fundamentales de una linea de produccion y
 * derivar sus cotas de performance, sin agregar ningun dato nuevo:
 *
 *   rb (tasa de cuello de botella) = 1 / tiempo de ciclo
 *   T0 (tiempo neto de proceso)    = contenido total de trabajo
 *   W0 (WIP critico)               = rb x T0
 *
 * La Ley de Little relaciona las tres medidas de performance de cualquier
 * sistema de produccion, con o sin variabilidad:
 *
 *   WIP = TH x TF
 *
 * A partir de ahi se acotan los resultados posibles de la linea para cada nivel
 * de WIP:
 *
 *   Mejor caso        TH = min(w / T0, rb)       TF = max(T0, w / rb)
 *   Peor caso practico TH = w / (W0 + w - 1) x rb  TF = T0 + (w - 1) / rb
 *   Peor caso          TH = 1 / T0                TF = w x T0
 *
 * El mejor caso supone cero variabilidad; el peor caso practico es el resultado
 * esperable de una linea con variabilidad moderada y es el punto de referencia
 * honesto contra el cual compararse. La distancia entre la linea real y esas
 * cotas es lo que dice si el problema es de capacidad o de variabilidad.
 *
 * ATENCION: este modulo NO simula el WIP real de la linea. El caso de balanceo
 * es deterministico y no modela colas ni buffers entre estaciones. Lo que se
 * calcula aca son las cotas teoricas del sistema, que sirven para ubicar el
 * punto de operacion, no para afirmar cuanto WIP tiene la linea hoy.
 */
import type { BalanceMetrics } from "@/lib/types";

export interface FactoryPhysicsPoint {
  /** Nivel de WIP, en unidades dentro de la linea. */
  wip: number;
  /** Throughput del mejor caso (unidades por hora). */
  bestThroughput: number;
  /** Throughput del peor caso practico (unidades por hora). */
  practicalThroughput: number;
  /** Tiempo de flujo del mejor caso (segundos). */
  bestFlowSeconds: number;
  /** Tiempo de flujo del peor caso practico (segundos). */
  practicalFlowSeconds: number;
}

export interface FactoryPhysicsResult {
  /** Tasa de cuello de botella, en unidades por hora. */
  bottleneckRatePerHour: number;
  /** Tiempo neto de proceso T0, en segundos. */
  rawProcessSeconds: number;
  /** WIP critico W0 = rb x T0, en unidades. */
  criticalWip: number;
  /** Tiempo de flujo en el WIP critico, por Ley de Little (segundos). */
  criticalFlowSeconds: number;
  /** Throughput alcanzable en el WIP critico (unidades por hora). */
  criticalThroughputPerHour: number;
  /** Curva de cotas para distintos niveles de WIP. */
  curve: FactoryPhysicsPoint[];
  /** Estaciones de la distribucion analizada. */
  stationCount: number;
}

const SECONDS_PER_HOUR = 3600;

/**
 * Calcula los descriptores de Factory Physics y la curva de cotas.
 * Es una funcion pura sobre las metricas que el balanceo ya produjo.
 */
export function buildFactoryPhysics(metrics: BalanceMetrics): FactoryPhysicsResult {
  const cycleSeconds = metrics.cycleSeconds;
  const rawProcessSeconds = metrics.totalWorkSeconds;

  /* Sin tiempo de ciclo no hay linea que analizar: se devuelve una curva vacia
     en lugar de dividir por cero. */
  if (cycleSeconds <= 0 || rawProcessSeconds <= 0) {
    return {
      bottleneckRatePerHour: 0,
      rawProcessSeconds,
      criticalWip: 0,
      criticalFlowSeconds: 0,
      criticalThroughputPerHour: 0,
      curve: [],
      stationCount: metrics.stationCount,
    };
  }

  /* rb en unidades por segundo: la estacion mas cargada marca el ritmo. */
  const bottleneckRate = 1 / cycleSeconds;
  const criticalWip = bottleneckRate * rawProcessSeconds;

  /* La curva se recorre hasta el doble del WIP critico, que es donde las tres
     cotas ya se separaron lo suficiente como para leerse. */
  const maxWip = Math.max(2, Math.ceil(criticalWip * 2));
  const curve: FactoryPhysicsPoint[] = [];

  for (let wip = 1; wip <= maxWip; wip += 1) {
    const bestThroughput = Math.min(wip / rawProcessSeconds, bottleneckRate);
    const practicalThroughput = (wip / (criticalWip + wip - 1)) * bottleneckRate;

    curve.push({
      wip,
      bestThroughput: bestThroughput * SECONDS_PER_HOUR,
      practicalThroughput: practicalThroughput * SECONDS_PER_HOUR,
      bestFlowSeconds: Math.max(rawProcessSeconds, wip / bottleneckRate),
      practicalFlowSeconds: rawProcessSeconds + (wip - 1) / bottleneckRate,
    });
  }

  return {
    bottleneckRatePerHour: bottleneckRate * SECONDS_PER_HOUR,
    rawProcessSeconds,
    criticalWip,
    /* En el WIP critico el mejor caso alcanza rb con el tiempo de flujo minimo:
       por Ley de Little, TF = WIP / TH = W0 / rb = T0. */
    criticalFlowSeconds: rawProcessSeconds,
    criticalThroughputPerHour: bottleneckRate * SECONDS_PER_HOUR,
    curve,
    stationCount: metrics.stationCount,
  };
}

/**
 * Verificacion de la Ley de Little sobre un punto de operacion.
 * Se usa en la interfaz para mostrar que la identidad WIP = TH x TF se cumple
 * con los numeros del caso y no es una formula decorativa.
 */
export function littlesLawCheck(
  wip: number,
  throughputPerHour: number,
  flowSeconds: number,
): { expectedWip: number; matches: boolean } {
  const expectedWip = (throughputPerHour / SECONDS_PER_HOUR) * flowSeconds;
  return { expectedWip, matches: Math.abs(expectedWip - wip) < 1e-6 };
}
