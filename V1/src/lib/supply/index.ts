/**
 * Punto de entrada del modulo Torre de abastecimiento (V2).
 *
 * `runSupply` es una funcion pura: dado un escenario devuelve siempre el mismo
 * resultado, en el servidor y en el navegador. El cache evita recalcular al
 * navegar entre secciones; `force` lo saltea cuando el usuario pide recalcular
 * los riesgos desde la interfaz.
 */
import type { MaterialSupplyRow, SupplyKpis, SupplyResult, SupplyScenario } from "@/lib/types";
import { buildSupplyContext } from "./context";
import { buildMaterialRow, NO_CONSUMPTION_COVERAGE, RISK_RANK } from "./metrics";
import { ACTIONABLE_ACTIONS, buildRecommendations, buildSupplyInsights } from "./recommendations";
import { normalizeSupplyScenario } from "./scenarios";

export * from "./context";
export * from "./metrics";
export * from "./recommendations";
export * from "./scenarios";

const CACHE_LIMIT = 40;
const cache = new Map<string, SupplyResult>();

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function buildKpis(
  rows: MaterialSupplyRow[],
  recommendations: ReturnType<typeof buildRecommendations>,
  delayedOrders: number,
): SupplyKpis {
  const withConsumption = rows.filter((row) => row.coverageDays !== NO_CONSUMPTION_COVERAGE);
  const averageCoverageDays =
    withConsumption.length > 0
      ? withConsumption.reduce((acc, row) => acc + row.coverageDays, 0) / withConsumption.length
      : 0;

  return {
    criticalMaterials: rows.filter((row) => row.risk === "critico").length,
    highRiskMaterials: rows.filter((row) => row.risk === "alto").length,
    averageCoverageDays,
    inventoryValue: rows.reduce((acc, row) => acc + row.inventoryValue, 0),
    /* Solo se computa el margen expuesto por materiales en riesgo alto o
       critico: en los demas el faltante proyectado se evita con una compra
       normal dentro del ciclo de revision, por lo que no esta "en riesgo". */
    costAtRisk: rows
      .filter((row) => row.risk === "critico" || row.risk === "alto")
      .reduce((acc, row) => acc + row.inactionCost, 0),
    delayedOrders,
    actionableRecommendations: recommendations.filter((item) =>
      ACTIONABLE_ACTIONS.includes(item.action),
    ).length,
    materialsBelowReorderPoint: rows.filter((row) => row.stockOnHand < row.reorderPoint).length,
    totalPurchaseCost: recommendations.reduce((acc, item) => acc + item.estimatedCost, 0),
  };
}

export function runSupply(
  scenario: SupplyScenario,
  options: { force?: boolean } = {},
): SupplyResult {
  const normalized = normalizeSupplyScenario(scenario);
  const key = JSON.stringify(normalized);
  if (!options.force) {
    const cached = cache.get(key);
    if (cached) return cached;
  }

  const started = now();
  const ctx = buildSupplyContext(normalized);

  const rows = ctx.materials
    .map((material) => buildMaterialRow(material, ctx))
    .sort(
      (a, b) =>
        RISK_RANK[a.risk] - RISK_RANK[b.risk] ||
        a.coverageDays - b.coverageDays ||
        a.material.code.localeCompare(b.material.code),
    );

  const recommendations = buildRecommendations(rows, ctx);
  const delayedOrders = ctx.orders.filter((order) => order.order.status === "retrasada").length;

  const result: SupplyResult = {
    scenario: normalized,
    startDate: ctx.startDate,
    endDate: ctx.endDate,
    rows,
    orders: ctx.orders,
    recommendations,
    kpis: buildKpis(rows, recommendations, delayedOrders),
    insights: buildSupplyInsights(rows, recommendations, ctx),
    computedInMs: now() - started,
  };

  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(key, result);
  return result;
}
