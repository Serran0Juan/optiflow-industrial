"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Factory } from "lucide-react";
import type { ReactNode } from "react";
import { dataset } from "@/lib/data/dataset";
import { formatLongDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";
import { ScenarioBar } from "./scenario-bar";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const firstDay = dataset.planningDays[0];
  const lastDay = dataset.planningDays[dataset.planningDays.length - 1];

  const isActive = (href: string): boolean =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-navy-800 lg:flex">
        <div className="flex items-center gap-3 border-b border-navy-700 px-5 py-4">
          <span className="rounded-md bg-navy-600 p-2 text-white">
            <Factory className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight text-white">OptiFlow Industrial</p>
            <p className="text-xs text-navy-200">Planificacion y abastecimiento</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Navegacion principal">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-start gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-navy-600 text-white"
                    : "text-navy-100 hover:bg-navy-700 hover:text-white",
                )}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>
                  <span className="block font-medium">{item.label}</span>
                  <span
                    className={cn(
                      "mt-0.5 block text-xs leading-snug",
                      active ? "text-navy-100" : "text-navy-300",
                    )}
                  >
                    {item.description}
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-navy-700 px-5 py-4 text-xs leading-relaxed text-navy-200">
          <p className="font-medium text-navy-100">Horizonte planificado</p>
          <p>
            {formatLongDate(firstDay.date)} a {formatLongDate(lastDay.date)}
          </p>
          <p className="mt-2">
            Datos sinteticos generados con semilla fija {dataset.seed}. Ninguna cifra corresponde a una
            empresa real.
          </p>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <Link href="/" className="flex items-center gap-2 lg:hidden">
              <span className="rounded-md bg-navy-700 p-1.5 text-white">
                <Factory className="h-4 w-4" aria-hidden />
              </span>
              <span className="text-sm font-semibold text-navy-800">OptiFlow Industrial</span>
            </Link>
            <ScenarioBar />
          </div>

          <nav
            className="scroll-x flex gap-1 border-t border-line px-2 py-2 lg:hidden"
            aria-label="Navegacion principal (movil)"
          >
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium",
                    active ? "bg-navy-700 text-white" : "text-steel-600 hover:bg-steel-100",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {item.shortLabel}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>

        <footer className="border-t border-line px-4 py-6 text-xs leading-relaxed text-steel-500 sm:px-6 lg:px-8">
          <p>
            OptiFlow Industrial es un caso de estudio simulado construido para portfolio. Los datos de
            demanda, capacidad, costos, proveedores y resultados son sinteticos y deterministicos; no
            representan a ninguna empresa ni constituyen resultados reales.
          </p>
        </footer>
      </div>
    </div>
  );
}
