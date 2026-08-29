"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { LineLoadChart } from "@/components/charts/operations-charts";
import { FamilyLegend, PlanGrid } from "@/components/plan/plan-grid";
import { PlanComparisonTable, PlanReasonsTable } from "@/components/plan/plan-tables";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup } from "@/components/ui/controls";
import { Note, PageHeader } from "@/components/ui/layout-bits";
import { dataset } from "@/lib/data/dataset";
import { formatCurrency, formatNumber } from "@/lib/format";
import { useScenario } from "@/state/scenario-context";

const LINE_LABELS: Record<string, string> = Object.fromEntries(
  dataset.lines.map((line) => [line.id, line.id]),
);

export default function PlanPage() {
  const { result, recalculate, computation } = useScenario();
  const [view, setView] = useState<"recommended" | "base">("recommended");

  const plan = view === "recommended" ? result.recommended : result.base;
  const evaluation =
    view === "recommended" ? result.comparison.recommended : result.comparison.base;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plan de produccion semanal"
        description="Programa por dia, linea y producto. Cada corrida indica unidades, minutos de produccion, cambios de formato y hora extra, junto con la regla que la genero."
        actions={
          <Button onClick={recalculate} variant="primary" size="sm">
            <RefreshCw className="h-4 w-4" aria-hidden />
            Recalcular escenario
          </Button>
        }
      />

      <Card>
        <CardHeader
          actions={
            <ToggleGroup
              ariaLabel="Plan a visualizar"
              value={view}
              onChange={(value) => setView(value as "recommended" | "base")}
              options={[
                { value: "recommended", label: "Plan recomendado" },
                { value: "base", label: "Plan base" },
              ]}
            />
          }
        >
          <CardTitle>{plan.label}</CardTitle>
          <CardDescription>{plan.description}</CardDescription>
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
            <FamilyLegend />
            <p className="text-xs text-steel-400">
              {computation
                ? `${formatNumber(plan.runs.length)} corridas programadas - calculo determinista en ${formatNumber(computation.ms, 1)} ms (${computation.version === 0 ? "calculo inicial" : `recalculo ${computation.version}`})`
                : `${formatNumber(plan.runs.length)} corridas programadas`}
            </p>
          </div>
        </CardHeader>
        <CardContent className="px-0 py-0 sm:px-0">
          <PlanGrid plan={plan} days={result.days} lines={dataset.lines} />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Uso de la capacidad por linea</CardTitle>
            <CardDescription>
              Reparto de los minutos disponibles de la semana entre produccion, cambios de formato y
              capacidad ociosa. La hora extra se apila por encima de la jornada normal.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LineLoadChart plan={plan} evaluation={evaluation} lineNames={LINE_LABELS} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Como se construyo este plan</CardTitle>
            <CardDescription>
              Reglas efectivamente aplicadas por el planificador seleccionado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2.5">
              {plan.notes.map((note) => (
                <li key={note} className="flex gap-2.5 text-sm leading-relaxed text-steel-700">
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-navy-400"
                    aria-hidden
                  />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 rounded-md bg-steel-50 px-3 py-2.5 text-xs leading-relaxed text-steel-600">
              Resultado del plan seleccionado: {formatNumber(evaluation.setupCount)} cambios de
              formato, {formatNumber(evaluation.overtimeHours, 1)} horas extra y un costo total de{" "}
              {formatCurrency(evaluation.costs.total)}.
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Comparacion entre plan base y plan recomendado</CardTitle>
          <CardDescription>
            La columna de diferencia se calcula como plan recomendado menos plan base. En verde, la
            variacion favorable segun el indicador.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 py-0">
          <PlanComparisonTable comparison={result.comparison} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detalle de decisiones del {plan.label.toLowerCase()}</CardTitle>
          <CardDescription>
            Trazabilidad completa: cada corrida programada con la regla que la justifica. Es la misma
            informacion que aparece al pasar el cursor sobre una corrida en la vista semanal.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 py-0">
          <div className="max-h-[560px] overflow-y-auto">
            <PlanReasonsTable plan={plan} days={result.days} />
          </div>
        </CardContent>
      </Card>

      <Note>
        El plan recomendado es una <strong>recomendacion heuristica</strong>, no un optimo matematico
        garantizado. La heuristica construye la solucion de forma golosa con compuertas economicas
        explicitas; un modelo de programacion entera podria encontrar planes mejores a costa de
        tiempo de calculo y de trazabilidad.
      </Note>
    </div>
  );
}
