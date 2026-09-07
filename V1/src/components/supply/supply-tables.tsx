"use client";

import { TableWrap } from "@/components/ui/layout-bits";
import { MATERIAL_CATEGORY_LABELS } from "@/lib/data/supply-config";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { SUPPLY_ACTION_LABELS } from "@/lib/supply/recommendations";
import type {
  DecisionStatus,
  MaterialSupplyRow,
  OpenOrderRow,
  SupplyRecommendation,
} from "@/lib/types";
import {
  AbcBadge,
  DecisionStatusBadge,
  formatCoverage,
  OrderStatusBadge,
  policyLabel,
  RiskBadge,
} from "./supply-bits";

/**
 * Tabla principal de materiales: consumo, cobertura, riesgo, recomendacion y
 * estado de la decision humana. El filtrado se resuelve en la pagina: aca solo
 * se renderiza lo que llega por props.
 */
export function MaterialsSupplyTable({
  rows,
  recommendations,
  decisions,
}: {
  rows: MaterialSupplyRow[];
  recommendations: Record<string, SupplyRecommendation>;
  decisions: Record<string, DecisionStatus>;
}) {
  if (rows.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-steel-500 sm:px-5">
        Ningun material cumple con los filtros seleccionados.
      </p>
    );
  }

  return (
    <TableWrap>
      <thead>
        <tr>
          <th>Material</th>
          <th>ABC / politica</th>
          <th>Proveedor</th>
          <th className="numeric">Stock actual</th>
          <th className="numeric">Posicion inv.</th>
          <th className="numeric">Consumo proyectado</th>
          <th className="numeric">Cobertura</th>
          <th className="numeric">Lead time</th>
          <th className="numeric">Stock seguridad</th>
          <th className="numeric">Punto de pedido</th>
          <th className="numeric">Stock proyectado</th>
          <th>Riesgo</th>
          <th>Recomendacion</th>
          <th className="numeric">Cantidad sugerida</th>
          <th>Aprobacion</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const recommendation = recommendations[row.material.id];
          const status = decisions[row.material.id] ?? "pendiente";
          return (
            <tr key={row.material.id}>
              <td>
                <span className="block font-medium text-navy-800">{row.material.code}</span>
                <span className="block text-xs text-steel-500">
                  {row.material.name} &middot; {MATERIAL_CATEGORY_LABELS[row.material.category]}
                </span>
              </td>
              <td>
                <div className="flex flex-col items-start gap-1">
                  <AbcBadge
                    abcClass={row.abc.abcClass}
                    title={`Puesto ${row.abc.rank} por consumo valorizado: ${formatPercent(row.abc.valueShare, 1)} del total, ${formatPercent(row.abc.cumulativeShare, 1)} acumulado.`}
                  />
                  <span className="text-xs text-steel-500">
                    {policyLabel(row.reviewPolicy)}
                  </span>
                  <span className="text-xs text-steel-500">
                    NS {formatPercent(row.serviceLevel, 2)} (Z {formatNumber(row.serviceLevelZ, 2)})
                  </span>
                </div>
              </td>
              <td>
                <span className="block">{row.supplier.name}</span>
                <span className="block text-xs text-steel-500">
                  Confiabilidad {formatNumber(row.effectiveReliability * 100, 0)}% &middot; minimo{" "}
                  {formatNumber(row.supplier.minOrderQuantity)} {row.material.unit}
                </span>
              </td>
              <td className="numeric">
                {formatNumber(row.stockOnHand)} {row.material.unit}
              </td>
              <td className="numeric">
                {formatNumber(row.inventoryPosition)} {row.material.unit}
              </td>
              <td className="numeric">
                {formatNumber(row.projectedConsumption)} {row.material.unit}
                <span className="block text-xs text-steel-500">
                  {formatNumber(row.dailyConsumption, 1)} / dia
                </span>
              </td>
              <td className="numeric">{formatCoverage(row.coverageDays)}</td>
              <td className="numeric">
                {formatNumber(row.effectiveLeadTimeDays)} d
                <span className="block text-xs text-steel-500">
                  sigma {formatNumber(row.leadTimeSigmaDays, 1)} d
                </span>
              </td>
              <td className="numeric">
                {formatNumber(row.safetyStockUnits)} {row.material.unit}
                <span className="block text-xs text-steel-500">
                  {formatPercent(row.sigmaLeadTimeShare, 0)} por plazo
                </span>
              </td>
              <td className="numeric">
                {formatNumber(row.reorderPoint)} {row.material.unit}
                <span className="block text-xs text-steel-500">
                  {row.reviewPolicy === "continua" ? "punto de pedido r" : "techo de stock R"}
                </span>
              </td>
              <td
                className={`numeric ${row.projectedStock < 0 ? "font-semibold text-danger-600" : ""}`}
              >
                {formatNumber(row.projectedStock)} {row.material.unit}
              </td>
              <td>
                <RiskBadge risk={row.risk} title={row.riskRule} />
              </td>
              <td>
                <span className="block text-xs font-medium text-navy-800">
                  {recommendation ? recommendation.actionLabel : SUPPLY_ACTION_LABELS["no-comprar"]}
                </span>
                {recommendation && recommendation.estimatedCost > 0 ? (
                  <span className="block text-xs text-steel-500">
                    {formatCurrency(recommendation.estimatedCost)}
                  </span>
                ) : null}
              </td>
              <td className="numeric">
                {recommendation && recommendation.quantity > 0
                  ? `${formatNumber(recommendation.quantity)} ${row.material.unit}`
                  : "-"}
              </td>
              <td>
                <DecisionStatusBadge status={status} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </TableWrap>
  );
}

/** Tabla de ordenes de compra abiertas con su retraso estimado e impacto. */
export function OpenOrdersTable({ orders }: { orders: OpenOrderRow[] }) {
  return (
    <TableWrap>
      <thead>
        <tr>
          <th>Orden</th>
          <th>Proveedor</th>
          <th>Material</th>
          <th className="numeric">Cantidad</th>
          <th>Fecha prometida</th>
          <th>Estado</th>
          <th className="numeric">Retraso estimado</th>
          <th>Impacto potencial</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((row) => (
          <tr key={row.order.id}>
            <td>
              <span className="block font-medium text-navy-800">{row.order.id}</span>
              <span className="block text-xs text-steel-500">
                Emitida {row.order.issuedDate} &middot; {formatCurrency(row.order.cost)}
              </span>
            </td>
            <td>{row.supplierName}</td>
            <td>
              <span className="block">{row.materialCode}</span>
              <span className="block text-xs text-steel-500">{row.materialName}</span>
            </td>
            <td className="numeric">{formatNumber(row.order.quantity)}</td>
            <td>
              <span className="block">{row.order.promisedDate}</span>
              <span className="block text-xs text-steel-500">
                Estimada {row.adjustedArrivalDate}
              </span>
            </td>
            <td>
              <OrderStatusBadge status={row.order.status} />
            </td>
            <td className={`numeric ${row.delayDays > 0 ? "font-semibold text-danger-600" : ""}`}>
              {row.delayDays > 0 ? `+${formatNumber(row.delayDays)} d` : "En fecha"}
            </td>
            <td className="max-w-md text-xs leading-relaxed text-steel-600">{row.impact}</td>
          </tr>
        ))}
      </tbody>
    </TableWrap>
  );
}
