"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency, formatCurrencyCompact } from "@/lib/format";
import type { CostBreakdown } from "@/lib/types";
import {
  AXIS_PROPS,
  CHART_COLORS,
  ChartFrame,
  ChartLegend,
  TOOLTIP_ITEM_STYLE,
  TOOLTIP_LABEL_STYLE,
  TOOLTIP_STYLE,
} from "./chart-kit";

/** Costo total del plan base contra el costo total del plan recomendado. */
export function CostComparisonChart({
  baseCost,
  recommendedCost,
}: {
  baseCost: number;
  recommendedCost: number;
}) {
  const data = [
    { name: "Plan base", costo: Math.round(baseCost), color: CHART_COLORS.base },
    { name: "Plan recomendado", costo: Math.round(recommendedCost), color: CHART_COLORS.recommended },
  ];

  return (
    <>
      <ChartFrame height={260}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
            <XAxis dataKey="name" {...AXIS_PROPS} axisLine={{ stroke: CHART_COLORS.grid }} />
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
              formatter={(value: number | string) => [formatCurrency(Number(value)), "Costo total"]}
            />
            <Bar dataKey="costo" radius={[4, 4, 0, 0]} maxBarSize={110}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>
      <ChartLegend
        items={[
          { label: "Plan base", color: CHART_COLORS.base },
          { label: "Plan recomendado", color: CHART_COLORS.recommended },
        ]}
      />
    </>
  );
}

/** Composicion del costo total de cada plan (barras apiladas). */
export function CostBreakdownChart({
  base,
  recommended,
}: {
  base: CostBreakdown;
  recommended: CostBreakdown;
}) {
  const data = [
    {
      name: "Plan base",
      Setups: Math.round(base.setup),
      "Horas extra": Math.round(base.overtime),
      Inventario: Math.round(base.holding),
      Faltantes: Math.round(base.stockout),
    },
    {
      name: "Plan recomendado",
      Setups: Math.round(recommended.setup),
      "Horas extra": Math.round(recommended.overtime),
      Inventario: Math.round(recommended.holding),
      Faltantes: Math.round(recommended.stockout),
    },
  ];

  return (
    <ChartFrame height={300}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis dataKey="name" {...AXIS_PROPS} axisLine={{ stroke: CHART_COLORS.grid }} />
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
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            iconType="square"
            iconSize={10}
          />
          <Bar dataKey="Setups" stackId="costos" fill={CHART_COLORS.setup} maxBarSize={110} />
          <Bar dataKey="Horas extra" stackId="costos" fill={CHART_COLORS.overtime} maxBarSize={110} />
          <Bar dataKey="Inventario" stackId="costos" fill={CHART_COLORS.holding} maxBarSize={110} />
          <Bar
            dataKey="Faltantes"
            stackId="costos"
            fill={CHART_COLORS.stockout}
            radius={[4, 4, 0, 0]}
            maxBarSize={110}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
