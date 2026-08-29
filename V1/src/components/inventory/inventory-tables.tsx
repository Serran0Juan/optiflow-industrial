"use client";

import { Badge } from "@/components/ui/badge";
import { TableWrap } from "@/components/ui/layout-bits";
import { dataset, familiesById } from "@/lib/data/dataset";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import type { MaterialCoverage, PlanEvaluation, PlanningResult } from "@/lib/types";

/** Situacion de inventario de producto terminado bajo el plan recomendado. */
export function FinishedGoodsTable({
  evaluation,
  result,
}: {
  evaluation: PlanEvaluation;
  result: PlanningResult;
}) {
  const rows = dataset.products.map((product) => {
    const productDays = evaluation.productDays.filter((row) => row.productId === product.id);
    const demand = productDays.reduce((acc, row) => acc + row.demand, 0);
    const produced = productDays.reduce((acc, row) => acc + row.produced, 0);
    const unmet = productDays.reduce((acc, row) => acc + row.unmet, 0);
    const closing = productDays[productDays.length - 1].closingStock;
    const minCover = Math.min(...productDays.map((row) => row.coverDays));
    const closingCover = productDays[productDays.length - 1].coverDays;
    const initialCover = demand > 0 ? product.initialStock / (demand / productDays.length) : 99;

    const status =
      unmet > 0
        ? { label: "Quiebre", variant: "danger" as const }
        : minCover < product.safetyStockDays
          ? { label: "Riesgo", variant: "warning" as const }
          : closingCover > product.maxCoverDays
            ? { label: "Exceso", variant: "neutral" as const }
            : { label: "Cubierto", variant: "positive" as const };

    return {
      product,
      demand,
      produced,
      unmet,
      closing,
      closingCover,
      initialCover,
      status,
      lineId: result.recommended.lineAssignments[product.id],
    };
  });

  return (
    <TableWrap>
      <thead>
        <tr>
          <th>Producto</th>
          <th>Familia</th>
          <th>Linea</th>
          <th className="text-right">Stock inicial</th>
          <th className="text-right">Cobertura inicial</th>
          <th className="text-right">Demanda proyectada</th>
          <th className="text-right">Produccion planificada</th>
          <th className="text-right">Stock final</th>
          <th className="text-right">Cobertura final</th>
          <th className="text-right">No atendido</th>
          <th>Riesgo</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const family = familiesById[row.product.familyId];
          return (
            <tr key={row.product.id}>
              <td className="whitespace-nowrap">
                <span className="font-medium text-navy-800">{row.product.sku}</span>
                <span className="ml-1.5 text-steel-500">{row.product.name}</span>
              </td>
              <td>
                <Badge className={family.badgeClass}>{family.id}</Badge>
              </td>
              <td className="whitespace-nowrap font-medium text-steel-700">{row.lineId}</td>
              <td className="numeric">{formatNumber(row.product.initialStock)}</td>
              <td className="numeric">{formatNumber(row.initialCover, 1)} d</td>
              <td className="numeric">{formatNumber(row.demand)}</td>
              <td className="numeric">{formatNumber(row.produced)}</td>
              <td className="numeric">{formatNumber(row.closing)}</td>
              <td className="numeric">{formatNumber(row.closingCover, 1)} d</td>
              <td className="numeric">{row.unmet > 0 ? formatNumber(row.unmet) : "-"}</td>
              <td>
                <Badge variant={row.status.variant}>{row.status.label}</Badge>
              </td>
            </tr>
          );
        })}
      </tbody>
    </TableWrap>
  );
}

const MATERIAL_STATUS = {
  ok: { label: "Cubierto", variant: "positive" as const },
  atencion: { label: "Atencion", variant: "warning" as const },
  critico: { label: "Critico", variant: "danger" as const },
};

/** Consumo y cobertura de materias primas derivados del plan recomendado. */
export function MaterialsTable({ materials }: { materials: MaterialCoverage[] }) {
  return (
    <TableWrap>
      <thead>
        <tr>
          <th>Materia prima</th>
          <th>Proveedor</th>
          <th className="text-right">Stock inicial</th>
          <th className="text-right">Consumo requerido</th>
          <th className="text-right">Stock final</th>
          <th className="text-right">Cobertura</th>
          <th className="text-right">Lead time</th>
          <th className="text-right">Valorizacion final</th>
          <th>Alerta</th>
        </tr>
      </thead>
      <tbody>
        {materials.map((material) => {
          const supplier = dataset.suppliers.find((item) => item.id === material.supplierId)!;
          const status = MATERIAL_STATUS[material.status];
          return (
            <tr key={material.materialId}>
              <td className="whitespace-nowrap">
                <span className="font-medium text-navy-800">{material.code}</span>
                <span className="ml-1.5 text-steel-500">{material.name}</span>
              </td>
              <td className="whitespace-nowrap text-steel-600">{supplier.name}</td>
              <td className="numeric">
                {formatNumber(material.initialStock)} {material.unit}
              </td>
              <td className="numeric">
                {formatNumber(material.requiredUnits)} {material.unit}
              </td>
              <td className="numeric">
                {formatNumber(material.closingStock)} {material.unit}
              </td>
              <td className="numeric">
                {formatNumber(material.coverageDays, 1)} d
                <span className="block text-[11px] text-steel-400">
                  min {formatNumber(material.minCoverageDays, 0)} d
                </span>
              </td>
              <td className="numeric">{material.leadTimeDays} d</td>
              <td className="numeric">
                {formatCurrency(Math.max(0, material.closingStock) * material.unitCost)}
              </td>
              <td>
                <Badge variant={status.variant}>{status.label}</Badge>
              </td>
            </tr>
          );
        })}
      </tbody>
    </TableWrap>
  );
}

/** Proveedores con su lead time, confiabilidad simulada y riesgo asociado. */
export function SuppliersTable({ materials }: { materials: MaterialCoverage[] }) {
  return (
    <TableWrap>
      <thead>
        <tr>
          <th>Proveedor</th>
          <th className="text-right">Lead time</th>
          <th className="text-right">Entregas por semana</th>
          <th className="text-right">Confiabilidad simulada</th>
          <th>Materias primas abastecidas</th>
          <th>Riesgo</th>
        </tr>
      </thead>
      <tbody>
        {dataset.suppliers.map((supplier) => {
          const supplied = materials.filter((material) => material.supplierId === supplier.id);
          const flagged = supplied.filter((material) => material.status !== "ok");
          const riskScore =
            (supplier.reliability < 0.9 ? 2 : supplier.reliability < 0.95 ? 1 : 0) +
            (supplier.leadTimeDays >= 10 ? 2 : supplier.leadTimeDays >= 6 ? 1 : 0) +
            (flagged.length > 0 ? 1 : 0);
          const risk =
            riskScore >= 4
              ? { label: "Alto", variant: "danger" as const }
              : riskScore >= 2
                ? { label: "Medio", variant: "warning" as const }
                : { label: "Bajo", variant: "positive" as const };

          return (
            <tr key={supplier.id}>
              <td className="whitespace-nowrap font-medium text-navy-800">{supplier.name}</td>
              <td className="numeric">{supplier.leadTimeDays} d</td>
              <td className="numeric">{supplier.deliveriesPerWeek}</td>
              <td className="numeric">{formatPercent(supplier.reliability, 0)}</td>
              <td className="text-steel-600">
                {supplied.map((material) => material.code).join(", ") || "-"}
                {flagged.length > 0 ? (
                  <span className="ml-1.5 text-warning-600">
                    ({flagged.length} con cobertura ajustada)
                  </span>
                ) : null}
              </td>
              <td>
                <Badge variant={risk.variant}>{risk.label}</Badge>
              </td>
            </tr>
          );
        })}
      </tbody>
    </TableWrap>
  );
}
