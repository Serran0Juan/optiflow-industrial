"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency, formatCurrencyCompact, formatNumber } from "@/lib/format";
import type { BalanceComparison, BalanceLayout } from "@/lib/types";
import {
  AXIS_PROPS,
  CHART_COLORS,
  ChartFrame,
  ChartLegend,
  TOOLTIP_ITEM_STYLE,
  TOOLTIP_LABEL_STYLE,
  TOOLTIP_STYLE,
} from "./chart-kit";

/** Color de la barra segun el riesgo que representa la estacion. */
function stationColor(loadSeconds: number, taktSeconds: number, isBottleneck: boolean): string {
  if (loadSeconds > taktSeconds + 1e-9) return CHART_COLORS.stationOverTakt;
  if (isBottleneck) return CHART_COLORS.stationBottleneck;
  return CHART_COLORS.station;
}

/**
 * Carga de cada estacion contra el takt time, en barras horizontales.
 * La porcion clara completa el tiempo de ciclo: es la ociosidad del puesto.
 */
export function StationLoadChart({ layout }: { layout: BalanceLayout }) {
  const takt = layout.metrics.taktSeconds;
  const data = layout.stations.map((station) => ({
    estacion: `E${station.index}`,
    Carga: station.loadSeconds,
    Ociosa: station.idleSeconds,
    color: stationColor(station.loadSeconds, takt, station.isBottleneck),
  }));

  const anyOverTakt = layout.stations.some((station) => station.loadSeconds > takt + 1e-9);

  return (
    <>
      <ChartFrame height={Math.max(220, 42 * data.length + 60)}>
        <ResponsiveContainer>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 16, right: 20, bottom: 4, left: 4 }}
            barCategoryGap="22%"
          >
            <CartesianGrid stroke={CHART_COLORS.grid} horizontal={false} />
            <XAxis
              type="number"
              {...AXIS_PROPS}
              axisLine={{ stroke: CHART_COLORS.grid }}
              tickFormatter={(value: number) => `${formatNumber(value)}s`}
            />
            <YAxis type="category" dataKey="estacion" {...AXIS_PROPS} axisLine={false} width={44} />
            <Tooltip
              cursor={{ fill: "#f1f5f9" }}
              contentStyle={TOOLTIP_STYLE}
              labelStyle={TOOLTIP_LABEL_STYLE}
              itemStyle={TOOLTIP_ITEM_STYLE}
              formatter={(value: number | string) => `${formatNumber(Number(value), 1)} s`}
            />
            <ReferenceLine
              x={takt}
              stroke={CHART_COLORS.takt}
              strokeDasharray="4 3"
              label={{
                value: `takt ${formatNumber(takt, 1)} s`,
                position: "top",
                fill: CHART_COLORS.takt,
                fontSize: 11,
              }}
            />
            <Bar dataKey="Carga" stackId="carga" maxBarSize={26}>
              {data.map((entry) => (
                <Cell key={entry.estacion} fill={entry.color} />
              ))}
            </Bar>
            <Bar
              dataKey="Ociosa"
              stackId="carga"
              fill={CHART_COLORS.idle}
              radius={[0, 4, 4, 0]}
              maxBarSize={26}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>
      <ChartLegend
        items={[
          { label: "Carga asignada", color: CHART_COLORS.station },
          { label: "Cuello de botella", color: CHART_COLORS.stationBottleneck },
          ...(anyOverTakt
            ? [{ label: "Carga por encima del takt", color: CHART_COLORS.stationOverTakt }]
            : []),
          { label: "Ociosa hasta el tiempo de ciclo", color: CHART_COLORS.idle },
        ]}
      />
    </>
  );
}

/** Capacidad diaria (eje izquierdo) y eficiencia de linea (eje derecho). */
export function EfficiencyCapacityChart({ comparison }: { comparison: BalanceComparison }) {
  const { initial, recommended } = comparison;
  const data = [
    {
      name: "Distribucion inicial",
      Capacidad: initial.metrics.dailyCapacityUnits,
      Eficiencia: Number((initial.metrics.lineEfficiency * 100).toFixed(1)),
    },
    {
      name: "Balance recomendado",
      Capacidad: recommended.metrics.dailyCapacityUnits,
      Eficiencia: Number((recommended.metrics.lineEfficiency * 100).toFixed(1)),
    },
  ];

  return (
    <ChartFrame height={290}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 18, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis dataKey="name" {...AXIS_PROPS} axisLine={{ stroke: CHART_COLORS.grid }} />
          <YAxis
            yAxisId="unidades"
            {...AXIS_PROPS}
            axisLine={false}
            width={58}
            tickFormatter={(value: number) => formatNumber(value)}
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
              name === "Eficiencia"
                ? `${formatNumber(Number(value), 1)}%`
                : `${formatNumber(Number(value))} u/dia`
            }
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="square" iconSize={10} />
          <ReferenceLine
            yAxisId="unidades"
            y={initial.metrics.dailyDemandUnits}
            stroke={CHART_COLORS.takt}
            strokeDasharray="4 3"
            label={{
              value: `demanda ${formatNumber(initial.metrics.dailyDemandUnits)} u`,
              position: "insideTopRight",
              fill: CHART_COLORS.takt,
              fontSize: 11,
            }}
          />
          <Bar
            yAxisId="unidades"
            dataKey="Capacidad"
            fill={CHART_COLORS.capacity}
            radius={[4, 4, 0, 0]}
            maxBarSize={64}
          />
          <Bar
            yAxisId="pct"
            dataKey="Eficiencia"
            fill={CHART_COLORS.efficiency}
            radius={[4, 4, 0, 0]}
            maxBarSize={64}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/**
 * Composicion del costo diario estimado.
 * El costo de estaciones se abre en tiempo productivo y tiempo ocioso: los dos
 * ya estan dentro del costo de estaciones, no se suman como conceptos aparte.
 */
export function BalanceCostChart({ comparison }: { comparison: BalanceComparison }) {
  const data = [comparison.initial, comparison.recommended].map((layout) => ({
    name: layout.label,
    "Estaciones - productivo": Math.round(layout.cost.productiveCost),
    "Estaciones - ocioso": Math.round(layout.cost.idleCost),
    "Unidades no atendidas": Math.round(layout.cost.unmetCost),
  }));

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
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="square" iconSize={10} />
          <Bar
            dataKey="Estaciones - productivo"
            stackId="costo"
            fill={CHART_COLORS.recommended}
            maxBarSize={110}
          />
          <Bar
            dataKey="Estaciones - ocioso"
            stackId="costo"
            fill={CHART_COLORS.overtime}
            maxBarSize={110}
          />
          <Bar
            dataKey="Unidades no atendidas"
            stackId="costo"
            fill={CHART_COLORS.stockout}
            radius={[4, 4, 0, 0]}
            maxBarSize={110}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
