import { dataset } from "@/lib/data/dataset";
import { roundTo } from "@/lib/rng";
import type { Dataset } from "@/lib/types";
import { clamp } from "@/lib/utils";

const RECENT_WINDOW = 20;
const WEEKDAY_WINDOW = 6;
const BASELINE_WINDOW = 30;

export interface ForecastDetail {
  productId: string;
  /** Promedio ponderado de los ultimos 20 dias habiles. */
  weightedRecentAverage: number;
  /** Indice de estacionalidad por dia de semana usado en el horizonte. */
  weekdayFactors: Record<number, number>;
  units: number[];
}

/**
 * Pronostico deterministico de demanda para el horizonte.
 *
 * Metodo (explicable a proposito, sin modelos opacos):
 *   1. Media ponderada con decaimiento lineal de los ultimos 20 dias habiles.
 *   2. Indice de dia de semana = media de las ultimas 6 observaciones de ese dia
 *      dividida por la media de los ultimos 30 dias, acotado a [0,80 ; 1,20].
 *   3. Pronostico = media ponderada x indice del dia, redondeado a 10 unidades.
 *
 * La variacion de demanda del escenario se aplica despues, como multiplicador.
 */
export function buildForecast(source: Dataset = dataset): Record<string, ForecastDetail> {
  const result: Record<string, ForecastDetail> = {};

  for (const product of source.products) {
    const history = source.demandHistory
      .filter((record) => record.productId === product.id)
      .sort((a, b) => a.dayIndex - b.dayIndex);

    const recent = history.slice(-RECENT_WINDOW);
    let weightedSum = 0;
    let weightTotal = 0;
    recent.forEach((record, index) => {
      const weight = index + 1; // decaimiento lineal: el dia mas reciente pesa mas
      weightedSum += record.units * weight;
      weightTotal += weight;
    });
    const weightedRecentAverage = weightedSum / weightTotal;

    const baselineWindow = history.slice(-BASELINE_WINDOW);
    const baselineAverage =
      baselineWindow.reduce((acc, record) => acc + record.units, 0) / baselineWindow.length;

    const weekdayFactors: Record<number, number> = {};
    for (let weekday = 1; weekday <= 5; weekday += 1) {
      const sameWeekday = history.filter((record) => record.weekday === weekday).slice(-WEEKDAY_WINDOW);
      const average = sameWeekday.reduce((acc, record) => acc + record.units, 0) / sameWeekday.length;
      weekdayFactors[weekday] = clamp(average / baselineAverage, 0.8, 1.2);
    }

    const units = source.planningDays.map((day) =>
      Math.max(0, roundTo(weightedRecentAverage * weekdayFactors[day.weekday], 10)),
    );

    result[product.id] = {
      productId: product.id,
      weightedRecentAverage,
      weekdayFactors,
      units,
    };
  }

  return result;
}

/** Aplica la variacion de demanda del escenario al pronostico base. */
export function applyDemandVariation(
  forecast: Record<string, ForecastDetail>,
  demandVariationPct: number,
): Record<string, number[]> {
  const factor = 1 + demandVariationPct / 100;
  const result: Record<string, number[]> = {};
  for (const [productId, detail] of Object.entries(forecast)) {
    result[productId] = detail.units.map((units) => Math.max(0, roundTo(units * factor, 10)));
  }
  return result;
}

/** Pronostico base cacheado a nivel modulo (no depende del escenario). */
export const baseForecast: Record<string, ForecastDetail> = buildForecast();
