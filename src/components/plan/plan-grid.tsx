"use client";

import { Badge } from "@/components/ui/badge";
import { familiesById, productsById } from "@/lib/data/dataset";
import { formatNumber, formatPercent } from "@/lib/format";
import type { PlanningDay, ProductionPlan, ProductionLine } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Vista semanal del plan: una fila por linea, una columna por dia habil.
 * Cada corrida se muestra con su familia (color), unidades, minutos y las
 * marcas de cambio de formato y hora extra.
 */
export function PlanGrid({
  plan,
  days,
  lines,
}: {
  plan: ProductionPlan;
  days: PlanningDay[];
  lines: ProductionLine[];
}) {
  return (
    <div className="scroll-x">
      <table className="w-full min-w-[980px] border-collapse text-sm">
        <thead>
          <tr>
            <th className="w-48 border-b border-line bg-steel-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-steel-500">
              Linea
            </th>
            {days.map((day) => (
              <th
                key={day.date}
                className="border-b border-l border-line bg-steel-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-steel-500"
              >
                {day.label}
                <span className="ml-1 font-normal normal-case text-steel-400">{day.weekdayName}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id} className="align-top">
              <th className="border-b border-line px-3 py-3 text-left align-top">
                <span className="block text-sm font-semibold text-navy-800">{line.id}</span>
                <span className="block text-xs font-normal leading-snug text-steel-500">
                  {line.name.replace(`${line.id} - `, "")}
                </span>
                <span className="mt-1 block text-xs font-normal text-steel-400">
                  {line.shiftsPerDay} turnos x {line.hoursPerShift} h
                </span>
              </th>
              {days.map((day) => {
                const lineDay = plan.lineDays.find(
                  (item) => item.lineId === line.id && item.dayIndex === day.index,
                );
                if (!lineDay) return <td key={day.date} className="border-b border-l border-line" />;

                const overloaded = lineDay.overtimeMinutes > 0;
                return (
                  <td key={day.date} className="border-b border-l border-line p-2 align-top">
                    <div className="space-y-1.5">
                      {lineDay.runs.length === 0 ? (
                        <p className="px-1 py-2 text-xs text-steel-400">Sin produccion programada</p>
                      ) : (
                        lineDay.runs.map((run) => {
                          const product = productsById[run.productId];
                          const family = familiesById[run.familyId];
                          return (
                            <div
                              key={`${run.productId}-${run.sequence}`}
                              className="rounded border-l-4 bg-steel-50 px-2 py-1.5"
                              style={{ borderLeftColor: family.color }}
                              title={run.reason}
                            >
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="text-xs font-semibold text-navy-800">
                                  {product.sku}
                                </span>
                                <span className="text-xs font-medium tabular-nums text-steel-700">
                                  {formatNumber(run.units)} u
                                </span>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-steel-500">
                                <span className="tabular-nums">
                                  {formatNumber(run.runMinutes, 0)} min
                                </span>
                                {run.setupMinutes > 0 ? (
                                  <Badge variant="warning">
                                    Setup {formatNumber(run.setupMinutes, 0)}&apos;
                                  </Badge>
                                ) : null}
                                {run.overtimeMinutes > 0 ? (
                                  <Badge variant="danger">
                                    HE {formatNumber(run.overtimeMinutes, 0)}&apos;
                                  </Badge>
                                ) : null}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="mt-2 border-t border-line pt-1.5">
                      <div className="flex items-center justify-between text-[11px] text-steel-500">
                        <span>
                          {formatNumber(lineDay.usedMinutes, 0)} / {formatNumber(lineDay.regularCapacityMinutes)} min
                        </span>
                        <span
                          className={cn(
                            "font-semibold tabular-nums",
                            overloaded ? "text-warning-600" : "text-steel-600",
                          )}
                        >
                          {formatPercent(lineDay.utilization, 0)}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-steel-200">
                        <div
                          className={cn("h-full", overloaded ? "bg-warning-400" : "bg-navy-500")}
                          style={{ width: `${Math.min(100, lineDay.utilization * 100)}%` }}
                        />
                      </div>
                      {lineDay.setupCount > 0 ? (
                        <p className="mt-1 text-[11px] text-steel-500">
                          {lineDay.setupCount} cambio{lineDay.setupCount > 1 ? "s" : ""} de formato
                          {lineDay.overtimeMinutes > 0
                            ? ` · ${formatNumber(lineDay.overtimeMinutes, 0)} min de hora extra`
                            : ""}
                        </p>
                      ) : lineDay.overtimeMinutes > 0 ? (
                        <p className="mt-1 text-[11px] text-warning-600">
                          {formatNumber(lineDay.overtimeMinutes, 0)} min de hora extra
                        </p>
                      ) : null}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FamilyLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-steel-600">
      {Object.values(familiesById).map((family) => (
        <li key={family.id} className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: family.color }}
            aria-hidden
          />
          {family.name} ({family.id})
        </li>
      ))}
    </ul>
  );
}
