"use client";

import { Badge } from "@/components/ui/badge";
import { TableWrap } from "@/components/ui/layout-bits";
import { familiesById, productsById } from "@/lib/data/dataset";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import type { PlanComparison, PlanningDay, ProductionPlan } from "@/lib/types";
import { cn } from "@/lib/utils";

type Direction = "lower-better" | "higher-better" | "neutral";

interface ComparisonRow {
  label: string;
  baseValue: number;
  recommendedValue: number;
  format: (value: number) => string;
  direction: Direction;
  group?: string;
}

/** Tabla de comparacion linea a linea entre el plan base y el recomendado. */
export function PlanComparisonTable({ comparison }: { comparison: PlanComparison }) {
  const { base, recommended } = comparison;

  const rows: ComparisonRow[] = [
    {
      label: "Costo de cambios de formato",
      baseValue: base.costs.setup,
      recommendedValue: recommended.costs.setup,
      format: formatCurrency,
      direction: "lower-better",
      group: "Modelo economico",
    },
    {
      label: "Costo de horas extra",
      baseValue: base.costs.overtime,
      recommendedValue: recommended.costs.overtime,
      format: formatCurrency,
      direction: "lower-better",
    },
    {
      label: "Costo de mantenimiento de inventario",
      baseValue: base.costs.holding,
      recommendedValue: recommended.costs.holding,
      format: formatCurrency,
      direction: "lower-better",
    },
    {
      label: "Costo de faltantes",
      baseValue: base.costs.stockout,
      recommendedValue: recommended.costs.stockout,
      format: formatCurrency,
      direction: "lower-better",
    },
    {
      label: "Costo total del plan",
      baseValue: base.costs.total,
      recommendedValue: recommended.costs.total,
      format: formatCurrency,
      direction: "lower-better",
    },
    {
      label: "Nivel de servicio",
      baseValue: base.serviceLevel,
      recommendedValue: recommended.serviceLevel,
      format: (value) => formatPercent(value, 2),
      direction: "higher-better",
      group: "Indicadores operativos",
    },
    {
      label: "Unidades no atendidas",
      baseValue: base.unmetUnits,
      recommendedValue: recommended.unmetUnits,
      format: (value) => `${formatNumber(value)} u`,
      direction: "lower-better",
    },
    {
      label: "Cantidad de cambios de formato",
      baseValue: base.setupCount,
      recommendedValue: recommended.setupCount,
      format: (value) => formatNumber(value),
      direction: "lower-better",
    },
    {
      label: "Horas de cambio de formato",
      baseValue: base.setupHours,
      recommendedValue: recommended.setupHours,
      format: (value) => `${formatNumber(value, 1)} h`,
      direction: "lower-better",
    },
    {
      label: "Horas extra utilizadas",
      baseValue: base.overtimeHours,
      recommendedValue: recommended.overtimeHours,
      format: (value) => `${formatNumber(value, 1)} h`,
      direction: "lower-better",
    },
    {
      label: "Utilizacion de capacidad",
      baseValue: base.utilization,
      recommendedValue: recommended.utilization,
      format: (value) => formatPercent(value, 1),
      direction: "neutral",
    },
    {
      label: "Unidades producidas",
      baseValue: base.producedUnits,
      recommendedValue: recommended.producedUnits,
      format: (value) => `${formatNumber(value)} u`,
      direction: "neutral",
    },
    {
      label: "Inventario al cierre del horizonte",
      baseValue: base.closingInventoryUnits,
      recommendedValue: recommended.closingInventoryUnits,
      format: (value) => `${formatNumber(value)} u`,
      direction: "neutral",
    },
  ];

  return (
    <TableWrap>
      <thead>
        <tr>
          <th>Indicador</th>
          <th className="text-right">Plan base</th>
          <th className="text-right">Plan recomendado</th>
          <th className="text-right">Diferencia</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const delta = row.recommendedValue - row.baseValue;
          const improves =
            row.direction === "lower-better"
              ? delta < -1e-9
              : row.direction === "higher-better"
                ? delta > 1e-9
                : false;
          const worsens =
            row.direction === "lower-better"
              ? delta > 1e-9
              : row.direction === "higher-better"
                ? delta < -1e-9
                : false;
          return (
            <tr key={row.label}>
              <td>
                {row.group ? (
                  <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-steel-400">
                    {row.group}
                  </span>
                ) : null}
                <span className={cn(row.label.startsWith("Costo total") && "font-semibold text-navy-800")}>
                  {row.label}
                </span>
              </td>
              <td className="numeric">{row.format(row.baseValue)}</td>
              <td className={cn("numeric", row.label.startsWith("Costo total") && "font-semibold")}>
                {row.format(row.recommendedValue)}
              </td>
              <td
                className={cn(
                  "numeric font-medium",
                  improves && "text-positive-600",
                  worsens && "text-danger-600",
                  !improves && !worsens && "text-steel-500",
                )}
              >
                {delta > 0 ? "+" : ""}
                {row.format(delta)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </TableWrap>
  );
}

/** Detalle de cada corrida con la justificacion que genero el planificador. */
export function PlanReasonsTable({ plan, days }: { plan: ProductionPlan; days: PlanningDay[] }) {
  const runs = [...plan.runs].sort(
    (a, b) =>
      a.dayIndex - b.dayIndex || a.lineId.localeCompare(b.lineId) || a.sequence - b.sequence,
  );

  return (
    <TableWrap>
      <thead>
        <tr>
          <th>Dia</th>
          <th>Linea</th>
          <th>Producto</th>
          <th>Familia</th>
          <th className="text-right">Unidades</th>
          <th className="text-right">Min. corrida</th>
          <th className="text-right">Setup</th>
          <th className="text-right">Hora extra</th>
          <th>Justificacion de la decision</th>
        </tr>
      </thead>
      <tbody>
        {runs.map((run) => {
          const product = productsById[run.productId];
          const family = familiesById[run.familyId];
          return (
            <tr key={`${run.dayIndex}-${run.lineId}-${run.sequence}`}>
              <td className="whitespace-nowrap">{days[run.dayIndex].label}</td>
              <td className="whitespace-nowrap font-medium text-navy-800">{run.lineId}</td>
              <td className="whitespace-nowrap">
                <span className="font-medium text-navy-800">{product.sku}</span>
                <span className="ml-1 text-steel-500">{product.name}</span>
              </td>
              <td>
                <Badge className={family.badgeClass}>{family.id}</Badge>
              </td>
              <td className="numeric">{formatNumber(run.units)}</td>
              <td className="numeric">{formatNumber(run.runMinutes, 0)}</td>
              <td className="numeric">
                {run.setupMinutes > 0 ? `${formatNumber(run.setupMinutes, 0)} min` : "-"}
              </td>
              <td className="numeric">
                {run.overtimeMinutes > 0 ? `${formatNumber(run.overtimeMinutes, 0)} min` : "-"}
              </td>
              <td className="min-w-[320px] text-xs leading-relaxed text-steel-600">{run.reason}</td>
            </tr>
          );
        })}
      </tbody>
    </TableWrap>
  );
}
