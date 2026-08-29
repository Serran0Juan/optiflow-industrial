"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  DecisionLogEntry,
  DecisionStatus,
  SupplyDecision,
  SupplyRecommendation,
} from "@/lib/types";

/**
 * Aprobacion humana de las recomendaciones de compra (HITL).
 *
 * Las decisiones se guardan UNICAMENTE en el `localStorage` del navegador: no
 * hay backend, no hay base de datos y no se envia nada a ningun servicio. Es un
 * mecanismo de demostracion para mostrar el circuito de aprobacion, no un
 * sistema de gestion de compras.
 */

export const SUPPLY_DECISIONS_STORAGE_KEY = "optiflow.torre-abastecimiento.decisiones.v2";

/** Usuario demostrativo con el que se firman las decisiones del registro. */
export const DEMO_USER = "Planificador";

/** Cantidad maxima de entradas que se conservan en el registro de decisiones. */
const LOG_LIMIT = 100;

interface StoredState {
  decisions: Record<string, SupplyDecision>;
  log: DecisionLogEntry[];
}

const EMPTY_STATE: StoredState = { decisions: {}, log: [] };

function isDecisionStatus(value: unknown): value is DecisionStatus {
  return (
    value === "pendiente" || value === "aprobada" || value === "rechazada" || value === "revision"
  );
}

/** Lectura defensiva: cualquier dato invalido se descarta en lugar de romper la pagina. */
function readStoredState(): StoredState {
  if (typeof window === "undefined") return EMPTY_STATE;
  try {
    const raw = window.localStorage.getItem(SUPPLY_DECISIONS_STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as Partial<StoredState>;
    const decisions: Record<string, SupplyDecision> = {};
    for (const [materialId, decision] of Object.entries(parsed.decisions ?? {})) {
      if (decision && isDecisionStatus(decision.status)) {
        decisions[materialId] = {
          materialId,
          status: decision.status,
          note: typeof decision.note === "string" ? decision.note : "",
          updatedAt: typeof decision.updatedAt === "string" ? decision.updatedAt : "",
        };
      }
    }
    const log = Array.isArray(parsed.log)
      ? parsed.log.filter((entry): entry is DecisionLogEntry =>
          Boolean(entry && typeof entry.id === "string" && isDecisionStatus(entry.status)),
        )
      : [];
    return { decisions, log };
  } catch {
    return EMPTY_STATE;
  }
}

export interface SupplyDecisionsState {
  /** false hasta que se leyo el `localStorage`, para no romper la hidratacion. */
  hydrated: boolean;
  decisions: Record<string, SupplyDecision>;
  log: DecisionLogEntry[];
  statusOf: (materialId: string) => DecisionStatus;
  noteOf: (materialId: string) => string;
  pendingCount: (materialIds: string[]) => number;
  decide: (recommendation: SupplyRecommendation, status: DecisionStatus, note: string) => void;
  clearAll: () => void;
}

export function useSupplyDecisions(): SupplyDecisionsState {
  const [state, setState] = useState<StoredState>(EMPTY_STATE);
  const [hydrated, setHydrated] = useState(false);

  /* El estado guardado se lee despues del montaje: en el servidor no existe
     `localStorage` y el HTML debe coincidir con el primer render del cliente. */
  useEffect(() => {
    setState(readStoredState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(SUPPLY_DECISIONS_STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* Modo privado o cuota agotada: la demo sigue funcionando en memoria. */
    }
  }, [state, hydrated]);

  const decide = useCallback(
    (recommendation: SupplyRecommendation, status: DecisionStatus, note: string) => {
      const timestamp = new Date().toISOString();
      const trimmedNote = note.trim();

      /* Impacto estimado registrado con la decision: si se aprueba, lo que
         cuesta la compra; en cualquier otro caso, el margen que queda expuesto. */
      const estimatedImpact =
        status === "aprobada" ? recommendation.estimatedCost : recommendation.inactionCost;

      const entry: DecisionLogEntry = {
        id: `${recommendation.materialId}-${timestamp}`,
        timestamp,
        materialId: recommendation.materialId,
        materialCode: recommendation.materialCode,
        materialName: recommendation.materialName,
        recommendedAction: recommendation.actionLabel,
        risk: recommendation.risk,
        user: DEMO_USER,
        status,
        note: trimmedNote,
        estimatedImpact,
      };

      setState((current) => ({
        decisions: {
          ...current.decisions,
          [recommendation.materialId]: {
            materialId: recommendation.materialId,
            status,
            note: trimmedNote,
            updatedAt: timestamp,
          },
        },
        log: [entry, ...current.log].slice(0, LOG_LIMIT),
      }));
    },
    [],
  );

  const clearAll = useCallback(() => setState(EMPTY_STATE), []);

  const statusOf = useCallback(
    (materialId: string): DecisionStatus => state.decisions[materialId]?.status ?? "pendiente",
    [state.decisions],
  );

  const noteOf = useCallback(
    (materialId: string): string => state.decisions[materialId]?.note ?? "",
    [state.decisions],
  );

  const pendingCount = useCallback(
    (materialIds: string[]): number =>
      materialIds.filter((id) => (state.decisions[id]?.status ?? "pendiente") === "pendiente")
        .length,
    [state.decisions],
  );

  return useMemo(
    () => ({
      hydrated,
      decisions: state.decisions,
      log: state.log,
      statusOf,
      noteOf,
      pendingCount,
      decide,
      clearAll,
    }),
    [hydrated, state.decisions, state.log, statusOf, noteOf, pendingCount, decide, clearAll],
  );
}
