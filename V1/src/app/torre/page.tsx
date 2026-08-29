"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  ClipboardCheck,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Timer,
  Trash2,
  Truck,
  Wallet,
} from "lucide-react";
import {
  CoverageByMaterialChart,
  ProjectedStockChart,
  PurchaseVsInactionChart,
  RiskByCategoryChart,
  RiskMatrixChart,
} from "@/components/charts/supply-charts";
import { DecisionLog } from "@/components/supply/decision-log";
import { RecommendationPanel } from "@/components/supply/recommendation-panel";
import { DECISION_STATUS_LABELS, RISK_LABELS, SupplyDisclaimer } from "@/components/supply/supply-bits";
import { MaterialsSupplyTable, OpenOrdersTable } from "@/components/supply/supply-tables";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SelectField, SliderField, ToggleGroup } from "@/components/ui/controls";
import { KpiCard, type KpiTone } from "@/components/ui/kpi-card";
import { Note, PageHeader } from "@/components/ui/layout-bits";
import { supplySuppliers } from "@/lib/data/supply-catalog";
import {
  MATERIAL_CATEGORY_LABELS,
  SUPPLY_HORIZON_OPTIONS,
  SUPPLY_REVIEW_PERIOD_DAYS,
} from "@/lib/data/supply-config";
import { formatCurrency, formatCurrencyCompact, formatNumber } from "@/lib/format";
import { ACTIONABLE_ACTIONS, SUPPLY_LIMITS, SUPPLY_PRESETS } from "@/lib/supply";
import type {
  DecisionStatus,
  MaterialCategory,
  SupplyRecommendation,
  SupplyRiskLevel,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { useSupplyDecisions } from "@/state/use-supply-decisions";
import { CUSTOM_SUPPLY_PRESET_ID, useSupplyScenario } from "@/state/use-supply-scenario";

const ALL = "todos";

const RISK_OPTIONS = [
  { value: ALL, label: "Todos los riesgos" },
  ...(Object.keys(RISK_LABELS) as SupplyRiskLevel[]).map((risk) => ({
    value: risk,
    label: RISK_LABELS[risk],
  })),
];

const CATEGORY_OPTIONS = [
  { value: ALL, label: "Todas las categorias" },
  ...(Object.keys(MATERIAL_CATEGORY_LABELS) as MaterialCategory[]).map((category) => ({
    value: category,
    label: MATERIAL_CATEGORY_LABELS[category],
  })),
];

const DECISION_OPTIONS = [
  { value: ALL, label: "Todas las decisiones" },
  ...(Object.keys(DECISION_STATUS_LABELS) as DecisionStatus[]).map((status) => ({
    value: status,
    label: DECISION_STATUS_LABELS[status],
  })),
];

const SUPPLIER_OPTIONS = [
  { value: ALL, label: "Todos los proveedores" },
  ...supplySuppliers.map((supplier) => ({ value: supplier.id, label: supplier.name })),
];

export default function SupplyTowerPage() {
  const { scenario, result, presetId, computation, updateScenario, applyPreset, recalculate, reset } =
    useSupplyScenario();
  const { hydrated, decisions, log, statusOf, pendingCount, decide, clearAll } =
    useSupplyDecisions();

  const [riskFilter, setRiskFilter] = useState<string>(ALL);
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL);
  const [supplierFilter, setSupplierFilter] = useState<string>(ALL);
  const [decisionFilter, setDecisionFilter] = useState<string>(ALL);

  const recommendationsById = useMemo<Record<string, SupplyRecommendation>>(
    () => Object.fromEntries(result.recommendations.map((item) => [item.materialId, item])),
    [result.recommendations],
  );

  const decisionStatuses = useMemo<Record<string, DecisionStatus>>(
    () => Object.fromEntries(result.rows.map((row) => [row.material.id, statusOf(row.material.id)])),
    [result.rows, statusOf],
  );

  const filteredRows = useMemo(
    () =>
      result.rows.filter((row) => {
        if (riskFilter !== ALL && row.risk !== riskFilter) return false;
        if (categoryFilter !== ALL && row.material.category !== categoryFilter) return false;
        if (supplierFilter !== ALL && row.supplier.id !== supplierFilter) return false;
        if (decisionFilter !== ALL && decisionStatuses[row.material.id] !== decisionFilter)
          return false;
        return true;
      }),
    [result.rows, riskFilter, categoryFilter, supplierFilter, decisionFilter, decisionStatuses],
  );

  const filteredRecommendations = useMemo(
    () =>
      result.recommendations.filter((item) =>
        filteredRows.some((row) => row.material.id === item.materialId),
      ),
    [result.recommendations, filteredRows],
  );

  const actionableIds = useMemo(
    () =>
      result.recommendations
        .filter((item) => ACTIONABLE_ACTIONS.includes(item.action))
        .map((item) => item.materialId),
    [result.recommendations],
  );

  const pendingApprovals = pendingCount(actionableIds);
  const filtersActive =
    riskFilter !== ALL || categoryFilter !== ALL || supplierFilter !== ALL || decisionFilter !== ALL;

  const clearFilters = () => {
    setRiskFilter(ALL);
    setCategoryFilter(ALL);
    setSupplierFilter(ALL);
    setDecisionFilter(ALL);
  };

  const criticalTone: KpiTone = result.kpis.criticalMaterials > 0 ? "danger" : "positive";
  const highTone: KpiTone = result.kpis.highRiskMaterials > 0 ? "warning" : "positive";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Torre de abastecimiento"
        description="Anticipacion de quiebres, cobertura y decisiones de compra."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="h-4 w-4" aria-hidden />
              Operacion estable
            </Button>
            <Button variant="primary" size="sm" onClick={recalculate}>
              <RefreshCw className="h-4 w-4" aria-hidden />
              Recalcular riesgos
            </Button>
          </>
        }
      />

      <SupplyDisclaimer
        detail={`${result.rows.length} materias primas · ${result.orders.length} ordenes abiertas · horizonte ${scenario.horizonDays} dias habiles (${result.startDate} a ${result.endDate})${
          computation
            ? ` · calculo determinista en ${formatNumber(computation.ms, 1)} ms${
                computation.version > 0 ? ` (recalculo ${computation.version})` : ""
              }`
            : ""
        }`}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <KpiCard
          label="Materiales criticos"
          value={`${result.kpis.criticalMaterials} de ${result.rows.length}`}
          icon={ShieldAlert}
          tone={criticalTone}
          hint="El stock se agota antes de la proxima entrega factible: comprar hoy ya no evita el quiebre."
        />
        <KpiCard
          label="Materiales con riesgo alto"
          value={`${result.kpis.highRiskMaterials} de ${result.rows.length}`}
          icon={AlertTriangle}
          tone={highTone}
          hint="Cobertura por debajo del lead time del proveedor o con una orden abierta retrasada."
        />
        <KpiCard
          label="Cobertura promedio"
          value={`${formatNumber(result.kpis.averageCoverageDays, 1)} d`}
          icon={Timer}
          hint={`Promedio simple de los materiales con consumo. ${result.kpis.materialsBelowReorderPoint} estan por debajo de su punto de pedido.`}
        />
        <KpiCard
          label="Valor de inventario"
          value={formatCurrencyCompact(result.kpis.inventoryValue)}
          icon={Boxes}
          hint="Stock disponible de materia prima valorizado al costo unitario simulado."
        />
        <KpiCard
          label="Costo estimado en riesgo"
          value={formatCurrencyCompact(result.kpis.costAtRisk)}
          icon={Wallet}
          tone={result.kpis.costAtRisk > 0 ? "danger" : "positive"}
          hint="Margen de contribucion expuesto por los materiales en riesgo alto o critico si no se toma ninguna accion."
        />
        <KpiCard
          label="Ordenes retrasadas"
          value={`${result.kpis.delayedOrders} de ${result.orders.length}`}
          icon={Truck}
          tone={result.kpis.delayedOrders > 0 ? "warning" : "positive"}
          hint="Ordenes abiertas cuya llegada estimada supera la fecha comprometida por el proveedor."
        />
        <KpiCard
          label="Pendientes de aprobacion"
          value={`${pendingApprovals} de ${result.kpis.actionableRecommendations}`}
          icon={ClipboardCheck}
          tone={pendingApprovals > 0 ? "warning" : "positive"}
          hint="Recomendaciones que piden una decision humana y todavia no fueron aprobadas, rechazadas ni marcadas para revision."
        />
        <KpiCard
          label="Costo de las compras sugeridas"
          value={formatCurrencyCompact(result.kpis.totalPurchaseCost)}
          icon={Wallet}
          hint={`Suma de las compras propuestas al precio de cada proveedor, con su cantidad minima ya aplicada.`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Escenario de abastecimiento</CardTitle>
          <CardDescription>
            Cada control recalcula el consumo, la cobertura, el punto de pedido, la clasificacion de
            riesgo, las recomendaciones, los KPI y los graficos. El escenario es propio de este
            modulo y no modifica el simulador del plan de produccion.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-steel-500">
              Escenarios predefinidos
            </p>
            {SUPPLY_PRESETS.map((preset) => {
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
            {presetId === CUSTOM_SUPPLY_PRESET_ID ? (
              <p className="rounded-md bg-steel-50 px-3 py-2 text-xs text-steel-600">
                Escenario personalizado: los parametros no coinciden con ningun preset.
              </p>
            ) : null}
          </div>

          <div className="space-y-5 lg:col-span-2">
            <div className="grid gap-5 sm:grid-cols-2">
              <SliderField
                label="Variacion de demanda"
                value={scenario.demandVariationPct}
                min={SUPPLY_LIMITS.demandVariationPct.min}
                max={SUPPLY_LIMITS.demandVariationPct.max}
                step={SUPPLY_LIMITS.demandVariationPct.step}
                onChange={(value) => updateScenario({ demandVariationPct: value })}
                formatValue={(value) => `${value > 0 ? "+" : ""}${formatNumber(value)}%`}
                description="Se aplica al pronostico base y arrastra el consumo de todas las materias primas via la lista de materiales."
              />
              <SliderField
                label="Retraso adicional de proveedores"
                value={scenario.supplierDelayDays}
                min={SUPPLY_LIMITS.supplierDelayDays.min}
                max={SUPPLY_LIMITS.supplierDelayDays.max}
                step={SUPPLY_LIMITS.supplierDelayDays.step}
                onChange={(value) => updateScenario({ supplierDelayDays: value })}
                formatValue={(value) => `${formatNumber(value)} d`}
                description="Suma dias habiles al lead time de todos los proveedores y a la llegada estimada de las ordenes abiertas."
              />
              <SliderField
                label="Variacion de confiabilidad"
                value={scenario.reliabilityVariationPoints}
                min={SUPPLY_LIMITS.reliabilityVariationPoints.min}
                max={SUPPLY_LIMITS.reliabilityVariationPoints.max}
                step={SUPPLY_LIMITS.reliabilityVariationPoints.step}
                onChange={(value) => updateScenario({ reliabilityVariationPoints: value })}
                formatValue={(value) => `${value > 0 ? "+" : ""}${formatNumber(value)} p.p.`}
                description="Mueve la confiabilidad de entrega de todos los proveedores; por debajo del 90% el material pasa a riesgo medio."
              />
              <SliderField
                label="Consumo adicional por scrap"
                value={scenario.scrapPct}
                min={SUPPLY_LIMITS.scrapPct.min}
                max={SUPPLY_LIMITS.scrapPct.max}
                step={SUPPLY_LIMITS.scrapPct.step}
                onChange={(value) => updateScenario({ scrapPct: value })}
                formatValue={(value) => `+${formatNumber(value)}%`}
                description="Mermas de proceso: aumentan el consumo de materia prima sin aumentar las unidades vendidas."
              />
            </div>

            <div className="flex flex-col gap-2 border-t border-line pt-4">
              <p className="text-sm font-medium text-steel-700">Horizonte de analisis</p>
              <ToggleGroup
                ariaLabel="Horizonte de analisis en dias habiles"
                value={String(scenario.horizonDays)}
                onChange={(value) => updateScenario({ horizonDays: Number(value) })}
                options={SUPPLY_HORIZON_OPTIONS.map((days) => ({
                  value: String(days),
                  label: `${days} dias`,
                }))}
              />
              <p className="text-xs text-steel-500">
                Del {result.startDate} al {result.endDate}. Todos los plazos del modulo se expresan
                en dias habiles de planta, igual que el horizonte del plan de produccion.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cobertura por material frente al lead time</CardTitle>
            <CardDescription>
              Dias de stock de cada material contra los dias que tarda su proveedor en reponer.
              Cuando la barra de cobertura queda por debajo de la de lead time, el material no llega
              a reponerse a tiempo. El color indica el nivel de riesgo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CoverageByMaterialChart rows={result.rows} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Matriz de riesgo: cobertura contra exposicion</CardTitle>
            <CardDescription>
              Cada punto es una materia prima. Hacia la izquierda hay menos dias de stock; hacia
              arriba, mas dinero en juego. El tamano del punto es el lead time del proveedor.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RiskMatrixChart rows={result.rows} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Materiales en riesgo por categoria</CardTitle>
            <CardDescription>
              Composicion de los materiales en riesgo alto o critico segun su categoria dentro de la
              lista de materiales.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RiskByCategoryChart rows={result.rows} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Evolucion del stock proyectado</CardTitle>
            <CardDescription>
              Los cuatro materiales mas comprometidos durante el horizonte, expresados en dias de
              cobertura para poder compararlos entre si. Cruzar la linea del cero es el quiebre.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProjectedStockChart rows={result.rows} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Costo de comprar contra costo de no actuar</CardTitle>
          <CardDescription>
            Para los materiales que proyectan faltante: cuanto cuesta la compra sugerida y cuanto
            margen de contribucion se pierde si la decision no se toma. Solo aparecen los materiales
            donde la inaccion tiene un costo estimado distinto de cero.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PurchaseVsInactionChart rows={result.rows} recommendations={result.recommendations} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          actions={
            filtersActive ? (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            ) : null
          }
        >
          <CardTitle>Materias primas</CardTitle>
          <CardDescription>
            Consumo derivado de la lista de materiales, cobertura, stock proyectado, riesgo y accion
            recomendada para cada material. Mostrando {filteredRows.length} de {result.rows.length}.
          </CardDescription>
        </CardHeader>
        <CardContent className="border-b border-line">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SelectField
              label="Riesgo"
              value={riskFilter}
              options={RISK_OPTIONS}
              onChange={setRiskFilter}
            />
            <SelectField
              label="Categoria"
              value={categoryFilter}
              options={CATEGORY_OPTIONS}
              onChange={setCategoryFilter}
            />
            <SelectField
              label="Proveedor"
              value={supplierFilter}
              options={SUPPLIER_OPTIONS}
              onChange={setSupplierFilter}
            />
            <SelectField
              label="Estado de decision"
              value={decisionFilter}
              options={DECISION_OPTIONS}
              onChange={setDecisionFilter}
            />
          </div>
        </CardContent>
        <CardContent className="px-0 py-0">
          <MaterialsSupplyTable
            rows={filteredRows}
            recommendations={recommendationsById}
            decisions={decisionStatuses}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ordenes de compra abiertas</CardTitle>
          <CardDescription>
            Ordenes ya emitidas del caso simulado. Solo las confirmadas y en transito que llegan
            dentro del horizonte se computan como abastecimiento firme en el stock proyectado.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 py-0">
          <OpenOrdersTable orders={result.orders} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recomendaciones y aprobacion humana</CardTitle>
          <CardDescription>
            Una accion principal por material, ordenada por gravedad: primero las criticas y altas.
            Cada tarjeta explica el porque con los numeros del escenario y espera una decision del
            planificador. Mostrando {filteredRecommendations.length} de{" "}
            {result.recommendations.length}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Note tone="info" title="Las decisiones se guardan localmente">
            Las decisiones se guardan localmente en este navegador para fines de demostracion. No se
            emite ninguna orden de compra real, no se contacta a ningun proveedor y no se envia
            informacion a ningun servicio externo.
            {hydrated ? null : " Cargando decisiones guardadas..."}
          </Note>
          <RecommendationPanel
            recommendations={filteredRecommendations}
            decisions={decisions}
            onDecide={decide}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          actions={
            log.length > 0 ? (
              <Button variant="outline" size="sm" onClick={clearAll}>
                <Trash2 className="h-4 w-4" aria-hidden />
                Borrar registro local
              </Button>
            ) : null
          }
        >
          <CardTitle>Registro de decisiones</CardTitle>
          <CardDescription>
            Trazabilidad de que se recomendo, quien decidio y con que impacto estimado. Se conserva
            en el navegador y sobrevive a recargas de la pagina.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 py-0">
          <DecisionLog entries={log} />
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
        La cobertura y el punto de pedido se calculan con el consumo diario del horizonte, que sale
        de la demanda proyectada multiplicada por la lista de materiales. Un stock proyectado
        negativo no es, por si solo, una emergencia: significa que hay que comprar durante el
        horizonte. El riesgo critico aparece cuando el material se agota antes de la primera entrega
        factible, es decir cuando emitir la compra hoy ya no llega a tiempo. La cantidad sugerida
        cubre el lead time mas el ciclo de revision de compras de {SUPPLY_REVIEW_PERIOD_DAYS} dias
        habiles y respeta la cantidad minima de cada proveedor, por eso puede superar al faltante
        estricto. Todos los costos son estimaciones del caso simulado, no cotizaciones reales:{" "}
        {formatCurrency(result.kpis.totalPurchaseCost)} de compras propuestas frente a{" "}
        {formatCurrency(result.kpis.costAtRisk)} de margen expuesto.
      </Note>
    </div>
  );
}
