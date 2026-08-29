import type { PlanningDay } from "./types";

/**
 * Utilidades de fecha en UTC puro. Se evita `Intl` y la zona horaria local
 * para que el render del servidor y el del cliente produzcan exactamente el
 * mismo texto (sin errores de hidratacion) y para que el caso sea reproducible.
 */

const WEEKDAY_NAMES = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];
const WEEKDAY_SHORT = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
const MONTH_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function toIsoDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000);
}

export function isBusinessDay(date: Date): boolean {
  const day = date.getUTCDay();
  return day >= 1 && day <= 5;
}

/** Devuelve `count` dias habiles consecutivos a partir de `startIso` inclusive. */
export function businessDaysFrom(startIso: string, count: number): PlanningDay[] {
  const days: PlanningDay[] = [];
  let cursor = parseIsoDate(startIso);
  while (days.length < count) {
    if (isBusinessDay(cursor)) {
      days.push(buildPlanningDay(cursor, days.length));
    }
    cursor = addDays(cursor, 1);
  }
  return days;
}

/** Devuelve los `count` dias habiles inmediatamente anteriores a `endIso` (excluyente). */
export function businessDaysBefore(endIso: string, count: number): PlanningDay[] {
  const collected: Date[] = [];
  let cursor = addDays(parseIsoDate(endIso), -1);
  while (collected.length < count) {
    if (isBusinessDay(cursor)) collected.push(cursor);
    cursor = addDays(cursor, -1);
  }
  collected.reverse();
  return collected.map((date, index) => buildPlanningDay(date, index));
}

function buildPlanningDay(date: Date, index: number): PlanningDay {
  const weekday = date.getUTCDay();
  return {
    index,
    date: toIsoDate(date),
    label: `${WEEKDAY_SHORT[weekday]} ${String(date.getUTCDate()).padStart(2, "0")}/${MONTH_SHORT[date.getUTCMonth()]}`,
    weekdayName: WEEKDAY_NAMES[weekday],
    weekday,
  };
}

export function formatLongDate(iso: string): string {
  const date = parseIsoDate(iso);
  return `${WEEKDAY_NAMES[date.getUTCDay()]} ${date.getUTCDate()} de ${MONTH_SHORT[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}
