"use client";

import Link from "next/link";
import { Gauge, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/controls";
import { formatNumber } from "@/lib/format";
import { SCENARIO_PRESETS } from "@/lib/planning";
import { CUSTOM_PRESET_ID, useScenario } from "@/state/scenario-context";

/** Selector de escenario disponible en todas las pantallas. */
export function ScenarioBar() {
  const { scenario, presetId, applyPreset, recalculate } = useScenario();

  const options = [
    ...SCENARIO_PRESETS.map((preset) => ({ value: preset.id, label: preset.name })),
    ...(presetId === CUSTOM_PRESET_ID
      ? [{ value: CUSTOM_PRESET_ID, label: "Escenario personalizado" }]
      : []),
  ];

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-x-3 gap-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="navy" title="Variacion aplicada a la demanda proyectada">
          Demanda {scenario.demandVariationPct >= 0 ? "+" : ""}
          {formatNumber(scenario.demandVariationPct)}%
        </Badge>
        <Badge
          variant={scenario.capacityReductionPct > 0 ? "warning" : "neutral"}
          title="Reduccion de capacidad disponible por linea"
        >
          Capacidad -{formatNumber(scenario.capacityReductionPct)}%
        </Badge>
        <Badge
          variant={scenario.setupTimeIncreasePct > 0 ? "warning" : "neutral"}
          title="Aumento del tiempo de cambio de formato"
        >
          Setup +{formatNumber(scenario.setupTimeIncreasePct)}%
        </Badge>
        <Badge
          variant={scenario.stockoutCostMultiplier > 1 ? "warning" : "neutral"}
          title="Multiplicador del costo de faltante"
        >
          Faltante x{formatNumber(scenario.stockoutCostMultiplier, 2)}
        </Badge>
        <Badge
          variant={scenario.allowOvertime ? "positive" : "danger"}
          title="Disponibilidad de horas extra"
        >
          {scenario.allowOvertime ? "Horas extra ON" : "Horas extra OFF"}
        </Badge>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <SelectField
          label="Escenario"
          hideLabel
          value={presetId}
          options={options}
          onChange={applyPreset}
          className="min-w-[150px] flex-1 sm:min-w-[200px] sm:flex-none"
        />
        <Button variant="outline" size="sm" onClick={recalculate} title="Recalcular el escenario activo">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Recalcular
        </Button>
        <Link
          href="/simulador"
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-steel-600 transition-colors hover:bg-steel-100 hover:text-steel-800"
        >
          <Gauge className="h-3.5 w-3.5" aria-hidden />
          Ajustar
        </Link>
      </div>
    </div>
  );
}
