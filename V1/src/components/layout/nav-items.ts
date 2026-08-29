import {
  BookOpen,
  Boxes,
  CalendarRange,
  LayoutDashboard,
  Radar,
  Scale,
  SlidersHorizontal,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Dashboard",
    shortLabel: "Dashboard",
    description: "Resultado economico y operativo de la semana planificada.",
    icon: LayoutDashboard,
  },
  {
    href: "/plan",
    label: "Plan de produccion",
    shortLabel: "Plan",
    description: "Programa por dia, linea y producto con su justificacion.",
    icon: CalendarRange,
  },
  {
    href: "/inventario",
    label: "Inventario y abastecimiento",
    shortLabel: "Inventario",
    description: "Cobertura de producto terminado, materias primas y proveedores.",
    icon: Boxes,
  },
  {
    href: "/torre",
    label: "Torre de abastecimiento",
    shortLabel: "Torre",
    description: "Cobertura de materias primas, riesgo de quiebre y decisiones de compra.",
    icon: Radar,
  },
  {
    href: "/balanceo",
    label: "Balanceo de linea",
    shortLabel: "Balanceo",
    description: "Takt time, carga por estacion, cuello de botella y eficiencia de linea.",
    icon: Scale,
  },
  {
    href: "/simulador",
    label: "Simulador de escenarios",
    shortLabel: "Simulador",
    description: "Modifica demanda, capacidad, setups y costos y recalcula el plan.",
    icon: SlidersHorizontal,
  },
  {
    href: "/metodologia",
    label: "Metodologia",
    shortLabel: "Metodologia",
    description: "Supuestos, formulas, desperdicios abordados y limitaciones.",
    icon: BookOpen,
  },
];
