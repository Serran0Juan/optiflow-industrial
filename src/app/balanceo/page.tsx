"use client";

import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  Gauge,
  Package,
  Repeat,
  RefreshCw,
  RotateCcw,
  Timer,
  TrendingDown,
  Users,
  Wallet,
} from "lucide-react";
import {
  BalanceCostChart,
  EfficiencyCapacityChart,
  StationLoadChart,
} from "@/components/charts/balance-charts";
import { LayoutComparisonTable, TaskAssignmentTable } from "@/components/balance/balance-tables";
import { StageLegend, StationBoard } from "@/components/balance/station-board";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SliderField, SwitchField, ToggleGroup } from "@/components/ui/controls";
import { KpiCard, type KpiTone } from "@/components/ui/kpi-card";
import { Note, PageHeader } from "@/components/ui/layout-bits";
import { BALANCE_LIMITS, BALANCE_PRESETS, SHIFT_COUNT_OPTIONS } from "@/lib/balance";
import { assemblyLine } from "@/lib/data/assembly-line";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatSeconds,
  formatSignedCurrency,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { CUSTOM_BALANCE_PRESET_ID, useBalanceScenario } from "@/state/use-balance-scenario";

export default function BalancePage() {
  const { scenario, result, presetId, computation, updateScenario, applyPreset, recalculate, reset } =
    useBalanceScenario();
  const [boardView, setBoardView] = useState<"recomendado" | "inicial">("recomendado");

  const { initial, recommended } = result.comparison;
  const board = boardView === "recomendado" ? recommended : initial;
  const bottleneck =
    recommended.stations.find((station) => station.isBottleneck) ?? recommended.stations[0];

  const costTone: KpiTone = result.comparison.improves
    ? "positive"
    : result.comparison.costDelta < 0
      ? "danger"
      : "neutral";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Balanceo de linea"
        description="Como se reparte el contenido de trabajo de una linea de ensamble entre estaciones, que ritmo exige la demanda (takt time), donde queda el cuello de botella y cuanta capacidad se pierde por desbalance."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="h-4 w-4" aria-hidden />
              Operacion estable
            </Button>
            <Button variant="primary" size="sm" onClick={recalculate}>
              <RefreshCw className="h-4 w-4" aria-hidden />
              Recalcular balance
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-2 rounded-md border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-medium">
          Caso de estudio simulado &middot; Recomendacion heuristica, no optimo matematico
          garantizado.
        </p>
        <p className="text-xs text-warning-700">
          {assemblyLine.name} &middot; {assemblyLine.tasks.length} tareas &middot;{" "}
          {assemblyLine.stages.length} etapas
          {computation
            ? ` · calculo determinista en ${formatNumber(computation.ms, 1)} ms${
                computation.version > 0 ? ` (recalculo ${computation.version})` : ""
              }`
            : ""}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Demanda diaria"
          value={`${formatNumber(recommended.metrics.dailyDemandUnits)} u`}
          hint={`${formatNumber(recommended.metrics.availableSeconds / 3600, 2)} h disponibles por dia (${scenario.shiftCount} turno${scenario.shiftCount > 1 ? "s" : ""} de ${formatNumber(scenario.shiftMinutes)} min)`}
          icon={Package}
        />
        <KpiCard
          label="Takt time"
          value={formatSeconds(recommended.metrics.taktSeconds)}
          hint="Tiempo disponible diario / demanda diaria: el ritmo que la linea debe sostener."
          icon={Timer}
        />
        <KpiCard
          label="Tiempo de ciclo recomendado"
          value={formatSeconds(recommended.metrics.cycleSeconds)}
          hint={`Distribucion inicial: ${formatSeconds(initial.metrics.cycleSeconds)}`}
          icon={Repeat}
          tone={
            recommended.metrics.cycleSeconds > recommended.metrics.taktSeconds + 1e-9
              ? "danger"
              : "neutral"
          }
          comparison={{
            label: "Diferencia:",
            value: `${result.comparison.cycleDeltaSeconds > 0 ? "+" : ""}${formatSeconds(result.comparison.cycleDeltaSeconds)}`,
            tone: result.comparison.cycleDeltaSeconds < 0 ? "positive" : "neutral",
          }}
        />
        <KpiCard
          label="Capacidad diaria"
          value={`${formatNumber(recommended.metrics.dailyCapacityUnits)} u`}
          hint={`Brecha de capacidad: ${formatNumber(recommended.metrics.capacityGapUnits)} unidades frente a la demanda.`}
          icon={Gauge}
          tone={recommended.metrics.capacityGapUnits >= 0 ? "positive" : "danger"}
        />
        <KpiCard
          label="Estaciones"
          value={formatNumber(recommended.metrics.stationCount)}
          hint={`Minimo teorico: ${formatNumber(recommended.metrics.theoreticalMinStations)} estaciones. Distribucion inicial: ${formatNumber(initial.metrics.stationCount)}.`}
          icon={Users}
        />
        <KpiCard
          label="Eficiencia de linea"
          value={formatPercent(recommended.metrics.lineEfficiency)}
          hint={`Distribucion inicial: ${formatPercent(initial.metrics.lineEfficiency)}`}
          icon={Activity}
          tone={result.comparison.efficiencyDeltaPoints > 1e-9 ? "positive" : "neutral"}
          comparison={{
            label: "Diferencia:",
            value: `${result.comparison.efficiencyDeltaPoints > 0 ? "+" : ""}${formatNumber(result.comparison.efficiencyDeltaPoints, 1)} p.p.`,
            tone: result.comparison.efficiencyDeltaPoints > 1e-9 ? "positive" : "neutral",
          }}
        />
        <KpiCard
          label="Perdida por desbalance"
          value={formatPercent(recommended.metrics.balanceLoss)}
          hint={`${formatSeconds(recommended.metrics.idleSecondsPerCycle)} de tiempo ocioso por ciclo. Inicial: ${formatPercent(initial.metrics.balanceLoss)}.`}
          icon={TrendingDown}
          tone={recommended.metrics.balanceLoss > 0.2 ? "warning" : "neutral"}
        />
        <KpiCard
          label="Cuello de botella"
          value={bottleneck.label}
          hint={`${formatSeconds(bottleneck.loadSeconds)} de carga (${formatPercent(bottleneck.taktRatio, 0)} del takt) en ${bottleneck.tasks.map((task) => task.code).join(", ")}.`}
          icon={AlertTriangle}
          tone={
            bottleneck.loadSeconds > recommended.metrics.taktSeconds + 1e-9 ? "danger" : "neutral"
          }
        />
        <KpiCard
          label="Diferencia de costo estimada"
          value={formatSignedCurrency(result.comparison.costDelta)}
          hint={
            result.comparison.improves
              ? "Diferencia estimada dentro del caso simulado, a favor del balance recomendado."
              : result.comparison.costDelta < 0
                ? "El balance recomendado cuesta mas en este escenario: se informa como empeoramiento."
                : "Ambas distribuciones cuestan lo mismo en este escenario."
          }
          icon={Wallet}
          tone={costTone}
          comparison={{
            label: "Costo total inicial / recomendado:",
            value: `${formatCurrency(initial.cost.total)} / ${formatCurrency(recommended.cost.total)}`,
          }}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Escenario de la linea</CardTitle>
          <CardDescription>
            Cada control recalcula el takt time, la asignacion de tareas, los indicadores y el modelo
            economico. No hay valores prefijados: todo sale de las formulas del modulo.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-steel-500">
              Escenarios predefinidos
            </p>
            {BALANCE_PRESETS.map((preset) => {
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
            {presetId === CUSTOM_BALANCE_PRESET_ID ? (
              <p className="rounded-md bg-steel-50 px-3 py-2 text-xs text-steel-600">
                Escenario personalizado: los parametros no coinciden con ningun preset.
              </p>
            ) : null}
          </div>

          <div className="space-y-5 lg:col-span-2">
            <div className="grid gap-5 sm:grid-cols-2">
              <SliderField
                label="Demanda diaria"
                value={scenario.demandVariationPct}
                min={BALANCE_LIMITS.demandVariationPct.min}
                max={BALANCE_LIMITS.demandVariationPct.max}
                step={BALANCE_LIMITS.demandVariationPct.step}
                onChange={(value) => updateScenario({ demandVariationPct: value })}
                formatValue={(value) => `${value > 0 ? "+" : ""}${formatNumber(value)}%`}
                description={`Base ${formatNumber(assemblyLine.baseDailyDemandUnits)} u/dia. Escenario actual: ${formatNumber(recommended.metrics.dailyDemandUnits)} u/dia.`}
              />
              <SliderField
                label="Tiempo disponible por turno"
                value={scenario.shiftMinutes}
                min={BALANCE_LIMITS.shiftMinutes.min}
                max={BALANCE_LIMITS.shiftMinutes.max}
                step={BALANCE_LIMITS.shiftMinutes.step}
                onChange={(value) => updateScenario({ shiftMinutes: value })}
                formatValue={(value) => `${formatNumber(value)} min`}
                description="Minutos productivos del turno, ya descontadas paradas y refrigerio."
              />
              <SliderField
                label="Variacion de tiempos estandar"
                value={scenario.taskTimeVariationPct}
                min={BALANCE_LIMITS.taskTimeVariationPct.min}
                max={BALANCE_LIMITS.taskTimeVariationPct.max}
                step={BALANCE_LIMITS.taskTimeVariationPct.step}
                onChange={(value) => updateScenario({ taskTimeVariationPct: value })}
                formatValue={(value) => `${value > 0 ? "+" : ""}${formatNumber(value)}%`}
                description={`Contenido total de trabajo resultante: ${formatSeconds(recommended.metrics.totalWorkSeconds)}.`}
              />
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-steel-700">Cantidad de turnos</p>
                <ToggleGroup
                  ariaLabel="Cantidad de turnos por dia"
                  value={String(scenario.shiftCount)}
                  onChange={(value) => updateScenario({ shiftCount: Number(value) })}
                  options={SHIFT_COUNT_OPTIONS.map((count) => ({
                    value: String(count),
                    label: `${count} turno${count > 1 ? "s" : ""}`,
                  }))}
                />
                <p className="text-xs text-steel-500">
                  Tiempo disponible diario:{" "}
                  {formatNumber(recommended.metrics.availableSeconds / 3600, 2)} h (
                  {formatNumber(recommended.metrics.availableSeconds)} s).
                </p>
              </div>
            </div>

            <div className="border-t border-line pt-4">
              <SwitchField
                label="Habilitar una estacion adicional"
                description="La heuristica apunta a una estacion mas para acortar el tiempo de ciclo. Suma un operario al costo diario: puede mejorar la capacidad y empeorar el costo."
                checked={scenario.extraStation}
                onChange={(checked) => updateScenario({ extraStation: checked })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Distribucion inicial</CardTitle>
            <CardDescription>
              {initial.description} Cuello de botella en la estacion{" "}
              {initial.metrics.bottleneckStationIndex} con{" "}
              {formatSeconds(initial.metrics.cycleSeconds)}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StationLoadChart layout={initial} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Balance recomendado</CardTitle>
            <CardDescription>
              {recommended.description} Cuello de botella en la estacion{" "}
              {recommended.metrics.bottleneckStationIndex} con{" "}
              {formatSeconds(recommended.metrics.cycleSeconds)}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StationLoadChart layout={recommended} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Eficiencia y capacidad</CardTitle>
            <CardDescription>
              Capacidad diaria en unidades (eje izquierdo) y eficiencia de linea en porcentaje (eje
              derecho). La linea punteada marca la demanda del escenario.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EfficiencyCapacityChart comparison={result.comparison} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Composicion del costo simulado</CardTitle>
            <CardDescription>
              El costo de estaciones se abre en tiempo productivo y tiempo ocioso; encima se suman
              las unidades de demanda que la linea no llega a producir.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BalanceCostChart comparison={result.comparison} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Comparacion entre distribucion inicial y balance recomendado</CardTitle>
          <CardDescription>
            La columna de diferencia se calcula como balance recomendado menos distribucion inicial.
            En verde, la variacion favorable segun el indicador.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 py-0">
          <LayoutComparisonTable comparison={result.comparison} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          actions={
            <ToggleGroup
              ariaLabel="Distribucion a visualizar"
              value={boardView}
              onChange={(value) => setBoardView(value as "recomendado" | "inicial")}
              options={[
                { value: "recomendado", label: "Balance recomendado" },
                { value: "inicial", label: "Distribucion inicial" },
              ]}
            />
          }
        >
          <CardTitle>Estaciones del {board.label.toLowerCase()}</CardTitle>
          <CardDescription>
            Tareas asignadas a cada estacion, en el orden del proceso, con su carga acumulada, el
            porcentaje respecto del takt time y el tiempo ocioso.
          </CardDescription>
          <div className="mt-3">
            <StageLegend />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <StationBoard layout={board} />
          <ul className="space-y-2 border-t border-line pt-4">
            {board.notes.map((note) => (
              <li key={note} className="flex gap-2.5 text-sm leading-relaxed text-steel-700">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-navy-400" aria-hidden />
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detalle de tareas</CardTitle>
          <CardDescription>
            Las {assemblyLine.tasks.length} tareas del caso con su etapa, tiempo estandar,
            precedencias, peso posicional y la estacion que les asigna cada distribucion.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 py-0">
          <TaskAssignmentTable rows={result.taskRows} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lectura operativa</CardTitle>
          <CardDescription>
            Texto generado de forma determinista a partir de los numeros del escenario activo. No
            interviene ningun modelo de lenguaje ni servicio externo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2.5">
            {result.insights.map((insight) => (
              <li key={insight} className="flex gap-2.5 text-sm leading-relaxed text-steel-700">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-navy-400" aria-hidden />
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Note tone="info" title="Como leer este modulo">
        El costo del tiempo ocioso no se suma como un concepto aparte: es la porcion del costo de
        estaciones que se paga sin agregar valor, y se informa como indicador para no contar dos
        veces el mismo peso. El costo total estimado del dia suma unicamente las estaciones y las
        unidades de demanda no atendidas, con los supuestos de{" "}
        {formatCurrency(assemblyLine.stationCostPerHour)} por hora de estacion y{" "}
        {formatCurrency(assemblyLine.unmetUnitCost)} por unidad no atendida.
      </Note>
    </div>
  );
}
