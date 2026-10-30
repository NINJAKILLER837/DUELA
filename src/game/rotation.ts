import type { Position, Player } from "@/types";

/**
 * DUELA · Fase 3 — decisiones del entrenador.
 *
 * Este módulo es deliberadamente puro: no simula acciones ni modifica el
 * marcador. Decide qué cinco empiezan y qué cambios proponer en una ventana de
 * balón muerto. La resolución de la posesión sigue viviendo en engine.ts.
 *
 * La calidad de entrenador se calcula con atributos individuales, no con OVR ni
 * POT. `team.rotation` define la plantilla disponible (5–10 jugadores) y
 * `rotationMinutes` solo actúa como preferencia táctica, nunca como minutos
 * fijos: los minutos finales se acumulan por tiempo real en cancha.
 */

export interface CoachPlayer {
  player: Player;
  onCourt: boolean;
  secondsPlayed: number;
  fatigue: number;
  fouls: number;
  fouledOut: boolean;
  lastOffElapsed: number;
  stintStartElapsed: number;
  coachPreference: number;
}

export interface CoachContext {
  teamId: string;
  period: number;
  /** Segundos que quedan en el período. */
  clock: number;
  elapsed: number;
  margin: number;
  teamSubstitutions: number;
  lastTeamSubElapsed: number;
}

export interface SubstitutionDecision {
  out: CoachPlayer;
  in: CoachPlayer;
  reason: string;
  forced: boolean;
}

const GROUPS: Record<Position, "G" | "F" | "C"> = { PG: "G", SG: "G", SF: "F", PF: "F", C: "C" };

const VALUE_WEIGHTS: Record<Position, Partial<Record<keyof Player["attributes"], number>>> = {
  PG: { speed: 8, dribbling: 16, passing: 16, offensiveIQ: 14, threePointers: 10, midRange: 8, layups: 7, freeThrows: 5, perimeterDefense: 6, defensiveIQ: 7, rebounding: 1, strength: 2 },
  SG: { speed: 8, dribbling: 9, passing: 7, offensiveIQ: 11, threePointers: 17, midRange: 12, layups: 9, freeThrows: 5, perimeterDefense: 9, defensiveIQ: 7, rebounding: 3, strength: 3 },
  SF: { speed: 7, dribbling: 6, passing: 6, offensiveIQ: 10, threePointers: 12, midRange: 10, layups: 11, freeThrows: 4, perimeterDefense: 10, defensiveIQ: 8, rebounding: 8, strength: 6, inside: 5 },
  PF: { speed: 4, passing: 4, offensiveIQ: 7, threePointers: 7, midRange: 7, layups: 12, inside: 14, strength: 12, freeThrows: 3, perimeterDefense: 5, defensiveIQ: 8, rebounding: 15, interiorDefense: 8 },
  C: { speed: 2, passing: 3, offensiveIQ: 6, threePointers: 2, midRange: 4, layups: 12, inside: 18, strength: 14, freeThrows: 3, perimeterDefense: 2, defensiveIQ: 8, rebounding: 18, interiorDefense: 10 },
};

/** Valor de entrenador (0–100) basado en atributos individuales, nunca en OVR. */
export function coachValue(player: Player): number {
  const weights = VALUE_WEIGHTS[player.position];
  let total = 0;
  let weight = 0;
  for (const [key, value] of Object.entries(weights) as [keyof Player["attributes"], number][]) {
    total += player.attributes[key] * value;
    weight += value;
  }
  const skills = weight ? total / weight : 50;
  const physical = (player.attributes.endurance * 0.45 + player.attributes.strength * 0.3 + player.attributes.speed * 0.25);
  const height = Math.max(0, Math.min(1, (player.heightIn - 72) / 16)) * 4;
  return Math.round(skills * 0.86 + physical * 0.14 + height);
}

export function selectGameRotation(team: { rotation?: string[] }, players: Player[]): Player[] {
  const byId = new Map(players.map((player) => [player.id, player]));
  const explicit = (team.rotation ?? []).map((id) => byId.get(id)).filter((player): player is Player => Boolean(player));
  const chosen: Player[] = [];
  const used = new Set<string>();
  for (const player of explicit) {
    if (!used.has(player.id) && chosen.length < 10) {
      chosen.push(player);
      used.add(player.id);
    }
  }
  if (chosen.length >= 5) return chosen;
  const ranked = [...players].sort((a, b) => coachValue(b) - coachValue(a));
  const slots: ("G" | "F" | "C")[] = ["G", "G", "F", "F", "C"];
  for (const slot of slots) {
    const pick = ranked.find((player) => GROUPS[player.position] === slot && !used.has(player.id));
    if (pick) { chosen.push(pick); used.add(pick.id); }
  }
  for (const player of ranked) {
    if (!used.has(player.id) && chosen.length < 10) { chosen.push(player); used.add(player.id); }
  }
  if (chosen.length < 5) throw new Error("Se necesitan al menos cinco jugadores elegibles para simular.");
  return chosen;
}

export function chooseStartingFive(rotation: Player[]): Player[] {
  const chosen: Player[] = [];
  const used = new Set<string>();
  for (const position of ["PG", "SG", "SF", "PF", "C"] as Position[]) {
    const pick = [...rotation]
      .filter((player) => player.position === position && !used.has(player.id))
      .sort((a, b) => coachValue(b) - coachValue(a))[0];
    if (pick) { chosen.push(pick); used.add(pick.id); }
  }
  for (const player of [...rotation].sort((a, b) => coachValue(b) - coachValue(a))) {
    if (!used.has(player.id) && chosen.length < 5) { chosen.push(player); used.add(player.id); }
  }
  return chosen.slice(0, 5);
}

export function coachPreference(team: { rotation?: string[]; rotationMinutes?: Record<string, number> }, player: Player): number {
  const order = team.rotation?.indexOf(player.id) ?? -1;
  const orderFactor = order >= 0 ? Math.max(0.94, 1 - order * 0.008) : 1;
  const minutes = team.rotationMinutes?.[player.id];
  const minutesFactor = minutes === undefined ? 1 : 0.94 + Math.min(42, Math.max(4, minutes)) / 420;
  return orderFactor * minutesFactor;
}

function topValue(players: CoachPlayer[], count: number): number {
  return [...players].map((item) => coachValue(item.player)).sort((a, b) => b - a)[count - 1] ?? 0;
}

function pickReplacement(bench: CoachPlayer[], context: CoachContext, outgoing: CoachPlayer, preferQuality: boolean): CoachPlayer | undefined {
  const candidates = bench.filter((item) => !item.fouledOut && context.elapsed - item.lastOffElapsed >= 90);
  const pool = candidates.length ? candidates : bench.filter((item) => !item.fouledOut);
  if (!pool.length) return undefined;
  return [...pool].sort((a, b) => {
    const aRest = Math.min(1, Math.max(0, (context.elapsed - a.lastOffElapsed) / 600));
    const bRest = Math.min(1, Math.max(0, (context.elapsed - b.lastOffElapsed) / 600));
    const aFit = a.player.position === outgoing.player.position ? 4 : GROUPS[a.player.position] === GROUPS[outgoing.player.position] ? 2 : 0;
    const bFit = b.player.position === outgoing.player.position ? 4 : GROUPS[b.player.position] === GROUPS[outgoing.player.position] ? 2 : 0;
    const aScore = coachValue(a.player) * a.coachPreference + aRest * 10 + aFit + (preferQuality ? coachValue(a.player) * 0.3 : 0);
    const bScore = coachValue(b.player) * b.coachPreference + bRest * 10 + bFit + (preferQuality ? coachValue(b.player) * 0.3 : 0);
    return bScore - aScore;
  })[0];
}

/**
 * Devuelve como máximo un cambio normal por ventana. Las expulsiones se
 * resuelven primero y pueden forzar un cambio. Si no hay reemplazo elegible,
 * devuelve una lista vacía: el motor nunca inventa un jugador.
 */
export function chooseSubstitutions(players: CoachPlayer[], context: CoachContext): SubstitutionDecision[] {
  const onCourt = players.filter((item) => item.onCourt);
  const bench = players.filter((item) => !item.onCourt);
  const disqualified = onCourt.filter((item) => item.fouledOut || item.fouls >= 6);

  if (disqualified.length) {
    const replacement = pickReplacement(bench, context, disqualified[0], context.margin <= 5);
    if (replacement) return [{ out: disqualified[0], in: replacement, reason: "6 faltas", forced: true }];
    return [];
  }
  if (onCourt.length < 5) {
    const fill = pickReplacement(bench, context, onCourt[0] ?? players[0], false);
    if (fill) return [{ out: onCourt[0], in: fill, reason: "alineación incompleta", forced: true }];
    return [];
  }
  if (context.teamSubstitutions >= 40) return [];
  if (context.elapsed - context.lastTeamSubElapsed < 45) return [];
  if (!bench.some((item) => !item.fouledOut)) return [];

  const close = Math.abs(context.margin) <= 5;
  const clutch = context.period >= 4 && context.clock <= 300 && close;
  const overtime = context.period > 4;
  const blowout = Math.abs(context.margin) >= 16 && context.period >= 3;
  const garbage = Math.abs(context.margin) >= 20 && context.period >= 4 && context.clock <= 420;
  const best = topValue(players, 1);
  const fifth = topValue(players, 5);

  const candidates = onCourt
    .filter((item) => context.elapsed - item.stintStartElapsed >= 100)
    .map((item) => {
      const value = coachValue(item.player);
      let score = 0;
      const stintMinutes = (context.elapsed - item.stintStartElapsed) / 60;
      if (item.fatigue >= 0.5) score += (item.fatigue - 0.42) * 2.2;
      if (stintMinutes >= 8) score += 0.45 + Math.min(0.6, (stintMinutes - 8) * 0.12);
      if (item.fatigue >= 0.4 && item.fouls < 3) score += 0.2;
      if (item.fouls >= 5) score += clutch ? 1.5 : 0.7;
      else if (item.fouls >= 4 && clutch) score += 0.35;
      if (clutch && value < fifth) score += 0.55 + (fifth - value) * 0.012;
      if ((garbage || blowout) && value >= best - 6) score += garbage ? 1.1 : 0.45;
      if (overtime && item.fatigue >= 0.48) score += 0.4;
      if (item.fatigue < 0.4 && !clutch && !blowout) score -= 0.4;
      return { item, score, value };
    })
    .sort((a, b) => b.score - a.score);
  const outgoing = candidates[0];
  if (!outgoing || outgoing.score < 0.45) return [];
  const replacement = pickReplacement(bench, context, outgoing.item, clutch);
  if (!replacement) return [];
  const reason = outgoing.item.fouls >= 4 && clutch ? "faltas"
    : outgoing.item.fatigue >= 0.5 ? "fatiga"
      : clutch ? "cierre"
        : garbage || blowout ? "descanso"
          : "ritmo";
  return [{ out: outgoing.item, in: replacement, reason, forced: false }];
}

export function substitutionText(outName: string, inName: string, reason: string): string {
  return `Cambio: sale ${outName}, entra ${inName} (${reason}).`;
}
