import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SimulatedBadge } from "./badge";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-line pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-navy-800 sm:text-2xl">{title}</h1>
          <SimulatedBadge />
        </div>
        <p className="mt-2 text-sm leading-relaxed text-steel-600">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function TableWrap({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("scroll-x", className)}>
      <table className="data-table">{children}</table>
    </div>
  );
}

export function Note({
  children,
  tone = "info",
  title,
}: {
  children: ReactNode;
  tone?: "info" | "warning" | "positive";
  title?: string;
}) {
  const tones = {
    info: "border-navy-200 bg-navy-50 text-navy-800",
    warning: "border-warning-200 bg-warning-50 text-warning-800",
    positive: "border-positive-200 bg-positive-50 text-positive-800",
  } as const;

  return (
    <div className={cn("rounded-md border px-4 py-3 text-sm leading-relaxed", tones[tone])}>
      {title ? <p className="mb-1 font-semibold">{title}</p> : null}
      {children}
    </div>
  );
}

export function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2 last:border-b-0">
      <dt className="text-sm text-steel-500">{label}</dt>
      <dd className="text-sm font-medium tabular-nums text-navy-800">{children}</dd>
    </div>
  );
}
