# OptiFlow Industrial — Planificación de Producción y Abastecimiento

Caso de estudio **simulado** de planificación semanal de producción para una planta de productos de limpieza y envases plásticos. La aplicación genera un plan de producción heurístico, lo compara contra un plan base menos eficiente y valoriza ambos con un modelo económico transparente.

> **Aviso importante:** todos los datos (demanda, capacidades, costos, proveedores) son sintéticos y generados con una semilla fija. Los resultados no corresponden a ninguna empresa real ni representan ahorros obtenidos en una operación real. El objetivo es demostrar el método de análisis y la trazabilidad de las decisiones.

---

## Qué resuelve

Una planta con 3 líneas, 18 productos terminados y 3 familias debe decidir cada semana **qué producir, en qué línea y en qué orden**. Los objetivos se contradicen entre sí:

| Objetivo | Se logra… | Pero empeora… |
| --- | --- | --- |
| Evitar quiebres de stock | produciendo más y antes | el inventario y las horas extra |
| Minimizar cambios de formato | agrupando familias | el nivel de servicio de lo que se posterga |
| Evitar horas extra | ajustando el programa a la jornada | los faltantes |
| No inflar el inventario | produciendo justo a tiempo | el riesgo de quiebre |

La aplicación pondera los cuatro de forma explícita y muestra cuánto vale, en pesos, la decisión de secuenciamiento.

---

## Stack técnico

- **Next.js 15** (App Router) + **TypeScript** estricto
- **Tailwind CSS 3** con paleta industrial propia
- **Recharts** para gráficos, **lucide-react** para iconografía
- Primitivas de UI propias en estilo shadcn/ui (`class-variance-authority` + `tailwind-merge`), sin dependencia del CLI
- **Sin servicios externos, sin base de datos, sin variables de entorno y sin API keys.** Todo el dataset se genera en memoria a partir de una semilla.

---

## Instalación y ejecución

Requisitos: Node.js 18.17 o superior (probado en Node 24).

```bash
npm install
```

```bash
npm run dev
```

La aplicación queda disponible en `http://localhost:3000`.

Otros comandos:

```bash
npm run build
```

```bash
npm run lint
```

```bash
npm run typecheck
```

```bash
npm run verify
```

`npm run verify` recalcula los presets y los escenarios extremos de los tres módulos (planificación, balanceo de línea y torre de abastecimiento), imprime sus indicadores y comprueba que dos corridas consecutivas den exactamente el mismo resultado. En el módulo de abastecimiento verifica además la coherencia del caso (BOM, materiales y órdenes referencian entidades existentes), que cada material reciba una única acción principal y que la cobertura nunca divida por cero.

---

## Pantallas

1. **Dashboard** — KPI ejecutivos (nivel de servicio, costo total, diferencia contra el plan base, cambios de formato, horas extra, utilización), comparación de costos, composición del costo, inventario proyectado, alertas operativas priorizadas y resumen de decisiones.
2. **Plan de producción** — vista semanal por día y línea, con familia, unidades, minutos, setups y horas extra; comparación completa contra el plan base; y el detalle de cada corrida con la regla que la generó.
3. **Inventario y abastecimiento** — cobertura por producto terminado, consumo de materias primas según la BOM y exposición por proveedor.
4. **Simulador de escenarios** — variación de demanda (−20% a +30%), reducción de capacidad, aumento de tiempos de setup, multiplicador del costo de faltante y habilitación de horas extra, más tres presets. Todo recalcula el modelo completo.
5. **Torre de abastecimiento** (V2) — traduce la demanda y el plan de producción en consumo de materias primas vía la BOM, calcula cobertura, punto de pedido y stock proyectado, clasifica el riesgo de quiebre, recomienda una acción de compra explicable por material y registra la aprobación humana de cada recomendación.
6. **Balanceo de línea** (V1.1) — caso simulado de una línea de ensamble de 16 tareas: takt time, carga por estación contra el takt, cuello de botella, eficiencia de línea, pérdida por desbalance, brecha de capacidad y costo estimado. Compara la distribución inicial desbalanceada contra el balance recomendado por heurística de peso posicional.
7. **Metodología** — problema, supuestos, estructura de datos, lógica de priorización, fórmula económica, balanceo de línea y capacidad, torre de abastecimiento, desperdicios Lean abordados, limitaciones y roadmap V2.1.

---

## Qué hace realmente el planificador

Ambos planes reciben **el mismo contexto** (mismo pronóstico, misma capacidad, mismos costos), de modo que la comparación sea justa.

### Plan base (referencia)

Planificación manual habitual: recorre los productos en orden comercial fijo (mayor volumen primero), cubre la demanda del día más el stock de seguridad, usa siempre la línea preferida de cada producto, cambia de formato cada vez que el orden lo pide sin evaluar su costo, y recurre a la hora extra apenas queda demanda del día sin cubrir.

### Plan recomendado (heurística constructiva)

1. **Asignación línea–producto**: cada producto se manda a la línea que minimiza `utilización proyectada + penalidad por línea más lenta − bonificación por concentrar su familia`. La carga se estima por **necesidad neta** (demanda + seguridad − stock), no por demanda bruta.
2. **Bloques por familia**: por línea y día se arranca siempre por la familia ya montada, cuyo cambio de formato cuesta cero minutos.
3. **Prioridad por riesgo**: dentro del bloque, primero el producto con menos días de cobertura.
4. **Compuerta económica del setup**: un cambio de formato se ejecuta sólo si el riesgo que evita en los próximos dos días supera su costo. El bloque completo se simula antes de comprometer el setup.
5. **Extensión de corrida**: la capacidad ociosa se usa para cubrir también el día siguiente y evitar un setup mañana, con techo de cobertura máxima para no generar sobrestock.
6. **Derivación a línea alternativa** para los faltantes que siguen abiertos.
7. **Hora extra como último recurso**, sólo si el faltante evitado supera su costo.

Es una **heurística golosa con compuertas económicas explícitas**, no un óptimo matemático. La aplicación lo declara en cada pantalla donde muestra el plan.

### Modelo económico

```
costo_setup      = Σ (minutos_setup / 60 × costo_horario_setup(línea))
costo_hora_extra = Σ (minutos_hora_extra / 60 × costo_hora_extra(línea))
costo_inventario = Σ (stock_final(producto, día) × costo_mantener(producto))
costo_faltante   = Σ (unidades_no_atendidas × costo_faltante(producto))
costo_total      = costo_setup + costo_hora_extra + costo_inventario + costo_faltante
```

El **costo evitado** tiene una única definición en todo el sistema:

```
costo_evitado = costo_total(plan base) − costo_total(plan recomendado)
```

Si el resultado es negativo, la aplicación lo informa como **empeoramiento del escenario**, nunca como ahorro. No existe ninguna otra métrica de ahorro.

---

## V1.1 — Módulo de balanceo de línea

Segundo caso simulado, independiente del planificador semanal: una **línea de ensamble de envases dosificadores** con 16 tareas, 5 etapas (preparación, ensamble, llenado, control de calidad y embalaje) y 16 relaciones de precedencia explícitas.

### Cálculos

```
tiempo_disponible_diario = minutos_por_turno × 60 × cantidad_de_turnos
takt_time                = tiempo_disponible_diario / demanda_diaria
contenido_de_trabajo     = Σ tiempo_estándar(tarea)
estaciones_teóricas_mín  = techo(contenido_de_trabajo / takt_time)
tiempo_de_ciclo          = máx(carga_total(estación))
capacidad_diaria         = piso(tiempo_disponible_diario / tiempo_de_ciclo)
eficiencia_de_línea      = contenido_de_trabajo / (estaciones × tiempo_de_ciclo)
pérdida_por_desbalance   = 1 − eficiencia_de_línea
tiempo_ocioso_por_ciclo  = (estaciones × tiempo_de_ciclo) − contenido_de_trabajo
brecha_de_capacidad      = capacidad_diaria − demanda_diaria
```

### Modelo económico del módulo

```
costo_estaciones  = estaciones × (tiempo_disponible_diario / 3600) × 14.500
costo_no_atendido = unidades_no_atendidas × 2.800
costo_total       = costo_estaciones + costo_no_atendido

costo_del_ocio    = costo_estaciones × pérdida_por_desbalance   (indicador, NO se suma)
diferencia        = costo_total(inicial) − costo_total(recomendado)
```

El **costo del tiempo ocioso no se suma como concepto aparte**: es la porción del costo de estaciones que se paga sin agregar valor. Sumarlo además del costo de estaciones contaría dos veces el mismo peso. Cuando la diferencia es favorable se informa siempre como **diferencia estimada dentro del caso simulado**; si es negativa, como empeoramiento del escenario.

### Heurística: peso posicional (RPW)

1. Peso posicional de cada tarea = tiempo propio + tiempo de todas sus sucesoras (cierre transitivo).
2. Orden por peso posicional descendente, con desempate por código de tarea.
3. Se carga la estación abierta con la primera tarea elegible que entre en el límite de ciclo; tras cada colocación se vuelve a recorrer desde la de mayor peso.
4. Precedencias siempre respetadas: una tarea sólo se asigna si todas sus predecesoras ya lo están.
5. Se abre una estación nueva cuando ninguna tarea elegible entra en el remanente.
6. **Pasada de suavizado**: con la cantidad de estaciones ya definida, se busca el menor tiempo de ciclo entero que siga entrando en ellas.

No es un óptimo matemático: el balanceo de líneas (SALBP) es NP-difícil y el peso posicional es una regla constructiva golosa. La aplicación lo declara como **recomendación heurística** en la pantalla y en la metodología.

---

## V2 — Torre de abastecimiento

Tercer módulo del proyecto. El planificador decide **qué producir** y el balanceo **cómo repartir el trabajo**; la torre responde **qué comprar, cuánto y cuándo** para que el plan sea ejecutable.

El caso amplía el de la V1: **17 materias primas** (las 12 originales más tapas, dosificador, film, pallet y pote), **6 proveedores** (los 5 originales más uno nuevo para el dosificador), una **BOM completa por producto** y **10 órdenes de compra abiertas** en distintos estados.

> Convención: todos los plazos del módulo (cobertura, lead time, horizonte, fechas de órdenes) se expresan en **días hábiles de planta**, la misma unidad que el horizonte del plan. Así la cobertura de un material y el lead time de su proveedor son directamente comparables.

### Cálculos

```
consumo_diario    = SUM_productos( demanda_diaria x consumo_por_unidad ) x (1 + scrap)
consumo_horizonte = consumo_diario x días_del_horizonte
stock_proyectado  = stock_disponible + órdenes_firmes_del_horizonte - consumo_horizonte
cobertura_días    = stock_disponible / consumo_diario
stock_seguridad   = días_de_seguridad x consumo_diario
punto_de_pedido   = (consumo_diario x lead_time_promedio) + stock_seguridad
```

Si un material no tiene consumo en el horizonte no se divide: se informa como *sin consumo* y queda fuera de promedios y gráficos.

**Orden firme** = confirmada o en tránsito, con llegada estimada dentro del horizonte. Las retrasadas y las pendientes de confirmación no se computan: son el riesgo que el tablero debe mostrar.

### Clasificación de riesgo

Reglas explícitas, evaluadas en orden y excluyentes. La distinción central es entre un quiebre **evitable** y uno **inevitable**: que el stock proyectado cierre negativo solo significa que hay que comprar durante el horizonte.

| Riesgo | Regla exacta |
| --- | --- |
| **Crítico** | días hasta el quiebre ≤ días hasta la próxima entrega factible (comprar hoy ya no llega a tiempo) |
| **Alto** | cobertura < lead time, o el material tiene una orden abierta retrasada |
| **Medio** | cobertura < lead time máximo, o confiabilidad del proveedor < 90%, o stock < punto de pedido |
| **Bajo** | ninguna de las anteriores |

### Motor de recomendaciones

Árbol de decisión determinista: cada material recibe **una única acción principal** entre `Comprar de forma urgente`, `Anticipar o reprogramar orden`, `Emitir compra normal`, `Consolidar compra con otros materiales`, `Monitorear` y `No comprar`.

```
requerimiento_neto = consumo_diario x (lead_time + ciclo_de_revisión)
                     + stock_seguridad - stock_disponible - órdenes_firmes
cantidad_sugerida  = redondear_arriba( max(requerimiento_neto, faltante_proyectado),
                                       cantidad_mínima_del_proveedor )
```

Cada recomendación incluye razón explicable, riesgo, cantidad, proveedor, fecha límite de decisión, costo estimado, consecuencia de no actuar y nivel de confianza. **El nivel de confianza refleja la calidad de los datos simulados** (confiabilidad del proveedor, órdenes pendientes de confirmación, existencia de consumo), no la certeza de un modelo ni de una IA. Todos los textos se arman con los números del escenario: cambian cuando el escenario cambia.

### Costos estimados

- **Costo de la compra sugerida** = cantidad × precio del proveedor (costo unitario × factor de precio).
- **Costo de no actuar** = el faltante proyectado se reparte entre los productos que consumen el material en proporción a su consumo, se convierte a unidades de producto terminado y se valoriza al margen de contribución.
- **Costo estimado en riesgo (KPI)** = costo de no actuar **solo de los materiales en riesgo alto o crítico**.

### Intervención humana (HITL)

Ninguna recomendación se ejecuta sola. El planificador la marca como **aprobada**, **rechazada** o **requiere revisión** y puede dejar una nota. Cada decisión genera una entrada en el registro con fecha y hora, material, recomendación original, riesgo, usuario demostrativo (`Planificador`), decisión, nota e impacto estimado.

Las decisiones se guardan **únicamente en el `localStorage` del navegador** (clave `optiflow.torre-abastecimiento.decisiones.v2`), a modo de demostración: no hay backend, no se emite ninguna orden de compra real y no se envía información a ningún servicio externo. Sobreviven a recargas de la página y se pueden borrar desde la misma pantalla.

### Escenarios

Variación de demanda (−20% a +30%), retraso adicional de proveedores (0 a 10 días hábiles), variación de confiabilidad (−20 a +10 p.p.), consumo adicional por scrap (0 a +10%) y horizonte de análisis (7, 14 o 30 días hábiles). Presets: *Operación estable*, *Demanda elevada*, *Proveedor retrasado* y *Riesgo de quiebre*.

El módulo **reutiliza la demanda** del planificador (mismo pronóstico base) pero **mantiene su propio estado de escenario**, igual que el balanceo. Las variables del simulador global (capacidad de línea, tiempos de setup, multiplicador de faltante de producto terminado) no intervienen en una decisión de compra, y acoplarlas habría hecho que mover un control de compras alterara el plan de producción. Los datos originales de la V1 no se modifican: el planificador, el inventario y el balanceo siguen dando exactamente los mismos números.

---

## Estructura del proyecto

```
src/
  app/                        Rutas (App Router): dashboard, plan, inventario, torre, balanceo, simulador, metodología
  components/
    balance/                  Tablero de estaciones y tablas del balanceo de línea (V1.1)
    charts/                   Gráficos Recharts y paleta compartida
    dashboard/                Alertas y resumen de decisiones
    inventory/                Tablas de producto terminado, materias primas y proveedores
    layout/                   Shell, navegación y barra de escenario
    plan/                     Grilla semanal y tablas de comparación
    supply/                   Tablas, panel de recomendaciones y registro de decisiones (V2)
    ui/                       Primitivas (card, badge, button, controles, KPI)
  lib/
    data/
      config.ts               Parámetros del caso: líneas, costos, productos, BOM, proveedores
      generate.ts             Generador determinista del dataset
      dataset.ts              Dataset único e índices de acceso
      line-config.ts          Parámetros del caso de balanceo: tareas, precedencias, turnos, costos
      assembly-line.ts        Caso de línea validado (sin ciclos) e índices de sucesoras
      supply-config.ts        Parámetros de la torre: materiales, proveedores, BOM ampliada, órdenes
      supply-catalog.ts       Catálogo derivado: stock dimensionado, BOM por producto, órdenes fechadas
    balance/
      metrics.ts              Fórmulas: takt, ciclo, capacidad, eficiencia, desbalance y costo
      heuristic.ts            Peso posicional (RPW), asignación y pasada de suavizado
      insights.ts             Lecturas operativas deterministas
      scenarios.ts            Presets y normalización del escenario de balanceo
      index.ts                runBalance(): orquestación del módulo
    planning/
      forecast.ts             Pronóstico de demanda a partir del historial
      context.ts              Contexto de planificación ajustado por escenario
      baseline.ts             Plan base
      heuristic.ts            Plan recomendado
      evaluate.ts             Modelo económico y comparación
      insights.ts             Cobertura de materias primas, alertas y decisiones
      scenarios.ts            Presets y normalización de escenarios
      index.ts                runPlanning(): orquestación del ciclo completo
    supply/
      context.ts              Contexto de abastecimiento ajustado por escenario
      metrics.ts              Fórmulas: consumo, cobertura, punto de pedido, riesgo y proyección
      recommendations.ts      Motor de reglas, textos explicables y lecturas operativas
      scenarios.ts            Presets y normalización del escenario de abastecimiento
      index.ts                runSupply(): orquestación del módulo
    dates.ts, format.ts, rng.ts, types.ts, utils.ts
  state/
    scenario-context.tsx      Estado global del escenario de planificación
    use-balance-scenario.ts   Estado del escenario de balanceo de línea
    use-supply-scenario.ts    Estado del escenario de abastecimiento
    use-supply-decisions.ts   Aprobaciones y registro de decisiones (localStorage)
scripts/
  verify.ts                   Verificación de reproducibilidad y coherencia
```

---

## Reproducibilidad

El dataset proviene de `generateDataset(20260302)`, con un generador pseudoaleatorio con semilla (mulberry32). El planificador no usa valores aleatorios: dado un escenario, devuelve siempre el mismo plan, tanto en el servidor como en el navegador. Los formateadores numéricos están implementados a mano (no se usa `Intl`) para que el render del servidor y el del cliente coincidan exactamente.

Cambiar `SIMULATION_SEED` en `src/lib/data/config.ts` genera una planta distinta pero igualmente reproducible.

---

## Alcance actual y roadmap V2.1

**Incluido:** dashboard, plan de producción con heurística y plan base comparativo, modelo económico, inventario y abastecimiento, balanceo de línea (V1.1), torre de abastecimiento con motor de recomendaciones y aprobación humana (V2), simulador de escenarios por módulo, datos sintéticos reproducibles, visualizaciones y documentación de metodología.

**Deliberadamente fuera del proyecto:** autenticación, base de datos, APIs externas, variables de entorno, chatbot, RAG, IA generativa, carga de archivos reales, integración con proveedores y despliegue automático. La única persistencia es el `localStorage` del navegador para las decisiones de compra.

**Previsto para la V2.1:** carga y lectura de cotizaciones, remitos y facturas reales; extracción de datos documentales; comparación automática de precios, cantidades y fechas; RAG sobre políticas de compra y fichas técnicas; trazabilidad y evaluación de recomendaciones contra lo efectivamente ocurrido; e integración con una fuente de datos real.

Ver [`DATA_ASSUMPTIONS.md`](./DATA_ASSUMPTIONS.md) para el detalle completo de supuestos del caso simulado.
