"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Download, Gauge, PackageCheck, Pause, Play, RotateCcw, SkipForward, Timer, Truck, Wrench } from "lucide-react";
import { PlantFloor, type PlantFloorLine } from "@/components/plant/plant-floor";
import { ProductionChart, plantClock } from "@/components/plant/production-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SelectField, SliderField } from "@/components/ui/controls";
import { PageHeader, TableWrap } from "@/components/ui/layout-bits";
import { familiesById, productsById } from "@/lib/data/dataset";
import { formatNumber, formatPercent } from "@/lib/format";
import { DEFAULT_PLANT_SCENARIO, PLANT_PRESETS, runPlantSimulation } from "@/lib/plant";
import type { ProductionPlan } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useScenario } from "@/state/scenario-context";

type PlantScenario = typeof DEFAULT_PLANT_SCENARIO;
type PlantSimulation = ReturnType<typeof runPlantSimulation>;

const STATE_LABELS: Record<string, string> = {
  running: "Produciendo", setup: "Cambio de formato", downtime: "En parada",
  material: "Sin material", blocked: "Salida bloqueada", idle: "En espera",
  finished: "Plan completado", closed: "Jornada cerrada",
};
const COLORS = ["#43c8ba", "#90a4ff", "#eab46c"];
const LINE_NAMES: Record<string, string> = {
  L1: "Envasado de líquidos", L2: "Multiproducto", L3: "Inyección y soplado",
};

function Stat({ label, value, detail, icon, accent = false }: {
  label: string; value: string; detail: string; icon: ReactNode; accent?: boolean;
}) {
  return <div className={cn("rounded-xl border px-4 py-4", accent ? "border-teal-200 bg-teal-50/70" : "border-line bg-white")}>
    <div className="flex items-center justify-between gap-2 text-steel-500"><span className="text-xs font-medium">{label}</span>{icon}</div>
    <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-navy-800">{value}</p>
    <p className="mt-1 text-xs text-steel-500">{detail}</p>
  </div>;
}

export default function PlantPage() {
  const { result, scenario } = useScenario();
  const [dayIndex, setDayIndex] = useState(0);
  const [planId, setPlanId] = useState("recommended");
  const plan = planId === "base" ? result.base : result.recommended;

  return <div className="space-y-5">
    <PageHeader title="La planta, en movimiento" description="Explora cómo trabajan las tres líneas, sigue los materiales y observa qué pasa cuando cambia la operación." actions={
      <Link href="/plan" className="inline-flex items-center gap-2 text-sm font-medium text-navy-600">Ver plan de producción <ArrowRight className="h-4 w-4" /></Link>
    } />
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-wrap gap-3">
        <SelectField label="Jornada a simular" value={String(dayIndex)} onChange={(value) => setDayIndex(Number(value))} options={result.days.map((day) => ({ value: String(day.index), label: `${day.weekdayName} · ${day.date.slice(8)}/${day.date.slice(5, 7)}` }))} />
        <SelectField label="Plan de partida" value={planId} onChange={setPlanId} options={[{ value: "recommended", label: "Plan recomendado" }, { value: "base", label: "Plan base" }]} />
      </div>
      <p className="max-w-sm text-xs leading-relaxed text-steel-500">Los volúmenes y cambios de formato vienen del escenario activo. Cambiar el día o el plan reinicia la simulación.</p>
    </div>
    <PlantSession key={`${dayIndex}:${planId}:${JSON.stringify(scenario)}`} plan={plan} dayIndex={dayIndex} date={result.days.find((day) => day.index === dayIndex)?.date ?? ""} />
  </div>;
}

function PlantSession({ plan, dayIndex, date }: { plan: ProductionPlan; dayIndex: number; date: string }) {
  const [config, setConfig] = useState<PlantScenario>({ ...DEFAULT_PLANT_SCENARIO });
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(12);
  const [selectedLineId, setSelectedLineId] = useState("L1");
  const simulation = useMemo(() => runPlantSimulation({ plan, dayIndex, scenario: config }), [plan, dayIndex, config]);
  const reference = useMemo(() => runPlantSimulation({ plan, dayIndex, scenario: DEFAULT_PLANT_SCENARIO }), [plan, dayIndex]);
  const minute = Math.min(Math.floor(elapsed), simulation.horizonMinutes);
  const finished = minute >= simulation.horizonMinutes;
  const running = playing && !finished;
  const frame = simulation.frames[minute];
  const activePreset = PLANT_PRESETS.find((preset) => Object.entries({ ...DEFAULT_PLANT_SCENARIO, ...preset.scenario }).every(([key, value]) => config[key as keyof PlantScenario] === value));
  const selectedLine = frame.lines.find((line) => line.lineId === selectedLineId) ?? frame.lines[0];
  const selectedSummary = simulation.summary.lines.find((line) => line.lineId === selectedLineId)!;
  const lineConfig = simulation.lines.find((line) => line.lineId === selectedLineId)!;
  const currentReference = reference.frames[Math.min(minute, reference.horizonMinutes)];
  const loss = reference.summary.produced - simulation.summary.produced;
  const events = simulation.events.filter((event) => event.minute <= minute).slice(-7).reverse();
  const floorLines: PlantFloorLine[] = frame.lines.map((line, index) => ({
    id: line.lineId, name: `${line.lineId} · ${LINE_NAMES[line.lineId] ?? line.name}`,
    family: line.productId ? familiesById[productsById[line.productId]?.familyId]?.shortName ?? "" : "Sin corrida activa",
    color: COLORS[index], status: STATE_LABELS[line.state] ?? line.state,
    produced: line.produced, wip: line.wip,
    stages: line.stages.map((stage) => ({ name: stage.name,
      state: stage.state === "downtime" || stage.state === "closed" ? "stopped" : stage.state === "material" ? "starved" : stage.state === "finished" ? "idle" : stage.state,
      queue: stage.queue, progress: stage.progress,
    })),
  }));
  const chartPoints = useMemo(() => simulation.frames.filter((point) => point.minute % 10 === 0 || point.minute === simulation.horizonMinutes).map((point) => ({
    minute: point.minute, produced: point.totals.produced, dispatched: point.totals.dispatched,
    reference: reference.frames[Math.min(point.minute, reference.horizonMinutes)].totals.produced,
  })), [simulation, reference]);

  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => setElapsed((value) => Math.min(simulation.horizonMinutes, value + speed / 10)), 100);
    return () => window.clearInterval(interval);
  }, [running, speed, simulation.horizonMinutes]);

  function changeConfig(patch: Partial<PlantScenario>) {
    setPlaying(false);
    setElapsed(0);
    setConfig((current) => ({ ...current, ...patch }));
  }

  function choosePreset(scenario: Partial<PlantScenario>) {
    changeConfig({ ...DEFAULT_PLANT_SCENARIO, ...scenario });
  }

  function seek(value: number) {
    setPlaying(false);
    setElapsed(Math.max(0, Math.min(value, simulation.horizonMinutes)));
  }

  function togglePlay() {
    if (finished) { setElapsed(0); setPlaying(true); }
    else setPlaying((value) => !value);
  }

  const recommendations = getRecommendations(simulation, reference);

  return <div className="space-y-5">
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label="Escenarios de la planta">
      {PLANT_PRESETS.map((preset, index) => <button type="button" key={preset.id} aria-pressed={activePreset?.id === preset.id} onClick={() => choosePreset(preset.scenario)} className={cn("rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-400", activePreset?.id === preset.id ? "border-navy-600 bg-navy-800 text-white shadow-sm" : "border-line bg-white text-steel-700 hover:border-navy-300")}>
        <span className="flex items-center gap-2 text-sm font-semibold"><span className={cn("font-mono text-xs", activePreset?.id === preset.id ? "text-teal-300" : "text-steel-400")}>0{index + 1}</span>{preset.name}</span>
        <span className={cn("mt-1.5 block text-xs leading-relaxed", activePreset?.id === preset.id ? "text-navy-100" : "text-steel-500")}>{preset.description}</span>
      </button>)}
    </div>

    <section className="overflow-hidden rounded-xl border border-[#243d51] bg-[#0b1825] shadow-lg" aria-label="Vista de la planta y controles de reproducción">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
        <div className="flex items-center gap-2.5"><span className={cn("h-2 w-2 rounded-full", running ? "bg-teal-300" : "bg-slate-400")} /><span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-200">Vista de planta</span><span className="hidden text-xs text-slate-400 sm:inline">/ {activePreset?.name ?? "Escenario personalizado"}</span></div>
        <span className="text-xs text-slate-300">{finished ? "Jornada finalizada" : running ? "Simulación en curso" : minute === 0 ? "Lista para iniciar" : "En pausa"} <span className="px-2 text-slate-600">|</span><span className="font-mono text-base text-white">{plantClock(minute)}</span></span>
      </div>
      <PlantFloor lines={floorLines} minute={elapsed} duration={simulation.horizonMinutes} running={running} selectedLineId={selectedLineId} onSelectLine={setSelectedLineId} received={frame.totals.released} dispatched={frame.totals.dispatched} finishedStock={frame.totals.finishedStock} materialDelayed={minute < config.materialDelayMinutes} />
      <div className="space-y-3 bg-white px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={togglePlay} size="sm">{running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}{running ? "Pausar" : finished ? "Reproducir de nuevo" : "Reproducir"}</Button>
            <Button variant="outline" size="sm" onClick={() => seek(0)} aria-label="Reiniciar jornada"><RotateCcw className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => seek(minute + 60)} disabled={finished}><SkipForward className="h-4 w-4" />+1 hora</Button>
            <Button variant="ghost" size="sm" onClick={() => seek(simulation.horizonMinutes)}>Ver cierre</Button>
          </div>
          <SelectField label="Velocidad de reproducción" hideLabel value={String(speed)} onChange={(value) => setSpeed(Number(value))} options={[{ value: "3", label: "3 min / segundo" }, { value: "12", label: "12 min / segundo" }, { value: "36", label: "36 min / segundo" }]} />
        </div>
        <label className="sr-only" htmlFor="plant-timeline">Momento de la jornada</label>
        <input id="plant-timeline" type="range" min={0} max={simulation.horizonMinutes} step={1} value={minute} onChange={(event) => seek(Number(event.target.value))} aria-valuetext={`${plantClock(minute)}, minuto ${minute} de ${simulation.horizonMinutes}`} />
        <div className="flex justify-between gap-2 text-[11px] text-steel-500"><span>06:00 · Inicio</span><span>{formatNumber(minute)} / {simulation.horizonMinutes} min</span><span>{plantClock(simulation.horizonMinutes)} · Cierre</span></div>
      </div>
    </section>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Stat label="Producción conforme" value={`${formatNumber(frame.totals.produced)} u`} detail={`${formatPercent(simulation.plannedUnits ? frame.totals.produced / simulation.plannedUnits : 0)} del volumen programado`} icon={<PackageCheck className="h-4 w-4" />} accent />
      <Stat label="Trabajo en proceso" value={`${formatNumber(frame.totals.wip)} u`} detail="Material dentro de las líneas" icon={<Gauge className="h-4 w-4" />} />
      <Stat label="Despachado" value={`${formatNumber(frame.totals.dispatched)} u`} detail={`${formatNumber(frame.totals.finishedStock)} u listas en expedición`} icon={<Truck className="h-4 w-4" />} />
      <Stat label="Desvío frente a referencia" value={`${frame.totals.produced - currentReference.totals.produced > 0 ? "+" : ""}${formatNumber(frame.totals.produced - currentReference.totals.produced)} u`} detail={`Mismo plan a las ${plantClock(minute)}, parámetros normales`} icon={<Timer className="h-4 w-4" />} />
    </div>

    <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
      <Card>
        <CardHeader><CardTitle>Dentro de la línea</CardTitle><CardDescription>Selecciona una línea en el plano o aquí.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2" aria-label="Seleccionar línea">
            {frame.lines.map((line, index) => <button key={line.lineId} type="button" onClick={() => setSelectedLineId(line.lineId)} aria-pressed={selectedLineId === line.lineId} className={cn("flex-1 rounded-lg border px-3 py-2 text-sm font-semibold", selectedLineId === line.lineId ? "border-navy-500 bg-navy-50 text-navy-800" : "border-line text-steel-500")}><span style={{ backgroundColor: COLORS[index] }} className="mr-2 inline-block h-2 w-2 rounded-full" />{line.lineId}</button>)}
          </div>
          <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-base font-semibold">{LINE_NAMES[selectedLineId]}</h3><p className="mt-1 text-xs text-steel-500">{selectedLine.productName || "Sin producto en proceso"}</p></div><span className="rounded-md bg-steel-100 px-2 py-1 text-xs font-medium text-navy-700">{STATE_LABELS[selectedLine.state]}</span></div>
          <div className="grid grid-cols-3 gap-2 rounded-lg bg-steel-50 p-3 text-xs"><div className="text-steel-500">Programado<strong className="mt-1 block text-sm tabular-nums text-navy-800">{formatNumber(selectedLine.plannedUnits)} u</strong></div><div className="text-steel-500">Conforme<strong className="mt-1 block text-sm tabular-nums text-navy-800">{formatNumber(selectedLine.produced)} u</strong></div><div className="text-steel-500">Rechazado<strong className="mt-1 block text-sm tabular-nums text-navy-800">{formatNumber(selectedLine.rejected)} u</strong></div></div>
          <ol className="space-y-3">{selectedLine.stages.map((stage, index) => <li key={stage.id}>
            <div className="flex items-center justify-between gap-2 text-xs"><span className="font-medium text-steel-700">{index + 1}. {stage.name}</span><span className="text-steel-500">{STATE_LABELS[stage.state]} · {formatNumber(stage.queue)} u</span></div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-steel-100" role="meter" aria-label={`Ocupación de ${stage.name}`} aria-valuenow={Math.round(stage.queue)} aria-valuemin={0} aria-valuemax={Math.ceil(stage.capacity)}><div style={{ width: `${Math.min(100, stage.capacity ? stage.queue / stage.capacity * 100 : 0)}%` }} className={cn("h-full rounded-full", stage.state === "blocked" ? "bg-amber-400" : "bg-teal-500")} /></div>
          </li>)}</ol>
          <p className="text-xs leading-relaxed text-steel-500">Las barras muestran las colas a la salida de cada etapa; la última es producto listo en expedición. Rendimiento de calidad aplicado: {formatPercent(lineConfig.firstPassYield)}. Una cola llena puede detener el proceso anterior.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>El ritmo de la jornada</CardTitle><CardDescription>Unidades acumuladas · tres líneas en conjunto.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <ProductionChart points={chartPoints} minute={minute} duration={simulation.horizonMinutes} />
          <div className="border-t border-line pt-3"><h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-steel-500">Últimos eventos</h3>
            <ol className="max-h-44 space-y-2 overflow-y-auto pr-1 text-xs" aria-label="Eventos de la jornada">{events.length ? events.map((event, index) => <li key={`${event.minute}-${event.lineId}-${event.type}-${index}`} className="flex items-start gap-3"><span className="shrink-0 rounded bg-steel-50 px-1.5 py-0.5 font-mono text-steel-500">{plantClock(event.minute)}</span><span className="leading-relaxed text-steel-600">{event.message}</span></li>) : <li className="text-steel-500">Presiona Reproducir para seguir los cambios de la planta.</li>}</ol>
          </div>
        </CardContent>
      </Card>
    </div>

    <details className="group rounded-xl border border-line bg-white">
      <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-navy-800"><Wrench className="mr-2 inline h-4 w-4" />Ajustar la operación <span className="ml-2 text-xs font-normal text-steel-500">Velocidad, materiales, mantenimiento y despacho</span></summary>
      <div className="grid gap-x-8 gap-y-6 border-t border-line px-5 py-5 md:grid-cols-2 xl:grid-cols-3">
        <SliderField label="Velocidad de las máquinas" value={config.speedPct} min={50} max={130} step={5} onChange={(value) => changeConfig({ speedPct: value })} formatValue={(value) => `${value}%`} description="Ajuste sobre las velocidades de cada producto en el plan." />
        <SliderField label="Demora inicial de materiales" value={config.materialDelayMinutes} min={0} max={240} step={15} onChange={(value) => changeConfig({ materialDelayMinutes: value })} formatValue={(value) => `${value} min`} description="El suministro inicial se retrasa en las tres líneas." />
        <SliderField label="Capacidad de despacho compartida" value={config.dispatchCapacityPerHour} min={0} max={24000} step={100} onChange={(value) => changeConfig({ dispatchCapacityPerHour: value })} formatValue={(value) => `${formatNumber(value)} u/h`} description="Al saturar expedición se acumula producto y se bloquean las líneas." />
        <div className="space-y-4"><SelectField label="Línea con parada" value={config.downtimeLineId} onChange={(value) => changeConfig({ downtimeLineId: value })} options={frame.lines.map((line) => ({ value: line.lineId, label: `${line.lineId} · ${LINE_NAMES[line.lineId]}` }))} /><SliderField label="Duración de la parada" value={config.downtimeMinutes} min={0} max={240} step={15} onChange={(value) => changeConfig({ downtimeMinutes: value })} formatValue={(value) => `${value} min`} /></div>
        <SliderField label="Inicio de la parada" value={config.downtimeStartMinute} min={0} max={Math.min(900, simulation.horizonMinutes)} step={30} onChange={(value) => changeConfig({ downtimeStartMinute: value })} formatValue={plantClock} description="Se interrumpe la línea elegida durante el intervalo indicado." />
        <SliderField label="Espacio de espera entre etapas" value={config.bufferCapacityMinutes} min={2} max={30} step={2} onChange={(value) => changeConfig({ bufferCapacityMinutes: value })} formatValue={(value) => `${value} min`} description="Capacidad equivalente a minutos de producción nominal." />
        <SliderField label="Pérdida adicional de calidad" value={config.qualityLossPct} min={0} max={10} step={0.5} onChange={(value) => changeConfig({ qualityLossPct: value })} formatValue={(value) => `${formatNumber(value, 1)} p.p.`} description="Se resta al rendimiento base de cada línea. El rechazo no se reprocesa." />
        <div className="flex items-end"><Button variant="outline" onClick={() => choosePreset(DEFAULT_PLANT_SCENARIO)}><RotateCcw className="h-4 w-4" />Restaurar operación normal</Button></div>
      </div>
      <p className="px-5 pb-4 text-xs text-steel-500">Cada ajuste vuelve al inicio de la jornada. Estos controles pertenecen a esta simulación de planta.</p>
    </details>

    <Card>
      <CardHeader actions={<Button variant="outline" size="sm" onClick={() => exportJourney(simulation, date, plan.label)}><Download className="h-4 w-4" />Exportar jornada</Button>}><CardTitle>Proyección al cierre</CardTitle><CardDescription>Resultado de simular la jornada completa, aunque la reproducción esté pausada.</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3"><div><p className="text-xs text-steel-500">Conformes al cierre</p><p className="mt-1 text-xl font-semibold text-navy-800">{formatNumber(simulation.summary.produced)} u</p><p className="mt-1 text-xs text-steel-500">de {formatNumber(simulation.plannedUnits)} u programadas</p></div><div><p className="text-xs text-steel-500">Efecto frente a operación normal</p><p className={cn("mt-1 text-xl font-semibold", loss > 1 ? "text-amber-700" : "text-teal-700")}>{loss > 0 ? "−" : loss < 0 ? "+" : ""}{formatNumber(Math.abs(loss))} u</p><p className="mt-1 text-xs text-steel-500">Referencia: {formatNumber(reference.summary.produced)} u conformes</p></div><div><p className="text-xs text-steel-500">Máximo trabajo en proceso</p><p className="mt-1 text-xl font-semibold text-navy-800">{formatNumber(simulation.summary.peakWip)} u</p><p className="mt-1 text-xs text-steel-500">Mayor acumulación dentro de las tres líneas</p></div></div>
        <TableWrap><thead><tr><th>Línea</th><th>Programado</th><th>Conforme</th><th>Rechazado</th><th>En proceso</th><th>Despachado</th></tr></thead><tbody>{simulation.summary.lines.map((line) => <tr key={line.lineId}><td className="font-medium">{line.lineId} · {LINE_NAMES[line.lineId]}</td><td className="numeric">{formatNumber(line.plannedUnits)}</td><td className="numeric">{formatNumber(line.produced)}</td><td className="numeric">{formatNumber(line.rejected)}</td><td className="numeric">{formatNumber(line.wip)}</td><td className="numeric">{formatNumber(line.dispatched)}</td></tr>)}</tbody></TableWrap>
        <div className="grid gap-3 md:grid-cols-2">{recommendations.map((recommendation) => <div key={recommendation.title} className="rounded-lg border border-line bg-steel-50 px-4 py-3"><p className="flex items-center gap-2 text-sm font-semibold text-navy-800"><CheckCircle2 className="h-4 w-4 shrink-0 text-teal-600" />{recommendation.title}</p><p className="mt-1.5 text-xs leading-relaxed text-steel-600">{recommendation.description}</p></div>)}</div>
        <p className="text-xs leading-relaxed text-steel-500">En {selectedLineId}, el cierre registra {formatNumber(selectedSummary.blockedMinutes)} min con bloqueo, {formatNumber(selectedSummary.downtimeMinutes)} min de parada y {formatNumber(selectedSummary.setupMinutes)} min de cambio de formato. Son tiempos de la línea seleccionada.</p>
      </CardContent>
    </Card>

    <details className="rounded-xl border border-line bg-white text-sm">
      <summary className="cursor-pointer px-5 py-4 font-semibold text-navy-800">Qué representa esta simulación</summary>
      <div className="space-y-3 border-t border-line px-5 py-4 text-xs leading-relaxed text-steel-600">
        <p><strong>Del proyecto:</strong> líneas habilitadas, productos, velocidades, secuencia, cantidades, cambios de formato, capacidad diaria y rendimiento base de calidad. La jornada comienza a las 06:00 y representa dos turnos de ocho horas más la extensión necesaria del plan.</p>
        <p><strong>Supuestos adicionales:</strong> disposición de equipos conceptual, cuatro etapas por línea, esperas finitas y una expedición compartida. Las pausas se distribuyen en dos ventanas centradas a las 10:00 y 18:00, con duración derivada de la capacidad disponible del plan. Se simula flujo agregado en pasos de un minuto; las unidades pueden ser fraccionarias en el cálculo y se muestran redondeadas. Los puntos en las cintas ilustran el movimiento.</p>
        <p><strong>Alcance:</strong> cada día empieza con las líneas y expedición vacías, sin arrastre del día anterior ni stock inicial de producto terminado. La falta de material se representa como una demora inicial común. Las tres líneas producen de forma independiente: no se supone que los envases de L3 alimenten automáticamente las otras líneas.</p>
        <p>La calidad sí descuenta unidades conformes en esta vista; el planificador semanal sigue programando unidades brutas. No se recalculan aquí sus costos ni su nivel de servicio. El plano no está a escala y los servicios auxiliares son ilustrativos. Para validar una planta real se necesitan mediciones de equipos, recorridos, dotación, almacenamiento y tiempos observados.</p>
        <Link href="/metodologia" className="inline-flex items-center gap-1 font-medium text-navy-600">Metodología del proyecto <ArrowRight className="h-3 w-3" /></Link>
      </div>
    </details>
  </div>;
}

function getRecommendations(simulation: PlantSimulation, reference: PlantSimulation) {
  const { summary, scenario } = simulation;
  const items: Array<{ title: string; description: string }> = [];
  if (summary.blockedMinutes > 0) items.push({ title: "Revisar la salida de producción", description: `Se acumulan ${formatNumber(summary.blockedMinutes)} minutos de línea con bloqueo. Prueba aumentar el despacho o el espacio de espera y compara las unidades conformes al cierre.` });
  if (scenario.downtimeMinutes > 0) items.push({ title: `Evaluar el mantenimiento de ${scenario.downtimeLineId}`, description: `La parada comienza a las ${plantClock(scenario.downtimeStartMinute)} y dura ${scenario.downtimeMinutes} minutos. Muévela en la jornada para observar cuánto trabajo logra recuperar la línea.` });
  if (scenario.materialDelayMinutes > 0) items.push({ title: "Asegurar materiales antes del arranque", description: `Las tres líneas esperan el suministro durante ${scenario.materialDelayMinutes} minutos iniciales. Compara el escenario sin demora para medir el efecto de tener el material preparado.` });
  if (scenario.qualityLossPct > 0) items.push({ title: "Recuperar el rendimiento de calidad", description: `El escenario rechaza ${formatNumber(summary.rejected)} unidades. Restablece la pérdida adicional a cero para distinguir este efecto del producido por las paradas.` });
  if (!items.length) items.push({ title: "Usar esta jornada como referencia", description: `La operación normal permite comparar los incidentes con ${formatNumber(reference.summary.produced)} unidades conformes. Prueba una parada o una demora de materiales para ver qué línea absorbe el impacto.` });
  items.push({ title: "Mirar el flujo completo", description: `Al cierre quedan ${formatNumber(summary.wip)} unidades dentro de las líneas y ${formatNumber(summary.finishedStock)} listas en expedición. Aumentar la velocidad solo ayuda si las etapas siguientes pueden absorber la producción.` });
  return items.slice(0, 4);
}

function exportJourney(simulation: PlantSimulation, date: string, planLabel: string) {
  const escapeCell = (value: unknown) => `"${String(value).replace(/"/g, '""')}"`;
  const scenarioText = JSON.stringify(simulation.scenario);
  const rows: unknown[][] = [["Fecha", "Plan", "Escenario (supuestos)", "Minuto", "Hora", "Ingresadas (u)", "Conformes (u)", "Rechazadas (u)", "En proceso (u)", "En expedición (u)", "Despachadas (u)"]];
  for (const frame of simulation.frames) rows.push([date, planLabel, scenarioText, frame.minute, plantClock(frame.minute), ...[frame.totals.released, frame.totals.produced, frame.totals.rejected, frame.totals.wip, frame.totals.finishedStock, frame.totals.dispatched].map((value) => value.toFixed(3).replace(".", ","))]);
  const csv = "\uFEFF" + rows.map((row) => row.map(escapeCell).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const link = document.createElement("a");
  link.href = url; link.download = `optiflow-planta-${date}-${simulation.planId}.csv`;
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
