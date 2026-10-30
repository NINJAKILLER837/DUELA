import type {
  Attributes,
  Game,
  PlayEvent,
  Player,
  PlayerGameStats,
  ShotZone,
  ShotZoneRecord,
  Team,
  TeamBoxScore,
  SubstitutionRecord,
} from "@/types";
import { chance, createRng, weightedIndex, type RNG } from "./random";
import {
  chooseStartingFive,
  chooseSubstitutions,
  coachPreference,
  selectGameRotation,
  substitutionText,
  type CoachContext,
  type CoachPlayer,
} from "./rotation";

/**
 * DUELA · Fase 2 — motor de posesiones basado en atributos.
 *
 * Todas las decisiones deportivas (tiro, pase, falta, tapón, rebote, fatiga,
 * reloj) se resuelven aquí. El play-by-play es únicamente un registro de esa
 * misma resolución: no consume aleatoriedad ni crea acciones nuevas.
 */

export const ENGINE_VERSION = 3;
const QUARTER_SECONDS = 12 * 60;
const OVERTIME_SECONDS = 5 * 60;
const REGULATION_PERIODS = 4;
const MAX_OVERTIMES = 10;

/** clamp decimal: no redondea, a diferencia del clamp entero usado para ratings. */
function bound(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export const SHOT_ZONES: ShotZone[] = ["restricted", "close", "mid", "corner3", "wing3"];

const ZONE_LABEL: Record<ShotZone, string> = {
  restricted: "área restringida",
  close: "pintura / tiro cercano",
  mid: "media distancia",
  corner3: "triple de esquina",
  wing3: "triple frontal o lateral",
};

const ZONE_BASE: Record<ShotZone, number> = {
  restricted: 0.72,
  close: 0.505,
  mid: 0.4,
  corner3: 0.378,
  wing3: 0.35,
};

const ZONE_SLOPE: Record<ShotZone, number> = {
  restricted: 0.0040,
  close: 0.0036,
  mid: 0.0032,
  corner3: 0.0035,
  wing3: 0.0034,
};

const ZONE_FOUL: Record<ShotZone, number> = {
  restricted: 0.135,
  close: 0.085,
  mid: 0.04,
  corner3: 0.015,
  wing3: 0.024,
};

const ORB_ZONE_FACTOR: Record<ShotZone, number> = {
  restricted: 1.16,
  close: 1.05,
  mid: 0.87,
  corner3: 0.62,
  wing3: 0.7,
};

const FATIGUE_DECAY: Record<keyof Attributes, number> = {
  strength: 0.15,
  speed: 0.27,
  jumping: 0.24,
  endurance: 0,
  inside: 0.15,
  layups: 0.16,
  freeThrows: 0.1,
  midRange: 0.16,
  threePointers: 0.15,
  offensiveIQ: 0.08,
  defensiveIQ: 0.09,
  dribbling: 0.15,
  passing: 0.1,
  rebounding: 0.16,
  perimeterDefense: 0.14,
  interiorDefense: 0.14,
};

export interface SimulationOptions {
  /** false = simulación rápida; la resolución es idéntica y solo omite la narración. */
  recordPlayByPlay?: boolean;
}

interface EnginePlayer extends CoachPlayer {
  usageWeight: number;
  stats: PlayerGameStats;
  minutes: number;
}

interface Side {
  key: "home" | "away";
  team: Team;
  players: EnginePlayer[];
  onCourt: EnginePlayer[];
  score: number;
  quarters: number[];
  teamFouls: number[];
  possessions: number;
  pointsInPaint: number;
  fastBreakPoints: number;
  substitutions: number;
  lastSubElapsed: number;
}

interface Situation {
  period: number;
  clock: number;
  elapsed: number;
}

interface ReboundResult {
  offenseRebound: boolean;
  rebounder: EnginePlayer;
}

interface ShotResult {
  nextSide: "home" | "away";
  made: boolean;
  points: number;
  offensiveRebound: boolean;
  fouled: boolean;
}

function emptyZones(): ShotZoneRecord {
  return SHOT_ZONES.reduce((record, zone) => {
    record[zone] = { fga: 0, fgm: 0, tpa: 0, tpm: 0, points: 0 };
    return record;
  }, {} as ShotZoneRecord);
}

function statLine(player: Player): PlayerGameStats {
  return {
    playerId: player.id,
    name: player.name,
    position: player.position,
    minutes: 0,
    points: 0,
    fgm: 0,
    fga: 0,
    tpm: 0,
    tpa: 0,
    ftm: 0,
    fta: 0,
    oreb: 0,
    dreb: 0,
    reb: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    tov: 0,
    pf: 0,
    plusMinus: 0,
    zones: emptyZones(),
    periodFouls: [],
  };
}

function usageWeight(player: Player): number {
  const a = player.attributes;
  const offensiveTalent =
    a.offensiveIQ * 0.22 +
    a.threePointers * 0.12 +
    a.inside * 0.13 +
    a.layups * 0.13 +
    a.midRange * 0.08 +
    a.dribbling * 0.14 +
    a.passing * 0.1 +
    a.speed * 0.05 +
    a.strength * 0.03;
  // Peso acotado: las estrellas tiran más, pero ningún jugador debe acaparar
  // la mitad de los intentos de un equipo. El uso se reparte entre la rotación.
  const normalized = bound((offensiveTalent - 40) / 42, 0, 1.35);
  return 0.55 + normalized * 0.95;
}

function makeSide(key: "home" | "away", team: Team, players: Player[]): Side {
  const selected = selectGameRotation(team, players);
  const starting = chooseStartingFive(selected);
  const starters = new Set(starting.map((player) => player.id));
  const enginePlayers: EnginePlayer[] = selected.map((player) => ({
    player,
    onCourt: starters.has(player.id),
    secondsPlayed: 0,
    minutes: 0,
    fatigue: 0,
    fouls: 0,
    fouledOut: false,
    lastOffElapsed: 0,
    stintStartElapsed: 0,
    coachPreference: coachPreference(team, player),
    usageWeight: usageWeight(player),
    stats: statLine(player),
  }));
  return {
    key,
    team,
    players: enginePlayers,
    onCourt: enginePlayers.filter((item) => item.onCourt),
    score: 0,
    quarters: [0, 0, 0, 0],
    teamFouls: [0, 0, 0, 0],
    possessions: 0,
    pointsInPaint: 0,
    fastBreakPoints: 0,
    substitutions: 0,
    lastSubElapsed: -999,
  };
}

function refreshOnCourt(side: Side): void {
  side.onCourt = side.players.filter((item) => item.onCourt);
}

/** Actualiza tiempo real, fatiga y recuperación de los diez jugadores del acta. */
function advancePlayerState(side: Side, seconds: number, _elapsed: number): void {
  const minutes = seconds / 60;
  for (const item of side.players) {
    if (item.onCourt) {
      item.secondsPlayed += seconds;
      const endurance = item.player.attributes.endurance;
      const rate = 0.012 + (90 - endurance) * 0.00012;
      item.fatigue = bound(item.fatigue + minutes * rate, 0, 1);
    } else {
      const endurance = item.player.attributes.endurance;
      const recovery = 0.010 + endurance * 0.00008;
      item.fatigue = bound(item.fatigue - minutes * recovery, 0, 1);
    }
  }
}

function recoverBetweenPeriods(side: Side): void {
  for (const item of side.players) {
    item.fatigue = bound(item.fatigue - 0.035, 0, 1);
  }
}

function makeCoachContext(side: Side, opponent: Side, period: number, clock: number, elapsed: number): CoachContext {
  return {
    teamId: side.team.id,
    period,
    clock,
    elapsed,
    margin: side.score - opponent.score,
    teamSubstitutions: side.substitutions,
    lastTeamSubElapsed: side.lastSubElapsed,
  };
}

function applySubstitutions(
  side: Side,
  opponent: Side,
  period: number,
  clock: number,
  elapsed: number,
  record: boolean,
  events: PlayEvent[],
  home: Side,
  away: Side,
  log: SubstitutionRecord[],
): void {
  const context = makeCoachContext(side, opponent, period, clock, elapsed);
  const decisions = chooseSubstitutions(side.players, context);
  for (const decision of decisions) {
    const out = decision.out;
    const incoming = decision.in;
    if (!out.onCourt || incoming.onCourt || incoming.fouledOut) continue;
    out.onCourt = false;
    out.lastOffElapsed = elapsed;
    incoming.onCourt = true;
    incoming.lastOffElapsed = elapsed;
    incoming.stintStartElapsed = elapsed;
    side.substitutions++;
    side.lastSubElapsed = elapsed;
    refreshOnCourt(side);
    const recordEntry: SubstitutionRecord = {
      id: `${side.team.id}::sub-${side.substitutions}-${elapsed}`,
      teamId: side.team.id,
      period,
      clock: runClock(period, clock),
      elapsed,
      outPlayerId: out.player.id,
      outPlayerName: out.player.name,
      inPlayerId: incoming.player.id,
      inPlayerName: incoming.player.name,
      reason: decision.reason,
      forced: decision.forced,
    };
    log.push(recordEntry);
    if (record) {
      addRecord(
        {
          seq: 0,
          period,
          clock: runClock(period, clock),
          teamId: side.team.id,
          text: `${side.team.abbreviation} · ${substitutionText(out.player.name, incoming.player.name, decision.reason)}`,
          homeScore: home.score,
          awayScore: away.score,
          kind: "substitution",
          playerId: out.player.id,
          inPlayerId: incoming.player.id,
          reason: decision.reason,
          side: side.key,
        },
        events,
      );
    }
  }
}

/** Convierte segundos reales en minutos con una décima, sin duplicar ni perder tiempo. */
function assignMinutes(side: Side): void {
  const totalSeconds = side.players.reduce((sum, item) => sum + item.secondsPlayed, 0);
  const targetTenths = Math.round(totalSeconds / 6);
  const entries = side.players
    .filter((item) => item.secondsPlayed > 0)
    .map((item) => {
      const exact = item.secondsPlayed / 6;
      const base = Math.max(1, Math.floor(exact));
      return { item, base, remainder: exact - Math.floor(exact) };
    });
  let assigned = entries.reduce((sum, entry) => sum + entry.base, 0);
  const ordered = [...entries].sort((a, b) => b.remainder - a.remainder);
  let cursor = 0;
  // Garantiza que todo participante tenga al menos 0,1 min y que el total
  // siga siendo exactamente el tiempo de equipo (240 + 25 por prórroga).
  while (assigned > targetTenths && entries.length) {
    const largest = [...entries].sort((a, b) => b.base - a.base)[0];
    if (largest.base <= 1) break;
    largest.base -= 1;
    assigned--;
  }
  while (assigned < targetTenths && ordered.length) {
    ordered[cursor % ordered.length].base += 1;
    assigned++;
    cursor++;
  }
  for (const entry of entries) {
    entry.item.minutes = entry.base / 10;
    entry.item.stats.minutes = entry.item.minutes;
  }
  for (const item of side.players) {
    if (!entries.some((entry) => entry.item === item)) {
      item.minutes = 0;
      item.stats.minutes = 0;
    }
  }
}

function sideByKey(home: Side, away: Side, key: "home" | "away"): Side {
  return key === "home" ? home : away;
}

function otherSide(key: "home" | "away"): "home" | "away" {
  return key === "home" ? "away" : "home";
}

function ensurePeriod(side: Side, period: number): void {
  while (side.quarters.length < period) side.quarters.push(0);
  while (side.teamFouls.length < period) side.teamFouls.push(0);
}

function addScore(side: Side, points: number, period: number, paint = false, fastBreak = false): void {
  side.score += points;
  ensurePeriod(side, period);
  side.quarters[period - 1] += points;
  if (paint) side.pointsInPaint += points;
  if (fastBreak) side.fastBreakPoints += points;
}

function fatiga(item: EnginePlayer, _situation?: Situation): number {
  // Fatiga acumulada por tiempo real en cancha. Se actualiza posesión a
  // posesión en advancePlayerState(); el banco recupera gradualmente.
  return bound(item.fatigue, 0, 1);
}

function eff(item: EnginePlayer, key: keyof Attributes, situation: Situation): number {
  if (key === "endurance") return item.player.attributes.endurance;
  const penalty = FATIGUE_DECAY[key] * fatiga(item, situation);
  return bound(item.player.attributes[key] * (1 - penalty), 5, 99);
}

function heightScore(heightIn: number, exponent = 1): number {
  return Math.pow(bound((heightIn - 68) / 12, 0.4, 2.1), exponent);
}

function minuteFactor(_item: EnginePlayer): number {
  // Neutralizado en Fase 3: los minutos ya no se preasignan. Se conserva el
  // punto de llamada para no alterar las fórmulas de selección de jugador.
  return 1;
}

function available(item: EnginePlayer): boolean {
  return !item.fouledOut;
}

function pickWeighted(rng: RNG, items: EnginePlayer[], weights: number[]): EnginePlayer {
  const eligible = items.map((item, index) => ({ item, weight: available(item) ? Math.max(0.0001, weights[index]) : 0 }));
  const total = eligible.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) return items[Math.floor(rng() * items.length)];
  return eligible[weightedIndex(rng, eligible.map((entry) => entry.weight))].item;
}

function teamAverage(side: Side, key: keyof Attributes, situation: Situation, _minutesWeighted = true): number {
  const players = side.onCourt.filter((item) => !item.fouledOut);
  const pool = players.length ? players : side.onCourt;
  if (!pool.length) return 0;
  return pool.reduce((sum, item) => sum + eff(item, key, situation), 0) / pool.length;
}

function pickHandler(rng: RNG, side: Side, situation: Situation): EnginePlayer {
  return pickWeighted(
    rng,
    side.onCourt,
    side.onCourt.map((item) => {
      const control = eff(item, "dribbling", situation) * 0.45 + eff(item, "passing", situation) * 0.25 + eff(item, "offensiveIQ", situation) * 0.3;
      return Math.pow(Math.max(8, control) / 55, 2) * minuteFactor(item) * (0.85 + item.player.attributes.speed / 300);
    }),
  );
}

function perimeterRating(item: EnginePlayer, situation: Situation): number {
  return (
    eff(item, "perimeterDefense", situation) * 0.5 +
    eff(item, "speed", situation) * 0.2 +
    eff(item, "defensiveIQ", situation) * 0.2 +
    eff(item, "strength", situation) * 0.1
  );
}

function interiorRating(item: EnginePlayer, situation: Situation): number {
  return (
    eff(item, "interiorDefense", situation) * 0.5 +
    eff(item, "strength", situation) * 0.16 +
    eff(item, "defensiveIQ", situation) * 0.18 +
    eff(item, "jumping", situation) * 0.1 +
    heightScore(item.player.heightIn) * 2.2
  );
}

function pickDefender(rng: RNG, defense: Side, zone: ShotZone, situation: Situation): EnginePlayer {
  const interior = zone === "restricted" || zone === "close";
  return pickWeighted(
    rng,
    defense.onCourt,
    defense.onCourt.map((item) => (interior ? interiorRating(item, situation) : perimeterRating(item, situation)) * minuteFactor(item)),
  );
}

function pickStealer(rng: RNG, defense: Side, situation: Situation): EnginePlayer {
  return pickWeighted(
    rng,
    defense.onCourt,
    defense.onCourt.map(
      (item) =>
        (perimeterRating(item, situation) * 0.55 +
          eff(item, "defensiveIQ", situation) * 0.25 +
          eff(item, "dribbling", situation) * 0.1) *
        minuteFactor(item),
    ),
  );
}

function pickBlocker(rng: RNG, defense: Side, situation: Situation): EnginePlayer {
  return pickWeighted(
    rng,
    defense.onCourt,
    defense.onCourt.map(
      (item) =>
        (eff(item, "interiorDefense", situation) * 0.4 +
          eff(item, "jumping", situation) * 0.25 +
          heightScore(item.player.heightIn) * 18 +
          eff(item, "strength", situation) * 0.1) *
        minuteFactor(item),
    ),
  );
}

function shotSkill(item: EnginePlayer, zone: ShotZone, situation: Situation): number {
  const height = (item.player.heightIn - 78) * 0.32;
  switch (zone) {
    case "restricted":
      return (
        eff(item, "inside", situation) * 0.32 +
        eff(item, "layups", situation) * 0.42 +
        eff(item, "strength", situation) * 0.17 +
        eff(item, "speed", situation) * 0.05 +
        eff(item, "jumping", situation) * 0.05 +
        height
      );
    case "close":
      return (
        eff(item, "inside", situation) * 0.28 +
        eff(item, "layups", situation) * 0.44 +
        eff(item, "midRange", situation) * 0.1 +
        eff(item, "strength", situation) * 0.17 +
        eff(item, "offensiveIQ", situation) * 0.04 +
        height
      );
    case "mid":
      return eff(item, "midRange", situation) * 0.82 + eff(item, "offensiveIQ", situation) * 0.13 + eff(item, "speed", situation) * 0.05;
    case "corner3":
      return eff(item, "threePointers", situation) * 0.82 + eff(item, "offensiveIQ", situation) * 0.13 + eff(item, "freeThrows", situation) * 0.05;
    case "wing3":
      return eff(item, "threePointers", situation) * 0.86 + eff(item, "offensiveIQ", situation) * 0.1 + eff(item, "midRange", situation) * 0.04;
  }
}

function chooseZone(rng: RNG, offense: Side, defense: Side, handler: EnginePlayer, transition: boolean, situation: Situation): ShotZone {
  if (transition) {
    return SHOT_ZONES[weightedIndex(rng, [0.5, 0.13, 0.02, 0.14, 0.21])];
  }
  const offIQ = eff(handler, "offensiveIQ", situation);
  const speed = eff(handler, "speed", situation);
  const dribbling = eff(handler, "dribbling", situation);
  const teamInside = teamAverage(offense, "inside", situation);
  const teamLayup = teamAverage(offense, "layups", situation);
  const teamMid = teamAverage(offense, "midRange", situation);
  const teamThree = teamAverage(offense, "threePointers", situation);
  const defInterior = teamAverage(defense, "interiorDefense", situation);
  const defPerimeter = teamAverage(defense, "perimeterDefense", situation);
  const diff = offense.score - defense.score;
  const clause = situation.period >= 4 && situation.clock < 120;
  const trailing = clause && diff < 0;
  const tactic = offense.team.philosophy ?? "Equilibrado";
  const iqRim = 1 + (offIQ - 60) * 0.0025;
  const iqMid = bound(1 - (offIQ - 60) * 0.004, 0.72, 1.3);
  const tacticsThree = tactic === "Triple" ? 1.35 : tactic === "Interior" ? 0.8 : tactic === "Defensa" ? 0.92 : 1;
  const tacticsInterior = tactic === "Interior" ? 1.22 : tactic === "Triple" ? 0.85 : 1;
  const drive = 1 + (speed - 60) * 0.006 + (dribbling - 60) * 0.004;
  const lateThree = trailing ? 1.35 : clause ? 1.08 : 1;

  const weights = [
    0.28 * Math.pow((teamInside * 0.55 + teamLayup * 0.45) / 65, 1.35) * drive * (1 - (defInterior - 60) * 0.0032) * iqRim * tacticsInterior,
    0.12 * Math.pow((teamInside * 0.45 + teamLayup * 0.55) / 65, 1.25) * (0.92 + (speed - 60) * 0.002) * (1 - (defInterior - 60) * 0.0028) * tacticsInterior,
    0.16 * Math.pow(teamMid / 65, 1.4) * iqMid * (1 + (defInterior - 60) * 0.0015) * (tactic === "Triple" ? 0.85 : 1),
    0.115 * Math.pow(Math.max(teamThree, eff(handler, "threePointers", situation)) / 65, 1.8) * (1 - (defPerimeter - 60) * 0.0035) * iqRim * tacticsThree * lateThree,
    0.245 * Math.pow(Math.max(teamThree, eff(handler, "threePointers", situation)) / 65, 1.55) * (1 - (defPerimeter - 60) * 0.003) * iqRim * tacticsThree * lateThree,
  ];
  if (situation.period >= 4 && situation.clock < 24 && diff <= 0) {
    weights[3] *= 1.35;
    weights[4] *= 1.5;
  }
  const index = weightedIndex(rng, weights);
  return SHOT_ZONES[index];
}

function pickShooter(rng: RNG, offense: Side, zone: ShotZone, situation: Situation): EnginePlayer {
  return pickWeighted(
    rng,
    offense.onCourt,
    offense.onCourt.map((item) => {
      const skill = shotSkill(item, zone, situation);
      const iq = eff(item, "offensiveIQ", situation);
      return item.usageWeight * Math.pow(Math.max(15, skill), 1.32) * minuteFactor(item) * (0.7 + iq / 160);
    }),
  );
}

function runClock(period: number, seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${period <= REGULATION_PERIODS ? `Q${period}` : `OT${period - REGULATION_PERIODS}`} ${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function addRecord(event: PlayEvent, events: PlayEvent[]): void {
  events.push({ ...event, seq: events.length + 1 });
}

function teamBox(side: Side): TeamBoxScore {
  // Solo aparecen en el box score los jugadores que pisaron la cancha.
  // El resto se muestra como DNP en la interfaz a partir de la plantilla.
  const players = side.players
    .filter((item) => item.secondsPlayed > 0)
    .map((item) => ({ ...item.stats, minutes: item.minutes, reb: item.stats.oreb + item.stats.dreb }));
  const zoneTotals = emptyZones();
  for (const player of players) {
    for (const zone of SHOT_ZONES) {
      const source = player.zones?.[zone];
      if (!source) continue;
      zoneTotals[zone].fga += source.fga;
      zoneTotals[zone].fgm += source.fgm;
      zoneTotals[zone].tpa += source.tpa;
      zoneTotals[zone].tpm += source.tpm;
      zoneTotals[zone].points += source.points;
    }
  }
  return {
    teamId: side.team.id,
    points: side.score,
    quarters: [...side.quarters],
    fgm: players.reduce((sum, item) => sum + item.fgm, 0),
    fga: players.reduce((sum, item) => sum + item.fga, 0),
    tpm: players.reduce((sum, item) => sum + item.tpm, 0),
    tpa: players.reduce((sum, item) => sum + item.tpa, 0),
    ftm: players.reduce((sum, item) => sum + item.ftm, 0),
    fta: players.reduce((sum, item) => sum + item.fta, 0),
    reb: players.reduce((sum, item) => sum + item.reb, 0),
    oreb: players.reduce((sum, item) => sum + item.oreb, 0),
    ast: players.reduce((sum, item) => sum + item.ast, 0),
    stl: players.reduce((sum, item) => sum + item.stl, 0),
    blk: players.reduce((sum, item) => sum + item.blk, 0),
    tov: players.reduce((sum, item) => sum + item.tov, 0),
    pf: players.reduce((sum, item) => sum + item.pf, 0),
    players,
    zones: zoneTotals,
    possessions: side.possessions,
    teamFouls: side.teamFouls.slice(0, Math.max(4, side.quarters.length)),
    pointsInPaint: side.pointsInPaint,
    fastBreakPoints: side.fastBreakPoints,
    engineVersion: ENGINE_VERSION,
  };
}

function attemptFreeThrows(
  rng: RNG,
  shooter: EnginePlayer,
  attempts: number,
  offense: Side,
  defense: Side,
  situation: Situation,
  offenseKey: "home" | "away",
  home: Side,
  away: Side,
  events: PlayEvent[],
  record: boolean,
  prefix: string,
): { made: number; nextSide: "home" | "away" } {
  let made = 0;
  const ft = eff(shooter, "freeThrows", situation);
  const probability = bound(0.78 + (ft - 75) * 0.0042 - fatiga(shooter, situation) * 0.012, 0.46, 0.97);
  for (let index = 0; index < attempts; index++) {
    shooter.stats.fta += 1;
    if (chance(rng, probability)) {
      shooter.stats.ftm += 1;
      shooter.stats.points += 1;
      made++;
      addScore(offense, 1, situation.period);
    }
  }
  shooter.stats.periodFouls = shooter.stats.periodFouls ?? [];
  if (record) {
    addRecord(
      {
        seq: 0,
        period: situation.period,
        clock: runClock(situation.period, situation.clock),
        teamId: offense.team.id,
        text: `${prefix} ${made}/${attempts} tiros libres.`,
        homeScore: home.score,
        awayScore: away.score,
        kind: "score",
        points: made,
        playerId: shooter.player.id,
        side: offenseKey,
      },
      events,
    );
  }
  if (made === attempts) return { made, nextSide: otherSide(offenseKey) };
  const rebound = resolveRebound(rng, offense, defense, "mid", situation, home, away, events, record, true);
  if (rebound.offenseRebound) return { made, nextSide: offenseKey };
  return { made, nextSide: otherSide(offenseKey) };
}

function resolveRebound(
  rng: RNG,
  offense: Side,
  defense: Side,
  zone: ShotZone,
  situation: Situation,
  home: Side,
  away: Side,
  events: PlayEvent[],
  record: boolean,
  freeThrow = false,
): ReboundResult {
  const positionFactor = (item: EnginePlayer): number =>
    item.player.position === "C" ? 1.18 : item.player.position === "PF" ? 1.1 : item.player.position === "SF" ? 1 : item.player.position === "SG" ? 0.86 : 0.72;
  const weight = (item: EnginePlayer): number =>
    (eff(item, "rebounding", situation) * 0.5 +
      eff(item, "strength", situation) * 0.17 +
      eff(item, "jumping", situation) * 0.15 +
      heightScore(item.player.heightIn) * 13 +
      eff(item, "offensiveIQ", situation) * 0.04) *
    positionFactor(item) *
    minuteFactor(item) *
    (1 - fatiga(item, situation) * 0.08);
  const offTotal = offense.onCourt.reduce((sum, item) => sum + weight(item), 0);
  const defTotal = defense.onCourt.reduce((sum, item) => sum + weight(item), 0);
  const zoneFactor = freeThrow ? 0.48 : ORB_ZONE_FACTOR[zone];
  const probability = bound(0.245 * Math.pow((offTotal + 1) / (defTotal + 1), 0.9) * zoneFactor, 0.06, 0.42);
  const offensive = chance(rng, probability);
  const team = offensive ? offense : defense;
  const rebounder = pickWeighted(rng, team.onCourt, team.onCourt.map(weight));
  if (offensive) rebounder.stats.oreb += 1;
  else rebounder.stats.dreb += 1;
  rebounder.stats.reb += 1;
  if (record) {
    addRecord(
      {
        seq: 0,
        period: situation.period,
        clock: runClock(situation.period, situation.clock),
        teamId: team.team.id,
        text: `${rebounder.player.name} captura el rebote ${offensive ? "ofensivo" : "defensivo"}.`,
        homeScore: home.score,
        awayScore: away.score,
        kind: "rebound",
        playerId: rebounder.player.id,
        side: team.key,
      },
      events,
    );
  }
  return { offenseRebound: offensive, rebounder };
}

function registerFoul(defender: EnginePlayer, defense: Side, situation: Situation): void {
  ensurePeriod(defense, situation.period);
  if (defender.stats.pf >= 6) return;
  defender.stats.pf += 1;
  defender.fouls += 1;
  defender.stats.periodFouls = defender.stats.periodFouls ?? [];
  defender.stats.periodFouls[situation.period - 1] = (defender.stats.periodFouls[situation.period - 1] ?? 0) + 1;
  defense.teamFouls[situation.period - 1] = (defense.teamFouls[situation.period - 1] ?? 0) + 1;
  if (defender.stats.pf >= 6) defender.fouledOut = true;
}

function chooseAssister(rng: RNG, offense: Side, shooter: EnginePlayer, situation: Situation): EnginePlayer | null {
  const pool = offense.onCourt.filter((item) => item.player.id !== shooter.player.id && available(item));
  if (!pool.length) return null;
  return pickWeighted(
    rng,
    pool,
    pool.map((item) => {
      const passing = eff(item, "passing", situation);
      const iq = eff(item, "offensiveIQ", situation);
      return Math.pow(passing / 55, 2.2) * (0.6 + iq / 130) * minuteFactor(item);
    }),
  );
}

function takeShot(
  rng: RNG,
  offense: Side,
  defense: Side,
  offenseKey: "home" | "away",
  zone: ShotZone,
  transition: boolean,
  situation: Situation,
  home: Side,
  away: Side,
  events: PlayEvent[],
  record: boolean,
  handler: EnginePlayer,
  putback = false,
): ShotResult {
  const shooter = putback ? pickShooter(rng, offense, "restricted", situation) : pickShooter(rng, offense, zone, situation);
  const defender = pickDefender(rng, defense, zone, situation);
  const help = pickDefender(rng, defense, "restricted", situation);
  const shotRating = shotSkill(shooter, zone, situation);
  const primaryDefense = zone === "restricted" || zone === "close" ? interiorRating(defender, situation) : perimeterRating(defender, situation);
  const helpDefense = zone === "restricted" || zone === "close" ? interiorRating(help, situation) * 0.18 : perimeterRating(help, situation) * 0.1;
  const shooterIQ = eff(shooter, "offensiveIQ", situation);
  const defenderIQ = eff(defender, "defensiveIQ", situation);
  const creatorPassing = eff(handler, "passing", situation);
  const tactic = offense.team.philosophy ?? "Equilibrado";

  // Falta en acción de tiro: se resuelven tiros libres, sin FGA (regla de anotación).
  const contact =
    eff(shooter, "strength", situation) * 0.0011 -
    eff(defender, "strength", situation) * 0.0006 +
    (eff(shooter, "speed", situation) - eff(defender, "speed", situation)) * 0.0008;
  const foulProbability = bound(ZONE_FOUL[zone] * (0.92 + (shooterIQ - 60) * 0.002) + contact - (defenderIQ - 60) * 0.0008, 0.005, 0.3);
  if (chance(rng, foulProbability)) {
    registerFoul(defender, defense, situation);
    const attempts = zone === "corner3" || zone === "wing3" ? 3 : 2;
    const freeThrowResult = attemptFreeThrows(
      rng,
      shooter,
      attempts,
      offense,
      defense,
      situation,
      offenseKey,
      home,
      away,
      events,
      record,
      `Falta de ${defender.player.name} sobre ${shooter.player.name}.`,
    );
    return { nextSide: freeThrowResult.nextSide, made: false, points: 0, offensiveRebound: false, fouled: true };
  }

  const blockBase =
    zone === "restricted" ? 0.055 : zone === "close" ? 0.04 : zone === "mid" ? 0.013 : 0.008;
  const blockAdvantage =
    eff(help, "jumping", situation) * 0.0009 +
    eff(help, "interiorDefense", situation) * 0.0007 +
    heightScore(help.player.heightIn) * 0.02 -
    shotRating * 0.0011;
  const blocked = chance(rng, bound(blockBase + blockAdvantage, 0.001, 0.17));

  shooter.stats.fga += 1;
  if (!shooter.stats.zones) shooter.stats.zones = emptyZones();
  shooter.stats.zones[zone].fga += 1;
  if (zone === "corner3" || zone === "wing3") {
    shooter.stats.tpa += 1;
    shooter.stats.zones[zone].tpa += 1;
  }

  let makeProbability = ZONE_BASE[zone] + (shotRating - 65) * ZONE_SLOPE[zone] - (primaryDefense - 62) * 0.0027;
  makeProbability += (shooterIQ - 60) * 0.0009 - (defenderIQ - 60) * 0.0007;
  makeProbability -= helpDefense * 0.0017;
  makeProbability += (creatorPassing - 60) * 0.00035;
  if (transition) makeProbability += 0.012;
  if (putback) makeProbability -= 0.018;
  if (tactic === "Triple" && (zone === "corner3" || zone === "wing3")) makeProbability += 0.005;
  if (tactic === "Interior" && (zone === "close" || zone === "restricted")) makeProbability += 0.007;
  if (defense.team.philosophy === "Defensa") makeProbability -= 0.008;
  if (zone === "restricted" || zone === "close") {
    makeProbability += (eff(shooter, "strength", situation) - 65) * 0.0012;
  }
  if (situation.period >= 4 && situation.clock < 30) makeProbability += (eff(shooter, "freeThrows", situation) - 70) * 0.0002;
  makeProbability = bound(makeProbability, 0.04, 0.9);

  if (blocked) {
    const blocker = pickBlocker(rng, defense, situation);
    blocker.stats.blk += 1;
    if (record) {
      addRecord(
        {
          seq: 0,
          period: situation.period,
          clock: runClock(situation.period, situation.clock),
          teamId: defense.team.id,
          text: `${blocker.player.name} tapa el intento de ${shooter.player.name} (${ZONE_LABEL[zone]}).`,
          homeScore: home.score,
          awayScore: away.score,
          kind: "block",
          playerId: blocker.player.id,
          shotZone: zone,
          side: defense.key,
        },
        events,
      );
    }
    const rebound = resolveRebound(rng, offense, defense, zone, situation, home, away, events, record);
    return {
      nextSide: rebound.offenseRebound ? offenseKey : otherSide(offenseKey),
      made: false,
      points: 0,
      offensiveRebound: rebound.offenseRebound,
      fouled: false,
    };
  }

  if ((globalThis as any).__DUELA_DEBUG_SHOTS__) console.log("SHOT", zone, {makeProbability, shotRating, primaryDefense, helpDefense, shooterIQ, defenderIQ, creatorPassing});
  const made = chance(rng, makeProbability);
  if (!made) {
    if (record) {
      addRecord(
        {
          seq: 0,
          period: situation.period,
          clock: runClock(situation.period, situation.clock),
          teamId: offense.team.id,
          text: `${shooter.player.name} falla un tiro desde ${ZONE_LABEL[zone]}.`,
          homeScore: home.score,
          awayScore: away.score,
          kind: "miss",
          shooterId: shooter.player.id,
          shotZone: zone,
          side: offenseKey,
        },
        events,
      );
    }
    const rebound = resolveRebound(rng, offense, defense, zone, situation, home, away, events, record);
    return {
      nextSide: rebound.offenseRebound ? offenseKey : otherSide(offenseKey),
      made: false,
      points: 0,
      offensiveRebound: rebound.offenseRebound,
      fouled: false,
    };
  }

  const isThree = zone === "corner3" || zone === "wing3";
  const points = isThree ? 3 : 2;
  shooter.stats.fgm += 1;
  if (isThree) shooter.stats.tpm += 1;
  shooter.stats.points += points;
  shooter.stats.zones[zone].fgm += 1;
  if (isThree) shooter.stats.zones[zone].tpm += 1;
  shooter.stats.zones[zone].points += points;
  addScore(offense, points, situation.period, zone === "restricted" || zone === "close", transition);

  const assistBase = zone === "corner3" ? 0.84 : zone === "wing3" ? 0.79 : zone === "restricted" ? 0.52 : zone === "close" ? 0.46 : 0.4;
  const teamPassing = teamAverage(offense, "passing", situation);
  const assistChance = bound(assistBase * (0.7 + teamPassing / 180) + (creatorPassing - 60) * 0.002, 0.12, 0.92);
  const assister = chance(rng, assistChance) ? chooseAssister(rng, offense, shooter, situation) : null;
  if (assister) assister.stats.ast += 1;
  if (record) {
    addRecord(
      {
        seq: 0,
        period: situation.period,
        clock: runClock(situation.period, situation.clock),
        teamId: offense.team.id,
        text: `${shooter.player.name} anota ${isThree ? "un triple" : zone === "mid" ? "un tiro de media distancia" : "una canasta interior"}${assister ? ` tras asistencia de ${assister.player.name}` : ""}.`,
        homeScore: home.score,
        awayScore: away.score,
        kind: "score",
        points,
        shooterId: shooter.player.id,
        shotZone: zone,
        side: offenseKey,
      },
      events,
    );
  }
  return { nextSide: otherSide(offenseKey), made: true, points, offensiveRebound: false, fouled: false };
}

/**
 * Resuelve una posesión completa. Devuelve únicamente el bando que ataca la
 * siguiente posesión y los segundos consumidos; todas las estadísticas ya están
 * registradas en `home`/`away`.
 */
function resolvePossession(
  rng: RNG,
  offense: Side,
  defense: Side,
  offenseKey: "home" | "away",
  situation: Situation,
  transition: boolean,
  home: Side,
  away: Side,
  events: PlayEvent[],
  record: boolean,
): { nextSide: "home" | "away"; secondsUsed: number; transitionOpportunity: boolean } {
  offense.possessions += 1;
  const handler = pickHandler(rng, offense, situation);
  const tactic = offense.team.philosophy ?? "Equilibrado";
  const speed = teamAverage(offense, "speed", situation);
  const defSpeed = teamAverage(defense, "speed", situation);
  const scoreDiff = offense.score - defense.score;
  let secondsUsed = transition ? 4 + rng() * 6 : 10.8 + rng() * 8.8;
  secondsUsed -= (speed - 60) * 0.035;
  secondsUsed += (defSpeed - 60) * 0.018;
  if (tactic === "Triple") secondsUsed -= 0.4;
  if (tactic === "Interior") secondsUsed += 0.3;
  if (situation.period >= 4 && situation.clock < 120) {
    if (scoreDiff > 0) secondsUsed = 18 + rng() * 6;
    else if (scoreDiff < 0) secondsUsed = 5 + rng() * 5;
  }
  secondsUsed = bound(secondsUsed, 1, Math.min(24, Math.max(1, situation.clock)));
  const clockText = runClock(situation.period, situation.clock);

  // Faltas tácticas: el equipo que va por detrás comete falta a propósito.
  if (situation.period >= 4 && situation.clock <= 30 && scoreDiff > 0 && scoreDiff <= 3 && chance(rng, 0.72)) {
    const defender = defenderForTacticalFoul(rng, defense, situation);
    registerFoul(defender, defense, situation);
    const recipient = bestFreeThrowShooter(offense, situation);
    secondsUsed = bound(2 + rng() * 4, 1, Math.max(1, situation.clock));
    const result = attemptFreeThrows(
      rng,
      recipient,
      2,
      offense,
      defense,
      situation,
      offenseKey,
      home,
      away,
      events,
      record,
      `Falta táctica de ${defender.player.name}.`,
    );
    return { nextSide: result.nextSide, secondsUsed, transitionOpportunity: false };
  }

  const defenseIQ = teamAverage(defense, "defensiveIQ", situation);
  const defensePressure = teamAverage(defense, "perimeterDefense", situation);
  const turnoverChance = bound(
    0.122 -
      (eff(handler, "dribbling", situation) - 65) * 0.00095 -
      (eff(handler, "passing", situation) - 65) * 0.00055 -
      (eff(handler, "offensiveIQ", situation) - 65) * 0.00035 +
      (defenseIQ - 62) * 0.00085 +
      (defensePressure - 62) * 0.00045 +
      fatiga(handler, situation) * 0.018,
    0.055,
    0.22,
  );
  if (chance(rng, turnoverChance)) {
    const roll = rng();
    if (roll < 0.2) {
      registerFoul(handler, offense, situation);
      handler.stats.tov += 1;
      if (record) {
        addRecord(
          {
            seq: 0,
            period: situation.period,
            clock: clockText,
            teamId: offense.team.id,
            text: `${handler.player.name} comete falta de ataque.`,
            homeScore: home.score,
            awayScore: away.score,
            kind: "foul",
            playerId: handler.player.id,
            side: offenseKey,
          },
          events,
        );
      }
      return { nextSide: otherSide(offenseKey), secondsUsed, transitionOpportunity: false };
    }
    handler.stats.tov += 1;
    const steal = chance(rng, 0.78);
    let stealer: EnginePlayer | null = null;
    if (steal) {
      stealer = pickStealer(rng, defense, situation);
      stealer.stats.stl += 1;
    }
    if (record) {
      const badPass = roll < 0.58;
      addRecord(
        {
          seq: 0,
          period: situation.period,
          clock: clockText,
          teamId: offense.team.id,
          text: `${badPass ? "Pase perdido" : "Pérdida de balón"} de ${handler.player.name}${stealer ? `; ${stealer.player.name} roba` : ""}.`,
          homeScore: home.score,
          awayScore: away.score,
          kind: "turnover",
          playerId: handler.player.id,
          side: offenseKey,
        },
        events,
      );
    }
    return { nextSide: otherSide(offenseKey), secondsUsed, transitionOpportunity: steal };
  }

  // Falta sin tiro antes del lanzamiento. Si hay bonus, tiros libres; si no,
  // el ataque conserva la posesión (saque de banda) sin FGA.
  if (!transition && chance(rng, 0.055 + (teamAverage(offense, "strength", situation) - 60) * 0.0004)) {
    const defender = pickDefender(rng, defense, chance(rng, 0.5) ? "restricted" : "wing3", situation);
    registerFoul(defender, defense, situation);
    ensurePeriod(defense, situation.period);
    const bonus = defense.teamFouls[situation.period - 1] >= 5;
    secondsUsed = bound(secondsUsed + 2, 1, Math.max(1, situation.clock));
    if (bonus) {
      const shooter = chance(rng, 0.65) ? handler : bestFreeThrowShooter(offense, situation);
      const result = attemptFreeThrows(
        rng,
        shooter,
        2,
        offense,
        defense,
        situation,
        offenseKey,
        home,
        away,
        events,
        record,
        `Bonus: falta de ${defender.player.name}.`,
      );
      return { nextSide: result.nextSide, secondsUsed, transitionOpportunity: false };
    }
    if (record) {
      addRecord(
        {
          seq: 0,
          period: situation.period,
          clock: clockText,
          teamId: offense.team.id,
          text: `Falta de ${defender.player.name}; saque de banda para ${offense.team.abbreviation}.`,
          homeScore: home.score,
          awayScore: away.score,
          kind: "foul",
          playerId: defender.player.id,
          side: defense.key,
        },
        events,
      );
    }
  }

  let zone = chooseZone(rng, offense, defense, handler, transition, situation);
  // Última posesión con muy poco tiempo: tiro forzado desde fuera, no una canasta inventada.
  if (situation.clock <= 2.5) zone = chance(rng, 0.55) ? "wing3" : "corner3";
  let shot = takeShot(rng, offense, defense, offenseKey, zone, transition, situation, home, away, events, record, handler);
  // Una segunda oportunidad real: el rebote ofensivo puede generar un putback.
  if (!shot.made && !shot.fouled && shot.offensiveRebound && !transition && chance(rng, 0.95)) {
    secondsUsed = bound(secondsUsed + 1.5, 1, Math.max(1, situation.clock));
    const putbackZone: ShotZone = chance(rng, 0.72) ? "restricted" : "close";
    shot = takeShot(rng, offense, defense, offenseKey, putbackZone, false, situation, home, away, events, record, handler, true);
  }
  return {
    nextSide: shot.nextSide,
    secondsUsed,
    transitionOpportunity: !shot.made && !shot.fouled && shot.nextSide !== offenseKey,
  };
}

function defenderForTacticalFoul(rng: RNG, defense: Side, situation: Situation): EnginePlayer {
  return pickWeighted(
    rng,
    defense.onCourt,
    defense.onCourt.map((item) => (perimeterRating(item, situation) + eff(item, "speed", situation) * 0.25) * minuteFactor(item)),
  );
}

function bestFreeThrowShooter(side: Side, situation: Situation): EnginePlayer {
  return [...(side.onCourt.length ? side.onCourt : side.players)].sort((a, b) => eff(b, "freeThrows", situation) - eff(a, "freeThrows", situation))[0];
}

function possessionLimitReached(): never {
  throw new Error("El motor excedió el número máximo de posesiones por seguridad.");
}

export function simulateGame(
  game: Game,
  homeTeam: Team,
  awayTeam: Team,
  homePlayers: Player[],
  awayPlayers: Player[],
  options: SimulationOptions = {},
): Game {
  if (game.played) return game;
  if (!homePlayers.length || !awayPlayers.length) throw new Error("No se puede simular un partido sin jugadores.");
  const record = options.recordPlayByPlay !== false;
  const rng = createRng(game.seed);
  const home = makeSide("home", homeTeam, homePlayers);
  const away = makeSide("away", awayTeam, awayPlayers);
  const events: PlayEvent[] = [];
  const substitutions: SubstitutionRecord[] = [];
  const startingLineups = {
    home: home.onCourt.map((item) => item.player.id),
    away: away.onCourt.map((item) => item.player.id),
  };
  let period = 1;
  let clock = QUARTER_SECONDS;
  let elapsed = 0;
  let offenseKey: "home" | "away" = rng() < 0.5 ? "home" : "away";
  let transition = false;
  let possessionGuard = 0;
  let overtime = 0;

  if (record) {
    addRecord(
      {
        seq: 0,
        period,
        clock: runClock(period, clock),
        teamId: home.team.id,
        text: `Comienza el partido en ${homeTeam.arena}.`,
        homeScore: 0,
        awayScore: 0,
        kind: "period",
      },
      events,
    );
  }

  while (true) {
    const offense = sideByKey(home, away, offenseKey);
    const defense = sideByKey(home, away, otherSide(offenseKey));
    const situation: Situation = { period, clock, elapsed };
    const fastBreakChance = transition
      ? bound(0.17 + (teamAverage(offense, "speed", situation) - 60) * 0.006 + (eff(pickHandler(rng, offense, situation), "speed", situation) - 60) * 0.002, 0.05, 0.55)
      : 0;
    const isTransition = transition && chance(rng, fastBreakChance);
    const result = resolvePossession(rng, offense, defense, offenseKey, situation, isTransition, home, away, events, record);
    clock = Math.max(0, clock - result.secondsUsed);
    elapsed += result.secondsUsed;
    advancePlayerState(home, result.secondsUsed, elapsed);
    advancePlayerState(away, result.secondsUsed, elapsed);
    transition = result.transitionOpportunity;
    offenseKey = result.nextSide;
    possessionGuard++;
    if (possessionGuard > 1200) possessionLimitReached();

    if (clock <= 0) {
      const periodEnds = period >= REGULATION_PERIODS;
      const tied = home.score === away.score;
      if (periodEnds && !tied) break;
      if (periodEnds && tied && overtime >= MAX_OVERTIMES) break;
      if (!periodEnds) {
        period += 1;
        clock = QUARTER_SECONDS;
      } else {
        overtime += 1;
        period += 1;
        clock = OVERTIME_SECONDS;
      }
      ensurePeriod(home, period);
      ensurePeriod(away, period);
      home.teamFouls[period - 1] = 0;
      away.teamFouls[period - 1] = 0;
      recoverBetweenPeriods(home);
      recoverBetweenPeriods(away);
      offenseKey = otherSide(offenseKey);
      transition = false;
      if (record) {
        addRecord(
          {
            seq: 0,
            period,
            clock: runClock(period, clock),
            teamId: home.team.id,
            text: period <= REGULATION_PERIODS ? `Comienza el cuarto ${period}.` : `Comienza la prórroga ${period - REGULATION_PERIODS}.`,
            homeScore: home.score,
            awayScore: away.score,
            kind: "period",
          },
          events,
        );
      }
    }
    // Ventana legal de balón muerto: la posesión ya se resolvió. Nunca se
    // sustituye dentro de resolvePossession ni durante una acción activa.
    applySubstitutions(home, away, period, clock, elapsed, record, events, home, away, substitutions);
    applySubstitutions(away, home, period, clock, elapsed, record, events, home, away, substitutions);
  }

  assignMinutes(home);
  assignMinutes(away);
  if (home.score === away.score) {
    // Seguridad matemática dentro del mismo flujo: una falta y un tiro libre final
    // solo si se agotan las prórrogas máximas.
    const shooter = bestFreeThrowShooter(home, { period, clock: 0, elapsed });
    shooter.stats.fta += 1;
    shooter.stats.ftm += 1;
    shooter.stats.points += 1;
    addScore(home, 1, period);
  }
  if (record) {
    addRecord(
      {
        seq: 0,
        period,
        clock: "FINAL",
        teamId: home.team.id,
        text: `Final: ${away.team.abbreviation} ${away.score} - ${home.team.abbreviation} ${home.score}.`,
        homeScore: home.score,
        awayScore: away.score,
        kind: "period",
      },
      events,
    );
  }

  const homeBox = teamBox(home);
  const awayBox = teamBox(away);
  return {
    ...game,
    played: true,
    homeScore: homeBox.points,
    awayScore: awayBox.points,
    boxScore: { home: homeBox, away: awayBox },
    playByPlay: record ? events : [],
    substitutions,
    startingLineups,
    simulatedAt: Date.now(),
    engineVersion: ENGINE_VERSION,
  };
}

/** Simulación rápida: misma resolución, sin narración. */
export function simulateGameQuick(game: Game, homeTeam: Team, awayTeam: Team, homePlayers: Player[], awayPlayers: Player[]): Game {
  return simulateGame(game, homeTeam, awayTeam, homePlayers, awayPlayers, { recordPlayByPlay: false });
}

export function emptyBox(teamId: string): TeamBoxScore {
  return {
    teamId,
    points: 0,
    quarters: [0, 0, 0, 0],
    fgm: 0,
    fga: 0,
    tpm: 0,
    tpa: 0,
    ftm: 0,
    fta: 0,
    reb: 0,
    oreb: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    tov: 0,
    pf: 0,
    players: [],
    zones: emptyZones(),
    possessions: 0,
    teamFouls: [0, 0, 0, 0],
    fastBreakPoints: 0,
    pointsInPaint: 0,
    engineVersion: ENGINE_VERSION,
  };
}

export function formatClock(event: PlayEvent): string {
  return event.clock;
}

export const SIM_MODEL_NOTES = [
  "Motor único de posesiones: la simulación rápida y el play-by-play usan exactamente la misma resolución.",
  "Cada tiro registra una de cinco zonas: restringida, cercana, media, esquina y triple frontal/lateral.",
  "Tirador, defensor primario, ayuda, IQ, fatiga, fuerza, velocidad y salto intervienen en faltas, tapones, tiros y rebotes.",
  "Pases, manejo y fatiga determinan pérdidas; Passing crea asistencias y mejora la calidad del tiro.",
  "Faltas de equipo por período, bonus, faltas tácticas y prórrogas múltiples se resuelven dentro del mismo flujo.",
  "Fase 3: la IA elige quinteto, aplica cambios por fatiga, faltas, cierre o descanso entre posesiones y deriva los minutos del tiempo real en cancha.",
  "Las sustituciones se evalúan al finalizar cada posesión (balón muerto); nunca se cambia a un jugador durante una posesión activa.",
  "No se modelan tiempos muertos, lesiones, faltas técnicas/flagrantes ni sustituciones por lesión; no se inventan jugadores.",
];
