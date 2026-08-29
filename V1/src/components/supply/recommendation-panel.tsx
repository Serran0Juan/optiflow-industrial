"use client";

import { useState } from "react";
import { CalendarClock, Check, RotateCcw, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MATERIAL_CATEGORY_LABELS } from "@/lib/data/supply-config";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { DecisionStatus, SupplyDecision, SupplyRecommendation } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ConfidenceBadge, DecisionStatusBadge, RiskBadge } from "./supply-bits";

const CARD_TONE: Record<string, string> = {
  critico: "border-danger-200 bg-danger-50/40",
  alto: "border-warning-200 bg-warning-50/40",
  medio: "border-line bg-surface",
  bajo: "border-line bg-surface",
};

/**
 * Tarjeta de una recomendacion con su circuito de aprobacion humana.
 *
 * Ningun boton emite una orden de compra real ni envia datos a ningun servicio:
 * registran la decision del planificador en el navegador para dejar trazabilidad
 * de quien reviso que.
 */
function RecommendationCard({
  recommendation,
  decision,
  onDecide,
}: {
  recommendation: SupplyRecommendation;
  decision: SupplyDecision | undefined;
  onDecide: (status: DecisionStatus, note: string) => void;
}) {
  const [note, setNote] = useState(decision?.note ?? "");
  const status: DecisionStatus = decision?.status ?? "pendiente";

  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-card border p-4 shadow-card",
        CARD_TONE[recommendation.risk] ?? "border-line bg-surface",
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-navy-800">
            {recommendation.materialCode} &middot; {recommendation.materialName}
          </p>
          <p className="mt-0.5 text-xs text-steel-500">
            {MATERIAL_CATEGORY_LABELS[recommendation.category]} &middot;{" "}
            {recommendation.supplierName}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <RiskBadge risk={recommendation.risk} />
          <DecisionStatusBadge status={status} />
        </div>
      </header>

      <p className="text-sm font-semibold text-navy-700">{recommendation.actionLabel}</p>

      <p className="text-sm leading-relaxed text-steel-700">{recommendation.reason}</p>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-y border-line py-3 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-steel-500">Cantidad sugerida</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-navy-800">
            {recommendation.quantity > 0
              ? `${formatNumber(recommendation.quantity)} ${recommendation.unit}`
              : "No aplica"}
          </dd>
        </div>
        <div>
          <dt className="text-steel-500">Costo estimado</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-navy-800">
            {recommendation.estimatedCost > 0
              ? formatCurrency(recommendation.estimatedCost)
              : "Sin compra"}
          </dd>
        </div>
        <div>
          <dt className="text-steel-500">Fecha limite de decision</dt>
          <dd className="mt-0.5 flex items-center gap-1 font-semibold tabular-nums text-navy-800">
            <CalendarClock className="h-3.5 w-3.5 text-steel-400" aria-hidden />
            {recommendation.decisionDeadline}
          </dd>
        </div>
        <div>
          <dt className="text-steel-500">Costo de no actuar</dt>
          <dd
            className={cn(
              "mt-0.5 font-semibold tabular-nums",
              recommendation.inactionCost > 0 ? "text-danger-600" : "text-navy-800",
            )}
          >
            {recommendation.inactionCost > 0
              ? formatCurrency(recommendation.inactionCost)
              : "Sin impacto estimado"}
          </dd>
        </div>
      </dl>

      <p className="text-xs leading-relaxed text-steel-600">
        <span className="font-semibold text-steel-700">Consecuencia de no actuar: </span>
        {recommendation.consequence}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <ConfidenceBadge
          confidence={recommendation.confidence}
          title={recommendation.confidenceReason}
        />
        <span className="text-xs text-steel-500">{recommendation.confidenceReason}</span>
      </div>

      <div className="flex flex-col gap-2 border-t border-line pt-3">
        <label
          htmlFor={`nota-${recommendation.materialId}`}
          className="text-xs font-medium uppercase tracking-wide text-steel-500"
        >
          Nota de decision
        </label>
        <textarea
          id={`nota-${recommendation.materialId}`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          maxLength={280}
          placeholder="Ej.: se confirmo con el proveedor una entrega parcial para el jueves."
          className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-steel-800 shadow-sm focus:border-navy-400 focus:outline-none focus:ring-2 focus:ring-navy-200"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={status === "aprobada" ? "primary" : "outline"}
            onClick={() => onDecide("aprobada", note)}
          >
            <Check className="h-4 w-4" aria-hidden />
            Aprobar
          </Button>
          <Button
            size="sm"
            variant={status === "rechazada" ? "primary" : "outline"}
            onClick={() => onDecide("rechazada", note)}
          >
            <X className="h-4 w-4" aria-hidden />
            Rechazar
          </Button>
          <Button
            size="sm"
            variant={status === "revision" ? "primary" : "outline"}
            onClick={() => onDecide("revision", note)}
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            Requiere revision
          </Button>
          {decision && decision.updatedAt ? (
            <Badge variant="outline">Registrada {decision.updatedAt.slice(0, 16).replace("T", " ")}</Badge>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/** Panel de recomendaciones, ordenado por gravedad: criticas y altas primero. */
export function RecommendationPanel({
  recommendations,
  decisions,
  onDecide,
}: {
  recommendations: SupplyRecommendation[];
  decisions: Record<string, SupplyDecision>;
  onDecide: (recommendation: SupplyRecommendation, status: DecisionStatus, note: string) => void;
}) {
  if (recommendations.length === 0) {
    return (
      <p className="rounded-md bg-steel-50 px-4 py-8 text-center text-sm text-steel-600">
        No hay recomendaciones que mostrar con los filtros aplicados.
      </p>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {recommendations.map((recommendation) => (
        /* La clave incluye la marca de tiempo de la decision para que la tarjeta
           se reinicie con la nota guardada al hidratar o al registrar un cambio. */
        <RecommendationCard
          key={`${recommendation.materialId}-${decisions[recommendation.materialId]?.updatedAt ?? "nueva"}`}
          recommendation={recommendation}
          decision={decisions[recommendation.materialId]}
          onDecide={(status, note) => onDecide(recommendation, status, note)}
        />
      ))}
    </div>
  );
}
