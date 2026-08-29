"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMinutes, formatNumber } from "@/lib/format";
import type { PlanEvaluation, PlanningDay, ProductionPlan } from "@/lib/types";
import {
  AXIS_PROPS,
  CHART_COLORS,
  ChartFrame,
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
