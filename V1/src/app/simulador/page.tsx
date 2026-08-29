"use client";

import { useMemo } from "react";
import { RotateCcw } from "lucide-react";
import { CostBreakdownChart, CostComparisonChart } from "@/components/charts/cost-charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SliderField, SwitchField } from "@/components/ui/controls";
import { Note, PageHeader, TableWrap } from "@/components/ui/layout-bits";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { runPlanning, SCENARIO_LIMITS, SCENARIO_PRESETS } from "@/lib/planning";
import { cn } from "@/lib/utils";
import { CUSTOM_PRESET_ID, useScenario } from "@/state/scenario-context";

const REFERENCE_PRESET = SCENARIO_PRESETS[0];

export default function SimulatorPage() {
  const { scenario, result, presetId, updateScenario, applyPreset, reset } = useScenario();

  // Referencia fija para dimensionar el efecto del escenario activo.
  const reference = useMemo(() => runPlanning(REFERENCE_PRESET.scenario), []);
  const current = result.comparison.recommended;
  const referenceEvaluation = reference.comparison.recommended;

  const effectRows = [
    {
      label: "Costo total del plan recomendado",
      current: formatCurrency(current.costs.total),
      reference: formatCurrency(referenceEvaluation.costs.total),
      delta: current.costs.total - referenceEvaluation.costs.total,
      format: (value: number) => formatCurrency(value),
      lowerBetter: true,
    },
    {
      label: "Costo total del plan base",
      current: formatCurrency(result.comparison.base.costs.total),
      reference: formatCurrency(reference.comparison.base.costs.total),
      delta: result.comparison.base.costs.total - reference.comparison.base.costs.total,
      format: (value: number) => formatCurrency(value),
      lowerBetter: true,
    },
    {
      label: "Nivel de servicio",
      current: formatPercent(current.serviceLevel, 2),
      reference: formatPercent(referenceEvaluation.serviceLevel, 2),
      delta: (current.serviceLevel - referenceEvaluation.serviceLevel) * 100,
      format: (value: number) => `${formatNumber(value, 2)} p.p.`,
      lowerBetter: false,
    },
    {
      label: "Unidades no atendidas",
      current: formatNumber(current.unmetUnits),
      reference: formatNumber(referenceEvaluation.unmetUnits),
      delta: current.unmetUnits - referenceEvaluation.unmetUnits,
      format: (value: number) => `${formatNumber(value)} u`,
      lowerBetter: true,
    },
    {
      label: "Cambios de formato",
      current: formatNumber(current.setupCount),
      reference: formatNumber(referenceEvaluation.setupCount),
      delta: current.setupCount - referenceEvaluation.setupCount,
      format: (value: number) => formatNumber(value),
      lowerBetter: true,
    },
    {
      label: "Horas extra",
      current: `${formatNumber(current.overtimeHours, 1)} h`,
      reference: `${formatNumber(referenceEvaluation.overtimeHours, 1)} h`,
      delta: current.overtimeHours - referenceEvaluation.overtimeHours,
      format: (value: number) => `${formatNumber(value, 1)} h`,
      lowerBetter: true,
    },
    {
      label: "Utilizacion de capacidad",
      current: formatPercent(current.utilization, 1),
      reference: formatPercent(referenceEvaluation.utilization, 1),
      delta: (current.utilization - referenceEvaluation.utilization) * 100,
      format: (value: number) => `${formatNumber(value, 1)} p.p.`,
      lowerBetter: false,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Simulador de escenarios"
        description="Modifica las condiciones de la semana y observa como cambian el plan, los costos y el nivel de servicio. Cada ajuste recalcula el pronostico, la capacidad, los dos planes y el modelo economico completo."
        actions={
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw className="h-4 w-4" aria-hidden />
            Volver a operacion estable
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Escenarios predefinidos</CardTitle>
              <CardDescription>
                Tres configuraciones tipicas de planta. Al elegir una se recalcula todo el modelo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {SCENARIO_PRESETS.map((preset) => {
                const active = presetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset.id)}
                    aria-pressed={active}
                    className={cn(
                      "w-full rounded-md border px-3 py-2.5 text-left transition-colors",
                      active
                        ? "border-navy-500 bg-navy-50"
                        : "border-line bg-surface hover:border-navy-200 hover:bg-steel-50",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-navy-800">{preset.name}</span>
                      {active ? <Badge variant="navy">Activo</Badge> : null}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-steel-500">
                      {preset.description}
                    </span>
                  </button>
                );
              })}
              {presetId === CUSTOM_PRESET_ID ? (
                <p className="rounded-md bg-steel-50 px-3 py-2 text-xs text-steel-600">
                  Escenario personalizado: los parametros no coinciden con ningun preset.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Parametros del escenario</CardTitle>
              <CardDescription>
                Los cambios se aplican inmediatamente sobre el pronostico, la capacidad y el modelo
                de costos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <SliderField
                label="Variacion de demanda"
                value={scenario.demandVariationPct}
                min={SCENARIO_LIMITS.demandVariationPct.min}
                max={SCENARIO_LIMITS.demandVariationPct.max}
                step={SCENARIO_LIMITS.demandVariationPct.step}
                onChange={(value) => updateScenario({ demandVariationPct: value })}
                formatValue={(value) => `${value > 0 ? "+" : ""}${formatNumber(value)}%`}
                description="Multiplica el pronostico de todos los productos del horizonte."
              />
              <SliderField
                label="Reduccion de capacidad disponible"
                value={scenario.capacityReductionPct}
                min={SCENARIO_LIMITS.capacityReductionPct.min}
                max={SCENARIO_LIMITS.capacityReductionPct.max}
                step={SCENARIO_LIMITS.capacityReductionPct.step}
                onChange={(value) => updateScenario({ capacityReductionPct: value })}
                formatValue={(value) => `-${formatNumber(value)}%`}
                description="Reduce los minutos de jornada normal de las tres lineas."
              />
              <SliderField
                label="Aumento del tiempo de setup"
                value={scenario.setupTimeIncreasePct}
                min={SCENARIO_LIMITS.setupTimeIncreasePct.min}
                max={SCENARIO_LIMITS.setupTimeIncreasePct.max}
                step={SCENARIO_LIMITS.setupTimeIncreasePct.step}
                onChange={(value) => updateScenario({ setupTimeIncreasePct: value })}
                formatValue={(value) => `+${formatNumber(value)}%`}
                description="Alarga cada cambio de formato: mas minutos perdidos y setups mas caros."
              />
              <SliderField
                label="Multiplicador del costo de faltante"
                value={scenario.stockoutCostMultiplier}
                min={SCENARIO_LIMITS.stockoutCostMultiplier.min}
                max={SCENARIO_LIMITS.stockoutCostMultiplier.max}
                step={SCENARIO_LIMITS.stockoutCostMultiplier.step}
                onChange={(value) => updateScenario({ stockoutCostMultiplier: value })}
                formatValue={(value) => `x${formatNumber(value, 2)}`}
                description="Endurece la penalidad por no atender demanda y cambia las prioridades de la heuristica."
              />
              <div className="border-t border-line pt-4">
                <SwitchField
                  label="Permitir horas extra"
                  description="Si se desactiva, ningun plan puede superar la jornada normal."
                  checked={scenario.allowOvertime}
                  onChange={(checked) => updateScenario({ allowOvertime: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 xl:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Costo total con el escenario activo</CardTitle>
                <CardDescription>
                  {result.comparison.improves
                    ? `El plan recomendado evita ${formatCurrency(result.comparison.costDelta)} respecto del plan base.`
                    : `El plan recomendado cuesta ${formatCurrency(Math.abs(result.comparison.costDelta))} mas que el plan base en este escenario.`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CostComparisonChart
                  baseCost={result.comparison.base.costs.total}
                  recommendedCost={current.costs.total}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Composicion del costo</CardTitle>
                <CardDescription>
                  Como se reparte el costo total entre setups, horas extra, inventario y faltantes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CostBreakdownChart
                  base={result.comparison.base.costs}
                  recommended={current.costs}
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Efecto del escenario</CardTitle>
              <CardDescription>
                Comparacion del escenario activo contra la referencia &quot;{REFERENCE_PRESET.name}&quot;.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 py-0">
              <TableWrap>
                <thead>
                  <tr>
                    <th>Indicador</th>
                    <th className="text-right">Referencia estable</th>
                    <th className="text-right">Escenario activo</th>
                    <th className="text-right">Variacion</th>
                  </tr>
                </thead>
                <tbody>
                  {effectRows.map((row) => {
                    const improves = row.lowerBetter ? row.delta < -1e-9 : row.delta > 1e-9;
                    const worsens = row.lowerBetter ? row.delta > 1e-9 : row.delta < -1e-9;
                    return (
                      <tr key={row.label}>
                        <td>{row.label}</td>
                        <td className="numeric text-steel-500">{row.reference}</td>
                        <td className="numeric font-medium text-navy-800">{row.current}</td>
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
            </CardContent>
          </Card>

          <Note tone="info" title="Como leer el simulador">
            El multiplicador de costo de faltante solo modifica el resultado economico cuando existen
            unidades no atendidas; en escenarios holgados puede no cambiar ningun numero, y eso es
            correcto. La reduccion de capacidad y el aumento de setups, en cambio, siempre alteran el
            plan porque cambian los minutos disponibles de cada linea.
          </Note>
        </div>
      </div>
    </div>
  );
}
