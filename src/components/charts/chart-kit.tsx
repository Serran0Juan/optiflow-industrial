"use client";

import type { ReactNode } from "react";

/** Paleta compartida por todos los graficos. */
export const CHART_COLORS = {
  base: "#8fa3b8",
  recommended: "#234269",
  setup: "#4d74a1",
  overtime: "#ef9f2b",
  holding: "#adc1d8",
  stockout: "#c03c33",
  idle: "#eef2f7",
  positive: "#1f9569",
  grid: "#e2e8f0",
  axis: "#8fa3b8",
};

export const AXIS_PROPS = {
  stroke: CHART_COLORS.axis,
  tick: { fill: "#5c718a", fontSize: 12 },
  tickLine: false,
} as const;

export const TOOLTIP_STYLE = {
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  boxShadow: "0 4px 12px rgba(16, 32, 51, 0.08)",
  fontSize: 12,
  padding: "8px 10px",
} as const;

export const TOOLTIP_LABEL_STYLE = { color: "#13253c", fontWeight: 600, marginBottom: 4 } as const;
export const TOOLTIP_ITEM_STYLE = { color: "#37475b", padding: 0 } as const;

export function ChartFrame({ height = 280, children }: { height?: number; children: ReactNode }) {
  return (
    <div style={{ width: "100%", height }} className="text-xs">
      {children}
    </div>
  );
}

export function ChartLegend({ items }: { items: Array<{ label: string; color: string }> }) {
  return (
    <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-steel-600">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} aria-hidden />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
