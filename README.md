# OptiFlow Industrial

**Plataforma de planificación de producción, capacidad, balanceo de línea y abastecimiento.**

> Caso de estudio industrial simulado · Los datos, costos e impactos son supuestos reproducibles y no representan resultados de una empresa real.

**Ver demo online: [https://optiflow-industrial.vercel.app/](https://optiflow-industrial.vercel.app/)**

---

## Descripción ejecutiva

OptiFlow Industrial simula una planta de productos de limpieza y envases plásticos con tres líneas de producción, 18 SKU y una red de proveedores de materia prima. Sobre ese caso, la aplicación construye un plan de producción semanal mediante una heurística explicable, lo compara contra un plan de referencia menos eficiente y valoriza ambos con un modelo económico transparente (costo de setup, horas extra, inventario y faltantes).

El proyecto va más allá de un dashboard de indicadores: es una herramienta de apoyo a decisiones industriales. Permite evaluar el uso de capacidad de cada línea, la cobertura de inventario de producto terminado, el balanceo de tareas de una línea de ensamble (takt time, precedencias, cuello de botella) y, en su módulo más reciente, el riesgo de quiebre de materias primas junto con un motor de recomendaciones de compra que un planificador humano revisa, aprueba o rechaza antes de que se considere una decisión tomada.

Todos los escenarios se recalculan de forma determinista: el mismo conjunto de parámetros produce siempre el mismo resultado, tanto en el servidor como en el navegador, lo que permite auditar cada número hasta su fórmula de origen.

---

## Problema abordado

Una planificación de producción y abastecimiento deficiente se traduce en consecuencias operativas y económicas concretas:

- incumplimiento de la demanda comprometida;
- exceso de inventario de producto terminado y capital de trabajo inmovilizado;
- faltantes de materias primas que detienen líneas ya programadas;
- tiempos ociosos y capacidad instalada sin aprovechar;
- cuellos de botella no identificados a tiempo;
- cambios de formato (setups) innecesarios o mal secuenciados;
- horas extra evitables por una mala asignación de carga;
- reprocesos administrativos y replanificación manual ante cada cambio de escenario.

OptiFlow Industrial modela estas tensiones de forma explícita y muestra, en pesos y en indicadores operativos, cuánto vale cada decisión.

---

## Módulos actuales

| Módulo | Funcionalidad |
| --- | --- |
| Dashboard | KPI ejecutivos de costo, nivel de servicio, setups y utilización de capacidad |
| Plan de producción | Comparación entre un plan base (orden comercial fijo) y un plan recomendado por heurística |
| Inventario | Stock de producto terminado, consumo proyectado, producción planificada y riesgo de quiebre |
| Simulador | Variación de demanda, reducción de capacidad, aumento de setups, multiplicador de faltante y horas extra |
| Balanceo de línea | Takt time, precedencias entre tareas, asignación a estaciones, eficiencia y cuello de botella |
| Torre de abastecimiento | Cobertura de materia prima, lead time de proveedores, clasificación de riesgo y recomendaciones de compra con aprobación humana |
| Metodología | Supuestos del caso, fórmulas de cada módulo, límites conocidos y roadmap |

---

## Capacidades demostradas

**Ingeniería Industrial y operaciones**
- Planeamiento y control de la producción (PCP)
- Gestión de inventarios y cobertura de stock
- Supply chain: lead time, punto de pedido, riesgo de proveedor
- Balanceo de línea (SALBP) y cálculo de takt time
- Análisis de capacidad y utilización de recursos
- Mejora continua y Lean Manufacturing (identificación de desperdicios)
- Análisis económico de decisiones operativas

**Desarrollo de software**
- Desarrollo web full-stack con Next.js y TypeScript
- Visualización de datos con Recharts
- Diseño de heurísticas constructivas explicables (no cajas negras)
- Human-in-the-loop: aprobación, rechazo o revisión de recomendaciones antes de ejecutarlas

---

## Indicadores calculados

> Todos los valores económicos y operativos son **simulados**: sirven para demostrar el método de cálculo, no representan resultados de una operación real.

**Plan de producción**
- Nivel de servicio y unidades no atendidas
- Costo total y su desagregación: setup, horas extra, inventario, faltantes
- Utilización de capacidad por línea

**Balanceo de línea**
- Takt time y tiempo de ciclo
- Número teórico mínimo de estaciones
- Eficiencia de línea y pérdida por desbalance
- Tiempo ocioso por estación

**Torre de abastecimiento**
- Cobertura de inventario (días de consumo disponibles)
- Punto de pedido
- Brecha entre cobertura y lead time del proveedor
- Costo de la compra sugerida frente al costo estimado de no actuar

---

## Metodología resumida

El **planificador heurístico** recibe el mismo contexto (demanda, capacidad, costos) que el plan base y construye una programación alternativa: prioriza los productos según su riesgo económico de faltante —no según su volumen de venta— y agrupa corridas por familia de producto para reducir la cantidad de cambios de formato.

El **balanceo de línea** calcula el takt time como el tiempo disponible dividido por la demanda diaria, y asigna tareas a estaciones respetando todas las precedencias mediante la regla del **peso posicional (RPW)**: cada tarea se prioriza por su propio tiempo más el de todas sus tareas sucesoras, lo que agrupa el trabajo hacia el principio del proceso sin violar el orden productivo.

La **torre de abastecimiento** clasifica el riesgo de cada material distinguiendo un quiebre evitable (se resuelve comprando dentro del horizonte) de uno inevitable (el stock se agota antes de que cualquier compra nueva pueda llegar). A partir de esa clasificación, un motor de reglas explícito —no un modelo de lenguaje— arma una recomendación de compra con su razón, su costo y su fecha límite de decisión.

En los tres casos, la recomendación queda sujeta a una instancia de revisión: en el plan de producción y el balanceo, el usuario compara ambas alternativas antes de adoptar una; en el abastecimiento, cada recomendación se aprueba, se rechaza o se marca para revisión de forma explícita antes de considerarse una decisión.

> Las recomendaciones son heurísticas, factibles y explicables. No se afirma que representen un óptimo matemático global.

---

## Arquitectura

```mermaid
flowchart LR
    A[Datos sintéticos] --> B[Lógica de planificación y balanceo]
    B --> C[Cálculos económicos y de abastecimiento]
    C --> D[Estado de escenarios y decisiones]
    D --> E[Componentes visuales]
    E --> F[Pantallas de la aplicación]
```

El código separa responsabilidades por capa dentro de `V1/src`:

- **Datos** (`lib/data`): parámetros del caso simulado y generación determinista del dataset.
- **Tipos** (`lib/types.ts`): modelo de dominio compartido por toda la aplicación.
- **Lógica de negocio** (`lib/planning`, `lib/balance`, `lib/supply`): funciones puras que calculan planes, balances y recomendaciones de compra a partir de un escenario.
- **Escenarios y decisiones** (`state/`): hooks de React que gestionan el escenario activo de cada módulo y, en el caso de abastecimiento, las decisiones de aprobación humana.
- **Componentes** (`components/`): tablas, gráficos y elementos de interfaz reutilizables por módulo.
- **Páginas** (`app/`): rutas de Next.js que combinan lógica, estado y componentes en cada pantalla.
- **Validaciones**: `scripts/verify.ts` recalcula presets y escenarios extremos de los tres módulos y verifica reproducibilidad y coherencia de los datos.

Ver [`ARCHITECTURE.md`](./ARCHITECTURE.md) para el detalle de esta separación y [`DATA_MODEL.md`](./DATA_MODEL.md) para las entidades del dominio.

---

## Stack tecnológico

- [Next.js](https://nextjs.org/) (App Router)
- [React](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Recharts](https://recharts.org/) para visualización de datos
- [Lucide React](https://lucide.dev/) para iconografía
- `localStorage` del navegador para persistir de forma demostrativa las decisiones de aprobación de compra
- [Vercel](https://vercel.com/) para el despliegue de la demo

---

## Estructura del repositorio

```text
optiflow-industrial/
├── V1/                         Aplicación desplegada (Root Directory configurado en Vercel)
│   ├── src/
│   │   ├── app/                Rutas: dashboard, plan, inventario, torre, balanceo, simulador, metodología
│   │   ├── components/         Componentes de UI, gráficos y tablas por módulo
│   │   ├── lib/                Datos del caso, tipos y lógica de negocio (planning / balance / supply)
│   │   └── state/               Hooks de estado por escenario y decisiones
│   ├── scripts/
│   │   └── verify.ts           Verificación de reproducibilidad y coherencia del caso
│   ├── package.json
│   └── ...
└── V1.1/                       Documentación complementaria del caso simulado
    ├── README.md                Documentación técnica detallada de la aplicación
    └── DATA_ASSUMPTIONS.md      Supuestos y fórmulas de cada módulo
```

La carpeta `V1` contiene la aplicación que se despliega en producción. El **Root Directory** configurado en Vercel es `V1`; este README de la raíz no forma parte del build y no debe moverse esa carpeta ni cambiarse esa configuración.

---

## Ejecución local

```bash
cd V1
npm install
npm run dev
```

Luego abrir el enlace local que indique Next.js.

Comandos de validación disponibles en `V1/package.json`:

```bash
npm run typecheck   # Verificación de tipos con tsc
npm run lint        # Linter de Next.js
npm run build       # Build de producción
npm run verify       # Recalcula escenarios y verifica reproducibilidad de los tres módulos
```

---

## Escenarios para probar

| Escenario | Dónde probarlo | Qué observar |
| --- | --- | --- |
| Operación estable | Simulador / Balanceo / Torre de abastecimiento | Línea base de referencia contra la que se comparan los demás escenarios |
| Pico de demanda | Simulador | Sube el nivel de servicio exigido y el uso de horas extra; el plan recomendado prioriza los SKU de mayor riesgo de faltante |
| Restricción de capacidad | Simulador | Cae la capacidad disponible por línea; aumentan los setups agrupados y la utilización |
| Proveedor retrasado | Torre de abastecimiento | Sube el lead time efectivo; varios materiales pasan de "comprar" a "anticipar o reprogramar orden" |
| Riesgo de quiebre | Torre de abastecimiento | Combinación de mayor demanda, más scrap y proveedores menos confiables: la mayoría de los materiales queda en riesgo crítico o alto |
| Horizonte corto de abastecimiento (7 días) | Torre de abastecimiento | Con menos días de consumo proyectado, aparecen recomendaciones de "monitorear" y "no comprar" que no se ven en horizontes largos |

---

## Datos y limitaciones

- Todos los datos (demanda, capacidades, costos, materiales, proveedores) son **sintéticos y generados de forma determinista**; no corresponden a ninguna empresa real.
- Los costos e impactos económicos son **supuestos del caso simulado**, expresados en una moneda ficticia.
- No existe integración con ningún ERP, WMS ni sistema de gestión real.
- La aplicación **no emite órdenes de compra reales** ni se comunica con proveedores reales.
- Las decisiones de aprobación de la Torre de abastecimiento se guardan **únicamente en el `localStorage` del navegador**, a modo de demostración del flujo de revisión humana.
- La versión actual **no lee documentos reales** (remitos, facturas, cotizaciones) ni **utiliza un modelo de lenguaje en producción**: todo el texto explicativo se genera con plantillas a partir de los cálculos.
- Las heurísticas de planificación y balanceo son constructivas y explicables; **no garantizan un óptimo matemático global**.

---

## Roadmap

### Completado

- Planificación de producción con heurística y plan base comparativo
- Simulador de escenarios de demanda, capacidad y costos
- Balanceo de línea con cálculo de takt time y peso posicional (RPW)
- Torre de abastecimiento con clasificación de riesgo y motor de recomendaciones
- Aprobación humana local de recomendaciones de compra
- Modelo económico y métricas de cada módulo

### V2.1 prevista

- Carga y lectura de cotizaciones, remitos y facturas reales
- Extracción de datos documentales
- Comparación automática de precios y cantidades
- Consulta asistida (RAG) sobre políticas de compra
- Evaluación de recomendaciones contra lo efectivamente ocurrido
- Trazabilidad avanzada de decisiones
- Conexión con una fuente de datos real

---
