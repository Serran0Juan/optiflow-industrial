# DATA_ASSUMPTIONS.md — Supuestos del caso simulado

Este documento describe **cómo se construyen los datos** de OptiFlow Industrial y **qué supuestos** sostienen el modelo. Todo lo que sigue es una simulación: no hay ninguna empresa, planta, proveedor ni cifra real detrás.

- **Semilla de generación:** `20260302` (`SIMULATION_SEED` en `src/lib/data/config.ts`)
- **Generador:** mulberry32, determinista. Misma semilla ⇒ mismo dataset en cualquier máquina.
- **Moneda:** pesos argentinos **simulados**, sin inflación intra-semana.
- **Horizonte de planificación:** 5 días hábiles, del lunes 2 al viernes 6 de marzo de 2026.
- **Historial de demanda:** 90 días hábiles previos al horizonte (1.620 registros).
- **Caso de balanceo de línea (V1.1):** datos fijos, no generados con semilla. Ver sección 8.
- **Caso de torre de abastecimiento (V2):** amplía el caso semanal con 17 materias primas, 6 proveedores y 10 órdenes de compra abiertas; datos fijos, no generados con semilla. Todos sus plazos se expresan en días hábiles. Ver sección 9.

---

## 1. Planta simulada

Planta de productos de limpieza y envases plásticos con 3 líneas, 18 productos terminados y 3 familias.

### 1.1 Familias

| ID | Familia | Descripción |
| --- | --- | --- |
| `LIQ` | Líquidos de limpieza | Lavandinas, detergentes y desinfectantes envasados en línea de llenado |
| `CRE` | Cremas y geles | Productos de alta viscosidad que requieren dosificación y mezclado previo |
| `ENV` | Envases plásticos | Botellas, bidones y tapas producidas por inyección y soplado |

### 1.2 Líneas de producción

| Línea | Descripción | Familias | Turnos | Parada planificada | Jornada normal | Tope hora extra | Costo hora extra | Costo horario de setup | Familia montada al inicio |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| L1 | Envasado de líquidos | LIQ, CRE | 2 × 8 h | 45 min/día | 915 min/día | 120 min/día | $ 148.000/h | $ 38.000/h | LIQ |
| L2 | Multiproducto | LIQ, CRE, ENV | 2 × 8 h | 60 min/día | 900 min/día | 120 min/día | $ 162.000/h | $ 46.000/h | CRE |
| L3 | Inyección y soplado | ENV, CRE | 2 × 8 h | 50 min/día | 910 min/día | 120 min/día | $ 176.000/h | $ 54.000/h | ENV |

**Capacidad regular semanal:** 13.625 minutos (≈ 227 horas de línea).

Supuestos:

- La jornada normal se calcula como `turnos × horas × 60 − parada planificada`. La parada planificada cubre arranque, limpieza menor y cambios dentro de la misma familia.
- El costo horario de setup representa **costo directo** del cambio: cuadrilla, materiales de limpieza y producto perdido en el arranque. **No** incluye el costo de la capacidad perdida, porque ésta ya se captura por otra vía (horas extra y faltantes). Contabilizarla dos veces inflaría artificialmente el beneficio de agrupar familias.
- El costo de hora extra corresponde a la dotación completa de la línea con recargo.
- Cada línea corre al menos dos familias a propósito: si cada línea tuviera una sola familia, el problema de secuenciamiento no existiría.

### 1.3 Matriz de cambio de formato (minutos)

| Línea | Transición | Minutos |
| --- | --- | --- |
| L1 | LIQ → CRE | 42 |
| L1 | CRE → LIQ | 36 |
| L2 | LIQ → CRE | 48 |
| L2 | CRE → LIQ | 44 |
| L2 | LIQ → ENV | 55 |
| L2 | ENV → LIQ | 58 |
| L2 | CRE → ENV | 52 |
| L2 | ENV → CRE | 56 |
| L3 | ENV → CRE | 62 |
| L3 | CRE → ENV | 58 |

Dentro de una misma familia el cambio vale **0 minutos**: el cambio menor está contemplado en la parada planificada diaria.

### 1.4 Velocidades de producción

Se sortean por producto dentro de un rango por línea y familia (unidades por minuto):

| Línea | LIQ | CRE | ENV |
| --- | --- | --- | --- |
| L1 | 58 – 78 | 24 – 34 | no habilitado |
| L2 | 46 – 60 | 21 – 29 | 62 – 80 |
| L3 | no habilitado | 16 – 22 | 82 – 112 |

Las brechas de velocidad entre líneas son moderadas a propósito: si una línea fuera drásticamente más rápida que otra, la simple reasignación de productos dominaría el resultado y ocultaría el efecto del secuenciamiento.

### 1.5 Eventos de disponibilidad

| Línea | Día | Disponibilidad | Motivo |
| --- | --- | --- | --- |
| L1 | Lunes | 95% | Puesta a punto de arranque semanal |
| L2 | Miércoles | 82% | Mantenimiento preventivo programado |
| L3 | Jueves | 90% | Cambio y calibración de molde |
| L1 | Viernes | 93% | Auditoría interna de calidad |

Son eventos **conocidos al momento de planificar** (no fallas aleatorias). Afectan tanto la jornada normal como el tope de hora extra de ese día.

---

## 2. Productos terminados

Los valores fijos (SKU, familia, costo unitario, tamaño de lote) están definidos en `PRODUCT_SEEDS`. Los valores derivados se generan con la semilla.

| SKU | Producto | Fam. | Línea habitual | Costo unit. | Lote | Stock inicial | Demanda media/día | Cobertura inicial | Días de seguridad | Cobertura máx. | Prioridad comercial |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LIQ-101 | Lavandina concentrada 1 L | LIQ | L1 | $ 780 | 500 | 18.120 | 9.056 | 2,0 d | 1,31 | 2,82 | 9 |
| LIQ-102 | Lavandina tradicional 2 L | LIQ | L1 | $ 1.050 | 500 | 10.630 | 9.100 | 1,2 d | 1,39 | 3,00 | 6 |
| LIQ-103 | Detergente limón 750 ml | LIQ | L2 | $ 920 | 500 | 5.290 | 7.274 | 0,7 d | 1,36 | 3,46 | 10 |
| LIQ-104 | Detergente ultra 1,25 L | LIQ | L1 | $ 1.340 | 250 | 14.770 | 6.778 | 2,2 d | 0,94 | 3,61 | 11 |
| LIQ-105 | Desinfectante pisos 900 ml | LIQ | L2 | $ 1.180 | 250 | 12.610 | 8.998 | 1,4 d | 1,36 | 3,28 | 8 |
| LIQ-106 | Limpiador multiuso 500 ml | LIQ | L1 | $ 860 | 500 | 27.400 | 10.650 | 2,6 d | 1,36 | 3,65 | 4 |
| CRE-201 | Crema limpiadora 500 g | CRE | L2 | $ 1.420 | 250 | 5.130 | 2.368 | 2,2 d | 1,20 | 3,71 | 16 |
| CRE-202 | Gel desengrasante 750 g | CRE | L1 | $ 1.680 | 250 | 8.720 | 3.708 | 2,4 d | 1,28 | 2,80 | 13 |
| CRE-203 | Jabón en crema 300 g | CRE | L3 | $ 990 | 250 | 4.910 | 2.254 | 2,2 d | 1,08 | 3,75 | 17 |
| CRE-204 | Gel sanitizante 250 ml | CRE | L2 | $ 1.260 | 250 | 960 | 2.172 | **0,4 d** | 1,23 | 3,29 | 18 |
| CRE-205 | Pasta limpiametales 200 g | CRE | L1 | $ 1.520 | 100 | 4.760 | 2.700 | 1,8 d | 0,85 | 2,93 | 15 |
| CRE-206 | Crema pulidora 400 g | CRE | L3 | $ 1.380 | 250 | 6.460 | 2.942 | 2,2 d | 1,25 | 2,92 | 14 |
| ENV-301 | Botella PET 1 L | ENV | L3 | $ 320 | 1.000 | 41.170 | 14.808 | 2,8 d | 0,82 | 3,50 | 1 |
| ENV-302 | Botella PET 2 L | ENV | L3 | $ 470 | 1.000 | 22.690 | 9.288 | 2,4 d | 1,32 | 3,34 | 7 |
| ENV-303 | Bidón HDPE 5 L | ENV | L2 | $ 980 | 500 | 4.820 | 6.684 | **0,7 d** | 1,12 | 3,01 | 12 |
| ENV-304 | Tapa rosca 28 mm | ENV | L3 | $ 95 | 2.000 | 25.680 | 11.820 | 2,2 d | 1,13 | 3,23 | 3 |
| ENV-305 | Gatillo pulverizador | ENV | L2 | $ 410 | 1.000 | 26.790 | 10.208 | 2,6 d | 1,19 | 3,25 | 5 |
| ENV-306 | Envase gel 500 ml | ENV | L3 | $ 355 | 1.000 | 31.290 | 14.138 | 2,2 d | 1,26 | 3,27 | 2 |

Supuestos:

- **Tres SKU arrancan con cobertura crítica** (menos de un día): LIQ-103, CRE-204 y ENV-303. Es deliberado: sin riesgo real de quiebre no habría nada que priorizar.
- La **prioridad comercial** (el orden que sigue el plan base) es el ranking por volumen proyectado descendente. Es un criterio real de planta —atender primero lo que más se vende— pero ciego al costo de cambio de formato.
- La **línea habitual** representa la asignación histórica de la planta. No siempre es la mejor: el plan recomendado puede reasignar productos y lo informa explícitamente.
- El **tamaño de lote** obliga a producir en múltiplos. Ambos planes lo respetan por igual.

### 2.1 Calibración de la demanda

La demanda base de cada producto **no es arbitraria**: se calibra para que cada línea quede cargada al `targetLoad` definido en la configuración (L1 80%, L2 78%, L3 82%) con la asignación histórica de productos. Esa carga es lo que hace que los cambios de formato y las horas extra sean decisiones económicas relevantes y no ruido.

### 2.2 Generación del historial de demanda

Para cada producto y cada uno de los 90 días hábiles:

```
unidades = base × factor_día_semana × factor_tendencia × factor_ruido × pico
```

| Componente | Valor |
| --- | --- |
| `factor_día_semana` | Lun 1,12 · Mar 1,04 · Mié 0,97 · Jue 1,00 · Vie 0,87, más un ajuste por producto de ±5% |
| `factor_tendencia` | Lineal de −8% a +16% a lo largo de los 90 días, según el producto |
| `factor_ruido` | Ruido cuasi-normal con desvío de 7% a 15% según el producto |
| `pico` | Con probabilidad de 2% a 4,5%, un multiplicador de 1,25 a 1,60 |

El resultado se redondea a 10 unidades y nunca es negativo.

### 2.3 Pronóstico del horizonte

```
base(p)      = media ponderada de los últimos 20 días hábiles (peso lineal creciente)
índice(p,d)  = media de las últimas 6 observaciones de ese día de semana
               / media de los últimos 30 días hábiles, acotado a [0,80 ; 1,20]
demanda(p,d) = redondeo_10( base(p) × índice(p,d) ) × (1 + variación_escenario)
```

Es un pronóstico deliberadamente simple y auditable. No se modela incertidumbre: el pronóstico es un valor puntual, no una distribución.

---

## 3. Modelo económico

### 3.1 Parámetros

| Parámetro | Valor | Interpretación |
| --- | --- | --- |
| Tasa anual de mantenimiento de inventario | 45% | Costo financiero + almacenamiento + obsolescencia |
| Días hábiles por año | 250 | Base de prorrateo |
| Margen de contribución | 35% del costo unitario | Margen perdido si no se atiende la demanda |
| Penalidad comercial por faltante | 12% del costo unitario | Costo indirecto: reclamos, retrabajo administrativo, pérdida de posición en góndola |

### 3.2 Fórmulas

```
costo_mantener(p)  = costo_unitario(p) × 45% / 250
costo_faltante(p)  = ( margen(p) + penalidad(p) ) × multiplicador_escenario

costo_setup        = Σ (minutos_setup / 60 × costo_horario_setup(línea))
costo_hora_extra   = Σ (minutos_hora_extra / 60 × costo_hora_extra(línea))
costo_inventario   = Σ (stock_final(producto, día) × costo_mantener(producto))
costo_faltante     = Σ (unidades_no_atendidas × costo_faltante(producto))
costo_total        = costo_setup + costo_hora_extra + costo_inventario + costo_faltante

costo_evitado      = costo_total(plan base) − costo_total(plan recomendado)
```

Ejemplo con LIQ-101 (costo unitario $ 780): mantener una unidad un día cuesta $ 1,40 y no atender una unidad cuesta $ 273 + $ 94 = $ 367 antes del multiplicador de escenario.

### 3.3 Supuestos de la secuencia diaria

- La producción de un día queda disponible **ese mismo día**.
- La demanda se atiende **al cierre** de la jornada, contra el stock inicial más lo producido.
- La demanda no atendida **se pierde**: no se arrastra como pedido pendiente al día siguiente.
- El inventario se valoriza al cierre de cada día hábil, por lo que un lote producido el viernes paga un día de mantenimiento.
- El stock de seguridad se repone **también el último día del horizonte**, para el lunes siguiente. Ambos planes lo hacen, de modo que la comparación no premie a quien vacía el almacén.
- Los minutos que exceden la jornada normal de una línea-día se imputan como hora extra, en el orden en que fueron programados. Por eso la utilización nunca supera el 100%: el exceso se informa por separado.

---

## 4. Materias primas, BOM y proveedores

### 4.1 Materias primas

| Código | Materia prima | Unidad | Costo unit. | Stock inicial | Proveedor | Cobertura mínima |
| --- | --- | --- | --- | --- | --- | --- |
| MP-01 | Hipoclorito de sodio 10% | L | $ 310 | 209.510 | S1 | 5 d |
| MP-02 | Tensioactivo LESS 70% | kg | $ 1.450 | 15.980 | S1 | 5 d |
| MP-03 | Fragancia limón | kg | $ 6.800 | 1.870 | S2 | 8 d |
| MP-04 | Soda cáustica escamas | kg | $ 890 | 3.740 | S1 | 5 d |
| MP-05 | Espesante carbómero | kg | $ 9.200 | 1.000 | S2 | 8 d |
| MP-06 | Alcohol etílico 96 | L | $ 1.620 | 5.380 | S5 | 6 d |
| MP-07 | Resina PET grado botella | kg | $ 1.980 | 15.470 | S3 | 13 d |
| MP-08 | Resina HDPE soplado | kg | $ 1.740 | 14.000 | S3 | 13 d |
| MP-09 | Masterbatch color | kg | $ 5.400 | 1.420 | S3 | 13 d |
| MP-10 | Preforma PET 28 mm | u | $ 78 | 187.160 | S4 | 4 d |
| MP-11 | Etiqueta autoadhesiva | u | $ 42 | 491.620 | S4 | 4 d |
| MP-12 | Caja corrugada x12 | u | $ 640 | 31.550 | S5 | 6 d |

El stock inicial se dimensiona como `consumo diario medio × cobertura inicial deseada`, con coberturas entre 3,6 y 14 días según la materia prima. Las materias primas con lead time largo arrancan con más cobertura, pero no siempre suficiente: es lo que genera alertas de abastecimiento.

### 4.2 Lista de materiales (BOM)

Consumo por unidad de producto terminado, definido por familia:

| Familia | Materias primas y consumo unitario |
| --- | --- |
| LIQ | MP-01 (0,62 L) · MP-02 (0,045 kg) · MP-03 (0,004 kg) · MP-10 (1 u) · MP-11 (1 u) · MP-12 (0,084 u) |
| CRE | MP-02 (0,09 kg) · MP-04 (0,031 kg) · MP-05 (0,012 kg) · MP-06 (0,055 L) · MP-11 (1 u) · MP-12 (0,084 u) |
| ENV | MP-07 (0,026 kg) · MP-08 (0,018 kg) · MP-09 (0,0015 kg) |

Simplificación asumida: **la BOM depende de la familia, no del SKU individual**. En una planta real cada SKU tendría su propia fórmula y gramaje.

### 4.3 Proveedores

| ID | Proveedor | Lead time | Confiabilidad simulada | Entregas por semana |
| --- | --- | --- | --- | --- |
| S1 | Química del Litoral S.A. | 4 d | 96% | 2 |
| S2 | Insumos Rosario SRL | 7 d | 88% | 1 |
| S3 | Polímeros Andinos S.A. | 12 d | 82% | 1 |
| S4 | Envases y Etiquetas del Sur | 3 d | 94% | 3 |
| S5 | Distribuidora Pampa | 5 d | 91% | 2 |

La confiabilidad es un **valor informativo simulado**: no se usa como probabilidad en ninguna simulación estocástica. Alimenta el semáforo de riesgo de proveedor, que combina lead time, confiabilidad y cobertura de las materias primas que abastece.

**En la V1 el abastecimiento se verifica pero no restringe el plan**: se calcula el consumo de materia prima y su cobertura resultante, pero no se frenan corridas por falta de insumos ni se generan órdenes de compra.

---

## 5. Escenarios

| Parámetro | Rango | Efecto en el modelo |
| --- | --- | --- |
| Variación de demanda | −20% a +30% | Multiplica el pronóstico de todos los productos |
| Reducción de capacidad | 0% a 40% | Reduce los minutos de jornada normal de las tres líneas |
| Aumento de tiempo de setup | 0% a 100% | Alarga cada cambio de formato: más minutos perdidos y setups más caros |
| Multiplicador de costo de faltante | ×1 a ×3 | Endurece la penalidad por no atender demanda |
| Horas extra | on / off | Habilita o bloquea el uso de capacidad por encima de la jornada normal |

Presets:

| Preset | Demanda | Capacidad | Setup | Faltante | Horas extra |
| --- | --- | --- | --- | --- | --- |
| Operación estable | 0% | 0% | 0% | ×1,00 | Sí |
| Pico de demanda | +25% | 0% | 0% | ×1,50 | Sí |
| Restricción de capacidad | +5% | −20% | +30% | ×1,00 | No |

Nota: el multiplicador de costo de faltante sólo cambia el resultado económico cuando existen unidades no atendidas. En escenarios holgados puede no modificar ningún número, y eso es correcto.

---

## 6. Parámetros de la heurística

| Parámetro | Valor | Función |
| --- | --- | --- |
| Ventana de riesgo | 2 días | Horizonte con el que se evalúa si un cambio de formato se justifica |
| Peso del stock de seguridad | 0,20 | Cuánto vale reponer el colchón frente al costo de un faltante efectivo |
| Corrida mínima útil | 10 min | Debajo de eso no se programa, salvo que cubra un faltante del mismo día |
| Minutos ociosos mínimos para extender | 25 min | Umbral para usar capacidad sobrante y cubrir el día siguiente |
| Penalidad por línea más lenta | 0,25 | Peso en la asignación producto–línea |
| Bonificación por concentrar familia | 0,03 | Peso en la asignación producto–línea |
| Corrida mínima tras setup (plan base) | 15 min | Única regla de sentido común del plan base |

Estos valores son **decisiones de modelado**, no resultados de una optimización. Cambiarlos cambia el plan recomendado; están todos centralizados y comentados en `src/lib/planning/heuristic.ts` y `src/lib/planning/baseline.ts`.

---

## 7. Limitaciones conocidas

1. **No es un optimizador.** Es una heurística golosa; no garantiza el mínimo costo posible ni entrega cota de optimalidad.
2. **Efecto de fin de horizonte.** El último día no anticipa producción para la semana siguiente más allá del stock de seguridad.
3. **Demanda determinística.** No se modela incertidumbre ni se calculan stocks de seguridad estadísticos.
4. **La demanda no atendida se pierde**, no se acumula como pedido pendiente.
5. **Materia prima sin restricción dura.** El abastecimiento se informa, se valoriza y se traduce en recomendaciones de compra, pero no bloquea corridas del plan ni emite órdenes reales.
6. **Sin mano de obra ni herramentales explícitos.** No se modelan operarios, moldes ni matrices como recursos limitados independientes de la línea.
7. **BOM por familia** en el planificador semanal, no por SKU. La torre de abastecimiento (V2) sí agrega overrides por SKU sobre esa misma BOM; ver sección 9.3.
8. **Sin persistencia de servidor.** No hay base de datos ni histórico de escenarios: todo vive en memoria durante la sesión. La única excepción son las decisiones de compra de la torre de abastecimiento, que se guardan en el `localStorage` del navegador a modo de demostración; ver sección 9.9.
9. **El plan base es deliberadamente simple.** Una planta real suele aplicar algo de agrupamiento por familia, por lo que la brecha entre ambos planes sería menor que la que muestra el caso. La diferencia de costo que informa la aplicación mide la distancia contra *esa* referencia explícita, no contra "la industria".

---

## 8. Caso de balanceo de línea (V1.1)

Caso simulado **independiente** del planificador semanal. No comparte datos con él: es otra planta, otro producto y otra decisión.

- **Producto:** envase dosificador de 500 ml para limpiadores líquidos.
- **Línea:** `LN-DOSI-01`, sincrónica, un solo modelo, sin buffers entre puestos.
- **Datos fijos, no generados con semilla.** A diferencia del caso semanal, las 16 tareas y sus tiempos están escritos a mano en `src/lib/data/line-config.ts`: son pocos y se buscó que sean legibles y verificables uno por uno.
- **Validación en build.** `src/lib/data/assembly-line.ts` verifica que ninguna precedencia apunte a una tarea inexistente, que el grafo no tenga ciclos (orden topológico de Kahn) y que la asignación inicial no viole ninguna precedencia. Si algo falla, el build se rompe en lugar de producir un balance inválido.

### 8.1 Tareas y precedencias

| Código | Tarea | Etapa | Tiempo estándar (s) | Predecesoras | Estación inicial |
| --- | --- | --- | ---: | --- | ---: |
| T01 | Alimentar envase a la cinta | Preparación | 16 | — | E1 |
| T02 | Inspeccionar envase (rebabas y fisuras) | Preparación | 13 | T01 | E1 |
| T03 | Soplado y limpieza interior | Preparación | 10 | T02 | E1 |
| T04 | Alimentar tapas y cuerpos de dosificador | Preparación | 14 | — | E1 |
| T05 | Preensamblar cuerpo del dosificador | Ensamble | 27 | T04 | E2 |
| T06 | Insertar tubo de succión a medida | Ensamble | 22 | T05 | E2 |
| T07 | Verificar carrera del pulsador | Control de calidad | 12 | T06 | E2 |
| T08 | Posicionar envase bajo la boquilla | Llenado | 9 | T03 | E3 |
| T09 | Dosificar producto (llenado volumétrico) | Llenado | 31 | T08 | E3 |
| T10 | Verificar nivel y purgar goteo | Llenado | 15 | T09 | E3 |
| T11 | Colocar dosificador y roscar tapa | Ensamble | 19 | T07, T10 | E4 |
| T12 | Torquear tapa al par especificado | Ensamble | 17 | T11 | E4 |
| T13 | Control de torque y hermeticidad | Control de calidad | 21 | T12 | E4 |
| T14 | Colocar etiqueta frontal y dorsal | Embalaje | 18 | T13 | E5 |
| T15 | Empaquetar en caja de 12 unidades | Embalaje | 24 | T14 | E5 |
| T16 | Paletizar y flejar | Embalaje | 20 | T15 | E6 |

**Contenido total de trabajo: 288 s por unidad.** Tarea más larga: T09 con 31 s (fija el piso del tiempo de ciclo).

El grafo tiene dos ramas que convergen: la preparación y el llenado del envase (T01→T02→T03→T08→T09→T10) por un lado, y el subensamble del dosificador (T04→T05→T06→T07) por otro. Ambas se unen en T11, que no puede empezar hasta que existan el envase lleno y el dosificador armado.

### 8.2 Asignación inicial (deliberadamente desbalanceada)

| Estación | Tareas | Carga (s) |
| --- | --- | ---: |
| E1 | T01, T02, T03, T04 | 53 |
| E2 | T05, T06, T07 | **61** |
| E3 | T08, T09, T10 | 55 |
| E4 | T11, T12, T13 | 57 |
| E5 | T14, T15 | 42 |
| E6 | T16 | 20 |

Reproduce cómo suele armarse una línea en la práctica: **bloques por etapa del proceso, en el orden en que ocurre**, sin comparar la carga de cada puesto contra el takt time. Respeta todas las precedencias, pero concentra 61 s en E2 y deja 20 s en E6.

Con la demanda de referencia el takt time es de 60 s, así que **E2 no llega al ritmo requerido**: el tiempo de ciclo de 61 s deja la capacidad en 885 u/día contra una demanda de 900.

### 8.3 Parámetros de operación

| Parámetro | Valor base | Rango en el simulador |
| --- | ---: | --- |
| Demanda diaria | 900 u | −20% a +30% (paso 5%) |
| Minutos productivos por turno | 450 min | 360 a 480 min (paso 15) |
| Turnos por día | 2 | 1, 2 o 3 |
| Variación de tiempos estándar | 0% | −10% a +20% (paso 5%) |
| Estación adicional | deshabilitada | on / off |

Los 450 minutos son una jornada de 8 h menos refrigerio, arranque, limpieza de fin de turno y reuniones de piso. Con 2 turnos, el tiempo disponible diario es de **54.000 s (15 h)** y el takt time de **60 s por unidad**.

### 8.4 Supuestos económicos

| Parámetro | Valor | Qué representa |
| --- | ---: | --- |
| Costo por hora de estación | $ 14.500 | Operario, puesto de trabajo y servicios, costo cargado |
| Costo por unidad no atendida | $ 2.800 | Margen de contribución perdido por unidad que la línea no llega a producir |

Ambos son **supuestos declarados del caso**, no valores relevados. Están en `src/lib/data/line-config.ts` y se muestran en la pantalla y en la metodología.

```
costo_estaciones  = estaciones × (tiempo_disponible_diario / 3600) × 14.500
costo_no_atendido = unidades_no_atendidas × 2.800
costo_total       = costo_estaciones + costo_no_atendido

costo_del_ocio    = costo_estaciones × pérdida_por_desbalance   (indicador, NO se suma)
diferencia        = costo_total(inicial) − costo_total(recomendado)
```

**El costo del tiempo ocioso no es un sumando.** Es la porción del costo de estaciones que se paga sin agregar valor. Se informa como indicador y como apertura del gráfico de composición, pero sumarlo además del costo de estaciones contaría dos veces el mismo peso — el mismo error de doble conteo que se corrigió en el modelo económico del planificador semanal.

### 8.5 Escenarios predefinidos

| Preset | Demanda | Min/turno | Turnos | Tiempos | Estación extra |
| --- | ---: | ---: | ---: | ---: | --- |
| Operación estable | +0% | 450 | 2 | +0% | no |
| Pico de demanda | +30% | 450 | 2 | +0% | no |
| Restricción de capacidad | +5% | 390 | 2 | +15% | no |

Resultados de referencia (calculados por `npm run verify`):

| Preset | Takt | Ciclo ini. → rec. | Estaciones ini. → rec. | Eficiencia ini. → rec. | No atendidas ini. → rec. | Diferencia |
| --- | ---: | --- | --- | --- | --- | ---: |
| Operación estable | 60,0 s | 61,0 → 56,0 s | 6 → 6 | 78,7% → 85,7% | 15 → 0 u | $ 42.000 |
| Pico de demanda | 46,2 s | 61,0 → 46,0 s | 6 → 7 | 78,7% → 89,4% | 285 → 0 u | $ 580.500 |
| Restricción de capacidad | 49,5 s | 70,2 → 48,3 s | 6 → 8 | 78,7% → 85,8% | 279 → 0 u | $ 404.200 |

### 8.6 Parámetros de la heurística de balanceo

| Decisión de modelado | Valor | Función |
| --- | --- | --- |
| Regla de prioridad | Peso posicional (RPW) | Tiempo propio + tiempo de todas las sucesoras |
| Desempate | Código de tarea ascendente | Garantiza que el resultado sea determinista |
| Límite de la primera pasada | Takt time | Define cuántas estaciones hacen falta para la demanda |
| Piso del límite de ciclo | Tarea más larga | Por debajo, esa tarea no entraría en ninguna estación |
| Pasada de suavizado | Barrido entero ascendente | Menor ciclo que siga entrando en la cantidad de estaciones objetivo |
| Estación adicional | +1 sobre la primera pasada | Permite apuntar a un ciclo más corto a costa de un operario |

### 8.7 Limitaciones del módulo de balanceo

1. **Caso sintético.** Tareas, tiempos, precedencias y costos fueron construidos para el portfolio. No corresponden a ninguna línea real.
2. **Tiempos estándar sin variabilidad estocástica.** Cada tarea dura siempre exactamente lo mismo: no se modelan distribuciones, fatiga, curva de aprendizaje ni microparadas. Una línea real necesita colchones que el modelo no calcula.
3. **Sin ergonomía ni layout físico.** No se verifica si las tareas que caen en una misma estación son compatibles en espacio, herramientas, altura de trabajo o esfuerzo.
4. **Sin calidad en detalle.** No se modelan scrap, retrabajo ni el efecto de un rechazo aguas abajo.
5. **Sin optimización matemática exacta.** El balanceo de líneas (SALBP) es NP-difícil; el peso posicional es una regla constructiva golosa que no entrega cota de optimalidad.
6. **Una sola línea, un solo modelo.** No hay modelos mixtos, estaciones en paralelo ni buffers entre puestos.
7. **La dotación se supone disponible.** Habilitar una estación no modela contratación, curva de arranque ni polivalencia.
8. **La asignación inicial es deliberadamente simple**, igual que el plan base del módulo semanal: una línea real suele estar algo mejor nivelada, por lo que la diferencia contra una operación real sería menor que la que muestra el caso.

---

## 9. Caso de torre de abastecimiento (V2)

Este módulo **sí comparte el caso** del planificador semanal: es la misma planta, los mismos 18 productos y la misma demanda. Lo que agrega es el detalle de compras que la V1 no modelaba.

- **Amplía, no reemplaza.** Reutiliza `MATERIAL_SEEDS`, `SUPPLIER_SEEDS` y `BOM_BY_FAMILY` de la V1 y les suma categoría, condiciones comerciales y materiales nuevos. Los objetos originales no se modifican, por lo que el planificador, el inventario y el balanceo siguen dando exactamente los mismos números.
- **Datos fijos, no generados con semilla.** Los parámetros están escritos a mano en `src/lib/data/supply-config.ts`; `src/lib/data/supply-catalog.ts` los convierte en el dataset del módulo (stock dimensionado, BOM por producto, órdenes fechadas).
- **Todos los plazos en días hábiles.** Cobertura, lead time, horizonte y fechas de órdenes usan la misma unidad que el horizonte del plan, para que cobertura y lead time sean directamente comparables.

### 9.1 Materias primas

El stock inicial no se escribe a mano: se dimensiona como `consumo_diario_base × cobertura_inicial`, el mismo criterio que usa la V1 para sus doce materiales. El consumo diario base sale de la demanda pronosticada por producto multiplicada por la BOM.

| Código | Material | Categoría | UM | Costo unitario | Cobertura inicial (d) | Stock | SS (días) | Criticidad | Proveedor |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| `MP-01` | Hipoclorito de sodio 10% | Producto base | L | $ 310 | 6,5 | 208.990 | 3 | alta | `S1` |
| `MP-02` | Tensioactivo LESS 70% | Producto base | kg | $ 1.450 | 4,2 | 15.900 | 3 | alta | `S1` |
| `MP-03` | Fragancia limon | Fragancia o aditivo | kg | $ 6.800 | 9,0 | 1.870 | 4 | media | `S2` |
| `MP-04` | Soda caustica escamas | Producto base | kg | $ 890 | 7,4 | 3.700 | 3 | media | `S1` |
| `MP-05` | Espesante carbomero | Fragancia o aditivo | kg | $ 9.200 | 5,1 | 990 | 4 | alta | `S2` |
| `MP-06` | Alcohol etilico 96 | Producto base | L | $ 1.620 | 6,0 | 5.330 | 3 | media | `S5` |
| `MP-07` | Resina PET grado botella | Envase | kg | $ 1.980 | 8,8 | 15.320 | 6 | alta | `S3` |
| `MP-08` | Resina HDPE soplado | Envase | kg | $ 1.740 | 11,5 | 13.860 | 6 | alta | `S3` |
| `MP-09` | Masterbatch color | Fragancia o aditivo | kg | $ 5.400 | 14,0 | 1.410 | 5 | baja | `S3` |
| `MP-10` | Preforma PET 28 mm | Envase | u | $ 78 | 3,6 | 186.690 | 2 | alta | `S4` |
| `MP-11` | Etiqueta autoadhesiva | Etiqueta | u | $ 42 | 7,2 | 489.610 | 2 | media | `S4` |
| `MP-12` | Caja corrugada x12 | Caja, film o pallet | u | $ 640 | 5,5 | 31.420 | 3 | media | `S5` |
| `MP-13` | Tapa rosca 28 mm con precinto | Tapa o dosificador | u | $ 62 | 6,0 | 193.250 | 2 | alta | `S4` |
| `MP-14` | Dosificador gatillo 500 ml | Tapa o dosificador | u | $ 268 | 4,0 | 87.280 | 3 | alta | `S6` |
| `MP-15` | Film stretch 23 micrones | Caja, film o pallet | kg | $ 3.150 | 9,1 | 270 | 3 | baja | `S5` |
| `MP-16` | Pallet de madera 1,00 x 1,20 m | Caja, film o pallet | u | $ 14.800 | 5,0 | 590 | 2 | baja | `S5` |
| `MP-17` | Pote PP 500 g con tapa | Envase | u | $ 186 | 7,5 | 121.070 | 5 | alta | `S3` |

`MP-13` a `MP-17` son los materiales que agrega la V2: tapa rosca, dosificador gatillo, film stretch, pallet y pote de PP.

### 9.2 Proveedores

| ID | Proveedor | Lead time | Lead time máx. | Confiabilidad | Mínimo de compra | Factor de precio | Condición de compra | Riesgo |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| `S1` | Quimica del Litoral S.A. | 4 d | 7 d | 96% | 1.000 | ×1.04 | 30 dias fecha factura | bajo |
| `S2` | Insumos Rosario SRL | 7 d | 12 d | 88% | 150 | ×1.09 | 50% anticipo, 50% contra entrega | medio |
| `S3` | Polimeros Andinos S.A. | 12 d | 20 d | 82% | 2.500 | ×1.06 | 60 dias fecha factura | alto |
| `S4` | Envases y Etiquetas del Sur | 3 d | 6 d | 94% | 10.000 | ×1.02 | 15 dias fecha factura | bajo |
| `S5` | Distribuidora Pampa | 5 d | 9 d | 91% | 500 | ×1.05 | 30 dias fecha factura | medio |
| `S6` | Componentes Plasticos Cuyo S.R.L. | 8 d | 14 d | 79% | 2.000 | ×1.11 | Pago anticipado | alto |

El **factor de precio** convierte el costo unitario del material en stock en el precio de compra del proveedor: un proveedor con lead time largo y baja confiabilidad además cobra más caro. `S6` es el proveedor nuevo de la V2 y es el eslabón débil del caso: 8 días hábiles de lead time, 79% de confiabilidad y pago anticipado.

### 9.3 Lista de materiales ampliada

La BOM de la V1 era **por familia**. La V2 la mantiene, le suma consumos por familia y agrega **overrides por SKU**, con lo que resultan 139 líneas de BOM sobre 18 productos.

| Familia | Materiales que agrega la V2 |
| --- | --- |
| LIQ | `MP-13` tapa rosca (1 u/unidad), `MP-15` film (0,00026 kg/u), `MP-16` pallet (0,00104 u/u) |
| CRE | `MP-17` pote PP (1 u/unidad), `MP-15` film (0,00026 kg/u), `MP-16` pallet (0,00104 u/u) |
| ENV | `MP-15` film (0,00018 kg/u), `MP-16` pallet (0,00072 u/u) |

Supuestos de embalaje: una caja lleva 12 unidades (0,084 cajas por unidad, valor heredado de la V1), un pallet lleva 80 cajas y cada pallet consume 0,25 kg de film.

Overrides por SKU (`SUPPLY_BOM_BY_SKU`): los tres productos que se envasan con gatillo dosificador consumen `MP-14`; los dos líquidos que lo llevan **no** consumen la tapa rosca común de su familia.

| SKU | Agrega | Quita |
| --- | --- | --- |
| `LIQ-105` Desinfectante pisos 900 ml | `MP-14` (1 u/unidad) | `MP-13` |
| `LIQ-106` Limpiador multiuso 500 ml | `MP-14` (1 u/unidad) | `MP-13` |
| `CRE-204` Gel sanitizante 250 ml | `MP-14` (1 u/unidad) | — |

### 9.4 Órdenes de compra abiertas

Las cantidades se declaran en **días hábiles de consumo base** y se convierten a unidades en el catálogo, para que sigan siendo coherentes si cambia el dimensionamiento de la demanda. El costo usa el precio del proveedor.

| Orden | Proveedor | Material | Cantidad | Emisión | Prometida | Estimada | Estado | Costo | Riesgo de retraso |
| --- | --- | --- | ---: | --- | --- | --- | --- | ---: | ---: |
| `OC-2026-041` | `S1` | `MP-02` | 30.290 | 2026-02-20 | 2026-03-04 | 2026-03-04 | Confirmada | $ 45.677.320 | 10% |
| `OC-2026-042` | `S6` | `MP-14` | 218.210 | 2026-02-23 | 2026-03-05 | 2026-03-11 | Retrasada | $ 64.913.111 | 75% |
| `OC-2026-043` | `S3` | `MP-07` | 20.890 | 2026-02-17 | 2026-03-06 | 2026-03-10 | En transito | $ 43.843.932 | 35% |
| `OC-2026-044` | `S4` | `MP-10` | 311.150 | 2026-02-26 | 2026-03-03 | 2026-03-03 | En transito | $ 24.755.094 | 15% |
| `OC-2026-045` | `S2` | `MP-05` | 2.710 | 2026-02-24 | 2026-03-12 | 2026-03-17 | Retrasada | $ 27.175.880 | 60% |
| `OC-2026-046` | `S5` | `MP-12` | 51.410 | 2026-02-25 | 2026-03-09 | 2026-03-09 | Confirmada | $ 34.547.520 | 12% |
| `OC-2026-047` | `S3` | `MP-17` | 242.140 | 2026-02-27 | 2026-03-19 | 2026-03-19 | Pendiente | $ 47.740.322 | 40% |
| `OC-2026-048` | `S4` | `MP-13` | 225.450 | 2026-02-27 | 2026-03-06 | 2026-03-06 | Confirmada | $ 14.257.458 | 10% |
| `OC-2026-049` | `S5` | `MP-16` | 2.380 | 2026-02-18 | 2026-03-04 | 2026-03-13 | Retrasada | $ 36.985.200 | 55% |
| `OC-2026-050` | `S1` | `MP-01` | 160.760 | 2026-03-02 | 2026-03-10 | 2026-03-10 | Pendiente | $ 51.829.024 | 20% |

Solo las órdenes **confirmadas o en tránsito** que llegan dentro del horizonte se computan como abastecimiento firme en el stock proyectado. Las retrasadas y las pendientes de confirmación no: son el riesgo que el tablero debe mostrar, no un abastecimiento con el que se pueda contar.

### 9.5 Fórmulas

```
consumo_diario    = SUM_productos( demanda_diaria x consumo_por_unidad ) x (1 + scrap)
consumo_horizonte = consumo_diario x días_del_horizonte
stock_proyectado  = stock_disponible + órdenes_firmes_del_horizonte - consumo_horizonte
cobertura_días    = stock_disponible / consumo_diario        (si consumo = 0 → "sin consumo")
stock_seguridad   = días_de_seguridad_del_material x consumo_diario
punto_de_pedido   = (consumo_diario x lead_time_promedio) + stock_seguridad

requerimiento_neto = consumo_diario x (lead_time + ciclo_de_revisión)
                     + stock_seguridad - stock_disponible - órdenes_firmes
cantidad_sugerida  = redondear_arriba( max(requerimiento_neto, faltante_proyectado),
                                       cantidad_mínima_del_proveedor )
```

- **Ciclo de revisión de compras:** 5 días hábiles (`SUPPLY_REVIEW_PERIOD_DAYS`). La compra cubre el lead time más el tiempo hasta la próxima revisión del tablero, para no comprar el mismo material dos veces seguidas.
- **El caso sin consumo se maneja explícitamente:** no hay división por cero; el material se informa como *sin consumo* y queda fuera de promedios y gráficos de cobertura.
- **La cantidad sugerida puede superar al faltante estricto** por el redondeo al mínimo de compra del proveedor.

### 9.6 Clasificación de riesgo

Reglas explícitas, evaluadas **en orden y excluyentes**: cada material recibe un único nivel, y la interfaz muestra la regla exacta que se disparó.

| Riesgo | Regla exacta |
| --- | --- |
| **Crítico** | días hasta el quiebre ≤ días hasta la próxima entrega factible |
| **Alto** | cobertura < lead time, o el material tiene una orden abierta retrasada |
| **Medio** | cobertura < lead time máximo, o confiabilidad < 90%, o stock < punto de pedido |
| **Bajo** | ninguna de las anteriores |

La **próxima entrega factible** es la menor entre la llegada de la orden firme más cercana y un lead time completo (una compra emitida hoy). La distinción central del módulo es entre un quiebre **evitable** y uno **inevitable**: que el stock proyectado cierre negativo solo significa que hay que comprar durante el horizonte, que es la situación normal de cualquier material que no se stockea por un mes.

### 9.7 Motor de recomendaciones

Árbol de decisión determinista. Cada material recibe **una única acción principal**:

| Acción | Cuándo se emite |
| --- | --- |
| `Comprar de forma urgente` | Riesgo crítico y no hay orden abierta reprogramable |
| `Anticipar o reprogramar orden` | Riesgo crítico o alto y existe una orden abierta que no llega a tiempo o no es firme |
| `Emitir compra normal` | Riesgo alto o medio con cantidad sugerida mayor que cero |
| `Consolidar compra con otros materiales` | Riesgo bajo, hay que reponer y el mismo proveedor abastece otros materiales que también necesitan compra |
| `Monitorear` | No corresponde comprar todavía, pero el riesgo no es bajo |
| `No comprar` | Riesgo bajo sin necesidad de reposición, o material sin consumo |

**Nivel de confianza.** Refleja la calidad de los datos simulados que sostienen el cálculo, no la certeza de un modelo ni de una IA:

| Confianza | Condición |
| --- | --- |
| Baja | Confiabilidad del proveedor < 80%, o hay órdenes pendientes de confirmación, o el material no tiene consumo |
| Media | Confiabilidad < 90%, o el material tiene órdenes retrasadas |
| Alta | Proveedor confiable en el caso simulado y sin órdenes en discusión |

**Costos estimados.** El costo de la compra sugerida es `cantidad × precio del proveedor`. El costo de no actuar reparte el faltante proyectado entre los productos que consumen el material en proporción a su consumo, lo convierte a unidades de producto terminado dividiendo por el consumo unitario, y las valoriza al margen de contribución de cada producto. El KPI *costo estimado en riesgo* suma ese costo **solo de los materiales en riesgo alto o crítico**: en los demás el faltante se evita con una compra normal dentro del ciclo de revisión.

### 9.8 Escenarios del módulo

| Control | Rango | Qué mueve |
| --- | --- | --- |
| Variación de demanda | −20% a +30% (paso 5) | Consumo de todas las materias primas vía la BOM |
| Retraso adicional de proveedores | 0 a 10 días hábiles | Lead time de todos los proveedores y llegada estimada de las órdenes abiertas |
| Variación de confiabilidad | −20 a +10 p.p. | Confiabilidad de entrega; por debajo del 90% el material pasa a riesgo medio |
| Consumo adicional por scrap | 0 a +10% | Consumo de material sin aumentar las unidades vendidas |
| Horizonte de análisis | 7, 14 o 30 días hábiles | Consumo del horizonte, stock proyectado y qué órdenes se computan |

| Preset | Demanda | Retraso | Confiabilidad | Scrap | Horizonte |
| --- | ---: | ---: | ---: | ---: | ---: |
| Operación estable | 0% | 0 d | 0 p.p. | 0% | 14 d |
| Demanda elevada | +25% | 0 d | 0 p.p. | +4% | 14 d |
| Proveedor retrasado | 0% | 3 d | −10 p.p. | 0% | 14 d |
| Riesgo de quiebre | +30% | 8 d | −20 p.p. | +8% | 30 d |

El módulo **reutiliza la demanda** del planificador (mismo pronóstico base) pero **mantiene su propio estado de escenario**. Las variables del simulador global (capacidad de línea, tiempos de setup, multiplicador de faltante de producto terminado) no intervienen en una decisión de compra, y acoplarlas habría hecho que mover un control de compras alterara el plan de producción.

### 9.9 Persistencia de las decisiones

Las aprobaciones y el registro de decisiones se guardan **únicamente en el `localStorage` del navegador**, bajo la clave `optiflow.torre-abastecimiento.decisiones.v2`, con la forma `{ decisions, log }`. Sobreviven a recargas de la página, se pueden borrar desde la misma pantalla y el registro conserva las últimas 100 entradas.

- La lectura es defensiva: cualquier dato inválido se descarta en lugar de romper la página.
- El estado se lee **después del montaje**, para que el HTML del servidor coincida con el primer render del cliente.
- Si el navegador bloquea el almacenamiento (modo privado, cuota agotada), la demostración sigue funcionando en memoria.
- El usuario es siempre `Planificador`: no hay autenticación ni roles.

### 9.10 Limitaciones del módulo de abastecimiento

1. **Datos sintéticos.** Materiales, proveedores, precios, lead times y órdenes fueron construidos para el portfolio. No corresponden a ninguna empresa ni proveedor real.
2. **Sin ERP ni integración con sistemas de compras.** El stock, las órdenes y los precios son parte del caso.
3. **Sin pronóstico estadístico real.** La demanda es un valor puntual determinístico: no hay incertidumbre, ni stocks de seguridad por nivel de servicio, ni intervalos de confianza.
4. **Sin compra automática.** Ninguna acción emite una orden, contacta a un proveedor ni reserva capacidad.
5. **Sin validación de precios reales.** No se comparan cotizaciones, ni se aplican descuentos por volumen o condiciones negociadas.
6. **Sin restricción dura sobre el plan.** La falta de materia prima se informa y se valoriza, pero no bloquea corridas del plan de producción.
7. **Sin lectura de documentos ni IA generativa.** No se procesan remitos, facturas ni cotizaciones, y ningún texto proviene de un modelo de lenguaje: todos se arman con plantillas y los números calculados.
8. **Un solo depósito y un solo proveedor por material.** No hay múltiples plantas, proveedores alternativos ni compras repartidas entre varios orígenes.
9. **El consumo se distribuye de forma uniforme en el horizonte.** La proyección diaria usa el consumo medio, no el programa día a día del plan de producción, que solo cubre 5 días hábiles.
10. **El scrap es un porcentaje plano.** No depende del material, del producto ni de la etapa del proceso.
