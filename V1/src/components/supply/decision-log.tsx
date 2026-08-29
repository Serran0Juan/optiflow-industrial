"use client";

import { TableWrap } from "@/components/ui/layout-bits";
import { formatCurrency } from "@/lib/format";
import type { DecisionLogEntry } from "@/lib/types";
import { DecisionStatusBadge, RiskBadge } from "./supply-bits";

/** Fecha y hora legibles a partir del ISO guardado en el navegador. */
function formatTimestamp(iso: string): string {
  if (!iso) return "-";
  const [date, time] = iso.split("T");
  return `${date} ${time ? time.slice(0, 5) : ""}`.trim();
}

/**
 * Registro de decisiones tomadas sobre las recomendaciones.
 * Se alimenta del `localStorage` del navegador: es trazabilidad de demostracion,
 * no un log de auditoria persistido en ningun sistema.
 */
export function DecisionLog({ entries }: { entries: DecisionLogEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-steel-500 sm:px-5">
        Todavia no se registro ninguna decision. Aprobar, rechazar o marcar para revision una
        recomendacion agrega una entrada a este registro.
      </p>
    );
  }

  return (
    <TableWrap>
      <thead>
        <tr>
          <th>Fecha y hora</th>
          <th>Material</th>
          <th>Recomendacion original</th>
          <th>Riesgo</th>
          <th>Usuario</th>
          <th>Decision</th>
          <th>Nota</th>
          <th className="numeric">Impacto estimado</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <tr key={entry.id}>
            <td className="whitespace-nowrap tabular-nums">{formatTimestamp(entry.timestamp)}</td>
            <td>
              <span className="block font-medium text-navy-800">{entry.materialCode}</span>
              <span className="block text-xs text-steel-500">{entry.materialName}</span>
            </td>
            <td className="text-xs">{entry.recommendedAction}</td>
            <td>
              <RiskBadge risk={entry.risk} />
            </td>
            <td className="whitespace-nowrap">{entry.user}</td>
            <td>
              <DecisionStatusBadge status={entry.status} />
            </td>
            <td className="max-w-sm text-xs leading-relaxed text-steel-600">
              {entry.note || <span className="text-steel-400">Sin nota</span>}
            </td>
            <td className="numeric">{formatCurrency(entry.estimatedImpact)}</td>
          </tr>
        ))}
      </tbody>
    </TableWrap>
  );
}
