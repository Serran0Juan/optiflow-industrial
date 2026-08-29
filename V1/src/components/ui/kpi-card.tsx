import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type KpiTone = "neutral" | "positive" | "warning" | "danger";

const toneStyles: Record<KpiTone, { value: string; icon: string }> = {
  neutral: { value: "text-navy-800", icon: "bg-navy-50 text-navy-600" },
  positive: { value: "text-positive-600", icon: "bg-positive-50 text-positive-600" },
  warning: { value: "text-warning-600", icon: "bg-warning-50 text-warning-600" },
  danger: { value: "text-danger-600", icon: "bg-danger-50 text-danger-600" },
};

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  comparison,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: KpiTone;
  comparison?: { label: string; value: string; tone?: KpiTone };
}) {
  const styles = toneStyles[tone];
  return (
    <div className="flex flex-col justify-between rounded-card border border-line bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-steel-500">{label}</p>
        <span className={cn("rounded-md p-1.5", styles.icon)}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <p className={cn("mt-3 text-2xl font-semibold tabular-nums tracking-tight", styles.value)}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs leading-relaxed text-steel-500">{hint}</p> : null}
      {comparison ? (
        <p className="mt-2 border-t border-line pt-2 text-xs text-steel-500">
          {comparison.label}{" "}
          <span
            className={cn(
              "font-semibold tabular-nums",
              toneStyles[comparison.tone ?? "neutral"].value,
            )}
          >
            {comparison.value}
          </span>
        </p>
      ) : null}
    </div>
  );
}
