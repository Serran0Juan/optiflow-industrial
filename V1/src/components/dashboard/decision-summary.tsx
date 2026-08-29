"use client";

import { CircleCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Resumen de decisiones. El texto se arma con reglas deterministas sobre los
 * resultados del plan; no interviene ningun modelo de lenguaje.
 */
export function DecisionSummary({ decisions }: { decisions: string[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Decisiones recomendadas</CardTitle>
        <CardDescription>
          Generadas de forma determinista a partir de los resultados del plan, sin IA generativa: el
          mismo escenario produce siempre el mismo texto.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {decisions.map((decision) => (
            <li key={decision} className="flex gap-2.5 text-sm leading-relaxed text-steel-700">
              <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-positive-500" aria-hidden />
              <span>{decision}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
