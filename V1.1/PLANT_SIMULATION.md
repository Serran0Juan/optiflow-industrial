# Simulación visual de la planta

## Uso

Abrir `/planta`. Elegir un día del horizonte y el plan base o recomendado. Los parámetros globales de demanda, capacidad, setups y horas extra determinan el plan de partida. Los controles propios de la planta solo afectan esta simulación.

Se puede reproducir, pausar, cambiar la velocidad de reproducción, avanzar una hora o recorrer el reloj. **Ver cierre** muestra la última instantánea; **Proyección al cierre** siempre informa el resultado de simular la jornada completa. Seleccionar una línea permite inspeccionar sus etapas. El CSV contiene la serie completa por minuto, fecha, plan y parámetros.

## Datos heredados y supuestos

| Elemento | Origen o supuesto |
| --- | --- |
| L1, L2, L3; compatibilidades, productos y familias | Dataset existente de OptiFlow |
| Cantidad y orden de corridas; setups | Plan base o recomendado del día seleccionado |
| Ritmo nominal de una corrida | Unidades de la corrida / minutos de ejecución del plan |
| Calidad | Rendimiento de primera pasada del dataset, menos los puntos de pérdida adicional |
| Jornada | Comienza a las 06:00; 960 minutos más las horas extra ya asignadas, hasta 120 minutos adicionales |
| Disponibilidad | Se respeta la capacidad regular del día; los minutos no disponibles se colocan en ventanas ilustrativas centradas a las 10:00 y 18:00 |
| Etapas | Alimentación/preparación, proceso, calidad y embalaje; son etapas conceptuales |
| Velocidades relativas | 1,00; 1,00; 1,10; 1,12 veces el ritmo nominal, multiplicadas por el ajuste de velocidad |
| Espacio de espera | Por etapa y línea: mayor ritmo nominal del día × minutos de capacidad elegidos; mínimo una unidad |
| Despacho | Capacidad común en u/h; se reparte proporcionalmente al producto terminado en espera de cada línea |
| Estado inicial | Cero trabajo en proceso y producto terminado en expedición; no arrastra inventario entre días |
| Suministro | Material disponible al inicio o luego de la demora común configurada; no es una simulación de compras ni del inventario de la BOM |

## Modelo de flujo

El motor es determinista, con pasos de un minuto. Procesa las etapas desde la salida hacia la entrada para impedir que una unidad atraviese toda la planta en un mismo paso. Los grupos conservan su corrida y velocidad de origen dentro de las colas.

La alimentación nunca supera las unidades programadas. Un cambio de familia espera a que se vacíe el trabajo en proceso anterior; los productos ya embalados pueden seguir esperando despacho. Las paradas detienen toda la línea durante el intervalo configurado y pueden solaparse con pausas planificadas. La velocidad adicional no reduce el tiempo de setup. No se asignan automáticamente horas extra nuevas para recuperar incidentes.

El control de calidad descuenta rechazo una sola vez. Los rechazos no se reprocesan. Al llenarse una cola de salida, la etapa anterior pierde capacidad; si el despacho es insuficiente, ese bloqueo puede propagarse aguas arriba.

### Identidades de conservación

Para cada línea y para la planta, en cada instante:

```text
Ingresadas = conformes embaladas + rechazadas + trabajo en proceso
Conformes embaladas = despachadas + producto terminado en expedición
Ingresadas <= unidades programadas
Despachadas durante un minuto <= capacidad de despacho / 60
```

El trabajo en proceso suma las tres primeras colas; excluye la salida de embalaje. Las cantidades son fraccionarias en el modelo agregado y se muestran redondeadas; el CSV conserva tres decimales. Las unidades cuentan productos heterogéneos, no masa, litros ni pallets físicos.

## Comparación e interpretación

La referencia utiliza el mismo día y plan, con los parámetros normales de planta. El desvío durante la reproducción compara ambos resultados al mismo minuto. El cierre compara las jornadas completas. La referencia también incluye calidad, pausas y demora de recorrido, por lo que no equivale a producir el 100% de lo programado.

Los minutos de bloqueo de planta son la suma de minutos de línea; tres líneas bloqueadas durante un minuto suman tres. Las paradas informadas incluyen indisponibilidad planificada e incidentes mientras la línea tiene trabajo pendiente. El gráfico muestra producción conforme y despacho acumulados, y la referencia completa como guía.

## Alcance

El esquema no está a escala, no dimensiona una implantación física ni valida dotación o seguridad industrial. Los equipos, paquetes móviles y servicios auxiliares son ilustrativos. No presupone que los envases de L3 abastezcan internamente las otras líneas. No representa un sistema conectado a una planta real.

El planificador semanal sigue trabajando con cantidades brutas; sus costos, OEE y servicio no se modifican por este módulo. Para calibrarlo se necesitan mediciones reales de equipos, capacidades de almacenamiento, paradas, cambios, recorridos y calidad.

## Verificación

`npm run verify:plant` ejecuta verificaciones de conservación, reproducibilidad, límites de capacidad, no negatividad y efectos de los escenarios. Los chequeos de tipos, lint y build de la aplicación siguen aplicando al nuevo módulo.
