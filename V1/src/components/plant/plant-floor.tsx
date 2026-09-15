"use client";

import { useId } from "react";
import type { CSSProperties } from "react";
import { formatNumber } from "@/lib/format";
import styles from "./plant-floor.module.css";

export interface PlantFloorLine {
  id: string;
  name: string;
  family: string;
  color: string;
  status: string;
  produced: number;
  wip: number;
  stages: Array<{ name: string; state: string; queue: number; progress: number }>;
}

export interface PlantFloorProps {
  lines: PlantFloorLine[];
  minute: number;
  duration: number;
  running: boolean;
  selectedLineId: string;
  onSelectLine: (id: string) => void;
  received: number;
  dispatched: number;
  finishedStock: number;
  materialDelayed: boolean;
}

const states: Record<string, { color: string; label: string }> = {
  running: { color: "#61ddb5", label: "En marcha" },
  blocked: { color: "#fb9d78", label: "Bloqueada" },
  starved: { color: "#f2c367", label: "Sin material" },
  stopped: { color: "#ef8091", label: "Detenida" },
  setup: { color: "#adabff", label: "Cambio de formato" },
  idle: { color: "#8193a9", label: "En espera" },
};

const number = (value: number) => formatNumber(Math.round(value));
const bounded = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const short = (value: string, max = 24) => value.length > max ? `${value.slice(0, max - 1)}…` : value;

function Pallet({ x, y, bright = false }: { x: number; y: number; bright?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`} aria-hidden="true">
      <rect width="30" height="25" rx="3" fill={bright ? "#263e4f" : "#1b2c40"} stroke={bright ? "#567789" : "#34485e"} />
      <path d="M15 1v22M2 12h26M4 27h22M7 25v4M23 25v4" fill="none" stroke={bright ? "#668b99" : "#415770"} strokeWidth="1.5" />
    </g>
  );
}

/** Compact top-down equipment symbols: vessels, processing beds, filling heads, packing. */
function Equipment({ kind, color, phase }: { kind: number; color: string; phase: number }) {
  if (kind === 0) {
    return <g fill="none" stroke={color} strokeWidth="1.5">
      <circle cx="-20" cy="0" r="15" fill="#14283a" /><circle cx="20" cy="0" r="15" fill="#14283a" />
      <circle cx="-20" cy="0" r="6" /><circle cx="20" cy="0" r="6" />
      <path d="M-5 0H5M-20-15v-5H20v5" />
      <g transform={`rotate(${phase * 360} -20 0)`}><path d="M-24-5l8 10M-25 4l10-8" /></g>
      <g transform={`rotate(${-phase * 360} 20 0)`}><path d="M16-5l8 10M15 4l10-8" /></g>
    </g>;
  }
  if (kind === 1) {
    return <g fill="none" stroke={color} strokeWidth="1.5">
      <rect x="-38" y="-15" width="76" height="30" rx="5" fill="#14283a" />
      <path d="M-31-7H20M-31 0H20M-31 7H20M27-9v18M32-9v18" opacity=".7" />
      <rect x={-29 + phase * 42} y="-10" width="12" height="20" rx="2" fill={color} fillOpacity=".23" />
      <path d="M-28-19v4M28-19v4M-28 15v5M28 15v5" />
    </g>;
  }
  if (kind === 2) {
    return <g fill="none" stroke={color} strokeWidth="1.5">
      <rect x="-35" y="-19" width="70" height="11" rx="3" fill="#14283a" />
      {[-24, -8, 8, 24].map((x) => <g key={x}>
        <path d={`M${x}-8v8`} />
        <rect x={x - 5} y="4" width="10" height="15" rx="3" fill={color} fillOpacity=".16" />
        <path d={`M${x - 3} 1h6M${x - 4} ${16 - phase * 8}h8`} />
      </g>)}
    </g>;
  }
  return <g fill="none" stroke={color} strokeWidth="1.5">
    <rect x="-39" y="-17" width="78" height="34" rx="5" fill="#14283a" />
    <path d="M-11-16v32M11-16v32M-35-10v20M35-10v20" opacity=".6" />
    <rect x={-24 + phase * 31} y="-10" width="18" height="20" rx="2" fill={color} fillOpacity=".2" />
    <path d={`M${-15 + phase * 31}-9V9`} />
    <path d="M-22-22H22M-22 22H22" />
  </g>;
}

export function PlantFloor({ lines, minute, duration, selectedLineId, onSelectLine, received, dispatched, finishedStock, materialDelayed }: PlantFloorProps) {
  const instanceId = useId().replace(/:/g, "");
  const gridId = `${instanceId}-grid`;
  const arrowId = `${instanceId}-arrow`;
  const titleId = `${instanceId}-title`;
  const descriptionId = `${instanceId}-description`;
  const elapsed = bounded(duration > 0 ? minute / duration : 0);

  return (
    <figure className={styles.floor}>
      <p className={styles.mobileHint}>Deslizá el plano para recorrer la planta.</p>
      <div className={styles.viewport} role="region" aria-label="Plano interactivo de la planta; se puede desplazar horizontalmente" tabIndex={0}>
        <svg className={styles.plan} viewBox="0 0 1100 540" role="group" aria-labelledby={titleId} aria-describedby={descriptionId}>
          <title id={titleId}>Planta industrial con tres líneas de producción</title>
          <desc id={descriptionId}>El material entra por el almacén de la izquierda, atraviesa cada línea de forma independiente y sale por expedición a la derecha. Seleccioná una línea para explorar sus etapas. Los paquetes y equipos representan el avance del tiempo simulado; el plano es conceptual y no está a escala. Los pallets son ilustrativos y no representan existencias reales de materia prima.</desc>
          <defs>
            <pattern id={gridId} width="22" height="22" patternUnits="userSpaceOnUse"><path d="M22 0H0V22" fill="none" stroke="#7ba1c5" strokeOpacity=".075" strokeWidth=".7" /></pattern>
            <marker id={arrowId} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M1 1L7 4L1 7" fill="none" stroke="#6c879f" strokeWidth="1.4" /></marker>
          </defs>
          <rect width="1100" height="540" fill={`url(#${gridId})`} />
          <path d="M14 34V14H34M1066 14h20v20M14 506v20h20M1066 526h20v-20" fill="none" stroke="#41617c" strokeWidth="1.2" />
          <text x="24" y="39" className={styles.zoneCaption}>01 / ABASTECIMIENTO</text>
          <text x="228" y="39" className={styles.zoneCaption}>02 / PRODUCCIÓN</text>
          <text x="932" y="39" className={styles.zoneCaption}>03 / EXPEDICIÓN</text>

          {/* Independent branches connect the two shared warehouses to each line. */}
          <path d="M174 240h22M196 123v242M910 123v242M910 240h19" fill="none" stroke="#3c566d" strokeWidth="2" />
          {[123, 244, 365].map((y) => <g key={y} aria-hidden="true">
            <path d={`M196 ${y}H224M886 ${y}H928`} fill="none" stroke="#607b93" strokeWidth="1.5" markerEnd={`url(#${arrowId})`} />
            <circle cx="196" cy={y} r="3" fill="#91a6ba" /><circle cx="910" cy={y} r="3" fill="#91a6ba" />
          </g>)}

          <g aria-label={`Ingreso a producción: ${number(received)} unidades equivalentes ingresadas a las líneas${materialDelayed ? ", entrega demorada" : ""}`}>
            <rect x="24" y="62" width="150" height="365" rx="9" fill="#101f31" stroke={materialDelayed ? "#b99855" : "#32495f"} />
            <path d="M25 97H173" stroke="#2b4258" />
            <text x="38" y="84" className={styles.warehouseTitle}>Materia prima</text>
            <text x="38" y="119" className={styles.smallLabel}>ALMACÉN DE ENTRADA</text>
            {[0, 1, 2].map((row) => [0, 1, 2].map((column) => <Pallet key={`${row}-${column}`} x={39 + column * 40} y={142 + row * 41} bright={row === 0 && !materialDelayed} />))}
            <path d="M39 278h117M39 288h117" stroke="#40566b" strokeWidth="2" />
            <path d="M44 281h18M80 281h18M116 281h18" stroke="#9e936d" strokeWidth="2" />
            <text x="39" y="322" className={styles.counter}>{number(received)}</text>
            <text x="39" y="341" className={styles.secondary}>unidades ingresadas</text>
            <rect x="37" y="366" width="124" height="40" rx="5" fill={materialDelayed ? "#352e22" : "#142b33"} stroke={materialDelayed ? "#74603d" : "#24464b"} />
            <circle cx="49" cy="380" r="3" fill={materialDelayed ? "#f2c367" : "#61ddb5"} />
            <text x="59" y="384" className={styles.warehouseStatus} fill={materialDelayed ? "#f2c367" : "#87ceb8"}>{materialDelayed ? "Entrega demorada" : "Recepción habilitada"}</text>
            <text x="49" y="397" className={styles.microLabel}>{materialDelayed ? "Revisá el suministro" : "Material hacia las líneas"}</text>
          </g>

          {lines.slice(0, 3).map((line, lineIndex) => {
            const top = 62 + lineIndex * 121;
            const selected = line.id === selectedLineId;
            const color = line.color || ["#71c4ff", "#c6afff", "#6edbb7"][lineIndex];
            const stageCount = line.stages.length;
            const stageCenters = line.stages.map((_, index) => stageCount === 1 ? 553 : 304 + index * (494 / Math.max(1, stageCount - 1)));
            return (
              <g key={line.id} role="button" tabIndex={0} aria-pressed={selected} aria-label={`${line.name}, ${line.family}. ${line.status}. ${number(line.produced)} unidades producidas y ${number(line.wip)} en proceso. Seleccionar línea.`} className={styles.productionLine} style={{ "--line-color": color } as CSSProperties} onClick={() => onSelectLine(line.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectLine(line.id); } }}>
                <rect className={styles.lineSurface} x="226" y={top} width="658" height="108" rx="8" fill={selected ? "#13283b" : "#101e2f"} stroke={selected ? color : "#2b4057"} strokeWidth={selected ? "1.5" : "1"} />
                <path d={`M227 ${top + 26}H883`} stroke={selected ? color : "#3a526a"} opacity=".25" />
                <rect x="238" y={top + 9} width="5" height="9" rx="2" fill={color} />
                <text x="251" y={top + 18} className={styles.lineTitle} fill={color}>{short(line.name, 21)}</text>
                <text x="416" y={top + 18} className={styles.family}>{short(line.family, 32)}</text>
                <text x="869" y={top + 18} textAnchor="end" className={styles.lineStatus}>{short(line.status, 35)}</text>
                <path d={`M238 ${top + 60}H871`} stroke="#2e475d" strokeWidth="12" />
                <path d={`M238 ${top + 56}H871M238 ${top + 64}H871`} stroke="#5c758c" strokeOpacity=".6" strokeWidth=".8" />
                {line.stages.map((stage, stageIndex) => {
                  const state = states[stage.state] || states.idle;
                  const center = stageCenters[stageIndex];
                  const progress = bounded(stage.progress > 1 ? stage.progress / 100 : stage.progress);
                  const phase = stage.state === "running" ? (Math.max(0, minute) * .075 + progress + stageIndex * .17) % 1 : progress;
                  const start = stageIndex === 0 ? 239 : stageCenters[stageIndex - 1] + 48;
                  const end = center - 49;
                  const incomingQueue = stageIndex > 0 ? line.stages[stageIndex - 1].queue : 0;
                  return <g key={`${stage.name}-${stageIndex}`} aria-hidden="true">
                    <title>{`${stage.name}: ${state.label}. ${number(stage.queue)} unidades en espera a la salida.`}</title>
                    {end > start && <>
                      <path d={`M${start} ${top + 60}H${end}`} stroke="#7391aa" strokeWidth="1.1" markerEnd={`url(#${arrowId})`} />
                      {stage.state === "running" && <rect x={start + phase * Math.max(0, end - start - 7)} y={top + 57} width="7" height="6" rx="1.5" fill={color} />}
                      {incomingQueue > 0 && <>
                        <rect x={Math.max(start - 4, end - 34)} y={top + 32} width="35" height="14" rx="4" fill="#263b4e" />
                        <text x={Math.max(start + 13.5, end - 16.5)} y={top + 42} textAnchor="middle" className={styles.queueLabel}>{number(incomingQueue)}</text>
                      </>}
                    </>}
                    <rect x={center - 48} y={top + 32} width="96" height="53" rx="7" fill="#0c1b2a" stroke="#3e5870" />
                    <g transform={`translate(${center} ${top + 58})`}><Equipment kind={stageIndex === stageCount - 1 ? 3 : (stageIndex + (lineIndex === 2 ? 1 : 0)) % 3} color={color} phase={phase} /></g>
                    <rect x={center - 40} y={top + 80} width="80" height="2" rx="1" fill="#2d4257" />
                    <rect x={center - 40} y={top + 80} width={80 * progress} height="2" rx="1" fill={state.color} />
                    <circle cx={center + 40} cy={top + 37} r="3.5" fill={state.color} stroke="#0c1b2a" strokeWidth="1.5" />
                    <text x={center} y={top + 101} textAnchor="middle" className={styles.stageLabel}>{short(stage.name, stageCount > 3 ? 22 : 29)}</text>
                  </g>;
                })}
                <path d={`M${(stageCenters[stageCount - 1] || 798) + 49} ${top + 60}H871`} stroke="#7391aa" strokeWidth="1.1" markerEnd={`url(#${arrowId})`} />
                {line.stages[stageCount - 1]?.state === "running" && <rect x={848 + ((Math.max(0, minute) * .11 + lineIndex * .3) % 1) * 14} y={top + 57} width="7" height="6" rx="1.5" fill={color} />}
                {selected && <path d={`M226 ${top + 36}v36`} stroke={color} strokeWidth="3" />}
              </g>
            );
          })}

          <g aria-label={`Expedición: ${number(dispatched)} unidades despachadas y ${number(finishedStock)} unidades terminadas en depósito.`}>
            <rect x="931" y="62" width="145" height="365" rx="9" fill="#101f31" stroke="#32495f" />
            <path d="M932 97H1075" stroke="#2b4258" />
            <text x="945" y="84" className={styles.warehouseTitle}>Producto terminado</text>
            <text x="945" y="119" className={styles.smallLabel}>DEPÓSITO Y DESPACHO</text>
            {[0, 1].map((row) => [0, 1, 2].map((column) => <Pallet key={`${row}-${column}`} x={945 + column * 39} y={142 + row * 41} bright={finishedStock > (row * 3 + column) * 100} />))}
            <text x="947" y="248" className={styles.counter}>{number(finishedStock)}</text>
            <text x="947" y="267" className={styles.secondary}>unidades en depósito</text>
            <path d="M945 287h116" stroke="#2b4258" />
            <text x="947" y="322" className={styles.counter}>{number(dispatched)}</text>
            <text x="947" y="341" className={styles.secondary}>unidades despachadas</text>
            <g transform="translate(949 368)" fill="none" stroke="#7c96ac" strokeWidth="1.5" aria-hidden="true"><rect width="50" height="25" rx="3" /><path d="M50 8h16l9 11v6H50M57 10v9h15M8 6h32M8 11h24" /><circle cx="13" cy="28" r="5" fill="#101f31" /><circle cx="60" cy="28" r="5" fill="#101f31" /><path d="M83 17h24m-6-5 6 5-6 5" /></g>
          </g>

          <path d="M225 445H884" stroke="#3a5066" strokeDasharray="4 6" />
          <g transform="translate(228 458)" aria-label="Servicios compartidos de mantenimiento, calidad y energía">
            <text x="0" y="10" className={styles.smallLabel}>SERVICIOS COMPARTIDOS</text>
            <g transform="translate(0 24)"><rect width="197" height="30" rx="5" fill="#142236" stroke="#30435b" /><path d="M13 9l10 12M21 8l3 3-5 5-3-3M11 20l3-3" fill="none" stroke="#849cb7" strokeWidth="1.6" /><text x="35" y="19" className={styles.serviceLabel}>Mantenimiento</text></g>
            <g transform="translate(215 24)"><rect width="197" height="30" rx="5" fill="#142236" stroke="#30435b" /><path d="M17 6l7 3v7l-7 7-7-7V9zM13 14l3 3 5-6" fill="none" stroke="#849cb7" strokeWidth="1.5" /><text x="35" y="19" className={styles.serviceLabel}>Control de calidad</text></g>
            <g transform="translate(430 24)"><rect width="226" height="30" rx="5" fill="#142236" stroke="#30435b" /><path d="M19 6l-9 11h7l-2 8 10-13h-8z" fill="none" stroke="#849cb7" strokeWidth="1.3" /><text x="35" y="19" className={styles.serviceLabel}>Energía y servicios auxiliares</text></g>
          </g>
          <text x="27" y="478" className={styles.smallLabel}>AVANCE DEL TURNO</text>
          <text x="27" y="502" className={styles.shiftValue}>{Math.round(elapsed * 100)}<tspan className={styles.secondary}> %</tspan></text>
          <rect x="75" y="492" width="98" height="4" rx="2" fill="#294058" /><rect x="75" y="492" width={elapsed * 98} height="4" rx="2" fill="#77b7d5" />
          <text x="931" y="477" className={styles.smallLabel}>FLUJO ILUSTRATIVO</text>
          <text x="931" y="496" className={styles.secondary}>Vista conceptual</text>
          <text x="931" y="511" className={styles.secondary}>Sin escala física</text>
        </svg>
      </div>
      <figcaption className={styles.caption}>
        <ul className={styles.legend} aria-label="Estados de las etapas">
          {Object.entries(states).map(([key, value]) => <li key={key}><span style={{ backgroundColor: value.color }} aria-hidden="true" />{value.label}</li>)}
        </ul>
        <p>Seleccioná una línea para ver el detalle <span aria-hidden="true">↗</span></p>
      </figcaption>
    </figure>
  );
}
