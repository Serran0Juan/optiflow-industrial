"use client";

import {
  Activity,
  Clock4,
  Coins,
  Gauge,
  Repeat,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { CostBreakdownChart, CostComparisonChart } from "@/components/charts/cost-charts";
import { InventoryTrendChart, OeeByLineChart } from "@/components/charts/operations-charts";
import { AlertsTable } from "@/components/dashboard/alerts-table";
import { DecisionSummary } from "@/components/dashboard/decision-summary";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard, type KpiTone } from "@/components/ui/kpi-card";
import { Note, PageHeader } from "@/components/ui/layout-bits";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import { OEE_BENCHMARKS } from "@/lib/planning/oee";
import { useScenario } from "@/state/scenario-context";

export default function DashboardPage() {
  const { result } = useScenario();
  const { comparison, alerts, decisions, days, oee } = result;
  const { base, recommended } = comparison;

  const serviceTone: KpiTone =
    recommended.serviceLevel >= 0.99 ? "positive" : recommended.serviceLevel >= 0.95 ? "warning" : "danger";

  /* El OEE se compara contra las referencias habituales de la bibliografia:
     85% clase mundial, 60% tipico, 40% al comenzar un programa de mejora. */
  const oeeTone: KpiTone =
    oee.plant.oee >= OEE_BENCHMARKS.worldClass
      ? "positive"
      : oee.plant.oee >= OEE_BENCHMARKS.typical
        ? "warning"
        : "danger";
  const worstLine = oee.lines.find((line) => line.lineId === oee.worstLineId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard ejecutivo de operaciones"
        description={`Resultado del plan semanal para ${formatNumber(recommended.totalDemandUnits)} unidades de demanda proyectada sobre ${days.length} dias habiles, 3 lineas y 18 productos terminados. Todas las cifras estan expresadas en pesos argentinos simulados.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          label="Nivel de servicio"
          value={formatPercent(recommended.serviceLevel)}
          icon={Gauge}
          tone={serviceTone}
          hint={`${formatNumber(recommended.unmetUnits)} unidades no atendidas sobre la demanda del horizonte.`}
          comparison={{ label: "Plan base:", value: formatPercent(base.serviceLevel) }}
        />
        <KpiCard
          label="Costo total del plan recomendado"
          value={formatCurrencyCompact(recommended.costs.total)}
          icon={Coins}
          hint="Suma de setups, horas extra, mantenimiento de inventario y faltantes."
          comparison={{ label: "Plan base:", value: formatCurrencyCompact(base.costs.total) }}
        />
        <KpiCard
          label={comparison.improves ? "Costo evitado vs plan base" : "Empeoramiento vs plan base"}
          value={formatCurrencyCompact(comparison.costDelta)}
          icon={comparison.improves ? TrendingDown : TrendingUp}
          tone={comparison.improves ? "positive" : "danger"}
          hint={`Costo total del plan base menos costo total del plan recomendado (${formatNumber(comparison.costDeltaPct, 1)}%).`}
          comparison={{
            label: "Diferencia de nivel de servicio:",
            value: `${comparison.serviceLevelDelta >= 0 ? "+" : ""}${formatNumber(comparison.serviceLevelDelta * 100, 2)} p.p.`,
            tone: comparison.serviceLevelDelta >= 0 ? "positive" : "danger",
          }}
        />
        <KpiCard
          label="Cambios de formato"
          value={`${formatNumber(recommended.setupCount)}`}
          icon={Repeat}
          hint={`${formatNumber(recommended.setupHours, 1)} horas de linea detenida por cambios de familia.`}
          comparison={{
            label: "Plan base:",
            value: `${formatNumber(base.setupCount)} (${formatNumber(base.setupHours, 1)} h)`,
          }}
        />
        <KpiCard
          label="Horas extra"
          value={`${formatNumber(recommended.overtimeHours, 1)} h`}
          icon={Clock4}
          tone={recommended.overtimeHours > 0 ? "warning" : "positive"}
          hint={`Costo asociado: ${formatCurrency(recommended.costs.overtime)}.`}
          comparison={{
            label: "Plan base:",
            value: `${formatNumber(base.overtimeHours, 1)} h`,
          }}
        />
        <KpiCard
          label="Utilizacion de capacidad"
          value={formatPercent(recommended.utilization, 0)}
          icon={Activity}
          hint="Minutos de produccion y setup sobre la capacidad de jornada normal disponible."
          comparison={{ label: "Plan base:", value: formatPercent(base.utilization, 0) }}
        />
        <KpiCard
          label="OEE de planta"
          value={formatPercent(oee.plant.oee, 1)}
          icon={Zap}
          tone={oeeTone}
          hint={`Disponibilidad ${formatPercent(oee.plant.availability, 1)} x desempeno ${formatPercent(oee.plant.performance, 1)} x calidad ${formatPercent(oee.plant.quality, 1)}. Referencia de clase mundial: ${formatPercent(OEE_BENCHMARKS.worldClass, 0)}.`}
          comparison={
            worstLine
              ? {
                  label: `Linea mas baja (${worstLine.lineId}):`,
                  value: formatPercent(worstLine.oee, 1),
                  tone: "warning",
                }
              : undefined
          }
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Costo total: plan base vs plan recomendado</CardTitle>
            <CardDescription>
              Diferencia de {formatCurrency(Math.abs(comparison.costDelta))}{" "}
              {comparison.improves ? "a favor del plan recomendado" : "en contra del plan recomendado"}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CostComparisonChart
              baseCost={base.costs.total}
              recommendedCost={recommended.costs.total}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Composicion del costo</CardTitle>
            <CardDescription>
              Los cuatro componentes del modelo economico. La comparacion muestra donde se gana y
              donde se cede: el plan recomendado suele aceptar mas inventario para evitar setups,
              horas extra y faltantes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CostBreakdownChart base={base.costs} recommended={recommended.costs} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>OEE por linea: donde se pierde la capacidad efectiva</CardTitle>
          <CardDescription>
            Cada barra suma 100 puntos: el OEE alcanzado mas las tres perdidas que lo separan del
            maximo teorico. La disponibilidad descuenta paradas y cambios de formato, el desempeno
            mide el tiempo habilitado sin trabajo programado, y la calidad usa el rendimiento de
            primera pasada declarado para cada linea. El plan de produccion no modela scrap: el
            componente de calidad es un parametro del caso, no un resultado del plan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OeeByLineChart oee={oee} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Inventario proyectado de producto terminado</CardTitle>
          <CardDescription>
            Stock total al cierre de cada dia habil del horizonte, sumando los 18 productos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InventoryTrendChart days={days} base={base} recommended={recommended} />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <AlertsTable alerts={alerts} />
        </div>
        <DecisionSummary decisions={decisions} />
      </div>

      <Note tone="warning" title="Lectura de los resultados">
        Los datos son sinteticos y el plan base es deliberadamente simple, por lo que la brecha entre
        ambos planes es mayor a la que se observaria en una planta que ya aplica agrupamiento parcial
        por familia. El objetivo del caso es mostrar el metodo de calculo y la trazabilidad de cada
        decision, no prometer un ahorro replicable.
      </Note>
    </div>
  );
}
