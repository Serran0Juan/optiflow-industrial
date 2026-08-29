import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
  {
    variants: {
      variant: {
        neutral: "bg-steel-100 text-steel-700 ring-steel-200",
        navy: "bg-navy-50 text-navy-700 ring-navy-200",
        positive: "bg-positive-50 text-positive-700 ring-positive-200",
        warning: "bg-warning-50 text-warning-700 ring-warning-200",
        danger: "bg-danger-50 text-danger-700 ring-danger-200",
        outline: "bg-transparent text-steel-600 ring-steel-300",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps extends VariantProps<typeof badgeVariants> {
  className?: string;
  children: ReactNode;
  title?: string;
}

export function Badge({ variant, className, children, title }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} title={title}>
      {children}
    </span>
  );
}

/** Etiqueta permanente que recuerda que el caso y los datos son simulados. */
export function SimulatedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-warning-50 px-2.5 py-1 text-xs font-semibold text-warning-700 ring-1 ring-inset ring-warning-200",
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-warning-400" aria-hidden />
      Caso de estudio simulado
    </span>
  );
}
