"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { MATERIAL_CATEGORY_LABELS } from "@/lib/data/supply-config";
import { formatCurrency, formatCurrencyCompact, formatNumber } from "@/lib/format";
import { NO_CONSUMPTION_COVERAGE } from "@/lib/supply/metrics";
import type {
  MaterialSupplyRow,
  ServiceLevelTradeoffPoint,
  SupplyRecommendation,
  SupplyRiskLevel,
} from "@/lib/types";
import {
  ABC_CHART_COLORS,
  AXIS_PROPS,
  CHART_COLORS,
  ChartFrame,
  ChartLegend,
  RISK_CHART_COLORS,
  TOOLTIP_ITEM_STYLE,
  TOOLTIP_LABEL_STYLE,
  TOOLTIP_STYLE,
} from "./chart-kit";

const RISK_LEGEND = [
  { label: "Critico", color: RISK_CHART_COLORS.critico },
  { label: "Alto", color: RISK_CHART_COLORS.alto },
  { label: "Medio", color: RISK_CHART_COLORS.medio },
  { label: "Bajo", color: RISK_CHART_COLORS.bajo },
];

/** Cobertura acotada para graficar: los materiales sin consumo no se dibujan. */
function chartCoverage(row: MaterialSupplyRow): number {
  return row.coverageDays === NO_CONSUMPTION_COVERAGE ? 0 : row.coverageDays;
}

/**
 * 1. Cobertura por material contra el lead time de su proveedor.
 * Cada material muestra dos barras: los dias de stock que tiene y los dias que
 * tarda el proveedor en reponer. Cuando la barra de cobertura es mas corta que
 * la de lead time, el material no llega a reponerse a tiempo.
 */
export function CoverageByMaterialChart({ rows }: { rows: MaterialSupplyRow[] }) {
  const data = rows
    .filter((row) => row.coverageDays !== NO_CONSUMPTION_COVERAGE)
    .map((row) => ({
      material: row.material.code,
      Cobertura: Number(chartCoverage(row).toFixed(1)),
      "Lead time": row.effectiveLeadTimeDays,
      color: RISK_CHART_COLORS[row.risk],
      name: row.material.name,
    }));

  const averageLeadTime =
    data.reduce((acc, item) => acc + item["Lead time"], 0) / Math.max(1, data.length);

  return (
    <>
      <ChartFrame height={Math.max(260, 30 * data.length + 60)}>
        <ResponsiveContainer>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 16, right: 24, bottom: 4, left: 4 }}
            barCategoryGap="18%"
          >
            <CartesianGrid stroke={CHART_COLORS.grid} horizontal={false} />
            <XAxis
              type="number"
              {...AXIS_PROPS}
              axisLine={{ stroke: CHART_COLORS.grid }}
              tickFormatter={(value: number) => `${formatNumber(value)}d`}
            />
            <YAxis type="category" dataKey="material" {...AXIS_PROPS} axisLine={false} width={58} />
            <Tooltip
              cursor={{ fill: "#f1f5f9" }}
              contentStyle={TOOLTIP_STYLE}
              labelStyle={TOOLTIP_LABEL_STYLE}
              itemStyle={TOOLTIP_ITEM_STYLE}
              formatter={(value: number | string) => `${formatNumber(Number(value), 1)} dias`}
            />
            <ReferenceLine
              x={averageLeadTime}
              stroke={CHART_COLORS.takt}
              strokeDasharray="4 3"
              label={{
                value: `lead time promedio ${formatNumber(averageLeadTime, 1)} d`,
                position: "top",
                fill: CHART_COLORS.takt,
                fontSize: 11,
              }}
            />
            <Bar dataKey="Cobertura" maxBarSize={11} radius={[0, 3, 3, 0]}>
              {data.map((entry) => (
                <Cell key={entry.material} fill={entry.color} />
              ))}
            </Bar>
            <Bar
              dataKey="Lead time"
              fill={CHART_COLORS.leadTime}
              maxBarSize={11}
              radius={[0, 3, 3, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>
      <ChartLegend
        items={[...RISK_LEGEND, { label: "Lead time del proveedor", color: CHART_COLORS.leadTime }]}
      />
    </>
  );
}

/**
 * 2. Matriz de riesgo: cobertura contra exposicion economica.
 * El eje horizontal es la cobertura en dias y el vertical el valor del consumo
 * del horizonte. El cuadrante peligroso es el de arriba a la izquierda: mucho
 * dinero en juego con poco stock para sostenerlo.
 */
export function RiskMatrixChart({ rows }: { rows: MaterialSupplyRow[] }) {
  const byRisk: Record<SupplyRiskLevel, Array<Record<string, number | string>>> = {
    critico: [],
    alto: [],
    medio: [],
    bajo: [],
  };

  for (const row of rows) {
    if (row.coverageDays === NO_CONSUMPTION_COVERAGE) continue;
    byRisk[row.risk].push({
      x: Number(row.coverageDays.toFixed(1)),
      y: Math.round(row.projectedConsumption * row.material.unitCost),
      z: row.effectiveLeadTimeDays,
      code: row.material.code,
      name: row.material.name,
    });
  }

  const averageLeadTime =
    rows.reduce((acc, row) => acc + row.effectiveLeadTimeDays, 0) / Math.max(1, rows.length);

  return (
    <>
      <ChartFrame height={320}>
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 16, right: 24, bottom: 12, left: 8 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} />
            <XAxis
              type="number"
              dataKey="x"
              name="Cobertura"
              {...AXIS_PROPS}
              axisLine={{ stroke: CHART_COLORS.grid }}
              tickFormatter={(value: number) => `${formatNumber(value)}d`}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Consumo valorizado"
              {...AXIS_PROPS}
              axisLine={false}
              width={72}
              tickFormatter={(value: number) => formatCurrencyCompact(value)}
            />
            <ZAxis type="number" dataKey="z" range={[60, 260]} name="Lead time" />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              contentStyle={TOOLTIP_STYLE}
              labelStyle={TOOLTIP_LABEL_STYLE}
              itemStyle={TOOLTIP_ITEM_STYLE}
              formatter={(value: number | string, name: string) => {
                if (name === "Consumo valorizado") return formatCurrency(Number(value));
                return `${formatNumber(Number(value), 1)} dias`;
              }}
              labelFormatter={() => ""}
            />
            <ReferenceLine
              x={averageLeadTime}
              stroke={CHART_COLORS.takt}
              strokeDasharray="4 3"
              label={{
                value: `lead time promedio ${formatNumber(averageLeadTime, 1)} d`,
                position: "insideTopRight",
                fill: CHART_COLORS.takt,
                fontSize: 11,
              }}
            />
            {(Object.keys(byRisk) as SupplyRiskLevel[]).map((risk) => (
              <Scatter
                key={risk}
                name={risk}
                data={byRisk[risk]}
                fill={RISK_CHART_COLORS[risk]}
                fillOpacity={0.85}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </ChartFrame>
      <ChartLegend
        items={[
          ...RISK_LEGEND,
          { label: "Tamano del punto: lead time del proveedor", color: CHART_COLORS.grid },
        ]}
      />
    </>
  );
}

/**
 * 3. Composicion de los materiales en riesgo alto o critico por categoria.
 * Muestra donde se concentra el problema: en el producto base, en los envases,
 * en los cierres o en el embalaje.
 */
export function RiskByCategoryChart({ rows }: { rows: MaterialSupplyRow[] }) {
  const atRisk = rows.filter((row) => row.risk === "critico" || row.risk === "alto");

  const counts = new Map<string, { count: number; value: number }>();
  for (const row of atRisk) {
    const label = MATERIAL_CATEGORY_LABELS[row.material.category];
    const current = counts.get(label) ?? { count: 0, value: 0 };
    counts.set(label, {
      count: current.count + 1,
      value: current.value + Math.round(row.projectedConsumption * row.material.unitCost),
    });
  }

  const palette = ["#234269", "#2f5583", "#4d74a1", "#7d9bbe", "#adc1d8", "#d6e0ec"];
  const data = [...counts.entries()]
    .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
    .map((entry, index) => ({
      name: entry[0],
      value: entry[1].count,
      amount: entry[1].value,
      color: palette[index % palette.length],
    }));

  if (data.length === 0) {
    return (
      <p className="rounded-md bg-positive-50 px-4 py-6 text-center text-sm text-positive-800">
        Ningun material queda en riesgo alto o critico en este escenario.
      </p>
    );
  }

  return (
    <>
      <ChartFrame height={280}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="52%"
              outerRadius="80%"
              paddingAngle={2}
              stroke="#ffffff"
              strokeWidth={2}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelStyle={TOOLTIP_LABEL_STYLE}
              itemStyle={TOOLTIP_ITEM_STYLE}
              formatter={(value: number | string, _name: string, item: { payload?: unknown }) => {
                const payload = item.payload as { amount?: number } | undefined;
                return `${formatNumber(Number(value))} material(es) - ${formatCurrency(payload?.amount ?? 0)} de consumo`;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </ChartFrame>
      <ChartLegend items={data.map((entry) => ({ label: entry.name, color: entry.color }))} />
    </>
  );
}

/**
 * 4. Evolucion del stock proyectado de los materiales mas comprometidos.
 * Se expresa en dias de cobertura para poder comparar materiales medidos en
 * litros, kilos y unidades en un mismo grafico. Cruzar el cero es el quiebre.
 */
export function ProjectedStockChart({ rows }: { rows: MaterialSupplyRow[] }) {
  const tracked = rows
    .filter((row) => row.coverageDays !== NO_CONSUMPTION_COVERAGE)
    .slice(0, 4);

  if (tracked.length === 0) {
    return (
      <p className="rounded-md bg-steel-50 px-4 py-6 text-center text-sm text-steel-600">
        No hay materiales con consumo proyectado en este escenario.
      </p>
    );
  }

  const first = tracked[0];
  const data = first.projection.map((point, index) => {
    const entry: Record<string, number | string> = { dia: point.label };
    for (const row of tracked) {
      entry[row.material.code] = row.projection[index].coverageDays;
    }
    return entry;
  });

  const palette = [
    CHART_COLORS.riskCritical,
    CHART_COLORS.riskHigh,
    CHART_COLORS.coverage,
    CHART_COLORS.riskLow,
  ];

  return (
    <ChartFrame height={300}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 12, right: 16, bottom: 0, left: 4 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis dataKey="dia" {...AXIS_PROPS} axisLine={{ stroke: CHART_COLORS.grid }} interval="preserveStartEnd" minTickGap={16} />
          <YAxis
            {...AXIS_PROPS}
            axisLine={false}
            width={56}
            tickFormatter={(value: number) => `${formatNumber(value)}d`}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
            itemStyle={TOOLTIP_ITEM_STYLE}
            formatter={(value: number | string) => `${formatNumber(Number(value), 1)} dias de cobertura`}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="line" iconSize={12} />
          <ReferenceLine y={0} stroke={CHART_COLORS.riskCritical} strokeDasharray="4 3" />
          {tracked.map((row, index) => (
            <Line
              key={row.material.code}
              type="monotone"
              dataKey={row.material.code}
              stroke={palette[index % palette.length]}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/**
 * 5. Costo de comprar contra costo estimado de no actuar.
 * Solo se grafican los materiales donde la inaccion tiene un costo estimado
 * distinto de cero: en el resto la comparacion no aporta informacion.
 */
export function PurchaseVsInactionChart({
  rows,
  recommendations,
}: {
  rows: MaterialSupplyRow[];
  recommendations: SupplyRecommendation[];
}) {
  const costByMaterial = new Map(
    recommendations.map((item) => [item.materialId, item.estimatedCost]),
  );

  const data = rows
    .filter((row) => row.inactionCost > 0)
    .sort((a, b) => b.inactionCost - a.inactionCost)
    .slice(0, 8)
    .map((row) => ({
      material: row.material.code,
      "Costo de comprar": costByMaterial.get(row.material.id) ?? row.purchaseCost,
      "Costo de no actuar": row.inactionCost,
    }));

  if (data.length === 0) {
    return (
      <p className="rounded-md bg-positive-50 px-4 py-6 text-center text-sm text-positive-800">
        Ningun material proyecta faltante en este escenario, por lo que no hay costo de inaccion que
        comparar.
      </p>
    );
  }

  return (
    <ChartFrame height={300}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: 8 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis dataKey="material" {...AXIS_PROPS} axisLine={{ stroke: CHART_COLORS.grid }} />
          <YAxis
            {...AXIS_PROPS}
            axisLine={false}
            width={72}
            tickFormatter={(value: number) => formatCurrencyCompact(value)}
          />
          <Tooltip
            cursor={{ fill: "#f1f5f9" }}
            contentStyle={TOOLTIP_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
            itemStyle={TOOLTIP_ITEM_STYLE}
            formatter={(value: number | string) => formatCurrency(Number(value))}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="square" iconSize={10} />
          <Bar
            dataKey="Costo de comprar"
            fill={CHART_COLORS.purchase}
            radius={[4, 4, 0, 0]}
            maxBarSize={38}
          />
          <Bar
            dataKey="Costo de no actuar"
            fill={CHART_COLORS.inaction}
            radius={[4, 4, 0, 0]}
            maxBarSize={38}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/**
 * 6. Curva de Pareto del analisis ABC.
 * Barras: consumo valorizado de cada material, de mayor a menor. Linea: el
 * porcentaje acumulado. Los cortes en 80% y 95% separan las clases A, B y C.
 */
export function AbcParetoChart({ rows }: { rows: MaterialSupplyRow[] }) {
  const data = [...rows]
    .sort((a, b) => a.abc.rank - b.abc.rank)
    .map((row) => ({
      material: row.material.code,
      "Consumo valorizado": Math.round(row.abc.dailyValue),
      Acumulado: Number((row.abc.cumulativeShare * 100).toFixed(1)),
      abcClass: row.abc.abcClass,
    }));

  return (
    <>
      <ChartFrame height={320}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 16, right: 12, bottom: 0, left: 8 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
            <XAxis dataKey="material" {...AXIS_PROPS} axisLine={{ stroke: CHART_COLORS.grid }} />
            <YAxis
              yAxisId="valor"
              {...AXIS_PROPS}
              axisLine={false}
              width={72}
              tickFormatter={(value: number) => formatCurrencyCompact(value)}
            />
            <YAxis
              yAxisId="pct"
              orientation="right"
              domain={[0, 100]}
              {...AXIS_PROPS}
              axisLine={false}
              width={48}
              tickFormatter={(value: number) => `${formatNumber(value)}%`}
            />
            <Tooltip
              cursor={{ fill: "#f1f5f9" }}
              contentStyle={TOOLTIP_STYLE}
              labelStyle={TOOLTIP_LABEL_STYLE}
              itemStyle={TOOLTIP_ITEM_STYLE}
              formatter={(value: number | string, name: string) =>
                name === "Acumulado"
                  ? `${formatNumber(Number(value), 1)}%`
                  : `${formatCurrency(Number(value))} por dia`
              }
            />
            <ReferenceLine
              yAxisId="pct"
              y={80}
              stroke={CHART_COLORS.takt}
              strokeDasharray="4 3"
              label={{ value: "80% (corte A)", position: "insideTopLeft", fill: CHART_COLORS.takt, fontSize: 11 }}
            />
            <ReferenceLine
              yAxisId="pct"
              y={95}
              stroke={CHART_COLORS.leadTime}
              strokeDasharray="2 3"
              label={{ value: "95% (corte B)", position: "insideBottomLeft", fill: CHART_COLORS.leadTime, fontSize: 11 }}
            />
            <Bar yAxisId="valor" dataKey="Consumo valorizado" maxBarSize={30} radius={[3, 3, 0, 0]}>
              {data.map((entry) => (
                <Cell key={entry.material} fill={ABC_CHART_COLORS[entry.abcClass]} />
              ))}
            </Bar>
            <Line
              yAxisId="pct"
              type="monotone"
              dataKey="Acumulado"
              stroke={CHART_COLORS.takt}
              strokeWidth={2}
              dot={{ r: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartFrame>
      <ChartLegend
        items={[
          { label: "Clase A", color: ABC_CHART_COLORS.A },
          { label: "Clase B", color: ABC_CHART_COLORS.B },
          { label: "Clase C", color: ABC_CHART_COLORS.C },
          { label: "Consumo valorizado acumulado", color: CHART_COLORS.takt },
        ]}
      />
    </>
  );
}

/**
 * 7. Nivel de servicio contra capital inmovilizado en stock de seguridad.
 * Muestra el precio de cada escalon de servicio: el stock de seguridad crece de
 * forma lineal con Z, mientras que la probabilidad de no quebrar crece cada vez
 * menos. Es el argumento para no pedir 99,87% en todos los materiales.
 */
export function ServiceLevelTradeoffChart({
  points,
}: {
  points: ServiceLevelTradeoffPoint[];
}) {
  const data = points.map((point) => ({
    nivel: `${formatNumber(point.probability * 100, 2)}%`,
    "Stock de seguridad": Math.round(point.safetyStockValue),
    activo: point.isActiveForClassA,
    z: point.z,
  }));

  const active = data.find((item) => item.activo);

  return (
    <>
      <ChartFrame height={300}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 16, right: 12, bottom: 0, left: 8 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
            <XAxis dataKey="nivel" {...AXIS_PROPS} axisLine={{ stroke: CHART_COLORS.grid }} />
            <YAxis
              {...AXIS_PROPS}
              axisLine={false}
              width={72}
              tickFormatter={(value: number) => formatCurrencyCompact(value)}
            />
            <Tooltip
              cursor={{ fill: "#f1f5f9" }}
              contentStyle={TOOLTIP_STYLE}
              labelStyle={TOOLTIP_LABEL_STYLE}
              itemStyle={TOOLTIP_ITEM_STYLE}
              formatter={(value: number | string, _name: string, item: { payload?: unknown }) => {
                const payload = item.payload as { z?: number } | undefined;
                return `${formatCurrency(Number(value))} (Z = ${formatNumber(payload?.z ?? 0, 2)})`;
              }}
            />
            {active ? (
              <ReferenceLine
                x={active.nivel}
                stroke={CHART_COLORS.riskLow}
                strokeDasharray="4 3"
                label={{
                  value: "politica activa (clase A)",
                  position: "top",
                  fill: CHART_COLORS.riskLow,
                  fontSize: 11,
                }}
              />
            ) : null}
            <Bar dataKey="Stock de seguridad" maxBarSize={54} radius={[4, 4, 0, 0]}>
              {data.map((entry) => (
                <Cell
                  key={entry.nivel}
                  fill={entry.activo ? CHART_COLORS.riskLow : CHART_COLORS.safety}
                />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </ChartFrame>
      <ChartLegend
        items={[
          { label: "Capital inmovilizado por nivel de servicio", color: CHART_COLORS.safety },
          { label: "Nivel exigido hoy a la clase A", color: CHART_COLORS.riskLow },
        ]}
      />
    </>
  );
}

/**
 * 8. Origen del stock de seguridad por material.
 * Separa que parte del colchon existe por la variabilidad del consumo y que
 * parte por la del plazo de entrega. Cambia la accion: la primera se ataca con
 * pronostico, la segunda negociando con el proveedor.
 */
export function SafetyStockDriverChart({ rows }: { rows: MaterialSupplyRow[] }) {
  const data = [...rows]
    .filter((row) => row.safetyStockUnits > 0)
    .map((row) => ({
      material: row.material.code,
      value: row.safetyStockUnits * row.material.unitCost,
      demand: row.sigmaDemandShare,
      lead: row.sigmaLeadTimeShare,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)
    .map((item) => ({
      material: item.material,
      "Por variabilidad del consumo": Math.round(item.value * item.demand),
      "Por variabilidad del plazo": Math.round(item.value * item.lead),
    }));

  if (data.length === 0) {
    return (
      <p className="rounded-md bg-steel-50 px-4 py-6 text-center text-sm text-steel-600">
        No hay stock de seguridad exigido en este escenario.
      </p>
    );
  }

  return (
    <ChartFrame height={Math.max(260, 32 * data.length + 60)}>
      <ResponsiveContainer>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 20, bottom: 4, left: 4 }}
          barCategoryGap="22%"
        >
          <CartesianGrid stroke={CHART_COLORS.grid} horizontal={false} />
          <XAxis
            type="number"
            {...AXIS_PROPS}
            axisLine={{ stroke: CHART_COLORS.grid }}
            tickFormatter={(value: number) => formatCurrencyCompact(value)}
          />
          <YAxis type="category" dataKey="material" {...AXIS_PROPS} axisLine={false} width={58} />
          <Tooltip
            cursor={{ fill: "#f1f5f9" }}
            contentStyle={TOOLTIP_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
            itemStyle={TOOLTIP_ITEM_STYLE}
            formatter={(value: number | string) => formatCurrency(Number(value))}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="square" iconSize={10} />
          <Bar
            dataKey="Por variabilidad del consumo"
            stackId="ss"
            fill={CHART_COLORS.coverage}
            maxBarSize={20}
          />
          <Bar
            dataKey="Por variabilidad del plazo"
            stackId="ss"
            fill={CHART_COLORS.riskHigh}
            radius={[0, 3, 3, 0]}
            maxBarSize={20}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
