"use client";

import { AlertTriangle, Info, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TableWrap } from "@/components/ui/layout-bits";
import { formatCurrency } from "@/lib/format";
import type { OperationalAlert } from "@/lib/types";

const SEVERITY_META = {
  alta: { variant: "danger" as const, icon: ShieldAlert, label: "Alta" },
  media: { variant: "warning" as const, icon: AlertTriangle, label: "Media" },
  baja: { variant: "neutral" as const, icon: Info, label: "Baja" },
};

export function AlertsTable({ alerts, limit = 8 }: { alerts: OperationalAlert[]; limit?: number }) {
  const visible = alerts.slice(0, limit);
  const hidden = alerts.length - visible.length;

  return (
    <Card>
      <CardHeader
        actions={
          <Badge variant={alerts.some((alert) => alert.severity === "alta") ? "danger" : "neutral"}>
            {alerts.length} alertas
          </Badge>
        }
      >
        <CardTitle>Alertas operativas prioritarias</CardTitle>
        <CardDescription>
          Derivadas del plan recomendado y del abastecimiento, ordenadas por severidad e impacto
          economico estimado.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 py-0">
        {visible.length === 0 ? (
          <p className="px-5 py-6 text-sm text-steel-500">
            El escenario no genera alertas: ningun producto queda por debajo de su stock de seguridad
            y el abastecimiento cubre el horizonte.
          </p>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th>Severidad</th>
                <th>Tipo</th>
                <th>Entidad</th>
                <th>Detalle y accion sugerida</th>
                <th className="text-right">Impacto</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((alert) => {
                const meta = SEVERITY_META[alert.severity];
                const Icon = meta.icon;
                return (
                  <tr key={alert.id}>
                    <td>
                      <Badge variant={meta.variant}>
                        <Icon className="h-3 w-3" aria-hidden />
                        {meta.label}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap text-steel-600">{alert.category}</td>
                    <td className="max-w-[220px] font-medium text-navy-800">{alert.entity}</td>
                    <td className="max-w-[420px]">
                      <p className="text-steel-700">{alert.message}</p>
                      <p className="mt-0.5 text-xs text-steel-500">{alert.recommendation}</p>
                    </td>
                    <td className="numeric whitespace-nowrap">
                      {alert.impact > 0 ? formatCurrency(alert.impact) : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        )}
        {hidden > 0 ? (
          <p className="border-t border-line px-5 py-2.5 text-xs text-steel-500">
            {hidden} alertas adicionales de menor severidad no se muestran en este resumen.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
