import type { Game, LeagueBundle, PlayerGameStats } from "../src/types";
import { createLeagueBundle } from "../src/game/generate";
import { simulateGame } from "../src/game/simulate";

/**
 * Validación masiva de Fase 2. Semillas reproducibles derivadas del índice.
 * Referencia: medias de liga NBA 2024-25 publicadas por Basketball-Reference.
 * https://www.basketball-reference.com/leagues/NBA_2025.html
 */
const GAMES_PER_MODE = Number(process.env.GAMES ?? 500);
const REFERENCE = {
  points: 113.8, fgm: 41.7, fga: 89.2, fgPct: 46.7, tpm: 13.5, tpa: 37.6, tpPct: 36.0,
  ftm: 16.9, fta: 21.7, ftPct: 78.0, orb: 11.1, trb: 44.1, ast: 26.5, stl: 8.2, blk: 4.9,
  tov: 14.3, pf: 18.6, pace: 99.0,
};

interface Aggregate {
  games: number; points: number; oppPoints: number; possessions: number; fga: number; fgm: number; tpa: number; tpm: number;
  fta: number; ftm: number; orb: number; drb: number; reb: number; ast: number; stl: number; blk: number; tov: number; pf: number;
  teamFouls: number; minutes: number; playersWithMinutes: number; overtimeGames: number; closeGames: number; margin: number;
  zone: Record<string, { fga: number; fgm: number; tpa: number; tpm: number }>;
  events: number; bonusEvents: number; tacticalEvents: number; maxPlayerPoints: number; usage: number[]; playerTotals: Map<string, { name: string; points: number; fga: number; fta: number; tov: number; games: number; threeAtt: number; threeMade: number; ftAtt: number; ftMade: number; reb: number; rebAttr: number; threeAttr: number; position: string }>;
}

function blankAggregate(): Aggregate {
  return {
    games: 0, points: 0, oppPoints: 0, possessions: 0, fga: 0, fgm: 0, tpa: 0, tpm: 0, fta: 0, ftm: 0, orb: 0, drb: 0,
    reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, teamFouls: 0, minutes: 0, playersWithMinutes: 0, overtimeGames: 0,
    closeGames: 0, margin: 0, zone: { restricted: { fga: 0, fgm: 0, tpa: 0, tpm: 0 }, close: { fga: 0, fgm: 0, tpa: 0, tpm: 0 }, mid: { fga: 0, fgm: 0, tpa: 0, tpm: 0 }, corner3: { fga: 0, fgm: 0, tpa: 0, tpm: 0 }, wing3: { fga: 0, fgm: 0, tpa: 0, tpm: 0 } },
    events: 0, bonusEvents: 0, tacticalEvents: 0, maxPlayerPoints: 0, usage: [], playerTotals: new Map(),
  };
}

const failures: string[] = [];
const warnings: string[] = [];
function assert(condition: boolean, message: string): void {
  if (!condition) failures.push(message);
}
function seedFor(label: string, index: number): number {
  let h = 2166136261;
  const text = `${label}-${index}`;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h + index * 104729) >>> 0;
}
function addPlayer(aggregate: Aggregate, line: PlayerGameStats, player: { name: string; position: string; attributes: { threePointers: number; freeThrows: number; rebounding: number } }): void {
  const entry = aggregate.playerTotals.get(line.playerId) ?? { name: player.name, points: 0, fga: 0, fta: 0, tov: 0, games: 0, threeAtt: line.tpa, threeMade: line.tpm, ftAtt: line.fta, ftMade: line.ftm, reb: line.reb, rebAttr: player.attributes.rebounding, threeAttr: player.attributes.threePointers, position: player.position };
  entry.points += line.points; entry.fga += line.fga; entry.fta += line.fta; entry.tov += line.tov; entry.games += 1;
  entry.threeAtt += line.tpa; entry.threeMade += line.tpm; entry.ftAtt += line.fta; entry.ftMade += line.ftm; entry.reb += line.reb;
  aggregate.playerTotals.set(line.playerId, entry);
}

function auditGame(game: Game, homeTeam: { id: string }, awayTeam: { id: string }, label: string): void {
  const box = game.boxScore;
  assert(Boolean(box), `${label}: sin boxscore`);
  if (!box) return;
  assert(game.homeScore !== game.awayScore, `${label}: partido terminado en empate`);
  assert(game.engineVersion === 3, `${label}: versión de motor incorrecta`);
  assert((game.playByPlay?.length ?? 0) > 0, `${label}: sin play-by-play`);
  const events = game.playByPlay ?? [];
  let homeScore = 0; let awayScore = 0;
  for (const event of events) {
    assert(event.homeScore >= homeScore && event.awayScore >= awayScore, `${label}: marcador del play-by-play retrocede`);
    homeScore = event.homeScore; awayScore = event.awayScore;
  }
  const finalEvent = events[events.length - 1];
  assert(Boolean(finalEvent) && finalEvent.homeScore === game.homeScore && finalEvent.awayScore === game.awayScore, `${label}: último evento no coincide con el final`);
  const homeEventPoints = events.reduce((sum, event) => sum + (event.points ?? 0), 0);
  const homeScoringEvents = events.filter((event) => event.kind === "score").reduce((sum, event) => sum + (event.points ?? 0), 0);
  assert(homeScoringEvents === (game.homeScore ?? 0) + (game.awayScore ?? 0), `${label}: la narración de anotación no suma el marcador (${homeScoringEvents} vs ${(game.homeScore ?? 0) + (game.awayScore ?? 0)})`);
  for (const [side, team] of [["home", box.home], ["away", box.away]] as const) {
    assert(team.points === (side === "home" ? game.homeScore : game.awayScore), `${label}/${side}: marcador de equipo incorrecto`);
    assert(team.players.length >= 5 && team.players.length <= 10, `${label}/${side}: participantes fuera de rango (${team.players.length})`);
    assert(team.quarters.reduce((sum, value) => sum + value, 0) === team.points, `${label}/${side}: cuartos no suman el marcador`);
    assert(team.fga >= team.fgm && team.tpa >= team.tpm && team.tpa <= team.fga && team.tpm <= team.fgm && team.fta >= team.ftm, `${label}/${side}: tiros incoherentes`);
    assert(team.ast <= team.fgm, `${label}/${side}: asistencias > canastas`);
    const overtimePeriods = Math.max(0, team.quarters.length - 4);
    assert((team.possessions ?? 0) >= 85 && (team.possessions ?? 0) <= 118 + overtimePeriods * 7, `${label}/${side}: posesiones fuera de rango (${team.possessions}) en ${overtimePeriods} OT`);
    assert((team.teamFouls ?? []).reduce((sum, value) => sum + value, 0) === team.pf, `${label}/${side}: faltas de equipo no coinciden con PF`);
    const minutes = team.players.reduce((sum, line) => sum + line.minutes, 0);
    const expectedMinutes = 240 + Math.max(0, team.quarters.length - 4) * 25;
    assert(Math.abs(minutes - expectedMinutes) <= 0.2, `${label}/${side}: minutos ${minutes}, esperados ${expectedMinutes}`);
    assert(team.players.every((line) => line.minutes > 0), `${label}/${side}: participante con 0 minutos`);
    const zoneTotal = Object.values(team.zones ?? {}).reduce((sum, zone) => sum + zone.fga, 0);
    const zoneMade = Object.values(team.zones ?? {}).reduce((sum, zone) => sum + zone.fgm, 0);
    const zoneThree = Object.values(team.zones ?? {}).reduce((sum, zone) => sum + zone.tpa, 0);
    const zoneThreeMade = Object.values(team.zones ?? {}).reduce((sum, zone) => sum + zone.tpm, 0);
    assert(zoneTotal === team.fga, `${label}/${side}: zonas no suman FGA`);
    assert(zoneMade === team.fgm, `${label}/${side}: zonas no suman FGM`);
    assert(zoneThree === team.tpa, `${label}/${side}: zonas no suman 3PA`);
    assert(zoneThreeMade === team.tpm, `${label}/${side}: zonas no suman 3PM`);
    for (const key of ["points", "fgm", "fga", "tpm", "tpa", "ftm", "fta", "reb", "oreb", "ast", "stl", "blk", "tov", "pf"] as const) {
      const total = team.players.reduce((sum, line) => sum + line[key], 0);
      assert(total === team[key], `${label}/${side}: ${key} individual ${total} != equipo ${team[key]}`);
    }
    assert(team.players.reduce((sum, line) => sum + (2 * line.fgm + line.tpm + line.ftm), 0) === team.points, `${label}/${side}: fórmula de puntos falla`);
    const zonePoints = Object.values(team.zones ?? {}).reduce((sum, zone) => sum + zone.points, 0);
    assert(zonePoints === 2 * team.fgm + team.tpm, `${label}/${side}: puntos por zona no coinciden con las canastas`);
    assert(team.players.every((line) => line.fgm <= line.fga && line.tpm <= line.tpa && line.ftm <= line.fta && line.tpm <= line.fgm), `${label}/${side}: tiros individuales incoherentes`);
    assert(team.players.every((line) => Number.isFinite(line.points) && Number.isFinite(line.minutes)), `${label}/${side}: valores no finitos`);
    assert(team.players.every((line) => line.pf <= 6), `${label}/${side}: jugador con más de 6 faltas`);
  }
  assert(box.home.players.every((line) => box.away.players.every((other) => other.playerId !== line.playerId)), `${label}: jugador duplicado entre equipos`);
}

function collect(bundle: LeagueBundle, games: number, label: string, aggregate: Aggregate): void {
  const teams = new Map(bundle.teams.map((team) => [team.id, team]));
  const players = new Map(bundle.players.map((player) => [player.id, player]));
  for (let index = 0; index < games; index++) {
    const template = bundle.games[index % bundle.games.length];
    const seed = seedFor(`${label}-${index}`, index);
    const game: Game = { ...template, seed, played: false, homeScore: undefined, awayScore: undefined, boxScore: undefined, playByPlay: undefined };
    const home = teams.get(game.homeTeamId)!;
    const away = teams.get(game.awayTeamId)!;
    const result = simulateGame(game, home, away, bundle.players.filter((player) => player.teamId === home.id), bundle.players.filter((player) => player.teamId === away.id));
    auditGame(result, home, away, `${label}#${index}`);
    aggregate.games++;
    if ((result.boxScore!.home.quarters.length ?? 4) > 4) aggregate.overtimeGames++;
    const margin = Math.abs((result.homeScore ?? 0) - (result.awayScore ?? 0));
    aggregate.margin += margin;
    if (margin <= 5) aggregate.closeGames++;
    aggregate.events += result.playByPlay?.length ?? 0;
    aggregate.bonusEvents += (result.playByPlay ?? []).filter((event) => event.text.includes("Bonus")).length;
    aggregate.tacticalEvents += (result.playByPlay ?? []).filter((event) => event.text.includes("Falta táctica")).length;
    for (const [side, team] of [["home", result.boxScore!.home], ["away", result.boxScore!.away]] as const) {
      aggregate.points += team.points;
      aggregate.oppPoints += side === "home" ? result.boxScore!.away.points : result.boxScore!.home.points;
      aggregate.possessions += team.possessions ?? 0; aggregate.fga += team.fga; aggregate.fgm += team.fgm; aggregate.tpa += team.tpa; aggregate.tpm += team.tpm;
      aggregate.fta += team.fta; aggregate.ftm += team.ftm; aggregate.orb += team.oreb; aggregate.drb += team.reb - team.oreb; aggregate.reb += team.reb;
      aggregate.ast += team.ast; aggregate.stl += team.stl; aggregate.blk += team.blk; aggregate.tov += team.tov; aggregate.pf += team.pf;
      aggregate.teamFouls += (team.teamFouls ?? []).reduce((sum, value) => sum + value, 0);
      aggregate.minutes += team.players.reduce((sum, line) => sum + line.minutes, 0);
      aggregate.playersWithMinutes += team.players.filter((line) => line.minutes > 0).length;
      aggregate.maxPlayerPoints = Math.max(aggregate.maxPlayerPoints, ...team.players.map((line) => line.points));
      const usage = team.players.map((line) => ((line.fga + 0.44 * line.fta + line.tov) / Math.max(1, team.possessions ?? 1)) * 100);
      aggregate.usage.push(...usage);
      for (const [zone, values] of Object.entries(team.zones ?? {})) {
        aggregate.zone[zone].fga += values.fga; aggregate.zone[zone].fgm += values.fgm; aggregate.zone[zone].tpa += values.tpa; aggregate.zone[zone].tpm += values.tpm;
      }
      for (const line of team.players) {
        const player = players.get(line.playerId);
        if (player) addPlayer(aggregate, line, player);
      }
    }
  }
}

function printMetrics(label: string, aggregate: Aggregate, reference: typeof REFERENCE): boolean {
  const teams = aggregate.games * 2;
  const avg = (value: number) => value / teams;
  const pct = (made: number, attempted: number) => attempted ? (made / attempted) * 100 : 0;
  const metrics = {
    points: avg(aggregate.points), fgm: avg(aggregate.fgm), fga: avg(aggregate.fga), fgPct: pct(aggregate.fgm, aggregate.fga),
    tpm: avg(aggregate.tpm), tpa: avg(aggregate.tpa), tpPct: pct(aggregate.tpm, aggregate.tpa), ftm: avg(aggregate.ftm), fta: avg(aggregate.fta),
    ftPct: pct(aggregate.ftm, aggregate.fta), ftRate: pct(aggregate.fta, aggregate.fga), threeRate: pct(aggregate.tpa, aggregate.fga),
    orb: avg(aggregate.orb), drb: avg(aggregate.drb), trb: avg(aggregate.reb), ast: avg(aggregate.ast), stl: avg(aggregate.stl), blk: avg(aggregate.blk),
    tov: avg(aggregate.tov), pf: avg(aggregate.pf), possessions: avg(aggregate.possessions), ortg: (aggregate.points / Math.max(1, aggregate.possessions)) * 100,
    minutes: avg(aggregate.minutes), players: aggregate.playersWithMinutes / teams,
  };
  console.log(`\n===== ${label} =====`);
  console.log(`${aggregate.games} partidos · ${teams} actuaciones de equipo · semillas deterministas`);
  console.log(`PTS ${metrics.points.toFixed(1)} | POSS ${metrics.possessions.toFixed(1)} | ORtg ${metrics.ortg.toFixed(1)} | FG ${metrics.fgPct.toFixed(1)}% (${metrics.fgm.toFixed(1)}/${metrics.fga.toFixed(1)}) | 3P ${metrics.tpPct.toFixed(1)}% (${metrics.tpm.toFixed(1)}/${metrics.tpa.toFixed(1)}) | TL ${metrics.ftPct.toFixed(1)}% (${metrics.ftm.toFixed(1)}/${metrics.fta.toFixed(1)})`);
  console.log(`3PA/FGA ${metrics.threeRate.toFixed(1)}% | FTA/FGA ${metrics.ftRate.toFixed(1)}% | ORB ${metrics.orb.toFixed(1)} | DRB ${metrics.drb.toFixed(1)} | TRB ${metrics.trb.toFixed(1)} | AST ${metrics.ast.toFixed(1)} | STL ${metrics.stl.toFixed(1)} | BLK ${metrics.blk.toFixed(1)} | TOV ${metrics.tov.toFixed(1)} | PF ${metrics.pf.toFixed(1)}`);
  console.log(`MIN ${metrics.minutes.toFixed(1)} | jugadores con minutos ${metrics.players.toFixed(1)} | OT ${(aggregate.overtimeGames / aggregate.games * 100).toFixed(1)}% | margen ${(aggregate.margin / aggregate.games).toFixed(1)} | cierres ≤5 ${(aggregate.closeGames / aggregate.games * 100).toFixed(1)}% | eventos ${(aggregate.events / aggregate.games).toFixed(0)} | bonus ${(aggregate.bonusEvents / aggregate.games).toFixed(2)} | faltas tácticas ${(aggregate.tacticalEvents / aggregate.games).toFixed(2)}`);
  console.log(`Zonas: ${Object.entries(aggregate.zone).map(([zone, value]) => `${zone} ${(value.fga / aggregate.fga * 100).toFixed(1)}% intentos, ${pct(value.fgm, value.fga).toFixed(1)}% acierto`).join(" | ")}`);
  console.log(`Máximo anotador en un partido: ${aggregate.maxPlayerPoints} pts · uso ofensivo medio del jugador ${(aggregate.usage.reduce((sum, value) => sum + value, 0) / aggregate.usage.length).toFixed(1)}%`);
  console.log(`Referencia NBA 2024-25: PTS ${reference.points} · FG ${reference.fgPct}% (${reference.fgm}/${reference.fga}) · 3P ${reference.tpPct}% (${reference.tpm}/${reference.tpa}) · TL ${reference.ftPct}% (${reference.ftm}/${reference.fta}) · ORB ${reference.orb} · TRB ${reference.trb} · AST ${reference.ast} · STL ${reference.stl} · BLK ${reference.blk} · TOV ${reference.tov} · PF ${reference.pf} · ritmo ${reference.pace}`);

  const ranges: [string, number, number, number][] = [
    ["PTS", metrics.points, 108, 118], ["POSS", metrics.possessions, 94, 104], ["ORtg", metrics.ortg, 108, 118],
    ["FG%", metrics.fgPct, 45, 50], ["3P%", metrics.tpPct, 34.5, 38.5], ["FT%", metrics.ftPct, 76, 82],
    ["3PA/FGA", metrics.threeRate, 38, 46], ["ORB", metrics.orb, 8, 13], ["TRB", metrics.trb, 42, 52],
    ["AST", metrics.ast, 22, 28], ["TOV", metrics.tov, 10.5, 15.5], ["PF", metrics.pf, 15, 21], ["MIN", metrics.minutes, 239, 266],
  ];
  let all = true;
  for (const [name, value, min, max] of ranges) {
    if (!(value >= min && value <= max)) {
      warnings.push(`${label}: ${name}=${value.toFixed(1)} fuera del rango razonable [${min}, ${max}]`);
      all = false;
    }
  }
  const fgaDelta = ((metrics.fga - reference.fga) / reference.fga) * 100;
  const rebDelta = ((metrics.trb - reference.trb) / reference.trb) * 100;
  const fgDelta = metrics.fgPct - reference.fgPct;
  if (Math.abs(fgaDelta) > 10) warnings.push(`${label}: FGA ${fgaDelta.toFixed(1)}% respecto a la referencia`);
  if (Math.abs(rebDelta) > 10) warnings.push(`${label}: TRB ${rebDelta.toFixed(1)}% respecto a la referencia (todos los rebotes se asignan a jugadores; NBA incluye team rebounds)`);
  if (Math.abs(fgDelta) > 2) warnings.push(`${label}: FG% ${fgDelta.toFixed(1)} puntos respecto a la referencia`);
  const relativeWarnings: [string, number, number][] = [
    ["FGA", metrics.fga, reference.fga], ["STL", metrics.stl, reference.stl], ["TOV", metrics.tov, reference.tov],
    ["PF", metrics.pf, reference.pf], ["ORB", metrics.orb, reference.orb], ["TRB", metrics.trb, reference.trb],
  ];
  for (const [name, value, expected] of relativeWarnings) {
    const delta = ((value - expected) / expected) * 100;
    if (Math.abs(delta) > 12) warnings.push(`${label}: ${name} ${delta.toFixed(1)}% respecto a la referencia (${value.toFixed(1)} vs ${expected})`);
  }
  return all;
}

const fictional = createLeagueBundle({ name: "Validación F2", mode: "fictional", playMode: "spectator", theme: "tinta", userTeamId: "nyk", seed: "PHASE2-VALIDATION" });
const real = createLeagueBundle({ name: "Validación F2 Real", mode: "real", playMode: "spectator", theme: "tinta", userTeamId: "nyk", seed: "PHASE2-VALIDATION-REAL" });
const all = blankAggregate();
console.log("== VALIDACIÓN MASIVA FASE 2 ==");
const fictionAgg = blankAggregate();
collect(fictional, GAMES_PER_MODE, "FIC", fictionAgg);
const realAgg = blankAggregate();
collect(real, Math.floor(GAMES_PER_MODE * 0.6), "REAL", realAgg);
for (const aggregate of [fictionAgg, realAgg]) {
  all.games += aggregate.games; all.points += aggregate.points; all.oppPoints += aggregate.oppPoints; all.possessions += aggregate.possessions;
  all.fga += aggregate.fga; all.fgm += aggregate.fgm; all.tpa += aggregate.tpa; all.tpm += aggregate.tpm; all.fta += aggregate.fta; all.ftm += aggregate.ftm;
  all.orb += aggregate.orb; all.drb += aggregate.drb; all.reb += aggregate.reb; all.ast += aggregate.ast; all.stl += aggregate.stl; all.blk += aggregate.blk;
  all.tov += aggregate.tov; all.pf += aggregate.pf; all.teamFouls += aggregate.teamFouls; all.minutes += aggregate.minutes; all.playersWithMinutes += aggregate.playersWithMinutes;
  all.overtimeGames += aggregate.overtimeGames; all.closeGames += aggregate.closeGames; all.margin += aggregate.margin; all.events += aggregate.events;
  all.bonusEvents += aggregate.bonusEvents; all.tacticalEvents += aggregate.tacticalEvents; all.maxPlayerPoints = Math.max(all.maxPlayerPoints, aggregate.maxPlayerPoints);
  all.usage.push(...aggregate.usage);
  for (const [zone, value] of Object.entries(aggregate.zone)) { all.zone[zone].fga += value.fga; all.zone[zone].fgm += value.fgm; all.zone[zone].tpa += value.tpa; all.zone[zone].tpm += value.tpm; }
  for (const [id, entry] of aggregate.playerTotals) all.playerTotals.set(`${aggregate.games}-${id}`, entry);
}
printMetrics("NBA Ficticia", fictionAgg, REFERENCE);
printMetrics("NBA Real 2026-27", realAgg, REFERENCE);
printMetrics("Global", all, REFERENCE);

const threeShooters = [...all.playerTotals.values()].filter((player) => player.threeAtt >= 30).sort((a, b) => b.threeAtt - a.threeAtt).slice(0, 120);
const correlation = (xs: number[], ys: number[]) => {
  const mx = xs.reduce((sum, value) => sum + value, 0) / xs.length;
  const my = ys.reduce((sum, value) => sum + value, 0) / ys.length;
  const cov = xs.reduce((sum, value, index) => sum + (value - mx) * (ys[index] - my), 0);
  const vx = xs.reduce((sum, value) => sum + (value - mx) ** 2, 0);
  const vy = ys.reduce((sum, value) => sum + (value - my) ** 2, 0);
  return cov / Math.sqrt(vx * vy);
};
const individual = [...all.playerTotals.values()].filter((player) => player.games >= 10).sort((a, b) => b.points - a.points);
console.log(`\nMuestra individual: ${individual.length} jugadores con ≥10 partidos · acumulado máximo ${individual[0]?.points ?? 0} puntos · correlación 3P% con atributo 3P en volumen (n=${threeShooters.length}) ${correlation(threeShooters.map((p) => p.threeMade / Math.max(1, p.threeAtt)), threeShooters.map((p) => p.threeAttr)).toFixed(2)} (control: no es la prueba principal)`);

console.log(`\nInvariantes: ${failures.length === 0 ? "PASS" : `${failures.length} FALLOS`}`);
for (const failure of new Set(failures).values()) console.log(`FAIL ${failure}`);
console.log(`Advertencias: ${warnings.length}`);
for (const warning of warnings) console.log(`WARN ${warning}`);
console.log(`\nRESULTADO VALIDACIÓN: ${failures.length === 0 ? "PASS" : "FAIL"}`);
console.log("Referencia: Basketball-Reference, NBA 2024-25 League Averages (https://www.basketball-reference.com/leagues/NBA_2025.html).");
console.log("No se afirma que cada partido individual sea determinista al variar un atributo; la causalidad se valida en scripts/phase2-causality.ts.");
process.exitCode = failures.length ? 1 : 0;
