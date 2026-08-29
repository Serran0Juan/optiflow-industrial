/**
 * Lecturas operativas del balance.
 *
 * Los textos se arman a partir de los numeros calculados: el mismo escenario
 * produce siempre exactamente las mismas frases. No interviene ningun modelo de
 * lenguaje ni ningun servicio externo.
 */
import { formatCurrency, formatNumber, formatPercent, formatSeconds } from "@/lib/format";
import type { BalanceComparison, BalanceLayout } from "@/lib/types";
import type { BalanceContext } from "./metrics";

function bottleneckOf(layout: BalanceLayout) {
  return layout.stations.find((station) => station.isBottleneck) ?? layout.stations[0];
}

export function buildBalanceInsights(
  comparison: BalanceComparison,
  ctx: BalanceContext,
): string[] {
  const { initial, recommended } = comparison;
  const insights: string[] = [];

  insights.push(
    `La demanda de ${formatNumber(ctx.dailyDemandUnits)} unidades diarias con ${formatNumber(
      ctx.availableSeconds / 3600,
      1,
    )} horas disponibles exige un takt time de ${formatSeconds(ctx.taktSeconds)} por unidad: ese es el ritmo que la linea tiene que sostener.`,
  );

  const initialBottleneck = bottleneckOf(initial);
  insights.push(
    `En la distribucion inicial la ${initialBottleneck.label.toLowerCase()} limita la linea al concentrar ${formatSeconds(
      initialBottleneck.loadSeconds,
    )} de carga (${initialBottleneck.tasks.map((task) => task.code).join(", ")}), ${
      initialBottleneck.loadSeconds > ctx.taktSeconds
        ? `${formatSeconds(initialBottleneck.loadSeconds - ctx.taktSeconds)} por encima del takt`
        : `${formatSeconds(ctx.taktSeconds - initialBottleneck.loadSeconds)} por debajo del takt`
    }.`,
  );

  const recommendedBottleneck = bottleneckOf(recommended);
  insights.push(
    `El balance recomendado por heuristica traslada el cuello de botella a la ${recommendedBottleneck.label.toLowerCase()} con ${formatSeconds(
      recommendedBottleneck.loadSeconds,
    )}, de modo que el tiempo de ciclo pasa de ${formatSeconds(
      initial.metrics.cycleSeconds,
    )} a ${formatSeconds(recommended.metrics.cycleSeconds)}.`,
  );

  const lossDelta = initial.metrics.balanceLoss - recommended.metrics.balanceLoss;
  insights.push(
    lossDelta > 1e-6
      ? `La asignacion recomendada reduce la perdida por desbalance de ${formatPercent(
          initial.metrics.balanceLoss,
        )} a ${formatPercent(recommended.metrics.balanceLoss)} dentro del caso simulado, con ${formatSeconds(
          recommended.metrics.idleSecondsPerCycle,
        )} de tiempo ocioso por ciclo frente a ${formatSeconds(initial.metrics.idleSecondsPerCycle)}.`
      : `La asignacion recomendada no mejora la perdida por desbalance en este escenario: pasa de ${formatPercent(
          initial.metrics.balanceLoss,
        )} a ${formatPercent(recommended.metrics.balanceLoss)}.`,
  );

  insights.push(
    initial.metrics.capacityGapUnits < 0
      ? `Con la distribucion inicial existe una brecha de ${formatNumber(
          Math.abs(initial.metrics.capacityGapUnits),
        )} unidades diarias: la capacidad llega a ${formatNumber(
          initial.metrics.dailyCapacityUnits,
        )} unidades frente a una demanda de ${formatNumber(ctx.dailyDemandUnits)}.`
      : `Con la distribucion inicial no existe brecha de capacidad: la linea rinde ${formatNumber(
          initial.metrics.dailyCapacityUnits,
        )} unidades diarias, ${formatNumber(initial.metrics.capacityGapUnits)} por encima de la demanda.`,
  );

  insights.push(
    recommended.metrics.capacityGapUnits >= 0
      ? `El balance recomendado cubre la demanda con ${formatNumber(
          recommended.metrics.dailyCapacityUnits,
        )} unidades diarias de capacidad (${formatNumber(
          recommended.metrics.capacityGapUnits,
        )} de margen) usando ${formatNumber(recommended.metrics.stationCount)} estaciones.`
      : `Ni siquiera el balance recomendado alcanza la demanda: quedan ${formatNumber(
          Math.abs(recommended.metrics.capacityGapUnits),
        )} unidades diarias sin producir con ${formatNumber(
          recommended.metrics.stationCount,
        )} estaciones. Hace falta mas tiempo disponible o menos contenido de trabajo.`,
  );

  insights.push(
    recommended.metrics.stationCount > recommended.metrics.theoreticalMinStations
      ? `El minimo teorico es de ${formatNumber(
          recommended.metrics.theoreticalMinStations,
        )} estaciones (contenido de trabajo / takt time). La heuristica usa ${formatNumber(
          recommended.metrics.stationCount,
        )}: las precedencias y la indivisibilidad de las tareas impiden llegar al minimo teorico.`
      : `La heuristica alcanza el minimo teorico de ${formatNumber(
          recommended.metrics.theoreticalMinStations,
        )} estaciones para este takt time.`,
  );

  insights.push(
    comparison.improves
      ? `Diferencia estimada dentro del caso simulado: ${formatCurrency(
          comparison.costDelta,
        )} por dia a favor del balance recomendado (${formatNumber(
          comparison.costDeltaPct,
          1,
        )}% del costo de la distribucion inicial).`
      : comparison.costDelta === 0
        ? "Diferencia estimada dentro del caso simulado: ninguna. Ambas distribuciones cuestan lo mismo en este escenario."
        : `En este escenario el balance recomendado cuesta ${formatCurrency(
            Math.abs(comparison.costDelta),
          )} mas por dia que la distribucion inicial: se informa como empeoramiento del escenario, no como ahorro.`,
  );

  return insights;
}
