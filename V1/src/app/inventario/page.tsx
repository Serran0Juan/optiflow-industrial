"use client";

import { Boxes, PackageSearch, TriangleAlert } from "lucide-react";
import {
  FinishedGoodsTable,
  MaterialsTable,
  SuppliersTable,
} from "@/components/inventory/inventory-tables";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { Note, PageHeader } from "@/components/ui/layout-bits";
import { dataset } from "@/lib/data/dataset";
import { formatNumber } from "@/lib/format";
import { useScenario } from "@/state/scenario-context";

export default function InventoryPage() {
  const { result } = useScenario();
  const evaluation = result.comparison.recommended;
  const materials = result.materials;

  const productsAtRisk = dataset.products.filter((product) => {
    const rows = evaluation.productDays.filter((row) => row.productId === product.id);
    const unmet = rows.reduce((acc, row) => acc + row.unmet, 0);
    const minCover = Math.min(...rows.map((row) => row.coverDays));
    return unmet > 0 || minCover < product.safetyStockDays;
  }).length;

  const materialsAtRisk = materials.filter((material) => material.status !== "ok").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventario y abastecimiento"
        description="Situacion de stock de producto terminado bajo el plan recomendado, consumo de materias primas segun la lista de materiales y exposicion por proveedor."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          label="Inventario al cierre del horizonte"
          value={`${formatNumber(evaluation.closingInventoryUnits)} u`}
          icon={Boxes}
          hint={`Cobertura promedio de ${formatNumber(evaluation.averageCoverDays, 1)} dias de demanda proyectada.`}
        />
        <KpiCard
          label="Productos con riesgo de quiebre"
          value={`${productsAtRisk} de ${dataset.products.length}`}
          icon={TriangleAlert}
          tone={productsAtRisk > 0 ? "warning" : "positive"}
          hint="Incluye faltantes efectivos y productos que caen por debajo de su stock de seguridad."
        />
        <KpiCard
          label="Materias primas con cobertura ajustada"
          value={`${materialsAtRisk} de ${materials.length}`}
          icon={PackageSearch}
          tone={materialsAtRisk > 2 ? "warning" : materialsAtRisk > 0 ? "neutral" : "positive"}
          hint="Cobertura por debajo del minimo definido para el lead time del proveedor."
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Producto terminado</CardTitle>
          <CardDescription>
            Stock inicial, demanda proyectada del horizonte, produccion planificada por el plan
            recomendado, stock final y cobertura resultante para cada uno de los 18 SKU.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 py-0">
          <FinishedGoodsTable evaluation={evaluation} result={result} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Materias primas</CardTitle>
          <CardDescription>
            Consumo calculado a partir de la lista de materiales (BOM) de cada producto y de las
            unidades efectivamente programadas en el plan recomendado.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 py-0">
          <MaterialsTable materials={materials} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Proveedores</CardTitle>
          <CardDescription>
            Lead time, frecuencia de entrega y confiabilidad simulada. El riesgo combina esos tres
            factores con la cobertura de las materias primas que abastece cada proveedor.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 py-0">
          <SuppliersTable materials={materials} />
        </CardContent>
      </Card>

      <Note tone="info" title="Alcance de esta pantalla">
        Aca el abastecimiento se <strong>verifica pero no restringe</strong> el plan de produccion: se
        calcula el consumo de materias primas segun la BOM y se informa la cobertura resultante, sin
        frenar corridas por falta de insumos. El analisis de riesgo de quiebre, el punto de pedido, las
        recomendaciones de compra explicables y el circuito de aprobacion humana viven en la{" "}
        <strong>Torre de abastecimiento</strong>. La restriccion dura por disponibilidad de materia
        prima sobre el plan y la emision de ordenes reales siguen fuera del alcance del proyecto.
      </Note>
    </div>
  );
}
