import { formatCurrency, formatNumber } from "@/lib/format";
import type { FamilyId, PlanRun, Product, ProductionPlan } from "@/lib/types";
import type { PlanningContext } from "./context";
import { assemblePlan, ceilToLot, cumulativeDemand, floorToLot, pushOrMergeRun } from "./plan-utils";

/** Minutos ociosos minimos para que valga la pena extender una corrida. */
const MIN_EXTENSION_MINUTES = 25;
/**
 * Corrida minima util. Programar tres minutos de una linea no es un plan
 * ejecutable: obliga a preparar materiales y personal para casi nada. Solo se
 * admite una corrida mas corta cuando cubre un faltante del mismo dia.
 */
const MIN_RUN_MINUTES = 10;
/** Peso de la penalidad por usar una linea mas lenta al balancear carga. */
const SLOWER_LINE_PENALTY = 0.25;
/** Bonificacion por concentrar una familia en una linea que ya la corre. */
const FAMILY_CONCENTRATION_BONUS = 0.03;
/**
 * Peso con el que se valoriza reponer el stock de seguridad frente al costo de
 * un faltante efectivo. Representa la proteccion ante error de pronostico.
 */
const SAFETY_STOCK_WEIGHT = 0.2;

interface LineDayState {
  lineId: string;
  dayIndex: number;
  regularRemaining: number;
  overtimeRemaining: number;
  currentFamily: FamilyId;
  sequence: number;
}

/**
 * PLAN RECOMENDADO - heuristica constructiva de planificacion.
 *
 * No es un optimo matematico: es una heuristica golosa con compuertas
 * economicas explicitas. Cada decision se puede leer y auditar.
 *
 * Fase 0. Asignacion producto-linea balanceando carga y concentrando familias.
 * Fase 1. Por linea y dia, bloques por familia ordenados por riesgo economico,
 *         empezando por la familia ya montada (cambio de formato = 0 min).
 *         Un cambio de formato solo se ejecuta si el faltante que evita en los
 *         proximos dos dias supera su costo.
 * Fase 2. Con la capacidad ociosa restante se extiende la ultima corrida para
 *         cubrir tambien el dia siguiente, evitando un setup manana.
 * Fase 3. Los faltantes que siguen abiertos se intentan derivar a una linea
 *         alternativa con capacidad libre.
 * Fase 4. Recien entonces se evalua hora extra, y solo si el faltante evitado
 *         supera el costo de esa hora extra mas el setup asociado.
 */
export function buildRecommendedPlan(ctx: PlanningContext): ProductionPlan {
  const runs: PlanRun[] = [];
  const stock: Record<string, number> = { ...ctx.initialStock };
  const carriedFamily: Record<string, FamilyId> = {};
  for (const line of ctx.lines) carriedFamily[line.id] = line.initialFamilyId;

  const { assignments, notes: assignmentNotes } = assignLines(ctx);

  const lastDayIndex = ctx.days.length - 1;

  const safetyTarget = (product: Product): number =>
    product.safetyStockDays * ctx.averageDailyDemand[product.id];

  const coverDays = (product: Product): number => {
    const average = ctx.averageDailyDemand[product.id];
    return average > 0 ? stock[product.id] / average : 99;
  };

  /** Techo de produccion para no generar inventario excesivo. */
  const coverCeiling = (product: Product): number =>
    Math.max(0, product.maxCoverDays * ctx.averageDailyDemand[product.id] - stock[product.id]);

  const commit = (
    state: LineDayState,
    product: Product,
    units: number,
    setupMinutes: number,
    runMinutes: number,
    reason: string,
  ): void => {
    const total = setupMinutes + runMinutes;
    const fromRegular = Math.min(state.regularRemaining, total);
    state.regularRemaining -= fromRegular;
    state.overtimeRemaining = Math.max(0, state.overtimeRemaining - (total - fromRegular));
    const created = pushOrMergeRun(runs, {
      dayIndex: state.dayIndex,
      lineId: state.lineId,
      productId: product.id,
      familyId: product.familyId,
      sequence: state.sequence,
      units,
      runMinutes,
      setupMinutes,
      overtimeMinutes: 0,
      reason,
    });
    if (created) state.sequence += 1;
    state.currentFamily = product.familyId;
    stock[product.id] += units;
  };

  for (const day of ctx.days) {
    const dayIndex = day.index;
    const states: Record<string, LineDayState> = {};
    for (const line of ctx.lines) {
      states[line.id] = {
        lineId: line.id,
        dayIndex,
        regularRemaining: ctx.regularCapacity[line.id][dayIndex],
        overtimeRemaining: ctx.overtimeCapacity[line.id][dayIndex],
        currentFamily: carriedFamily[line.id],
        sequence: 0,
      };
    }

    const demandToday = (product: Product): number => ctx.demand[product.id][dayIndex];
    /**
     * Riesgo economico de no fabricar el producto hoy, en una ventana de dos dias.
     *
     * Se suman dos terminos: el faltante efectivo, valorizado al costo pleno de
     * no atender demanda, y las unidades que quedarian por debajo del stock de
     * seguridad, valorizadas al {SAFETY_STOCK_WEIGHT} de ese costo. Sin este
     * segundo termino la heuristica deja a la planta corriendo sin colchon: como
     * el pronostico es deterministico, nunca "pagaria" por reponer seguridad.
     */
    const riskTwoDays = (product: Product): number => {
      const window = cumulativeDemand(ctx, product.id, dayIndex, dayIndex + 1);
      const unitCost = ctx.stockoutCostPerUnit(product.id);
      const shortage = Math.max(0, window - stock[product.id]);
      const safetyGap = Math.max(0, window + safetyTarget(product) - stock[product.id]) - shortage;
      return shortage * unitCost + safetyGap * unitCost * SAFETY_STOCK_WEIGHT;
    };
    const shortageToday = (product: Product): number =>
      Math.max(0, demandToday(product) - stock[product.id]);
    const requirementToday = (product: Product): number =>
      Math.max(0, demandToday(product) + safetyTarget(product) - stock[product.id]);

    /* ---------------- Fase 1: bloques por familia ---------------- */
    for (const line of ctx.lines) {
      const state = states[line.id];
      const assigned = ctx.products.filter((product) => assignments[product.id] === line.id);

      const pendingFamilies = (): FamilyId[] => {
        const families = new Set<FamilyId>();
        for (const product of assigned) {
          if (requirementToday(product) > product.lotSize * 0.25) families.add(product.familyId);
        }
        return [...families].sort((a, b) => {
          // La familia ya montada va primero: su cambio de formato cuesta 0.
          const mountedA = a === state.currentFamily ? 0 : 1;
          const mountedB = b === state.currentFamily ? 0 : 1;
          if (mountedA !== mountedB) return mountedA - mountedB;
          const riskA = assigned
            .filter((product) => product.familyId === a)
            .reduce((acc, product) => acc + riskTwoDays(product), 0);
          const riskB = assigned
            .filter((product) => product.familyId === b)
            .reduce((acc, product) => acc + riskTwoDays(product), 0);
          if (riskA !== riskB) return riskB - riskA;
          return a.localeCompare(b);
        });
      };

      const attempted = new Set<FamilyId>();
      let families = pendingFamilies();
      while (families.length > 0) {
        const familyId = families.find((candidate) => !attempted.has(candidate));
        if (!familyId) break;
        attempted.add(familyId);

        const setupMinutes =
          state.currentFamily === familyId
            ? 0
            : ctx.setupMinutes(line.id, state.currentFamily, familyId);
        const budget = state.regularRemaining - setupMinutes;
        if (budget <= 0) break;

        const candidates = assigned
          .filter((product) => product.familyId === familyId)
          .filter((product) => requirementToday(product) > product.lotSize * 0.25)
          .sort((a, b) => coverDays(a) - coverDays(b) || riskTwoDays(b) - riskTwoDays(a) || a.id.localeCompare(b.id));

        // Se simula el bloque completo antes de comprometer el cambio de formato:
        // pagar un setup para terminar produciendo cero seria un desperdicio puro.
        const planned: Array<{ product: Product; units: number; runMinutes: number }> = [];
        let usedMinutes = 0;
        for (const product of candidates) {
          const unitsPerMinute = ctx.rate(line.id, product.id);
          if (unitsPerMinute <= 0) continue;
          const ceiling = coverCeiling(product);
          const target = Math.min(requirementToday(product), ceiling);
          if (target <= 0) continue;
          let units = ceilToLot(target, product.lotSize);
          if (units > ceiling) units = floorToLot(ceiling, product.lotSize);
          const feasible = floorToLot((budget - usedMinutes) * unitsPerMinute, product.lotSize);
          units = Math.min(units, feasible);
          if (units <= 0) continue;
          const runMinutes = units / unitsPerMinute;
          // Corridas testimoniales solo si evitan un faltante del mismo dia.
          if (runMinutes < MIN_RUN_MINUTES && shortageToday(product) <= 0) continue;
          planned.push({ product, units, runMinutes });
          usedMinutes += runMinutes;
        }

        if (planned.length === 0) {
          families = pendingFamilies();
          continue;
        }

        const avoidedCost = planned.reduce((acc, item) => acc + riskTwoDays(item.product), 0);
        const setupCost = (setupMinutes / 60) * line.setupCostPerHour;
        if (setupMinutes > 0 && avoidedCost < setupCost) {
          // Cambio de formato no rentable hoy: la familia queda postergada.
          families = pendingFamilies();
          continue;
        }

        planned.forEach((item, index) => {
          const isFirst = index === 0;
          const reason =
            isFirst && setupMinutes > 0
              ? `Cambio de formato a ${familyId} (${formatNumber(setupMinutes)} min): evita ${formatCurrency(avoidedCost)} de faltante frente a ${formatCurrency(setupCost)} de setup.`
              : setupMinutes > 0
                ? `Agrupado en el mismo bloque de ${familyId}: aprovecha el cambio de formato ya realizado.`
                : `Familia ${familyId} ya montada en la linea: se produce sin cambio de formato.`;
          commit(state, item.product, item.units, isFirst ? setupMinutes : 0, item.runMinutes, reason);
        });

        families = pendingFamilies();
      }
    }

    /* ---------------- Fase 2: extension de la corrida montada ---------------- */
    if (dayIndex < lastDayIndex) {
      for (const line of ctx.lines) {
        const state = states[line.id];
        if (state.regularRemaining < MIN_EXTENSION_MINUTES) continue;
        const familyId = state.currentFamily;
        const candidates = ctx.products
          .filter((product) => assignments[product.id] === line.id && product.familyId === familyId)
          .sort((a, b) => coverDays(a) - coverDays(b) || a.id.localeCompare(b.id));

        for (const product of candidates) {
          if (state.regularRemaining < MIN_EXTENSION_MINUTES) break;
          const unitsPerMinute = ctx.rate(line.id, product.id);
          if (unitsPerMinute <= 0) continue;
          const horizonNeed =
            cumulativeDemand(ctx, product.id, dayIndex, dayIndex + 1) +
            safetyTarget(product) -
            stock[product.id];
          const target = Math.min(horizonNeed, coverCeiling(product));
          if (target <= product.lotSize * 0.5) continue;
          const feasible = floorToLot(state.regularRemaining * unitsPerMinute, product.lotSize);
          const units = Math.min(floorToLot(target, product.lotSize) || product.lotSize, feasible);
          if (units <= 0 || units / unitsPerMinute < MIN_RUN_MINUTES) continue;
          commit(
            state,
            product,
            units,
            0,
            units / unitsPerMinute,
            `Extension de corrida con capacidad ociosa: cubre tambien el dia siguiente y evita un nuevo cambio de formato.`,
          );
        }
      }
    }

    /* ---------------- Fase 3: derivacion a linea alternativa ---------------- */
    const pendingProducts = ctx.products
      .filter((product) => shortageToday(product) > 0)
      .sort(
        (a, b) =>
          shortageToday(b) * ctx.stockoutCostPerUnit(b.id) -
            shortageToday(a) * ctx.stockoutCostPerUnit(a.id) || a.id.localeCompare(b.id),
      );

    for (const product of pendingProducts) {
      const shortage = shortageToday(product);
      if (shortage <= 0) continue;
      const options = ctx
        .eligibleLines(product.id)
        .filter((lineId) => ctx.rate(lineId, product.id) > 0)
        .sort((a, b) => {
          const setupA = states[a].currentFamily === product.familyId ? 0 : 1;
          const setupB = states[b].currentFamily === product.familyId ? 0 : 1;
          if (setupA !== setupB) return setupA - setupB;
          return states[b].regularRemaining - states[a].regularRemaining;
        });

      for (const lineId of options) {
        const state = states[lineId];
        const line = ctx.lineById[lineId];
        const setupMinutes =
          state.currentFamily === product.familyId
            ? 0
            : ctx.setupMinutes(lineId, state.currentFamily, product.familyId);
        const budget = state.regularRemaining - setupMinutes;
        if (budget <= 0) continue;
        const unitsPerMinute = ctx.rate(lineId, product.id);
        const units = Math.min(
          ceilToLot(shortage, product.lotSize),
          floorToLot(budget * unitsPerMinute, product.lotSize),
        );
        if (units <= 0) continue;
        const avoided = Math.min(units, shortage) * ctx.stockoutCostPerUnit(product.id);
        const setupCost = (setupMinutes / 60) * line.setupCostPerHour;
        if (avoided <= setupCost) continue;
        const reason =
          lineId === assignments[product.id]
            ? `Reposicion de urgencia: quedaba capacidad en la linea y evita ${formatCurrency(avoided)} de faltante.`
            : `Derivado a ${lineId} por falta de capacidad en ${assignments[product.id]}: evita ${formatCurrency(avoided)} de faltante.`;
        commit(state, product, units, setupMinutes, units / unitsPerMinute, reason);
        break;
      }
    }

    /* ---------------- Fase 4: hora extra con evaluacion economica ---------------- */
    if (ctx.scenario.allowOvertime) {
      const stillPending = ctx.products
        .filter((product) => shortageToday(product) > 0)
        .sort(
          (a, b) =>
            shortageToday(b) * ctx.stockoutCostPerUnit(b.id) -
              shortageToday(a) * ctx.stockoutCostPerUnit(a.id) || a.id.localeCompare(b.id),
        );

      for (const product of stillPending) {
        const shortage = shortageToday(product);
        if (shortage <= 0) continue;
        const options = ctx
          .eligibleLines(product.id)
          .filter((lineId) => ctx.rate(lineId, product.id) > 0)
          .sort((a, b) => {
            const setupA = states[a].currentFamily === product.familyId ? 0 : 1;
            const setupB = states[b].currentFamily === product.familyId ? 0 : 1;
            if (setupA !== setupB) return setupA - setupB;
            return ctx.lineById[a].overtimeCostPerHour - ctx.lineById[b].overtimeCostPerHour;
          });

        for (const lineId of options) {
          const state = states[lineId];
          const line = ctx.lineById[lineId];
          if (state.overtimeRemaining <= 0) continue;
          const setupMinutes =
            state.currentFamily === product.familyId
              ? 0
              : ctx.setupMinutes(lineId, state.currentFamily, product.familyId);
          const available = state.regularRemaining + state.overtimeRemaining - setupMinutes;
          if (available <= 0) continue;
          const unitsPerMinute = ctx.rate(lineId, product.id);
          const units = Math.min(
            ceilToLot(shortage, product.lotSize),
            floorToLot(available * unitsPerMinute, product.lotSize),
          );
          if (units <= 0) continue;
          const totalMinutes = setupMinutes + units / unitsPerMinute;
          const overtimeMinutes = Math.max(0, totalMinutes - state.regularRemaining);
          const cost =
            (overtimeMinutes / 60) * line.overtimeCostPerHour +
            (setupMinutes / 60) * line.setupCostPerHour;
          const avoided = Math.min(units, shortage) * ctx.stockoutCostPerUnit(product.id);
          if (avoided <= cost) continue;
          commit(
            state,
            product,
            units,
            setupMinutes,
            units / unitsPerMinute,
            `Hora extra justificada en ${lineId}: evita ${formatCurrency(avoided)} de faltante con un costo de ${formatCurrency(cost)}.`,
          );
          break;
        }
      }
    }

    /* ---------------- Cierre del dia ---------------- */
    for (const line of ctx.lines) {
      carriedFamily[line.id] = states[line.id].currentFamily;
    }
    for (const product of ctx.products) {
      stock[product.id] = Math.max(0, stock[product.id] - ctx.demand[product.id][dayIndex]);
    }
  }

  return assemblePlan({
    id: "recommended",
    label: "Plan recomendado",
    description:
      "Heuristica de priorizacion por riesgo de faltante con agrupamiento por familia, balanceo de lineas y compuertas economicas para setups y horas extra.",
    runs,
    lineAssignments: assignments,
    notes: [
      ...assignmentNotes,
      "Cada cambio de formato se ejecuta solo si el faltante evitado en dos dias supera su costo.",
      "La capacidad ociosa se usa para extender la corrida montada y evitar un setup al dia siguiente.",
      "La hora extra es el ultimo recurso y requiere que el faltante evitado supere su costo.",
      "La produccion por producto se limita a la cobertura maxima definida para no generar inventario excesivo.",
    ],
    ctx,
  });
}

/**
 * Fase 0: asignacion producto -> linea.
 *
 * Se recorren los productos de mayor a menor carga y cada uno se manda a la
 * linea que minimiza: utilizacion proyectada + penalidad por linea mas lenta -
 * bonificacion por concentrar la familia. El plan base, en cambio, usa siempre
 * la linea preferida aunque quede desbalanceada.
 */
function assignLines(ctx: PlanningContext): {
  assignments: Record<string, string>;
  notes: string[];
} {
  const capacity: Record<string, number> = {};
  const load: Record<string, number> = {};
  const families: Record<string, Set<FamilyId>> = {};
  for (const line of ctx.lines) {
    capacity[line.id] = ctx.regularCapacity[line.id].reduce((acc, value) => acc + value, 0);
    load[line.id] = 0;
    families[line.id] = new Set<FamilyId>();
  }

  const horizonDemand = (productId: string): number =>
    ctx.demand[productId].reduce((acc, value) => acc + value, 0);

  /**
   * La carga que un producto representa en la semana no es su demanda sino su
   * necesidad neta: demanda del horizonte mas stock de seguridad menos lo que ya
   * hay en stock. Se aplica un piso del 20% de la demanda para que un producto
   * con mucho inventario inicial no quede asignado a cualquier linea.
   */
  const horizonWorkload = (productId: string): number => {
    const product = ctx.productById[productId];
    const demand = horizonDemand(productId);
    const safety = product.safetyStockDays * ctx.averageDailyDemand[productId];
    const net = Math.max(0, demand + safety - ctx.initialStock[productId]);
    return Math.max(net, demand * 0.2);
  };

  const ordered = [...ctx.products].sort((a, b) => {
    const minutesA = horizonWorkload(a.id) / (ctx.rate(a.preferredLineId, a.id) || 1);
    const minutesB = horizonWorkload(b.id) / (ctx.rate(b.preferredLineId, b.id) || 1);
    return minutesB - minutesA || a.id.localeCompare(b.id);
  });

  const assignments: Record<string, string> = {};
  const moved: string[] = [];

  for (const product of ordered) {
    const options = ctx.eligibleLines(product.id).filter((lineId) => ctx.rate(lineId, product.id) > 0);
    const minutesByLine: Record<string, number> = {};
    for (const lineId of options) {
      minutesByLine[lineId] = horizonWorkload(product.id) / ctx.rate(lineId, product.id);
    }
    const fastestMinutes = Math.min(...options.map((lineId) => minutesByLine[lineId]));

    let bestLine = options[0];
    let bestScore = Number.POSITIVE_INFINITY;
    for (const lineId of options) {
      const minutes = minutesByLine[lineId];
      const projectedUtilization = (load[lineId] + minutes) / capacity[lineId];
      const speedPenalty = SLOWER_LINE_PENALTY * (minutes / fastestMinutes - 1);
      const concentrationBonus = families[lineId].has(product.familyId) ? FAMILY_CONCENTRATION_BONUS : 0;
      const score = projectedUtilization + speedPenalty - concentrationBonus;
      if (score < bestScore - 1e-9) {
        bestScore = score;
        bestLine = lineId;
      }
    }

    assignments[product.id] = bestLine;
    load[bestLine] += minutesByLine[bestLine];
    families[bestLine].add(product.familyId);
    if (bestLine !== product.preferredLineId) {
      moved.push(`${product.sku} (${product.preferredLineId} -> ${bestLine})`);
    }
  }

  const notes = [
    `Asignacion balanceada de carga entre lineas: ${ctx.lines
      .map((line) => `${line.id} ${formatNumber((load[line.id] / capacity[line.id]) * 100, 0)}%`)
      .join(" / ")}.`,
  ];
  if (moved.length > 0) {
    notes.push(`Productos reasignados respecto de su linea habitual: ${moved.join(", ")}.`);
  } else {
    notes.push("Ningun producto necesito cambiar de linea: la carga ya quedaba balanceada.");
  }

  return { assignments, notes };
}
