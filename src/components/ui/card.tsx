import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cn("rounded-card border border-line bg-surface shadow-card", className)}>
      {children}
    </section>
  );
}

export function CardHeader({
  className,
  children,
  actions,
}: {
  className?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-5 sm:py-4",
        className,
      )}
    >
      <div className="min-w-0">{children}</div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function CardTitle({ className, children }: { className?: string; children: ReactNode }) {
  return <h2 className={cn("text-base font-semibold text-navy-800", className)}>{children}</h2>;
}

export function CardDescription({ className, children }: { className?: string; children: ReactNode }) {
  return <p className={cn("mt-1 text-sm text-steel-500", className)}>{children}</p>;
}

export function CardContent({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("px-4 py-4 sm:px-5", className)}>{children}</div>;
}

export function CardFooter({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <footer className={cn("border-t border-line bg-steel-50 px-4 py-3 text-sm sm:px-5", className)}>
      {children}
    </footer>
  );
}
