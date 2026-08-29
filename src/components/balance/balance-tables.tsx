"use client";

import { Badge } from "@/components/ui/badge";
import { TableWrap } from "@/components/ui/layout-bits";
import { stagesById, tasksById } from "@/lib/data/assembly-line";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatSeconds,
} from "@/lib/format";
import type { BalanceComparison, BalanceTaskRow } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ComparisonRow {
  label: string;
  initial: string;
  recommended: string;
  delta: number;
  format: (value: number) => string;
  lowerBetter: boolean;
  /** Indicadores puramente descriptivos: no se colorean como mejora o riesgo. */
  neutral?: boolean;
}

/** Tabla comparativa entre la distribucion inicial y el balance recomendado. */
export function LayoutComparisonTable({ comparison }: { comparison: BalanceComparison }) {
  const { initial, recommended } = comparison;

  const rows: ComparisonRow[] = [
    {
      label: "Estaciones de trabajo",
      initial: formatNumber(initial.metrics.stationCount),
      recommended: formatNumber(recommended.metrics.stationCount),
      delta: comparison.stationDelta,
      format: (value) => formatNumber(value),
      lowerBetter: true,
      neutral: true,
    },
    {
      label: "Tiempo de ciclo",
      initial: formatSeconds(initial.metrics.cycleSeconds),
      recommended: formatSeconds(recommended.metrics.cycleSeconds),
      delta: comparison.cycleDeltaSeconds,
      format: (value) => formatSeconds(value),
      lowerBetter: true,
    },
    {
      label: "Eficiencia de linea",
      initial: formatPercent(initial.metrics.lineEfficiency),
      recommended: formatPercent(recommended.metrics.lineEfficiency),
      delta: comparison.efficiencyDeltaPoints,
      format: (value) => `${formatNumber(value, 1)} p.p.`,
      lowerBetter: false,
    },
    {
      label: "Perdida por desbalance",
      initial: formatPercent(initial.metrics.balanceLoss),
      recommended: formatPercent(recommended.metrics.balanceLoss),
      delta: (recommended.metrics.balanceLoss - initial.metrics.balanceLoss) * 100,
      format: (value) => `${formatNumber(value, 1)} p.p.`,
      lowerBetter: true,
    },
    {
      label: "Tiempo ocioso por ciclo",
      initial: formatSeconds(initial.metrics.idleSecondsPerCycle),
      recommended: formatSeconds(recommended.metrics.idleSecondsPerCycle),
      delta: recommended.metrics.idleSecondsPerCycle - initial.metrics.idleSecondsPerCycle,
      format: (value) => formatSeconds(value),
      lowerBetter: true,
    },
    {
      label: "Capacidad diaria",
      initial: `${formatNumber(initial.metrics.dailyCapacityUnits)} u`,
      recommended: `${formatNumber(recommended.metrics.dailyCapacityUnits)} u`,
      delta: comparison.capacityDeltaUnits,
      format: (value) => `${formatNumber(value)} u`,
      lowerBetter: false,
    },
    {
      label: "Brecha de capacidad",
      initial: `${formatNumber(initial.metrics.capacityGapUnits)} u`,
      recommended: `${formatNumber(recommended.metrics.capacityGapUnits)} u`,
      delta: recommended.metrics.capacityGapUnits - initial.metrics.capacityGapUnits,
      format: (value) => `${formatNumber(value)} u`,
      lowerBetter: false,
    },
    {
      label: "Unidades no atendidas",
      initial: `${formatNumber(initial.metrics.unmetUnits)} u`,
      recommended: `${formatNumber(recommended.metrics.unmetUnits)} u`,
      delta: comparison.unmetDeltaUnits,
      format: (value) => `${formatNumber(value)} u`,
      lowerBetter: true,
    },
    {
      label: "Costo diario de estaciones",
      initial: formatCurrency(initial.cost.stationCost),
      recommended: formatCurrency(recommended.cost.stationCost),
      delta: recommended.cost.stationCost - initial.cost.stationCost,
      format: (value) => formatCurrency(value),
      lowerBetter: true,
    },
    {
      label: "Costo de unidades no atendidas",
      initial: formatCurrency(initial.cost.unmetCost),
      recommended: formatCurrency(recommended.cost.unmetCost),
      delta: recommended.cost.unmetCost - initial.cost.unmetCost,
      format: (value) => formatCurrency(value),
      lowerBetter: true,
    },
    {
      label: "Costo total estimado del dia",
      initial: formatCurrency(initial.cost.total),
      recommended: formatCurrency(recommended.cost.total),
      delta: recommended.cost.total - initial.cost.total,
      format: (value) => formatCurrency(value),
      lowerBetter: true,
    },
    {
      label: "Costo por unidad entregada",
      initial: formatCurrency(initial.cost.costPerDeliveredUnit),
      recommended: formatCurrency(recommended.cost.costPerDeliveredUnit),
      delta: recommended.cost.costPerDeliveredUnit - initial.cost.costPerDeliveredUnit,
      format: (value) => formatCurrency(value),
      lowerBetter: true,
    },
  ];

  return (
    <TableWrap>
      <thead>
        <tr>
          <th>Indicador</th>
          <th className="text-right">Distribucion inicial</th>
          <th className="text-right">Balance recomendado</th>
          <th className="text-right">Diferencia</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const improves = !row.neutral && (row.lowerBetter ? row.delta < -1e-9 : row.delta > 1e-9);
          const worsens = !row.neutral && (row.lowerBetter ? row.delta > 1e-9 : row.delta < -1e-9);
          return (
            <tr key={row.label}>
              <td>{row.label}</td>
              <td className="numeric text-steel-500">{row.initial}</td>
              <td className="numeric font-medium text-navy-800">{row.recommended}</td>
              <td
                className={cn(
                  "numeric font-medium",
                  improves && "text-positive-600",
                  worsens && "text-danger-600",
                  !improves && !worsens && "text-steel-400",
                )}
              >
                {row.delta > 0 ? "+" : ""}
                {row.format(row.delta)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </TableWrap>
  );
}

/** Detalle por tarea: tiempo, precedencias, peso posicional y estacion asignada. */
export function TaskAssignmentTable({ rows }: { rows: BalanceTaskRow[] }) {
  return (
    <TableWrap>
      <thead>
        <tr>
          <th>Codigo</th>
          <th>Tarea</th>
          <th>Etapa</th>
          <th className="text-right">Tiempo estandar</th>
          <th>Predecesoras</th>
          <th className="text-right">Peso posicional</th>
          <th className="text-right">Estacion inicial</th>
          <th className="text-right">Estacion recomendada</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const stage = stagesById[row.task.stageId];
          const moved = row.initialStation !== row.recommendedStation;
          return (
            <tr key={row.task.id}>
              <td className="whitespace-nowrap font-medium text-navy-800">{row.task.code}</td>
              <td className="min-w-[220px] text-steel-700">{row.task.name}</td>
              <td>
                <Badge className={stage.badgeClass}>{stage.name}</Badge>
              </td>
              <td className="numeric">{formatNumber(row.seconds, 1)} s</td>
              <td className="whitespace-nowrap text-steel-500">
                {row.task.predecessorIds.length > 0
                  ? row.task.predecessorIds.map((id) => tasksById[id].code).join(", ")
                  : "-"}
              </td>
              <td className="numeric">{formatNumber(row.positionalWeight, 1)} s</td>
              <td className="numeric text-steel-500">E{row.initialStation}</td>
              <td className={cn("numeric font-medium", moved ? "text-navy-700" : "text-steel-500")}>
                E{row.recommendedStation}
                {moved ? <span className="ml-1 text-xs text-steel-400">(reasignada)</span> : null}
              </td>
            </tr>
          );
        })}
      </tbody>
    </TableWrap>
  );
}
