import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Note, PageHeader, TableWrap } from "@/components/ui/layout-bits";
import { Badge } from "@/components/ui/badge";
import {
  ANNUAL_HOLDING_RATE,
  BUSINESS_DAYS_PER_YEAR,
  CONTRIBUTION_MARGIN_RATE,
  HISTORY_BUSINESS_DAYS,
  STOCKOUT_PENALTY_RATE,
} from "@/lib/data/config";
import { dataset } from "@/lib/data/dataset";
import { formatCurrency, formatNumber, formatPercent, formatSeconds } from "@/lib/format";
import { runBalance } from "@/lib/balance";
import { BALANCE_PRESETS } from "@/lib/balance/scenarios";
import { assemblyLine, PRECEDENCE_COUNT } from "@/lib/data/assembly-line";
import { STATION_COST_PER_HOUR, UNMET_UNIT_COST } from "@/lib/data/line-config";
import { runSupply } from "@/lib/supply";
import { SUPPLY_PRESETS } from "@/lib/supply/scenarios";
import { supplySuppliers } from "@/lib/data/supply-catalog";
import {
  LOW_RELIABILITY_THRESHOLD,
  SUPPLY_REVIEW_PERIOD_DAYS,
} from "@/lib/data/supply-config";

const SECTIONS = [
  { id: "problema", label: "Problema abordado" },
  { id: "supuestos", label: "Supuestos del caso" },
  { id: "datos", label: "Tablas y variables" },
  { id: "priorizacion", label: "Logica de priorizacion" },
  { id: "economia", label: "Formula economica" },
  { id: "balanceo", label: "Balanceo de linea" },
  { id: "abastecimiento", label: "Torre de abastecimiento" },
  { id: "lean", label: "Desperdicios Lean" },
  { id: "limitaciones", label: "Limitaciones generales" },
  { id: "roadmap", label: "Roadmap V2.1" },
];

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <Card className="scroll-mt-28" >
      <div id={id} className="scroll-mt-28">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-relaxed text-steel-700">{children}</CardContent>
      </div>
    </Card>
  );
}

function Formula({ children }: { children: ReactNode }) {
  return (
    <pre className="scroll-x rounded-md bg-navy-800 px-4 py-3 font-mono text-xs leading-relaxed text-navy-50">
      {children}
    </pre>
  );
}

export default function MethodologyPage() {
  const holdingExample = dataset.products[0];
  // Referencia del modulo de balanceo: preset "Operacion estable", calculado
  // con las mismas funciones que usa la pagina, sin numeros escritos a mano.
  const balanceReference = runBalance(BALANCE_PRESETS[0].scenario);
  const balanceInitial = balanceReference.comparison.initial;
  const balanceRecommended = balanceReference.comparison.recommended;
  // Referencia de la Torre de abastecimiento: preset "Operacion estable",
  // calculado con las mismas funciones que usa la pagina del modulo.
  const supplyReference = runSupply(SUPPLY_PRESETS[0].scenario);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Metodologia"
        description="Como se construye el caso, que decide exactamente el planificador, con que formulas se valoriza el plan y que queda deliberadamente fuera de esta primera version."
      />

      <nav className="flex flex-wrap gap-2" aria-label="Secciones de la metodologia">
        {SECTIONS.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="rounded-md border border-line bg-surface px-3 py-1.5 text-xs font-medium text-steel-600 transition-colors hover:border-navy-200 hover:text-navy-700"
          >
            {section.label}
          </a>
        ))}
      </nav>

      <Section
        id="problema"
        title="Problema industrial abordado"
        description="Programacion semanal de produccion en una planta multiproducto con cambios de formato costosos."
      >
        <p>
          Una planta de productos de limpieza y envases plasticos debe decidir, cada semana, que
          producir en cada una de sus tres lineas y en que orden. La decision no es trivial porque
          los objetivos se contradicen entre si:
        </p>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>
            atender la demanda de 18 productos terminados evitando quiebres de stock, que cuestan
            margen y penalidades comerciales;
          </li>
          <li>
            minimizar los cambios de formato entre familias, que detienen la linea y consumen
            capacidad util;
          </li>
          <li>
            evitar horas extra, que son la forma mas cara de conseguir capacidad adicional;
          </li>
          <li>
            no inflar el inventario de producto terminado, que inmoviliza capital de trabajo.
          </li>
        </ul>
        <p>
          Optimizar cualquiera de esos objetivos por separado empeora los otros. La aplicacion
          construye un plan que los pondera de forma explicita y lo compara contra una planificacion
          simple por orden comercial, para dimensionar cuanto vale la decision de secuenciamiento.
        </p>
        <Note tone="warning" title="Caso simulado">
          Los 18 productos, las tres lineas, los 90 dias de historial, los costos, los proveedores y
          todos los resultados son sinteticos. Fueron generados con una semilla fija ({dataset.seed})
          para que el caso sea reproducible. No corresponden a ninguna empresa real ni representan
          ahorros obtenidos en una operacion real.
        </Note>
      </Section>

      <Section
        id="supuestos"
        title="Supuestos del caso"
        description="Reglas de negocio y simplificaciones adoptadas para que el modelo sea explicable."
      >
        <ul className="ml-5 list-disc space-y-1.5">
          <li>
            Horizonte de <strong>{dataset.planningDays.length} dias habiles</strong>, con historial de{" "}
            <strong>{HISTORY_BUSINESS_DAYS} dias habiles</strong> de demanda por producto.
          </li>
          <li>
            La produccion de un dia queda disponible <strong>ese mismo dia</strong>; la demanda se
            atiende al cierre de la jornada.
          </li>
          <li>
            La demanda no atendida se <strong>pierde</strong>: no se arrastra como pedido pendiente al
            dia siguiente.
          </li>
          <li>
            Cada linea arranca la semana con una familia ya montada, heredada del periodo anterior.
            Cambiar de familia consume los minutos de la matriz de setup; dentro de la misma familia
            el cambio menor esta contemplado en la parada planificada diaria.
          </li>
          <li>
            La capacidad diaria de cada linea es{" "}
            <code className="rounded bg-steel-100 px-1 py-0.5 font-mono text-xs">
              turnos x horas x 60 - parada planificada
            </code>
            , ajustada luego por los eventos de disponibilidad y por el escenario.
          </li>
          <li>
            El stock de seguridad se mantiene <strong>tambien al cierre del horizonte</strong>: ambos
            planes reponen para el lunes siguiente, de modo que la comparacion sea justa.
          </li>
          <li>
            El abastecimiento se verifica pero no restringe el plan: se calcula el consumo de materia
            prima y su cobertura, sin frenar corridas por falta de insumos.
          </li>
          <li>Todos los importes estan en pesos argentinos simulados, sin inflacion intra-semana.</li>
        </ul>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-navy-800">Parametros de las lineas</h3>
          <TableWrap>
            <thead>
              <tr>
                <th>Linea</th>
                <th>Familias habilitadas</th>
                <th className="text-right">Jornada normal</th>
                <th className="text-right">Tope hora extra</th>
                <th className="text-right">Costo hora extra</th>
                <th className="text-right">Costo horario de setup</th>
                <th>Familia montada al inicio</th>
              </tr>
            </thead>
            <tbody>
              {dataset.lines.map((line) => (
                <tr key={line.id}>
                  <td className="whitespace-nowrap">
                    <span className="font-medium text-navy-800">{line.id}</span>
                    <span className="ml-1.5 text-steel-500">
                      {line.name.replace(`${line.id} - `, "")}
                    </span>
                  </td>
                  <td>{line.familiesAllowed.join(", ")}</td>
                  <td className="numeric">{formatNumber(line.regularMinutesPerDay)} min/dia</td>
                  <td className="numeric">{formatNumber(line.maxOvertimeMinutesPerDay)} min/dia</td>
                  <td className="numeric">{formatCurrency(line.overtimeCostPerHour)}/h</td>
                  <td className="numeric">{formatCurrency(line.setupCostPerHour)}/h</td>
                  <td>
                    <Badge variant="neutral">{line.initialFamilyId}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-navy-800">
            Matriz de cambio de formato (minutos)
          </h3>
          <TableWrap>
            <thead>
              <tr>
                <th>Linea</th>
                <th>Transicion</th>
                <th className="text-right">Minutos</th>
                <th className="text-right">Costo del cambio</th>
              </tr>
            </thead>
            <tbody>
              {dataset.setupTimes
                .filter((entry) => entry.minutes > 0)
                .map((entry) => {
                  const line = dataset.lines.find((item) => item.id === entry.lineId)!;
                  return (
                    <tr key={`${entry.lineId}-${entry.fromFamily}-${entry.toFamily}`}>
                      <td className="font-medium text-navy-800">{entry.lineId}</td>
                      <td>
                        {entry.fromFamily} a {entry.toFamily}
                      </td>
                      <td className="numeric">{entry.minutes}</td>
                      <td className="numeric">
                        {formatCurrency((entry.minutes / 60) * line.setupCostPerHour)}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </TableWrap>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-navy-800">Eventos de disponibilidad</h3>
          <TableWrap>
            <thead>
              <tr>
                <th>Linea</th>
                <th>Dia</th>
                <th className="text-right">Disponibilidad</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {dataset.availabilityEvents.map((event) => (
                <tr key={`${event.lineId}-${event.dayIndex}`}>
                  <td className="font-medium text-navy-800">{event.lineId}</td>
                  <td>{dataset.planningDays[event.dayIndex].label}</td>
                  <td className="numeric">{formatPercent(event.availabilityFactor, 0)}</td>
                  <td className="text-steel-600">{event.reason}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </div>
      </Section>

      <Section
        id="datos"
        title="Tablas y variables utilizadas"
        description="Estructura del dataset sintetico que alimenta al planificador."
      >
        <TableWrap>
          <thead>
            <tr>
              <th>Entidad</th>
              <th className="text-right">Registros</th>
              <th>Variables principales</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="font-medium text-navy-800">Productos</td>
              <td className="numeric">{dataset.products.length}</td>
              <td>
                SKU, familia, costo unitario, margen de contribucion, penalidad por faltante, costo
                de mantener, stock inicial, dias de stock de seguridad, cobertura maxima, tamano de
                lote, linea preferida y alternativas, prioridad comercial.
              </td>
            </tr>
            <tr>
              <td className="font-medium text-navy-800">Familias</td>
              <td className="numeric">{dataset.families.length}</td>
              <td>Identificador, descripcion tecnica y color para la trazabilidad visual.</td>
            </tr>
            <tr>
              <td className="font-medium text-navy-800">Lineas</td>
              <td className="numeric">{dataset.lines.length}</td>
              <td>
                Turnos, horas por turno, parada planificada, minutos de jornada normal, tope de hora
                extra, costo de hora extra, costo horario de setup, familias habilitadas.
              </td>
            </tr>
            <tr>
              <td className="font-medium text-navy-800">Velocidades linea-producto</td>
              <td className="numeric">{dataset.rates.length}</td>
              <td>Unidades por minuto de cada combinacion valida de linea y producto.</td>
            </tr>
            <tr>
              <td className="font-medium text-navy-800">Matriz de setup</td>
              <td className="numeric">{dataset.setupTimes.length}</td>
              <td>Minutos de cambio de formato por linea y transicion entre familias.</td>
            </tr>
            <tr>
              <td className="font-medium text-navy-800">Historial de demanda</td>
              <td className="numeric">{formatNumber(dataset.demandHistory.length)}</td>
              <td>
                Unidades por producto y dia habil, con estacionalidad semanal, tendencia, ruido y
                picos ocasionales.
              </td>
            </tr>
            <tr>
              <td className="font-medium text-navy-800">Eventos de disponibilidad</td>
              <td className="numeric">{dataset.availabilityEvents.length}</td>
              <td>Factor de disponibilidad por linea y dia del horizonte, con su motivo.</td>
            </tr>
            <tr>
              <td className="font-medium text-navy-800">Materias primas</td>
              <td className="numeric">{dataset.rawMaterials.length}</td>
              <td>Unidad de medida, costo, stock inicial, proveedor y cobertura minima deseada.</td>
            </tr>
            <tr>
              <td className="font-medium text-navy-800">Lista de materiales (BOM)</td>
              <td className="numeric">{dataset.bom.length}</td>
              <td>Consumo de cada materia prima por unidad de producto terminado.</td>
            </tr>
            <tr>
              <td className="font-medium text-navy-800">Proveedores</td>
              <td className="numeric">{dataset.suppliers.length}</td>
              <td>Lead time, entregas por semana y confiabilidad simulada.</td>
            </tr>
          </tbody>
        </TableWrap>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-navy-800">Pronostico de demanda</h3>
          <p className="mb-2">
            El pronostico del horizonte se calcula a partir del historial, sin modelos opacos:
          </p>
          <Formula>{`base(p)      = media ponderada de los ultimos 20 dias habiles (peso lineal creciente)
indice(p,d) = media de las ultimas 6 observaciones del mismo dia de semana
              / media de los ultimos 30 dias habiles, acotado a [0,80 ; 1,20]
demanda(p,d) = redondeo_10( base(p) x indice(p,d) ) x (1 + variacion_escenario)`}</Formula>
        </div>
      </Section>

      <Section
        id="priorizacion"
        title="Logica de priorizacion"
        description="Que hace exactamente cada planificador. Ambos reciben el mismo contexto: mismo pronostico, misma capacidad, mismos costos."
      >
        <div>
          <h3 className="mb-2 text-sm font-semibold text-navy-800">Plan base (referencia)</h3>
          <ol className="ml-5 list-decimal space-y-1.5">
            <li>Ordena los 18 productos por volumen proyectado descendente (orden comercial fijo).</li>
            <li>
              Para cada dia y en ese orden, cubre la demanda del dia mas el stock de seguridad, sin
              mirar los dias siguientes.
            </li>
            <li>Usa siempre la linea preferida del producto: no balancea carga entre lineas.</li>
            <li>
              Cambia de formato cada vez que el orden comercial lo pide, sin evaluar su costo. La
              unica excepcion es no cambiar para una corrida menor a 15 minutos.
            </li>
            <li>
              Si al terminar la jornada normal queda demanda del dia sin cubrir, agrega hora extra sin
              analisis costo-beneficio.
            </li>
          </ol>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-navy-800">
            Plan recomendado (heuristica constructiva)
          </h3>
          <ol className="ml-5 list-decimal space-y-1.5">
            <li>
              <strong>Asignacion linea-producto.</strong> Cada producto se asigna a la linea que
              minimiza utilizacion proyectada + penalidad por linea mas lenta - bonificacion por
              concentrar su familia. Es lo que permite descargar una linea saturada sobre otra libre.
            </li>
            <li>
              <strong>Bloques por familia.</strong> Para cada linea y dia, los productos se agrupan
              por familia. Se empieza siempre por la familia ya montada, cuyo cambio de formato cuesta
              cero minutos.
            </li>
            <li>
              <strong>Prioridad por riesgo.</strong> Dentro del bloque, los productos se ordenan por
              dias de cobertura ascendente: primero el que se queda sin stock antes.
            </li>
            <li>
              <strong>Compuerta economica del setup.</strong> Un cambio de formato se ejecuta solo si
              el faltante que evita en los proximos dos dias supera su costo. Ademas, el bloque
              completo se simula antes de comprometer el setup: pagar un cambio para producir cero
              seria desperdicio puro.
            </li>
            <li>
              <strong>Extension de corrida.</strong> Con la capacidad ociosa que queda, se extiende la
              ultima corrida montada para cubrir tambien el dia siguiente, evitando un setup manana.
              El techo de cobertura maxima por producto impide que esto degenere en sobrestock.
            </li>
            <li>
              <strong>Derivacion a linea alternativa.</strong> Los faltantes que siguen abiertos se
              intentan cubrir en otra linea habilitada con capacidad libre.
            </li>
            <li>
              <strong>Hora extra como ultimo recurso.</strong> Solo se habilita si el faltante evitado
              supera el costo de esa hora extra mas el setup asociado.
            </li>
          </ol>
        </div>

        <Note tone="info" title="Es una heuristica, no un optimo">
          El plan recomendado es una <strong>recomendacion heuristica</strong> construida de forma
          golosa con reglas economicas explicitas. No hay garantia de optimalidad: un modelo de
          programacion entera mixta podria encontrar planes mejores, a costa de tiempo de calculo y de
          perder la trazabilidad de cada decision, que aca es el objetivo principal.
        </Note>
      </Section>

      <Section
        id="economia"
        title="Formula economica"
        description="Un unico modelo de costos valoriza los dos planes, de manera que la comparacion sea directa."
      >
        <Formula>{`costo_setup      = SUM( minutos_setup(linea, dia) / 60 x costo_horario_setup(linea) )
costo_hora_extra = SUM( minutos_hora_extra(linea, dia) / 60 x costo_hora_extra(linea) )
costo_inventario = SUM( stock_final(producto, dia) x costo_mantener(producto) )
costo_faltante   = SUM( unidades_no_atendidas(producto, dia) x costo_faltante(producto) )

costo_total      = costo_setup + costo_hora_extra + costo_inventario + costo_faltante`}</Formula>

        <p>Donde cada parametro se deriva del dataset de la siguiente forma:</p>
        <Formula>{`costo_mantener(p)  = costo_unitario(p) x ${formatNumber(ANNUAL_HOLDING_RATE * 100, 0)}% / ${BUSINESS_DAYS_PER_YEAR} dias habiles
costo_faltante(p)  = ( margen_contribucion(p) + penalidad_comercial(p) ) x multiplicador_escenario
margen(p)          = costo_unitario(p) x ${formatNumber(CONTRIBUTION_MARGIN_RATE * 100, 0)}%
penalidad(p)       = costo_unitario(p) x ${formatNumber(STOCKOUT_PENALTY_RATE * 100, 0)}%`}</Formula>

        <p>
          Ejemplo con {holdingExample.sku} ({holdingExample.name}), de costo unitario{" "}
          {formatCurrency(holdingExample.unitCost)}: mantener una unidad un dia cuesta{" "}
          {formatCurrency(holdingExample.holdingCostPerUnitPerDay)} y no atender una unidad cuesta{" "}
          {formatCurrency(holdingExample.contributionMargin + holdingExample.stockoutPenaltyPerUnit)}{" "}
          antes del multiplicador del escenario.
        </p>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-navy-800">Indicadores derivados</h3>
          <Formula>{`nivel_de_servicio  = unidades_entregadas / unidades_demandadas
utilizacion        = minutos_usados_en_jornada_normal / minutos_de_jornada_normal_disponibles
horas_de_setup     = minutos_de_cambio_de_formato / 60
costo_evitado      = costo_total(plan base) - costo_total(plan recomendado)`}</Formula>
          <p className="mt-2">
            <strong>El costo evitado tiene una unica definicion</strong>: la resta de los costos
            totales de ambos planes bajo el mismo escenario. Si el resultado es negativo, la
            aplicacion lo informa como empeoramiento del escenario y no como ahorro. No existe ninguna
            otra metrica de ahorro en el sistema.
          </p>
          <p>
            Los minutos que exceden la capacidad de jornada normal de una linea-dia se imputan como
            hora extra, en el orden en que fueron programados. Por eso la utilizacion nunca supera el
            100%: el exceso se reporta por separado como horas extra.
          </p>
        </div>
      </Section>

      <Section
        id="balanceo"
        title="Balanceo de linea y capacidad"
        description="Segundo caso simulado (V1.1): como se reparte el contenido de trabajo de una linea de ensamble entre estaciones y que capacidad resulta de esa decision."
      >
        <p>
          El modulo de <strong>Balanceo de linea</strong> trabaja sobre un caso distinto del
          planificador semanal: una linea de ensamble de {assemblyLine.tasks.length} tareas que
          fabrica {assemblyLine.product.toLowerCase()}. Aca la pregunta no es que producir, sino{" "}
          <strong>como repartir el trabajo entre puestos</strong> para que la linea sostenga el ritmo
          que exige la demanda sin pagar capacidad que no se usa.
        </p>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-navy-800">Conceptos base</h3>
          <dl className="space-y-2.5">
            <div>
              <dt className="font-medium text-navy-800">Takt time</dt>
              <dd>
                El ritmo que <em>impone la demanda</em>: cada cuantos segundos tiene que salir una
                unidad para cumplir el programa. Es tiempo disponible dividido demanda. No depende de
                como este armada la linea; es un objetivo, no un resultado.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-navy-800">Tiempo de ciclo</dt>
              <dd>
                El ritmo que <em>logra la linea</em>: la carga de la estacion mas cargada. Una unidad
                no puede avanzar mas rapido que el puesto mas lento. Si el tiempo de ciclo supera al
                takt time, la linea no llega a la demanda por mucho que se apure el resto de los
                puestos.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-navy-800">Relacion de precedencia</dt>
              <dd>
                Una tarea que no puede empezar hasta que otra termino: no se puede roscar la tapa
                antes de llenar el envase. Cualquier asignacion valida debe colocar cada tarea en la
                misma estacion que sus predecesoras o en una posterior. Es la restriccion que impide
                repartir el trabajo libremente.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-navy-800">Eficiencia de linea</dt>
              <dd>
                Que porcentaje del tiempo pagado se dedica efectivamente a trabajar: contenido total
                de trabajo sobre el tiempo total ofrecido por las estaciones (estaciones por tiempo
                de ciclo).
              </dd>
            </div>
            <div>
              <dt className="font-medium text-navy-800">Perdida por desbalance</dt>
              <dd>
                El complemento de la eficiencia. Es el tiempo que las estaciones menos cargadas pasan
                esperando al cuello de botella: se paga igual y no produce nada.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-navy-800">Cuello de botella</dt>
              <dd>
                La estacion de mayor carga. Fija el tiempo de ciclo y, con el, la capacidad diaria de
                toda la linea.
              </dd>
            </div>
          </dl>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-navy-800">Formulas del modulo</h3>
          <Formula>{`tiempo_disponible_diario = minutos_por_turno x 60 x cantidad_de_turnos
takt_time                = tiempo_disponible_diario / demanda_diaria
contenido_de_trabajo     = SUM( tiempo_estandar(tarea) )
estaciones_teoricas_min  = techo( contenido_de_trabajo / takt_time )
tiempo_de_ciclo          = MAX( carga_total(estacion) )
capacidad_diaria         = piso( tiempo_disponible_diario / tiempo_de_ciclo )
eficiencia_de_linea      = contenido_de_trabajo / ( estaciones x tiempo_de_ciclo )
perdida_por_desbalance   = 1 - eficiencia_de_linea
tiempo_ocioso_por_ciclo  = ( estaciones x tiempo_de_ciclo ) - contenido_de_trabajo
brecha_de_capacidad      = capacidad_diaria - demanda_diaria`}</Formula>
          <p className="mt-2">
            Con el escenario de referencia &quot;{BALANCE_PRESETS[0].name}&quot;:{" "}
            {formatNumber(balanceRecommended.metrics.dailyDemandUnits)} unidades diarias y{" "}
            {formatNumber(balanceRecommended.metrics.availableSeconds / 3600, 1)} horas disponibles
            dan un takt time de {formatSeconds(balanceRecommended.metrics.taktSeconds)}. El contenido
            de trabajo es de {formatSeconds(balanceRecommended.metrics.totalWorkSeconds)}, de modo que
            el minimo teorico es de {formatNumber(balanceRecommended.metrics.theoreticalMinStations)}{" "}
            estaciones.
          </p>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-navy-800">Modelo economico del modulo</h3>
          <Formula>{`costo_estaciones   = estaciones x ( tiempo_disponible_diario / 3600 ) x ${formatNumber(STATION_COST_PER_HOUR)}
costo_no_atendido  = unidades_no_atendidas x ${formatNumber(UNMET_UNIT_COST)}
costo_total        = costo_estaciones + costo_no_atendido

costo_del_ocio     = costo_estaciones x perdida_por_desbalance   (indicador, NO se suma)
diferencia         = costo_total(inicial) - costo_total(recomendado)`}</Formula>
          <p className="mt-2">
            El <strong>costo del tiempo ocioso no se suma como un concepto aparte</strong>: es la
            porcion del costo de estaciones que se paga sin agregar valor. Sumarlo ademas del costo de
            estaciones contaria dos veces el mismo peso e inflaria artificialmente la diferencia entre
            las dos distribuciones. Se informa como indicador y como apertura del grafico de costo.
          </p>
          <p>
            La diferencia tiene una unica definicion: costo total de la distribucion inicial menos
            costo total del balance recomendado, bajo el mismo escenario. Si el resultado es negativo
            se muestra como empeoramiento del escenario, nunca como ahorro. Cuando es favorable se la
            informa siempre como <strong>diferencia estimada dentro del caso simulado</strong>, no
            como un ahorro real.
          </p>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-navy-800">
            Metodo heuristico: peso posicional (RPW)
          </h3>
          <ol className="ml-5 list-decimal space-y-1.5">
            <li>
              Se calcula el <strong>peso posicional</strong> de cada tarea: su tiempo estandar mas el
              de todas sus sucesoras, directas e indirectas. Mide cuanto trabajo queda colgando de esa
              tarea.
            </li>
            <li>
              Se ordenan las tareas por peso posicional descendente. El desempate por codigo mantiene
              el resultado determinista.
            </li>
            <li>
              Se abre una estacion y se recorre la lista colocando la primera tarea que{" "}
              <em>entre en el limite de ciclo</em> y cuyas predecesoras ya esten asignadas. Cada vez
              que se coloca una tarea se vuelve a recorrer desde el principio, porque esa asignacion
              pudo habilitar tareas antes bloqueadas.
            </li>
            <li>
              Cuando ninguna tarea elegible entra en el remanente, se cierra la estacion y se abre
              otra. El limite nunca baja de la tarea mas larga: si lo hiciera, esa tarea no entraria
              en ninguna estacion.
            </li>
            <li>
              <strong>Pasada de suavizado.</strong> La primera pasada usa el takt time como limite y
              define cuantas estaciones hacen falta. Con esa cantidad fija, se busca el menor tiempo
              de ciclo entero que siga entrando en ellas: reparte la carga, baja el cuello de botella
              y sube la capacidad sin agregar personal. Si el escenario habilita una estacion
              adicional, el objetivo pasa a ser una estacion mas y el ciclo puede acortarse aun mas, a
              costa de un operario extra.
            </li>
          </ol>
          <p className="mt-2">
            En la referencia estable la distribucion inicial trabaja con{" "}
            {formatNumber(balanceInitial.metrics.stationCount)} estaciones y un ciclo de{" "}
            {formatSeconds(balanceInitial.metrics.cycleSeconds)} (
            {formatPercent(balanceInitial.metrics.lineEfficiency)} de eficiencia), y el balance
            recomendado llega a {formatSeconds(balanceRecommended.metrics.cycleSeconds)} con{" "}
            {formatNumber(balanceRecommended.metrics.stationCount)} estaciones (
            {formatPercent(balanceRecommended.metrics.lineEfficiency)}).
          </p>
        </div>

        <Note tone="info" title="Es una heuristica, no un optimo">
          El balanceo de lineas de ensamble (problema SALBP) es NP-dificil. El peso posicional es una
          regla constructiva golosa: entrega una solucion buena y explicable en un paso, pero{" "}
          <strong>no garantiza el minimo numero de estaciones ni el minimo tiempo de ciclo</strong>.
          Por eso el resultado se llama siempre <strong>balance recomendado por heuristica</strong> y
          la aplicacion muestra el minimo teorico como referencia, no como promesa.
        </Note>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-navy-800">Datos del caso simulado</h3>
          <TableWrap>
            <thead>
              <tr>
                <th>Variable</th>
                <th>Valor</th>
                <th>Comentario</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-medium text-navy-800">Tareas</td>
                <td className="numeric">{assemblyLine.tasks.length}</td>
                <td>Secuencia completa del ensamble, con tiempo estandar en segundos.</td>
              </tr>
              <tr>
                <td className="font-medium text-navy-800">Etapas</td>
                <td className="numeric">{assemblyLine.stages.length}</td>
                <td>{assemblyLine.stages.map((stage) => stage.name).join(", ")}.</td>
              </tr>
              <tr>
                <td className="font-medium text-navy-800">Relaciones de precedencia</td>
                <td className="numeric">{PRECEDENCE_COUNT}</td>
                <td>Se validan al construir el caso: sin ciclos y compatibles con la asignacion inicial.</td>
              </tr>
              <tr>
                <td className="font-medium text-navy-800">Demanda diaria base</td>
                <td className="numeric">{formatNumber(assemblyLine.baseDailyDemandUnits)} u</td>
                <td>Ajustable entre -20% y +30% desde el escenario.</td>
              </tr>
              <tr>
                <td className="font-medium text-navy-800">Tiempo por turno</td>
                <td className="numeric">{formatNumber(assemblyLine.baseShiftMinutes)} min</td>
                <td>Jornada de 8 h menos refrigerio, arranque, limpieza y reuniones de piso.</td>
              </tr>
              <tr>
                <td className="font-medium text-navy-800">Turnos por dia</td>
                <td className="numeric">{assemblyLine.baseShiftCount}</td>
                <td>Configurable en 1, 2 o 3 turnos.</td>
              </tr>
              <tr>
                <td className="font-medium text-navy-800">Costo por hora de estacion</td>
                <td className="numeric">{formatCurrency(assemblyLine.stationCostPerHour)}</td>
                <td>
                  <strong>Supuesto del caso:</strong> operario, puesto y servicios, en pesos
                  simulados.
                </td>
              </tr>
              <tr>
                <td className="font-medium text-navy-800">Costo por unidad no atendida</td>
                <td className="numeric">{formatCurrency(assemblyLine.unmetUnitCost)}</td>
                <td>
                  <strong>Supuesto del caso:</strong> margen de contribucion perdido por cada unidad
                  que la linea no llega a producir.
                </td>
              </tr>
            </tbody>
          </TableWrap>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-navy-800">
            Desperdicios Lean que expone el balanceo
          </h3>
          <TableWrap>
            <thead>
              <tr>
                <th>Desperdicio</th>
                <th>Como aparece en la linea simulada</th>
                <th>Como lo mide el modulo</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-medium text-navy-800">Espera</td>
                <td>
                  Los puestos livianos terminan antes y esperan a que el cuello de botella libere la
                  pieza.
                </td>
                <td>Ociosidad por estacion y tiempo ocioso por ciclo.</td>
              </tr>
              <tr>
                <td className="font-medium text-navy-800">Tiempo ocioso</td>
                <td>Horas de operario pagadas que no agregan valor por el desbalance de cargas.</td>
                <td>
                  Perdida por desbalance y su valorizacion como porcion del costo de estaciones.
                </td>
              </tr>
              <tr>
                <td className="font-medium text-navy-800">Sobreproduccion</td>
                <td>
                  Puestos rapidos que siguen produciendo por delante del cuello de botella sin que la
                  linea entregue mas.
                </td>
                <td>
                  Comparacion de la carga de cada estacion contra el takt time: producir por debajo
                  del takt no aumenta la salida.
                </td>
              </tr>
              <tr>
                <td className="font-medium text-navy-800">Inventario en proceso (WIP)</td>
                <td>Material acumulado delante de la estacion mas cargada.</td>
                <td>
                  Identificacion del cuello de botella y de la diferencia de carga entre estaciones
                  contiguas.
                </td>
              </tr>
              <tr>
                <td className="font-medium text-navy-800">Incumplimiento de demanda</td>
                <td>La linea no alcanza el volumen comprometido con comercial.</td>
                <td>
                  Brecha de capacidad, unidades no atendidas y su costo con el supuesto declarado.
                </td>
              </tr>
              <tr>
                <td className="font-medium text-navy-800">
                  Movimientos administrativos por replanificacion
                </td>
                <td>Rehacer el balanceo en planillas cada vez que cambia la demanda o el turno.</td>
                <td>
                  El escenario completo se recalcula de forma determinista y cada tarea queda con su
                  peso posicional y su estacion asignada a la vista.
                </td>
              </tr>
            </tbody>
          </TableWrap>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-navy-800">
            Limitaciones del modulo de balanceo
          </h3>
          <ul className="ml-5 list-disc space-y-1.5">
            <li>
              <strong>Caso sintetico.</strong> Las {assemblyLine.tasks.length} tareas, sus tiempos,
              sus precedencias y los costos fueron construidos para el portfolio. No corresponden a
              ninguna linea real.
            </li>
            <li>
              <strong>Tiempos estandar sin variabilidad estocastica.</strong> Cada tarea dura siempre
              exactamente lo mismo: no se modelan distribuciones, fatiga, curva de aprendizaje ni
              microparadas. Una linea real necesita colchones que el modelo no calcula.
            </li>
            <li>
              <strong>Sin ergonomia ni layout fisico.</strong> No se verifica si las tareas que caen
              en una misma estacion son compatibles en espacio, herramientas, altura de trabajo o
              esfuerzo del operario.
            </li>
            <li>
              <strong>Sin calidad en detalle.</strong> No se modelan scrap, retrabajo ni el efecto de
              un rechazo sobre el flujo aguas abajo.
            </li>
            <li>
              <strong>Sin optimizacion matematica exacta.</strong> Es una heuristica constructiva: no
              entrega cota de optimalidad ni explora asignaciones alternativas.
            </li>
            <li>
              <strong>Una sola linea, un solo producto.</strong> No hay modelos mixtos, ni estaciones
              en paralelo, ni buffers entre puestos.
            </li>
            <li>
              <strong>Sin ordenes de compra ni dotacion real.</strong> Habilitar una estacion supone
              que el operario esta disponible; no se modela contratacion ni curva de arranque.
            </li>
          </ul>
        </div>
      </Section>

      <Section
        id="abastecimiento"
        title="Torre de abastecimiento"
        description="Tercer modulo (V2): como se traduce la demanda en consumo de materia prima, como se mide el riesgo de quiebre y como se construye una recomendacion de compra explicable."
      >
        <p>
          El planificador decide <strong>que producir</strong> y el balanceo decide{" "}
          <strong>como repartir el trabajo</strong>. La Torre de abastecimiento responde una tercera
          pregunta: <strong>que comprar, cuanto y cuando</strong> para que el plan sea ejecutable. El
          modulo toma la demanda proyectada, la multiplica por la lista de materiales y obtiene el
          consumo de cada una de las {supplyReference.rows.length} materias primas del caso, que
          abastecen {supplySuppliers.length} proveedores con {supplyReference.orders.length} ordenes
          de compra abiertas.
        </p>

        <Note tone="info" title="Todos los plazos se expresan en dias habiles">
          Cobertura, lead time, horizonte y fechas de las ordenes usan la misma unidad que el
          horizonte del plan: dias habiles de planta. Asi la cobertura de un material y el lead time
          de su proveedor son directamente comparables, sin factores de conversion escondidos.
        </Note>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-navy-800">
            Que es la cobertura de inventario
          </h3>
          <p>
            La cobertura responde <strong>cuantos dias de produccion aguanta el stock actual</strong>{" "}
            si el consumo se mantiene. Es la forma de comparar un tanque de hipoclorito con una caja
            de etiquetas: no en litros contra unidades, sino en dias.
          </p>
          <Formula>{`consumo_diario   = SUM_productos( demanda_diaria_producto x consumo_por_unidad ) x (1 + scrap)
consumo_horizonte = consumo_diario x dias_del_horizonte
cobertura_dias   = stock_disponible / consumo_diario`}</Formula>
          <p className="mt-2">
            Si un material no tiene consumo en el horizonte, la division no se ejecuta: el material se
            informa como <strong>&quot;sin consumo&quot;</strong> y queda fuera de los promedios y de
            los graficos de cobertura. Nunca se divide por cero ni se muestra un infinito.
          </p>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-navy-800">
            Stock proyectado y punto de pedido
          </h3>
          <Formula>{`stock_proyectado = stock_disponible + ordenes_firmes_del_horizonte - consumo_horizonte
punto_de_pedido  = (consumo_diario x lead_time_promedio) + stock_de_seguridad
stock_de_seguridad = dias_de_seguridad_del_material x consumo_diario`}</Formula>
          <p className="mt-2">
            <strong>Orden firme</strong> significa confirmada o en transito y con llegada estimada
            dentro del horizonte. Las ordenes retrasadas y las pendientes de confirmacion{" "}
            <strong>no se computan</strong>: son justamente el riesgo que el tablero tiene que
            mostrar, no un abastecimiento con el que se pueda contar.
          </p>
          <p>
            El <strong>punto de pedido</strong> es el nivel de stock a partir del cual hay que emitir
            la compra para no quedarse sin material mientras el proveedor produce y entrega. Cubre el
            consumo durante el lead time y deja el stock de seguridad intacto como colchon.
          </p>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-navy-800">
            Lead time, stock de seguridad y riesgo de quiebre
          </h3>
          <p>
            Los tres conceptos son la misma historia contada en tres tiempos. El{" "}
            <strong>lead time</strong> es cuanto tarda el proveedor en reponer; la{" "}
            <strong>cobertura</strong> es cuanto aguanta la planta; el{" "}
            <strong>stock de seguridad</strong> es el margen que se reserva para absorber un desvio de
            demanda o una entrega tarde. Cuando la cobertura cae por debajo del lead time, el material
            depende exclusivamente de lo que ya esta en camino.
          </p>
          <p>
            La distincion que ordena todo el modulo es entre un quiebre <strong>evitable</strong> y
            uno <strong>inevitable</strong>. Que el stock proyectado cierre negativo solo significa
            que hay que comprar durante el horizonte: es la situacion normal de cualquier material que
            no se stockea por un mes. El riesgo critico aparece cuando el material se agota{" "}
            <strong>antes de la primera entrega factible</strong>, es decir cuando emitir la compra hoy
            ya no llega a tiempo.
          </p>
          <TableWrap>
            <thead>
              <tr>
                <th>Riesgo</th>
                <th>Regla exacta</th>
                <th>Lectura operativa</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <Badge variant="danger">Critico</Badge>
                </td>
                <td>dias_hasta_quiebre &le; dias_hasta_la_proxima_entrega_factible</td>
                <td>
                  El quiebre ya no se puede evitar comprando hoy: hay que renegociar una orden abierta
                  o reprogramar produccion.
                </td>
              </tr>
              <tr>
                <td>
                  <Badge variant="warning">Alto</Badge>
                </td>
                <td>cobertura &lt; lead_time, o el material tiene una orden abierta retrasada</td>
                <td>
                  Solo lo que ya esta en camino evita el quiebre. Cualquier desvio adicional lo vuelve
                  critico.
                </td>
              </tr>
              <tr>
                <td>
                  <Badge variant="neutral">Medio</Badge>
                </td>
                <td>
                  cobertura &lt; lead_time_maximo, o confiabilidad del proveedor &lt;{" "}
                  {formatPercent(LOW_RELIABILITY_THRESHOLD, 0)}, o stock &lt; punto de pedido
                </td>
                <td>
                  Cobertura ajustada: alcanza para un proveedor que cumple, no para uno que se
                  atrasa.
                </td>
              </tr>
              <tr>
                <td>
                  <Badge variant="positive">Bajo</Badge>
                </td>
                <td>Ninguna de las anteriores</td>
                <td>
                  Cobertura suficiente frente al lead time. Puede requerir compra igual, dentro del
                  ciclo normal.
                </td>
              </tr>
            </tbody>
          </TableWrap>
          <p className="mt-2">
            Las reglas se evaluan <strong>en ese orden y son excluyentes</strong>: cada material recibe
            un unico nivel de riesgo, y la aplicacion muestra en el tooltip de la tabla la regla exacta
            que se disparo. Con el escenario &quot;Operacion estable&quot; el caso arroja{" "}
            {supplyReference.kpis.criticalMaterials} materiales criticos y{" "}
            {supplyReference.kpis.highRiskMaterials} en riesgo alto sobre{" "}
            {supplyReference.rows.length}.
          </p>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-navy-800">
            Como funciona la recomendacion basada en reglas
          </h3>
          <p>
            El motor no es un modelo: es un arbol de decision determinista. Primero calcula{" "}
            <strong>cuanto comprar</strong> y despues elige <strong>una unica accion principal</strong>{" "}
            por material.
          </p>
          <Formula>{`requerimiento_neto = consumo_diario x (lead_time + ciclo_de_revision)
                     + stock_de_seguridad
                     - stock_disponible
                     - ordenes_firmes
cantidad_sugerida  = redondear_hacia_arriba(
                       max(requerimiento_neto, faltante_proyectado),
                       cantidad_minima_del_proveedor
                     )`}</Formula>
          <p className="mt-2">
            El ciclo de revision de compras es de {SUPPLY_REVIEW_PERIOD_DAYS} dias habiles: la compra
            cubre el lead time mas el tiempo que pasa hasta la proxima vez que se mira el tablero, para
            no tener que comprar el mismo material dos veces seguidas. Por el redondeo al minimo del
            proveedor, la cantidad sugerida puede superar al faltante estricto.
          </p>
          <TableWrap>
            <thead>
              <tr>
                <th>Accion</th>
                <th>Cuando se emite</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-medium text-navy-800">Comprar de forma urgente</td>
                <td>Riesgo critico y no hay ninguna orden abierta que se pueda reprogramar.</td>
              </tr>
              <tr>
                <td className="font-medium text-navy-800">Anticipar o reprogramar orden</td>
                <td>
                  Riesgo critico o alto y existe una orden abierta que no llega a tiempo o todavia no
                  es firme: renegociar esa fecha cuesta menos que emitir una compra nueva.
                </td>
              </tr>
              <tr>
                <td className="font-medium text-navy-800">Emitir compra normal</td>
                <td>Riesgo alto o medio con cantidad sugerida mayor que cero.</td>
              </tr>
              <tr>
                <td className="font-medium text-navy-800">Consolidar compra con otros materiales</td>
                <td>
                  Riesgo bajo, hay que reponer y el mismo proveedor abastece otros materiales que
                  tambien necesitan compra en este ciclo.
                </td>
              </tr>
              <tr>
                <td className="font-medium text-navy-800">Monitorear</td>
                <td>No corresponde comprar todavia, pero el riesgo no es bajo.</td>
              </tr>
              <tr>
                <td className="font-medium text-navy-800">No comprar</td>
                <td>Riesgo bajo sin necesidad de reposicion, o material sin consumo en el horizonte.</td>
              </tr>
            </tbody>
          </TableWrap>
          <p className="mt-2">
            Cada recomendacion se acompana de su razon, la cantidad, el proveedor, la fecha limite de
            decision, el costo estimado, la consecuencia de no actuar y un{" "}
            <strong>nivel de confianza</strong>. Ese nivel no mide la certeza de ningun modelo: refleja
            la <strong>calidad de los datos simulados</strong> que sostienen el calculo (confiabilidad
            del proveedor, ordenes pendientes de confirmacion y existencia de consumo). Todos los
            textos se arman con los numeros del escenario, por eso cambian cuando el escenario cambia.
          </p>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-navy-800">
            Por que una persona aprueba o rechaza la decision
          </h3>
          <p>
            Una recomendacion de compra compromete dinero, capacidad de un proveedor y espacio de
            almacen. El modelo ve la cobertura y el lead time; no ve que el proveedor esta en conflicto
            gremial, que hay una promocion comercial sin cargar o que el area de calidad bloqueo un
            lote. Por eso el modulo <strong>no ejecuta nada</strong>: propone, explica y espera una
            decision.
          </p>
          <p>
            El planificador puede marcar cada recomendacion como <strong>aprobada</strong>,{" "}
            <strong>rechazada</strong> o <strong>requiere revision</strong>, y dejar una nota. Cada
            decision genera una entrada en el registro con fecha y hora, material, recomendacion
            original, riesgo, usuario, nota e impacto estimado: si se aprueba se registra el costo de
            la compra, y en cualquier otro caso el margen que queda expuesto.
          </p>
          <Note tone="warning" title="Las decisiones se guardan solo en el navegador">
            Las decisiones y el registro viven unicamente en el <code>localStorage</code> del
            navegador, para fines de demostracion. No hay backend, no hay base de datos, no se emite
            ninguna orden de compra real y no se envia informacion a ningun servicio externo.
          </Note>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-navy-800">
            Que significan los costos estimados
          </h3>
          <ul className="ml-5 list-disc space-y-1.5">
            <li>
              <strong>Costo de la compra sugerida.</strong> Cantidad sugerida por el precio del
              proveedor, que es el costo unitario del material afectado por el factor de precio de ese
              proveedor. No es una cotizacion: es el precio de referencia del caso simulado.
            </li>
            <li>
              <strong>Costo estimado de no actuar.</strong> El faltante proyectado se reparte entre los
              productos que consumen el material, en proporcion a su consumo; el faltante asignado se
              divide por el consumo unitario para obtener las unidades de producto terminado que no se
              podrian fabricar, y esas unidades se valorizan al margen de contribucion del producto.
            </li>
            <li>
              <strong>Costo estimado en riesgo (KPI).</strong> Suma del costo de no actuar{" "}
              <strong>solo de los materiales en riesgo alto o critico</strong>. En los demas el
              faltante se evita con una compra normal dentro del ciclo de revision, por lo que no esta
              realmente en riesgo.
            </li>
            <li>
              <strong>Valor de inventario.</strong> Stock disponible de materia prima valorizado al
              costo unitario simulado. Con el caso base son{" "}
              {formatCurrency(supplyReference.kpis.inventoryValue)}.
            </li>
          </ul>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-navy-800">
            Relacion con el resto de la aplicacion
          </h3>
          <p>
            El modulo <strong>reutiliza la demanda</strong> del planificador: el consumo parte del
            mismo pronostico base (media ponderada con decaimiento lineal de los ultimos 20 dias habiles) que alimenta el plan de produccion, y extiende la lista de materiales de la
            V1 con cierres, potes, film y pallets. En cambio{" "}
            <strong>mantiene su propio escenario</strong>, separado del simulador global: las variables
            de aquel modulo (capacidad de linea, tiempos de cambio de formato, multiplicador de
            faltante de producto terminado) no intervienen en una decision de compra, y acoplarlas
            habria hecho que mover un control de compras alterara el plan de produccion. Los datos
            originales de la V1 no se modifican, por lo que el planificador, el inventario y el
            balanceo siguen dando exactamente los mismos numeros.
          </p>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-navy-800">Limitaciones de la V2</h3>
          <ul className="ml-5 list-disc space-y-1.5">
            <li>
              <strong>Datos sinteticos.</strong> Los {supplyReference.rows.length} materiales, los{" "}
              {supplySuppliers.length} proveedores, sus precios, sus lead times y las{" "}
              {supplyReference.orders.length} ordenes abiertas fueron construidos para el portfolio. No
              corresponden a ninguna empresa ni a ningun proveedor real.
            </li>
            <li>
              <strong>Sin ERP ni integracion con sistemas de compras.</strong> No hay conexion con
              SAP, con un WMS ni con ningun sistema de gestion: el stock, las ordenes y los precios son
              parte del caso.
            </li>
            <li>
              <strong>Sin pronostico estadistico real.</strong> La demanda es un valor puntual
              deterministico. No se modela incertidumbre, no se calculan stocks de seguridad
              estadisticos por nivel de servicio ni intervalos de confianza.
            </li>
            <li>
              <strong>Sin compra automatica.</strong> Ninguna accion emite una orden, contacta a un
              proveedor ni reserva capacidad. Las aprobaciones son un registro local de demostracion.
            </li>
            <li>
              <strong>Sin validacion de precios reales.</strong> Los precios son supuestos del caso; no
              se comparan cotizaciones, no se aplican descuentos por volumen ni condiciones
              negociadas.
            </li>
            <li>
              <strong>Sin restriccion dura sobre el plan.</strong> La falta de materia prima se informa
              y se valoriza, pero no bloquea corridas en el plan de produccion.
            </li>
            <li>
              <strong>Sin lectura de documentos ni IA generativa.</strong> No se procesan remitos,
              facturas ni cotizaciones, y ningun texto de la aplicacion proviene de un modelo de
              lenguaje: todos se arman con plantillas y los numeros calculados.
            </li>
            <li>
              <strong>Un solo deposito y un solo proveedor por material.</strong> No hay multiples
              plantas, ni proveedores alternativos, ni compras parciales entre varios origenes.
            </li>
          </ul>
        </div>
      </Section>

      <Section
        id="lean"
        title="Desperdicios Lean abordados"
        description="Cada desperdicio se traduce en una variable medible del modelo."
      >
        <TableWrap>
          <thead>
            <tr>
              <th>Desperdicio</th>
              <th>Como aparece en la planta simulada</th>
              <th>Como lo mide y ataca el modelo</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="font-medium text-navy-800">Espera</td>
              <td>Linea detenida durante el cambio de formato entre familias.</td>
              <td>
                Minutos y costo de setup por linea-dia; la heuristica agrupa familias y arranca por la
                que ya esta montada.
              </td>
            </tr>
            <tr>
              <td className="font-medium text-navy-800">Inventario excesivo</td>
              <td>Producto terminado que inmoviliza capital sin demanda que lo justifique.</td>
              <td>
                Costo de mantenimiento diario y techo de cobertura maxima por producto; se alerta
                cuando la cobertura supera el objetivo.
              </td>
            </tr>
            <tr>
              <td className="font-medium text-navy-800">Defectos de planificacion</td>
              <td>Quiebres de stock y demanda que no se puede atender.</td>
              <td>
                Unidades no atendidas, nivel de servicio y costo de faltante; la priorizacion ordena
                por dias de cobertura.
              </td>
            </tr>
            <tr>
              <td className="font-medium text-navy-800">
                Movimientos administrativos y reprocesos
              </td>
              <td>
                Replanificar a mano cada cambio de escenario y rehacer el calculo en planillas.
              </td>
              <td>
                El escenario completo se recalcula de forma determinista y cada corrida queda con su
                justificacion escrita, sin rehacer el analisis.
              </td>
            </tr>
            <tr>
              <td className="font-medium text-navy-800">Produccion no priorizada</td>
              <td>
                Fabricar lo que figura primero en la lista comercial en lugar de lo que esta por
                quebrar.
              </td>
              <td>
                Orden por riesgo economico de faltante en lugar de orden por volumen de venta; es la
                diferencia central entre los dos planes.
              </td>
            </tr>
          </tbody>
        </TableWrap>
      </Section>

      <Section
        id="limitaciones"
        title="Limitaciones generales"
        description="Lo que el modelo no hace, dicho explicitamente. Cada modulo suma ademas sus propias limitaciones."
      >
        <ul className="ml-5 list-disc space-y-1.5">
          <li>
            <strong>No es un optimizador.</strong> Es una heuristica golosa; no garantiza el minimo
            costo posible ni entrega una cota de optimalidad.
          </li>
          <li>
            <strong>Efecto de fin de horizonte.</strong> El ultimo dia no anticipa produccion para la
            semana siguiente, mas alla de reponer el stock de seguridad.
          </li>
          <li>
            <strong>Demanda deterministica.</strong> El pronostico es un valor puntual: no se modela
            incertidumbre ni se calculan stocks de seguridad estadisticos.
          </li>
          <li>
            <strong>La demanda no atendida se pierde</strong>, no se acumula como pedido pendiente.
          </li>
          <li>
            <strong>Materia prima sin restriccion dura.</strong> El abastecimiento se verifica, se
            valoriza y se traduce en recomendaciones de compra, pero no bloquea corridas del plan de
            produccion ni emite ordenes reales.
          </li>
          <li>
            <strong>Sin mano de obra ni herramentales explicitos.</strong> No se modelan operarios,
            moldes ni matrices como recursos limitados independientes de la linea.
          </li>
          <li>
            <strong>Sin persistencia de servidor.</strong> No hay base de datos, usuarios ni historico
            de escenarios: todo vive en memoria durante la sesion. La unica excepcion son las
            decisiones de compra de la Torre de abastecimiento, que se guardan en el{" "}
            <code className="rounded bg-steel-100 px-1 py-0.5 font-mono text-xs">localStorage</code>{" "}
            del navegador a modo de demostracion.
          </li>
          <li>
            <strong>El plan base es deliberadamente simple.</strong> Una planta real suele aplicar
            algo de agrupamiento por familia, por lo que la brecha entre ambos planes seria menor que
            la que muestra el caso.
          </li>
        </ul>
      </Section>

      <Section
        id="roadmap"
        title="Roadmap V2.1"
        description="Funcionalidad prevista para la siguiente version, hoy no implementada."
      >
        <p>
          La V2 cierra el circuito de decision de compra con datos sinteticos y reglas explicitas. Lo
          que sigue apunta a reemplazar esos datos por informacion real y a medir si las
          recomendaciones efectivamente mejoran el resultado.
        </p>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>
            <strong>Carga y lectura de cotizaciones, remitos y facturas reales.</strong> Subir los
            documentos que hoy llegan por correo y que alguien tipea a mano en una planilla.
          </li>
          <li>
            <strong>Extraccion de datos documentales.</strong> Obtener del documento el proveedor, el
            material, la cantidad, el precio y la fecha, con el fragmento de origen a la vista para
            poder auditarlo.
          </li>
          <li>
            <strong>Comparacion automatica de precios, cantidades y fechas.</strong> Contrastar la
            cotizacion contra la orden y el remito contra lo efectivamente recibido, y marcar las
            diferencias.
          </li>
          <li>
            <strong>RAG sobre politicas de compra y fichas tecnicas.</strong> Consulta asistida de
            politicas internas (proveedores homologados, limites de compra, lead times acordados) y de
            especificaciones de material, siempre con cita al documento fuente.
          </li>
          <li>
            <strong>Trazabilidad y evaluacion de recomendaciones.</strong> Persistir que se recomendo,
            con que datos, quien lo aprobo y que paso despues, para medir la tasa de acierto del motor
            de reglas en lugar de suponerla.
          </li>
          <li>
            <strong>Integracion con una fuente de datos real.</strong> Reemplazar el caso sintetico por
            stock, ordenes y precios provenientes de un ERP o de un archivo exportado por la planta.
          </li>
        </ul>
        <Note tone="warning" title="Nada de esto esta implementado hoy">
          La V2 no lee documentos, no consulta ningun modelo de lenguaje, no compara precios reales y
          no emite ordenes de compra. Cualquier pantalla que sugiriera lo contrario seria una
          simulacion de funcionalidad, y este proyecto evita deliberadamente ese tipo de demostracion.
        </Note>
      </Section>

      <Card>
        <CardHeader>
          <CardTitle>Reproducibilidad</CardTitle>
          <CardDescription>
            El caso se genera con semilla fija y la planificacion es una funcion pura.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed text-steel-700">
          <p>
            Todo el dataset proviene de <code className="rounded bg-steel-100 px-1 py-0.5 font-mono text-xs">generateDataset({dataset.seed})</code>,
            que usa un generador pseudoaleatorio con semilla (mulberry32). El planificador no usa
            valores aleatorios: dado un escenario, devuelve siempre exactamente el mismo plan, tanto
            en el servidor como en el navegador.
          </p>
          <p>
            El comando{" "}
            <code className="rounded bg-steel-100 px-1 py-0.5 font-mono text-xs">npm run verify</code>{" "}
            recalcula los tres presets y cuatro escenarios extremos, imprime sus indicadores y
            comprueba que dos corridas consecutivas den identico resultado.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
