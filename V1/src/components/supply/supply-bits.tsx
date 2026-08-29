import { Badge } from "@/components/ui/badge";
import { PURCHASE_ORDER_STATUS_LABELS } from "@/lib/data/supply-config";
import { formatNumber } from "@/lib/format";
import { NO_CONSUMPTION_COVERAGE } from "@/lib/supply/metrics";
import type {
  DecisionStatus,
  PurchaseOrderStatus,
  SupplyConfidence,
  SupplyRiskLevel,
} from "@/lib/types";

export const RISK_LABELS: Record<SupplyRiskLevel, string> = {
  critico: "Critico",
  alto: "Alto",
  medio: "Medio",
  bajo: "Bajo",
};

export const DECISION_STATUS_LABELS: Record<DecisionStatus, string> = {
  pendiente: "Pendiente",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
  revision: "Requiere revision",
};

const RISK_VARIANT: Record<SupplyRiskLevel, "danger" | "warning" | "neutral" | "positive"> = {
  critico: "danger",
  alto: "warning",
  medio: "neutral",
  bajo: "positive",
};

const ORDER_VARIANT: Record<PurchaseOrderStatus, "navy" | "danger" | "positive" | "neutral"> = {
  "en-transito": "navy",
  retrasada: "danger",
  confirmada: "positive",
  pendiente: "neutral",
};

const DECISION_VARIANT: Record<DecisionStatus, "outline" | "positive" | "danger" | "warning"> = {
  pendiente: "outline",
  aprobada: "positive",
  rechazada: "danger",
  revision: "warning",
};

const CONFIDENCE_VARIANT: Record<SupplyConfidence, "positive" | "neutral" | "warning"> = {
  alta: "positive",
  media: "neutral",
  baja: "warning",
};

export function RiskBadge({ risk, title }: { risk: SupplyRiskLevel; title?: string }) {
  return (
    <Badge variant={RISK_VARIANT[risk]} title={title}>
      {RISK_LABELS[risk]}
    </Badge>
  );
}

export function OrderStatusBadge({ status }: { status: PurchaseOrderStatus }) {
  return <Badge variant={ORDER_VARIANT[status]}>{PURCHASE_ORDER_STATUS_LABELS[status]}</Badge>;
}

export function DecisionStatusBadge({ status }: { status: DecisionStatus }) {
  return <Badge variant={DECISION_VARIANT[status]}>{DECISION_STATUS_LABELS[status]}</Badge>;
}

export function ConfidenceBadge({
  confidence,
  title,
}: {
  confidence: SupplyConfidence;
  title?: string;
}) {
  return (
    <Badge variant={CONFIDENCE_VARIANT[confidence]} title={title}>
      Confianza {confidence}
    </Badge>
  );
}

/** Cobertura en dias, contemplando los materiales sin consumo en el horizonte. */
export function formatCoverage(coverageDays: number): string {
  if (coverageDays === NO_CONSUMPTION_COVERAGE) return "sin consumo";
  return `${formatNumber(coverageDays, 1)} d`;
}

/** Leyenda obligatoria del modulo: recuerda que el caso y las reglas son simulados. */
export function SupplyDisclaimer({ detail }: { detail?: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800 sm:flex-row sm:items-center sm:justify-between">
      <p className="font-medium">
        Caso de estudio simulado &middot; Recomendaciones basadas en reglas operativas y supuestos
        explicitos.
      </p>
      {detail ? <p className="text-xs text-warning-700">{detail}</p> : null}
    </div>
  );
}
