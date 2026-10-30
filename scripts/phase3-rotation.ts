import type { Game, LeagueBundle, Player, SubstitutionRecord } from "../src/types";
import { createLeagueBundle } from "../src/game/generate";
import { simulateGame, simulateGameQuick } from "../src/game/simulate";
import { chooseSubstitutions, chooseStartingFive, coachValue, selectGameRotation, type CoachContext, type CoachPlayer } from "../src/game/rotation";

const GAMES = Number(process.env.GAMES ?? 120);
const failures: string[] = [];
const warnings: string[] = [];
let checks = 0;
function check(label: string, condition: boolean, detail = ""): void {
  checks++;
  if (!condition) failures.push(`${label}${detail ? ` · ${detail}` : ""}`);
}
function warn(label: string): void { warnings.push(label); }
function seedsFor(mode: string, count: number): number[] {
  return Array.from({ length: count }, (_, i) => {
    let h = 2166136261;
    const text = `phase3-${mode}-${i}`;
    for (let j = 0; j < text.length; j++) { h ^= text.charCodeAt(j); h = Math.imul(h, 16777619); }
    return (h + i * 104729) >>> 0;
  });
}
function boxKey(game: Game): string {
  return JSON.stringify({ score: [game.awayScore, game.homeScore], box: game.boxScore, subs: game.substitutions, lineups: game.startingLineups });
}
function expectedMinutes(quarters: number): number {
  return 240 + Math.max(0, quarters - 4) * 25;
}
function replayLineups(game: Game, roster: Player[]): { valid: boolean; reason: string } {
  const byId = new Map(roster.map((player) => [player.id, player]));
  const lineups = game.startingLineups;
  if (!lineups) return { valid: false, reason: "sin quintetos iniciales" };
  let valid = true; let reason = "";
  for (const side of ["home", "away"] as const) {
    const ids = lineups[side];
    if (ids.length !== 5) { valid = false; reason = `${side}: quinteto inicial de ${ids.length}`; break; }
    if (new Set(ids).size !== 5) { valid = false; reason = `${side}: quinteto inicial duplicado`; break; }
    if (ids.some((id) => !byId.has(id))) { valid = false; reason = `${side}: quinteto inicial con ID desconocido`; break; }
    const onCourt = new Set(ids);
    const disqualified = new Set<string>();
    const subs = (game.substitutions ?? []).filter((record) => record.teamId === (side === "home" ? game.homeTeamId : game.awayTeamId));
    for (const sub of subs) {
      if (!onCourt.has(sub.outPlayerId)) { valid = false; reason = `sale quien no está en cancha: ${sub.outPlayerName}`; break; }
      if (onCourt.has(sub.inPlayerId)) { valid = false; reason = `entra quien ya está en cancha: ${sub.inPlayerName}`; break; }
      if (disqualified.has(sub.inPlayerId)) { valid = false; reason = `entra expulsado: ${sub.inPlayerName}`; break; }
      onCourt.delete(sub.outPlayerId); onCourt.add(sub.inPlayerId);
      if (sub.reason === "6 faltas") disqualified.add(sub.outPlayerId);
      if (onCourt.size !== 5) { valid = false; reason = `${side}: ${onCourt.size} en cancha tras cambio`; break; }
    }
    if (!valid) break;
  }
  return { valid, reason };
}
const qualityMinutes: { mode: string; team: string; value: number; minutes: number }[] = [];
function auditGame(game: Game, roster: Player[], mode: string, index: number): void {
  const label = `${mode}#${index}`;
  check(`${label} engineVersion`, game.engineVersion === 3, String(game.engineVersion));
  check(`${label} played`, game.played === true);
  check(`${label} substitutions log`, Array.isArray(game.substitutions), "sin log");
  check(`${label} startingLineups`, Boolean(game.startingLineups));
  const replay = replayLineups(game, roster);
  check(`${label} lineups`, replay.valid, replay.reason);
  for (const [side, team] of [["home", game.boxScore!.home], ["away", game.boxScore!.away]] as const) {
    const ot = Math.max(0, team.quarters.length - 4);
    const expected = expectedMinutes(team.quarters.length);
    const minutes = team.players.reduce((sum, line) => sum + line.minutes, 0);
    check(`${label}/${side} minutes ${minutes}`, Math.abs(minutes - expected) <= 0.2, `esperado ${expected}`);
    check(`${label}/${side} participants`, team.players.length >= 5 && team.players.length <= 10, `${team.players.length}`);
    check(`${label}/${side} participants >0`, team.players.every((line) => line.minutes > 0));
    check(`${label}/${side} max minutes`, team.players.every((line) => line.minutes <= 48 + ot * 5 + 0.1), `máx ${Math.max(...team.players.map((line) => line.minutes))}`);
    check(`${label}/${side} fouls`, team.players.every((line) => line.pf >= 0 && line.pf <= 6), `máx ${Math.max(...team.players.map((line) => line.pf))}`);
    check(`${label}/${side} totals`, team.players.reduce((sum, line) => sum + line.points, 0) === team.points && team.quarters.reduce((sum, value) => sum + value, 0) === team.points, `jugadores ${team.players.reduce((sum, line) => sum + line.points, 0)} · equipo ${team.points} · cuartos ${team.quarters.reduce((sum, value) => sum + value, 0)} · ${team.quarters.join("/")}`);
    check(`${label}/${side} zones`, Object.values(team.zones ?? {}).reduce((sum, zone) => sum + zone.fga, 0) === team.fga);
    check(`${label}/${side} no duplicate`, new Set(team.players.map((line) => line.playerId)).size === team.players.length);
    // La comparación de calidad se agrega fuera del partido para no exigir
    // que la estrella tenga más minutos en cada juego concreto (faltas/contexto).
    for (const line of team.players) {
      const value = coachValue(roster.find((player) => player.id === line.playerId)!);
      qualityMinutes.push({ mode, team: side, value, minutes: line.minutes });
    }
  }
  const events = game.playByPlay ?? [];
  const last = events[events.length - 1];
  check(`${label} PBP final`, Boolean(last) && last.homeScore === game.homeScore && last.awayScore === game.awayScore);
  const substitutionEvents = events.filter((event) => event.kind === "substitution");
  check(`${label} PBP substitutions match log`, substitutionEvents.length === (game.substitutions ?? []).length, `${substitutionEvents.length}/${(game.substitutions ?? []).length}`);
  check(`${label} PBP substitution text`, substitutionEvents.every((event) => event.text.includes("Cambio:") && Boolean(event.inPlayerId) && Boolean(event.reason)));
  const firstEvent = events[0];
  check(`${label} no substitution before first possession`, firstEvent?.kind !== "substitution");
  const records = game.substitutions ?? [];
  const ids = new Set(records.map((record) => record.id));
  check(`${label} unique substitution IDs`, ids.size === records.length);
  check(`${label} substitution volume`, records.length <= 70, `${records.length} cambios`);
  const lastPair = new Map<string, number>();
  for (const record of records) {
    const key = `${record.teamId}:${record.outPlayerId}:${record.inPlayerId}`;
    const previous = lastPair.get(key);
    check(`${label} no repeated pair <60s`, previous === undefined || record.elapsed - previous >= 60, `${record.inPlayerName} por ${record.outPlayerName}`);
    lastPair.set(key, record.elapsed);
  }
  for (const record of records) {
    check(`${label} substitution clock`, /^(Q[1-4]|OT\d+)/.test(record.clock));
    check(`${label} substitution reason`, record.reason.length > 0);
  }
}

function coachFixture(bundle: LeagueBundle): { roster: Player[]; states: CoachPlayer[] } {
  const team = bundle.teams.find((item) => item.abbreviation === "NYK")!;
  const roster = selectGameRotation(team, bundle.players.filter((player) => player.teamId === team.id));
  const starters = new Set(chooseStartingFive(roster).map((player) => player.id));
  const states = roster.map((player) => ({
    player,
    onCourt: starters.has(player.id),
    secondsPlayed: 0,
    fatigue: 0,
    fouls: 0,
    fouledOut: false,
    lastOffElapsed: 0,
    stintStartElapsed: 0,
    coachPreference: 1,
  }));
  return { roster, states };
}
function baseContext(overrides: Partial<CoachContext>): CoachContext {
  return { teamId: "x", period: 4, clock: 300, elapsed: 2700, margin: 0, teamSubstitutions: 5, lastTeamSubElapsed: 2000, ...overrides };
}
function setFive(states: CoachPlayer[], ids: string[]): void {
  for (const state of states) state.onCourt = ids.includes(state.player.id);
}
function auditCoach(bundle: LeagueBundle, mode: string): void {
  const { roster, states } = coachFixture(bundle);
  const top = [...states].sort((a, b) => coachValue(b.player) - coachValue(a.player));
  const star = top[0];
  const low = top[top.length - 1];
  const others = states.filter((state) => state.player.id !== star.player.id && state.player.id !== low.player.id);
  const baseIds = [...others.slice(0, 4), low].map((state) => state.player.id);
  check(`${mode} starting five`, states.filter((state) => state.onCourt).length === 5);
  check(`${mode} starting five unique`, new Set(states.filter((state) => state.onCourt).map((state) => state.player.id)).size === 5);
  for (const state of states) { state.fatigue = 0.1; state.stintStartElapsed = 1500; state.lastOffElapsed = 0; state.fouls = 0; state.fouledOut = false; }
  setFive(states, baseIds);
  const lowState = states.find((state) => state.player.id === low.player.id)!;
  lowState.stintStartElapsed = 1500; lowState.fatigue = 0.2;
  const closing = chooseSubstitutions(states, baseContext({ margin: 1, clock: 180, elapsed: 2700 }));
  check(`${mode} clutch closing decision`, closing.length === 1 && closing[0].reason === "cierre" && closing[0].out.player.id === low.player.id && closing[0].in.player.id === star.player.id, closing[0] ? `${closing[0].out.player.name} → ${closing[0].in.player.name}: ${closing[0].reason}` : "sin cambio");

  const states2 = states.map((state) => ({ ...state }));
  const star2 = states2.find((state) => state.player.id === star.player.id)!;
  const low2 = states2.find((state) => state.player.id === low.player.id)!;
  const others2 = states2.filter((state) => !state.onCourt && state.player.id !== star2.player.id);
  setFive(states2, [...others2.slice(0, 4).map((state) => state.player.id), star2.player.id]);
  star2.onCourt = true; star2.fatigue = 0.7; star2.stintStartElapsed = 1500;
  low2.fatigue = 0.1;
  const rest = chooseSubstitutions(states2, baseContext({ margin: 20, elapsed: 2600, clock: 420 }));
  check(`${mode} blowout rest`, rest.length === 1 && rest[0].out.player.id === star2.player.id && rest[0].in.player.id !== star2.player.id, rest[0] ? `${rest[0].out.player.name} → ${rest[0].in.player.name}: ${rest[0].reason}` : "sin cambio");

  const states3 = states.map((state) => ({ ...state }));
  const fouled = states3.find((state) => state.onCourt)!;
  fouled.fouls = 5; fouled.stintStartElapsed = 1500; fouled.fatigue = 0.2;
  const foulDecision = chooseSubstitutions(states3, baseContext({ margin: 1, clock: 120, elapsed: 2700 }));
  check(`${mode} foul trouble`, foulDecision.length === 1 && foulDecision[0].reason === "faltas" && foulDecision[0].out.player.id === fouled.player.id, foulDecision[0]?.reason ?? "sin cambio");

  const states4 = states.map((state) => ({ ...state, fatigue: 0.1, stintStartElapsed: 2400 }));
  const quiet = chooseSubstitutions(states4, baseContext({ margin: 0, elapsed: 2500, clock: 500, lastTeamSubElapsed: 2000 }));
  check(`${mode} no forced change`, quiet.length === 0, quiet[0]?.reason ?? "correcto");

  const states5 = states.map((state) => ({ ...state, fouledOut: !state.onCourt, fatigue: 0.9 }));
  const none = chooseSubstitutions(states5, baseContext({ elapsed: 2800 }));
  check(`${mode} no invented replacement`, none.length === 0, none[0]?.reason ?? "correcto");

  const positions = new Set(chooseStartingFive(roster).map((player) => player.position));
  check(`${mode} varied starting positions`, positions.size >= 3, [...positions].join(","));
}

for (const mode of ["fictional", "real"] as const) {
  const bundle = createLeagueBundle({ name: `Phase 3 ${mode}`, mode, playMode: "spectator", theme: "tinta", userTeamId: "nyk", seed: "PHASE3-ROTATION" });
  auditCoach(bundle, mode);
  const seeds = seedsFor(mode, GAMES);
  const teams = new Map(bundle.teams.map((team) => [team.id, team]));
  let totalSubs = 0;
  let totalParticipants = 0;
  let totalGames = 0;
  for (let index = 0; index < GAMES; index++) {
    const template = bundle.games[index % bundle.games.length];
    const game: Game = { ...template, id: `p3-${mode}-${index}`, seed: seeds[index], played: false, homeScore: undefined, awayScore: undefined, boxScore: undefined, playByPlay: undefined, substitutions: undefined, startingLineups: undefined };
    const home = teams.get(game.homeTeamId)!; const away = teams.get(game.awayTeamId)!;
    const homePlayers = bundle.players.filter((player) => player.teamId === home.id);
    const awayPlayers = bundle.players.filter((player) => player.teamId === away.id);
    const result = simulateGame(game, home, away, homePlayers, awayPlayers);
    auditGame(result, bundle.players, mode, index);
    totalSubs += result.substitutions?.length ?? 0;
    totalParticipants += result.boxScore!.home.players.length + result.boxScore!.away.players.length;
    totalGames++;
    const repeat = simulateGame({ ...game }, home, away, homePlayers, awayPlayers);
    check(`${mode}#${index} deterministic`, boxKey(result) === boxKey(repeat));
    if (index < 30) {
      const quick = simulateGameQuick({ ...game }, home, away, homePlayers, awayPlayers);
      check(`${mode}#${index} quick box equal`, JSON.stringify(quick.boxScore) === JSON.stringify(result.boxScore));
      check(`${mode}#${index} quick subs equal`, JSON.stringify(quick.substitutions) === JSON.stringify(result.substitutions));
      check(`${mode}#${index} quick no PBP`, (quick.playByPlay?.length ?? 0) === 0 && (result.playByPlay?.length ?? 0) > 0);
    }
  }
  console.log(`${mode}: ${totalGames} partidos · ${(totalSubs / Math.max(1, totalGames)).toFixed(1)} cambios/partido · ${(totalParticipants / Math.max(1, totalGames)).toFixed(1)} participantes/partido`);
}
for (const mode of ["fictional", "real"]) {
  const rows = qualityMinutes.filter((row) => row.mode === mode);
  const values = [...new Set(rows.map((row) => row.value))].sort((a, b) => b - a);
  const topValues = new Set(values.slice(0, 5));
  const bottomValues = new Set(values.slice(-5));
  const avg = (set: Set<number>) => {
    const group = rows.filter((row) => set.has(row.value));
    return group.reduce((sum, row) => sum + row.minutes, 0) / Math.max(1, group.length);
  };
  const topMinutes = avg(topValues);
  const bottomMinutes = avg(bottomValues);
  check(`${mode} aggregate quality minutes`, topMinutes > bottomMinutes, `top ${topMinutes.toFixed(1)} vs bottom ${bottomMinutes.toFixed(1)}`);
  console.log(`${mode} minutos por calidad: top ${topMinutes.toFixed(1)} · bottom ${bottomMinutes.toFixed(1)}`);
}
console.log(`\nComprobaciones: ${checks} · Fallos: ${failures.length} · Advertencias: ${warnings.length}`);
for (const failure of [...new Set(failures)].slice(0, 30)) console.log(`FAIL ${failure}`);
if (failures.length > 30) console.log(`… ${failures.length - 30} fallos adicionales`);
console.log(`PHASE 3 ROTATION: ${failures.length === 0 ? "PASS" : "FAIL"}`);
process.exitCode = failures.length ? 1 : 0;
