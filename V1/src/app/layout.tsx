import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { ScenarioProvider } from "@/state/scenario-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "OptiFlow Industrial | Planificacion de produccion y abastecimiento",
  description:
    "Caso de estudio simulado de planificacion semanal de produccion: heuristica de secuenciamiento, comparacion contra un plan base y modelo economico transparente.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <ScenarioProvider>
          <AppShell>{children}</AppShell>
        </ScenarioProvider>
      </body>
    </html>
  );
}
