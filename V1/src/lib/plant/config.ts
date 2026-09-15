import type { PlantScenario } from "./types";

export const PLANT_START_HOUR = 6;
export const PLANT_REGULAR_MINUTES = 16 * 60;

export const DEFAULT_PLANT_SCENARIO: PlantScenario = {
  speedPct: 100,
  materialDelayMinutes: 0,
  downtimeLineId: "L2",
  downtimeStartMinute: 300,
  downtimeMinutes: 0,
  dispatchCapacityPerHour: 18000,
  bufferCapacityMinutes: 12,
  qualityLossPct: 0,
};

export const PLANT_PRESETS: Array<{
  id: string;
  name: string;
  description: string;
  scenario: PlantScenario;
}> = [
  {
    id: "normal",
    name: "Operación normal",
    description: "Secuencia del plan, calidad de cada línea y despacho con capacidad suficiente.",
    scenario: { ...DEFAULT_PLANT_SCENARIO },
  },
  {
    id: "l2-stop",
    name: "Parada en línea 2",
    description: "Una falla detiene L2 durante 120 minutos desde las 11:00.",
    scenario: { ...DEFAULT_PLANT_SCENARIO, downtimeMinutes: 120 },
  },
  {
    id: "material-delay",
    name: "Insumos demorados",
    description: "La alimentación de las tres líneas espera los insumos hasta las 09:00.",
    scenario: { ...DEFAULT_PLANT_SCENARIO, materialDelayMinutes: 180 },
  },
  {
    id: "dispatch-slow",
    name: "Despacho limitado",
    description: "El despacho común baja a 3.600 u/h y las colas pueden bloquear las líneas.",
    scenario: { ...DEFAULT_PLANT_SCENARIO, dispatchCapacityPerHour: 3600 },
  },
];

export const PLANT_LINE_LAYOUTS: Record<string, { name: string; color: string; stages: string[] }> = {
  L1: { name: "Línea 1 · Líquidos", color: "#38bdf8", stages: ["Preparación", "Llenado", "Calidad", "Embalaje"] },
  L2: { name: "Línea 2 · Multiproducto", color: "#a78bfa", stages: ["Preparación", "Proceso flexible", "Calidad", "Embalaje"] },
  L3: { name: "Línea 3 · Inyección y soplado", color: "#fbbf24", stages: ["Alimentación", "Moldeo / respaldo", "Calidad", "Embalaje"] },
};

const finite = (value: number | undefined, fallback: number) => Number.isFinite(value) ? value as number : fallback;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function normalizePlantScenario(input: Partial<PlantScenario> = {}): PlantScenario {
  return {
    speedPct: clamp(finite(input.speedPct, 100), 50, 130),
    materialDelayMinutes: Math.round(clamp(finite(input.materialDelayMinutes, 0), 0, 1080)),
    downtimeLineId: ["L1", "L2", "L3"].includes(input.downtimeLineId ?? "") ? input.downtimeLineId! : "L2",
    downtimeStartMinute: Math.round(clamp(finite(input.downtimeStartMinute, 300), 0, 1080)),
    downtimeMinutes: Math.round(clamp(finite(input.downtimeMinutes, 0), 0, 1080)),
    dispatchCapacityPerHour: clamp(finite(input.dispatchCapacityPerHour, 18000), 0, 60000),
    bufferCapacityMinutes: clamp(finite(input.bufferCapacityMinutes, 12), 1, 60),
    qualityLossPct: clamp(finite(input.qualityLossPct, 0), 0, 100),
  };
}
