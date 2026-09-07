/**
 * OEE - Overall Equipment Effectiveness.
 *
 * Mide la capacidad efectiva de una linea combinando tres perdidas distintas
 * que suelen mirarse por separado y esconderse entre si:
 *
 *   OEE = Disponibilidad x Desempeno x Calidad
 *
 *   Disponibilidad = tiempo operativo / tiempo calendario planificado
 *   Desempeno      = minutos de corrida / tiempo operativo
 *   Calidad        = unidades buenas / unidades producidas
 *
 * Definiciones de tiempo usadas, en el orden en que se descuentan:
 *
 *   tiempo calendario planificado : jornada de la linea menos paradas
 *                                   planificadas (limpieza, arranque)
 *   tiempo disponible             : lo anterior menos los eventos de menor
 *                                   disponibilidad y la reduccion del escenario
 *   tiempo operativo              : lo anterior menos los cambios de formato
 *
 * El cambio de formato se imputa como perdida de DISPONIBILIDAD, que es el
 * criterio clasico: la linea esta parada y no produce. El tiempo en que la
 * linea esta habilitada pero no tiene trabajo programado cae en DESEMPENO.
 *
 * Sobre la calidad: el plan de produccion de este caso no modela scrap, asi que
 * el componente de calidad usa el rendimiento de primera pasada declarado por
 * linea en la configuracion de planta. Es un parametro del caso, no un
 * resultado del plan, y esta documentado como tal en Metodologia.
 */
import type { LineOee, OeeResult, PlanEvaluation, ProductionLine } from "@/lib/types";
import type { PlanningContext } from "./context";

function safeRatio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

function buildLineOee(
  line: ProductionLine,
  evaluation: PlanEvaluation,
  ctx: PlanningContext,
): LineOee {
  const lineResult = evaluation.lines.find((item) => item.lineId === line.id);

  const plannedCalendarMinutes = line.regularMinutesPerDay * ctx.days.length;
  const availableMinutes = lineResult?.regularCapacityMinutes ?? 0;
  const setupMinutes = lineResult?.setupMinutes ?? 0;
  const runMinutes = lineResult?.runMinutes ?? 0;

  /* El tiempo operativo nunca puede ser negativo: si los setups consumieran mas
     que la capacidad habilitada, el excedente ya cayo en hora extra. */
  const operatingMinutes = Math.max(0, availableMinutes - setupMinutes);

  const availability = safeRatio(operatingMinutes, plannedCalendarMinutes);
  const performance = Math.min(1, safeRatio(runMinutes, operatingMinutes));
  const quality = line.firstPassYield;
  const oee = availability * performance * quality;

  return {
    lineId: line.id,
    lineName: line.name,
    plannedCalendarMinutes,
    availableMinutes,
    operatingMinutes,
    runMinutes,
    setupMinutes,
    availability,
    performance,
    quality,
    oee,
    /* Descomposicion en puntos de OEE: cuanto aporta cada perdida a la brecha
       contra el 100%. Los tres sumados mas el OEE dan exactamente 100. */
    availabilityLossPoints: (1 - availability) * 100,
    performanceLossPoints: availability * (1 - performance) * 100,
    qualityLossPoints: availability * performance * (1 - quality) * 100,
  };
}

/**
 * Calcula el OEE de cada linea y el de la planta para un plan ya evaluado.
 * Es una funcion pura: no toca el plan ni sus costos, solo lo lee.
 */
export function buildOee(evaluation: PlanEvaluation, ctx: PlanningContext): OeeResult {
  const lines = ctx.lines.map((line) => buildLineOee(line, evaluation, ctx));

  const plannedCalendarMinutes = lines.reduce((acc, item) => acc + item.plannedCalendarMinutes, 0);
  const operatingMinutes = lines.reduce((acc, item) => acc + item.operatingMinutes, 0);
  const runMinutes = lines.reduce((acc, item) => acc + item.runMinutes, 0);

  /* La calidad de planta se pondera por unidades producidas y no por tiempo:
     lo que importa es cuantas piezas salieron conformes, no en que linea. */
  const producedByLine = ctx.lines.map((line) => {
    const produced = evaluation.productDays.reduce((acc, row) => {
      const product = ctx.productById[row.productId];
      return acc + (product.preferredLineId === line.id ? row.produced : 0);
    }, 0);
    return { yieldRate: line.firstPassYield, produced };
  });
  const totalProduced = producedByLine.reduce((acc, item) => acc + item.produced, 0);
  const quality =
    totalProduced > 0
      ? producedByLine.reduce((acc, item) => acc + item.yieldRate * item.produced, 0) / totalProduced
      : safeRatio(
          lines.reduce((acc, item) => acc + item.quality, 0),
          lines.length,
        );

  const availability = safeRatio(operatingMinutes, plannedCalendarMinutes);
  const performance = Math.min(1, safeRatio(runMinutes, operatingMinutes));

  const worst = [...lines].sort((a, b) => a.oee - b.oee || a.lineId.localeCompare(b.lineId))[0];

  return {
    lines,
    plant: {
      availability,
      performance,
      quality,
      oee: availability * performance * quality,
      plannedCalendarMinutes,
      operatingMinutes,
      runMinutes,
    },
    worstLineId: worst ? worst.lineId : "",
  };
}

/**
 * Referencias de interpretacion del OEE usadas en la interfaz.
 * Son los valores de referencia habituales de la bibliografia, no objetivos
 * comprometidos por ninguna planta real.
 */
export const OEE_BENCHMARKS = {
  worldClass: 0.85,
  typical: 0.6,
  starting: 0.4,
} as const;
