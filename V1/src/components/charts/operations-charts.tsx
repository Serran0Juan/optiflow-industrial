"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMinutes, formatNumber } from "@/lib/format";
import { OEE_BENCHMARKS } from "@/lib/planning/oee";
import type { OeeResult, PlanEvaluation, PlanningDay, ProductionPlan } from "@/lib/types";
import {
  AXIS_PROPS,
  CHART_COLORS,
  ChartFrame,
  ChartLegend,
  TOOLTIP_ITEM_STYLE,
  TOOLTIP_LABEL_STYLE,
  TOOLTIP_STYLE,
} from "./chart-kit";

/** Inventario total de producto terminado proyectado durante la semana. */
export function InventoryTrendChart({
  days,
  base,
  recommended,
}: {
  days: PlanningDay[];
  base: PlanEvaluation;
  recommended: PlanEvaluation;
}) {
  const data = days.map((day) => ({
    dia: day.label,
    "Plan base": Math.round(base.days[day.index].closingInventoryUnits),
    "Plan recomendado": Math.round(recommended.days[day.index].closingInventoryUnits),
  }));

  return (
    <ChartFrame height={280}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis dataKey="dia" {...AXIS_PROPS} axisLine={{ stroke: CHART_COLORS.grid }} />
          <YAxis
            {...AXIS_PROPS}
            axisLine={false}
            width={72}
            tickFormatter={(value: number) => `${formatNumber(value / 1000, 0)}k`}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
            itemStyle={TOOLTIP_ITEM_STYLE}
            formatter={(value: number | string) => `${formatNumber(Number(value))} u`}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="plainline" iconSize={16} />
          <Line
            type="monotone"
            dataKey="Plan base"
            stroke={CHART_COLORS.base}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="Plan recomendado"
            stroke={CHART_COLORS.recommended}
            strokeWidth={2.5}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/** Uso de la capacidad semanal por linea: produccion, setups, ociosa y hora extra. */
export function LineLoadChart({
  plan,
  evaluation,
  lineNames,
}: {
  plan: ProductionPlan;
  evaluation: PlanEvaluation;
  lineNames: Record<string, string>;
}) {
  const data = evaluation.lines.map((line) => {
    const runMinutes = Math.round(line.runMinutes);
    const setupMinutes = Math.round(line.setupMinutes);
    const capacity = line.regularCapacityMinutes;
    const idle = Math.max(0, capacity - runMinutes - setupMinutes);
    return {
      linea: lineNames[line.lineId] ?? line.lineId,
      Produccion: runMinutes,
      Setups: setupMinutes,
      Ociosa: idle,
      "Hora extra": Math.round(line.overtimeMinutes),
    };
  });

  return (
    <ChartFrame height={260}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} key={plan.id}>
          <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis dataKey="linea" {...AXIS_PROPS} axisLine={{ stroke: CHART_COLORS.grid }} />
          <YAxis
            {...AXIS_PROPS}
            axisLine={false}
            width={64}
            tickFormatter={(value: number) => `${formatNumber(value / 60, 0)} h`}
          />
          <Tooltip
            cursor={{ fill: "#f1f5f9" }}
            contentStyle={TOOLTIP_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
            itemStyle={TOOLTIP_ITEM_STYLE}
            formatter={(value: number | string) => formatMinutes(Number(value))}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="square" iconSize={10} />
          <Bar dataKey="Produccion" stackId="cap" fill={CHART_COLORS.recommended} maxBarSize={90} />
          <Bar dataKey="Setups" stackId="cap" fill={CHART_COLORS.setup} maxBarSize={90} />
          <Bar dataKey="Ociosa" stackId="cap" fill={CHART_COLORS.idle} maxBarSize={90} />
          <Bar
            dataKey="Hora extra"
            stackId="cap"
            fill={CHART_COLORS.overtime}
            radius={[4, 4, 0, 0]}
            maxBarSize={90}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/**
 * OEE por linea, abierto en sus tres componentes.
 *
 * Barras apiladas que suman 100 puntos: el OEE alcanzado mas las tres perdidas
 * que lo separan del 100%. Leerlo asi evita la trampa habitual del indicador,
 * que es mirar un OEE bajo sin saber cual de los tres factores lo hunde.
 */
export function OeeByLineChart({ oee }: { oee: OeeResult }) {
  const data = oee.lines.map((line) => ({
    linea: line.lineId,
    nombre: line.lineName,
    OEE: Number((line.oee * 100).toFixed(1)),
    "Perdida por disponibilidad": Number(line.availabilityLossPoints.toFixed(1)),
    "Perdida por desempeno": Number(line.performanceLossPoints.toFixed(1)),
    "Perdida por calidad": Number(line.qualityLossPoints.toFixed(1)),
  }));

  return (
    <>
      <ChartFrame height={300}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 20, right: 12, bottom: 0, left: 8 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
            <XAxis dataKey="linea" {...AXIS_PROPS} axisLine={{ stroke: CHART_COLORS.grid }} />
            <YAxis
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
              formatter={(value: number | string) => `${formatNumber(Number(value), 1)} puntos`}
            />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="square" iconSize={10} />
            <ReferenceLine
              y={OEE_BENCHMARKS.worldClass * 100}
              stroke={CHART_COLORS.positive}
              strokeDasharray="4 3"
              label={{
                value: `clase mundial ${formatNumber(OEE_BENCHMARKS.worldClass * 100)}%`,
                position: "top",
                fill: CHART_COLORS.positive,
                fontSize: 11,
              }}
            />
            <Bar dataKey="OEE" stackId="oee" fill={CHART_COLORS.recommended} maxBarSize={80} />
            <Bar
              dataKey="Perdida por disponibilidad"
              stackId="oee"
              fill={CHART_COLORS.overtime}
              maxBarSize={80}
            />
            <Bar
              dataKey="Perdida por desempeno"
              stackId="oee"
              fill={CHART_COLORS.holding}
              maxBarSize={80}
            />
            <Bar
              dataKey="Perdida por calidad"
              stackId="oee"
              fill={CHART_COLORS.stockout}
              radius={[4, 4, 0, 0]}
              maxBarSize={80}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>
      <ChartLegend
        items={oee.lines.map((line) => ({
          label: `${line.lineId}: ${line.lineName}`,
          color: CHART_COLORS.recommended,
        }))}
      />
    </>
  );
}
