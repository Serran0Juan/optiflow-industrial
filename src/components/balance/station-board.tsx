"use client";

import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { assemblyLine, stagesById } from "@/lib/data/assembly-line";
import { formatNumber, formatPercent, formatSeconds } from "@/lib/format";
import type { BalanceLayout, BalanceStation } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Referencia de colores de etapa, compartida por el tablero y las tablas. */
export function StageLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-steel-600">
      {assemblyLine.stages.map((stage) => (
        <li key={stage.id} className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: stage.color }}
            aria-hidden
          />
          {stage.name}
        </li>
      ))}
    </ul>
  );
}

function StationCard({ station, taktSeconds }: { station: BalanceStation; taktSeconds: number }) {
  const overTakt = station.loadSeconds > taktSeconds + 1e-9;
  const ratio = Math.min(station.taktRatio, 1);

  return (
    <li
      className={cn(
        "flex flex-col rounded-card border bg-surface p-3 shadow-card",
        overTakt ? "border-danger-300" : station.isBottleneck ? "border-navy-400" : "border-line",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-navy-800">{station.label}</p>
        {station.isBottleneck ? (
          <Badge variant={overTakt ? "danger" : "navy"}>
            <AlertTriangle className="h-3 w-3" aria-hidden />
            Cuello de botella
          </Badge>
        ) : null}
      </div>

      <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-navy-800">
        {formatSeconds(station.loadSeconds)}
      </p>

      <div className="mt-2">
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-steel-100"
          role="img"
          aria-label={`Carga de ${formatPercent(station.taktRatio, 0)} respecto del takt time`}
        >
          <div
            className={cn("h-full rounded-full", overTakt ? "bg-danger-500" : "bg-navy-500")}
            style={{ width: `${Math.max(2, ratio * 100)}%` }}
          />
        </div>
        <p className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-3 text-xs text-steel-500">
          <span className={cn("font-medium", overTakt ? "text-danger-600" : "text-steel-600")}>
            {formatPercent(station.taktRatio, 0)} del takt
          </span>
          <span>Ociosa {formatSeconds(station.idleSeconds)}</span>
        </p>
      </div>

      <ul className="mt-3 space-y-1.5 border-t border-line pt-2.5">
        {station.tasks.map((task) => {
          const stage = stagesById[task.stageId];
          return (
            <li key={task.taskId} className="flex items-start gap-2 text-xs leading-snug">
              <span
                className="mt-1 h-2 w-2 shrink-0 rounded-sm"
                style={{ backgroundColor: stage.color }}
                title={stage.name}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="font-medium text-navy-700">{task.code}</span>{" "}
                <span className="text-steel-600">{task.name}</span>
              </span>
              <span className="shrink-0 tabular-nums text-steel-500">
                {formatNumber(task.seconds, 1)} s
              </span>
            </li>
          );
        })}
      </ul>
    </li>
  );
}

/** Representacion visual de las estaciones en el orden del proceso. */
export function StationBoard({ layout }: { layout: BalanceLayout }) {
  return (
    <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {layout.stations.map((station) => (
        <StationCard
          key={station.index}
          station={station}
          taktSeconds={layout.metrics.taktSeconds}
        />
      ))}
    </ol>
  );
}
