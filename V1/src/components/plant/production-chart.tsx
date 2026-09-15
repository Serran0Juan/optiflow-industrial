"use client";

import { useId } from "react";
import { formatNumber } from "@/lib/format";

export interface ProductionPoint {
  minute: number;
  produced: number;
  reference: number;
  dispatched: number;
}

export function plantClock(minute: number): string {
  const total = 6 * 60 + Math.floor(minute);
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function ProductionChart({ points, minute, duration }: {
  points: ProductionPoint[];
  minute: number;
  duration: number;
}) {
  const id = useId().replace(/:/g, "");
  const maxValue = Math.max(1, ...points.map((point) => Math.max(point.reference, point.produced)));
  const ceiling = Math.ceil(maxValue / 10000) * 10000;
  const x = (value: number) => 58 + value / Math.max(1, duration) * 622;
  const y = (value: number) => 200 - value / ceiling * 172;
  const path = (key: "produced" | "reference" | "dispatched") => points
    .filter((point) => key === "reference" || point.minute <= minute)
    .map((point, index) => `${index === 0 ? "M" : "L"}${x(point.minute).toFixed(1)},${y(point[key]).toFixed(1)}`)
    .join(" ");

  return (
    <div>
      <svg viewBox="0 0 710 242" className="block w-full" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
        <title id={`${id}-title`}>Producción y despacho acumulados durante la jornada</title>
        <desc id={`${id}-desc`}>La referencia muestra la misma jornada sin incidentes. Las curvas del escenario llegan hasta las {plantClock(minute)}. Los valores exactos se encuentran en las tarjetas y en el resumen de cierre.</desc>
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
          <g key={fraction}>
            <line x1="58" x2="680" y1={y(ceiling * fraction)} y2={y(ceiling * fraction)} stroke="#e6edf4" strokeDasharray="3 4" />
            <text x="47" y={y(ceiling * fraction) + 4} textAnchor="end" fontSize="11" fill="#73869b">{formatNumber(ceiling * fraction / 1000, 0)} mil</text>
          </g>
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
          <text key={fraction} x={x(duration * fraction)} y="224" textAnchor="middle" fontSize="11" fill="#73869b">{plantClock(duration * fraction)}</text>
        ))}
        <path d={path("reference")} fill="none" stroke="#a9b7c7" strokeWidth="2" strokeDasharray="5 5" />
        <path d={path("produced")} fill="none" stroke="#238f87" strokeWidth="3" strokeLinejoin="round" />
        <path d={path("dispatched")} fill="none" stroke="#466cb5" strokeWidth="2" strokeLinejoin="round" />
        <line x1={x(minute)} x2={x(minute)} y1="23" y2="200" stroke="#223d5d" strokeWidth="1" strokeDasharray="3 4" />
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-steel-500">
        <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#238f87]" />Producción conforme</span>
        <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#466cb5]" />Despachado</span>
        <span><span className="mr-1.5 inline-block h-0.5 w-3 border-t-2 border-dashed border-[#a9b7c7] align-middle" />Referencia sin incidentes</span>
      </div>
    </div>
  );
}
