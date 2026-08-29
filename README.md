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

`npm run verify` recalcula los tres presets y cuatro escenarios extremos, imprime los indicadores de ambos planes y comprueba que dos corridas consecutivas den exactamente el mismo resultado.

---

## Pantallas

1. **Dashboard** — KPI ejecutivos (nivel de servicio, costo total, diferencia contra el plan base, cambios de formato, horas extra, utilización), comparación de costos, composición del costo, inventario proyectado, alertas operativas priorizadas y resumen de decisiones.
2. **Plan de producción** — vista semanal por día y línea, con familia, unidades, minutos, setups y horas extra; comparación completa contra el plan base; y el detalle de cada corrida con la regla que la generó.
3. **Inventario y abastecimiento** — cobertura por producto terminado, consumo de materias primas según la BOM y exposición por proveedor.
4. **Simulador de escenarios** — variación de demanda (−20% a +30%), reducción de capacidad, aumento de tiempos de setup, multiplicador del costo de faltante y habilitación de horas extra, más tres presets. Todo recalcula el modelo completo.
5. **Balanceo de línea** (V1.1) — caso simulado de una línea de ensamble de 16 tareas: takt time, carga por estación contra el takt, cuello de botella, eficiencia de línea, pérdida por desbalance, brecha de capacidad y costo estimado. Compara la distribución inicial desbalanceada contra el balance recomendado por heurística de peso posicional.
6. **Metodología** — problema, supuestos, estructura de datos, lógica de priorización, fórmula económica, balanceo de línea y capacidad, desperdicios Lean abordados, limitaciones y roadmap V2.

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

## Estructura del proyecto

```
src/
  app/                        Rutas (App Router): dashboard, plan, inventario, simulador, balanceo, metodología
  components/
    balance/                  Tablero de estaciones y tablas del balanceo de línea (V1.1)
    charts/                   Gráficos Recharts y paleta compartida
    dashboard/                Alertas y resumen de decisiones
    inventory/                Tablas de producto terminado, materias primas y proveedores
    layout/                   Shell, navegación y barra de escenario
    plan/                     Grilla semanal y tablas de comparación
    ui/                       Primitivas (card, badge, button, controles, KPI)
  lib/
    data/
      config.ts               Parámetros del caso: líneas, costos, productos, BOM, proveedores
      generate.ts             Generador determinista del dataset
      dataset.ts              Dataset único e índices de acceso
      line-config.ts          Parámetros del caso de balanceo: tareas, precedencias, turnos, costos
      assembly-line.ts        Caso de línea validado (sin ciclos) e índices de sucesoras
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
    dates.ts, format.ts, rng.ts, types.ts, utils.ts
  state/
    scenario-context.tsx      Estado global del escenario de planificación
    use-balance-scenario.ts   Estado del escenario de balanceo de línea
scripts/
  verify.ts                   Verificación de reproducibilidad y coherencia
```

---

## Reproducibilidad

El dataset proviene de `generateDataset(20260302)`, con un generador pseudoaleatorio con semilla (mulberry32). El planificador no usa valores aleatorios: dado un escenario, devuelve siempre el mismo plan, tanto en el servidor como en el navegador. Los formateadores numéricos están implementados a mano (no se usa `Intl`) para que el render del servidor y el del cliente coincidan exactamente.

Cambiar `SIMULATION_SEED` en `src/lib/data/config.ts` genera una planta distinta pero igualmente reproducible.

---

## Alcance de la V1 y roadmap V2

**Incluido en la V1:** dashboard, simulador, planificador heurístico, plan base comparativo, modelo económico, datos sintéticos reproducibles, visualizaciones y documentación de metodología.

**Deliberadamente fuera de la V1:** autenticación, base de datos, APIs de IA, chatbot, RAG, carga de archivos reales, integración con proveedores y despliegue.

**Previsto para la V2:** extracción de remitos y facturas, RAG sobre políticas de compra, aprobación humana explícita, trazabilidad de decisiones, logs y evaluación de recomendaciones, órdenes de compra automáticas y restricción dura de abastecimiento.

Ver [`DATA_ASSUMPTIONS.md`](./DATA_ASSUMPTIONS.md) para el detalle completo de supuestos del caso simulado.
