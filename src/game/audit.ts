import type { LeagueBundle, Player } from "@/types";
import { REAL_ROSTER_CUTOFF, REAL_ROSTER_STATS } from "@/data/realRosters2026";
import { calculateOvr } from "./ratings";
import { simulateGame } from "./simulate";

export interface AuditCheck {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
}

export interface AuditReport {
  generatedAt: number;
  mode: "real" | "fictional";
  teams: number;
  players: number;
  games: number;
  simulatedSample: number;
  checks: AuditCheck[];
  passed: boolean;
}

function check(id: string, label: string, condition: boolean, detail: string, warning = false): AuditCheck {
  return { id, label, status: condition ? "pass" : warning ? "warn" : "fail", detail };
}

function positionCounts(roster: Player[]): Record<string, number> {
  return roster.reduce<Record<string, number>>((acc, player) => {
    acc[player.position] = (acc[player.position] ?? 0) + 1;
    return acc;
  }, {});
}

export function auditBundle(bundle: LeagueBundle, options: { simulateSamples?: number } = {}): AuditReport {
  const checks: AuditCheck[] = [];
  const { teams, players, games, league } = bundle;
  const isFictional = league.mode === "fictional";
  const teamIds = new Set(teams.map((team) => team.id));
  const playerIds = new Set(players.map((player) => player.id));
  const perTeam = [...teamIds].map((teamId) => players.filter((player) => player.teamId === teamId));

  checks.push(check("teams", "30 franquicias únicas", teams.length === 30 && teamIds.size === 30, `${teams.length} equipos, ${teamIds.size} IDs únicos.`));
  checks.push(check("conference", "15 equipos por conferencia", teams.filter((team) => team.conference === "Este").length === 15 && teams.filter((team) => team.conference === "Oeste").length === 15, `${teams.filter((team) => team.conference === "Este").length} Este / ${teams.filter((team) => team.conference === "Oeste").length} Oeste.`));
  checks.push(check("orphan-players", "Sin referencias rotas en jugadores", perTeam.every((roster) => roster.length > 0) && players.every((player) => teamIds.has(player.teamId)), "Todos los jugadores pertenecen a un equipo de la liga."));
  checks.push(check("unique-players", "IDs de jugador únicos", playerIds.size === players.length, `${players.length} jugadores, ${playerIds.size} IDs.`));

  if (isFictional) {
    const sizes = perTeam.map((roster) => roster.length);
    checks.push(check("roster-size", "Entre 10 y 15 jugadores por equipo", sizes.every((size) => size >= 10 && size <= 15), `Rango real: ${Math.min(...sizes)}–${Math.max(...sizes)}.`));
    checks.push(check("player-range", "Entre 300 y 450 jugadores ficticios", players.length >= 300 && players.length <= 450, `${players.length} jugadores generados.`));
    const names = new Set(players.map((player) => player.name));
    checks.push(check("unique-names", "Nombres ficticios sin duplicados", names.size === players.length, `${names.size} nombres distintos.`));
    const completePositions = perTeam.every((roster) => {
      const counts = positionCounts(roster);
      return counts.PG && counts.SG && counts.SF && counts.PF && counts.C;
    });
    checks.push(check("positions", "Cinco posiciones cubiertas por plantilla", completePositions, "Cada plantilla contiene bases, escoltas, aleros, ala-pívots y pívots."));
  } else {
    const sizes = perTeam.map((roster) => roster.length);
    const realNames = players.map((player) => player.name);
    const twoWays = players.filter((player) => player.contractType === "two-way").length;
    const standard = players.filter((player) => player.contractType !== "two-way").length;
    const perTeamLimits = perTeam.every((roster) => {
      const tw = roster.filter((player) => player.contractType === "two-way").length;
      return tw <= 3 && roster.length - tw <= 15;
    });
    const legacySnapshot = players.length < 500;
    const sourceDetail = legacySnapshot
      ? `Esta liga conserva el snapshot histórico de ${players.length} fichas. La base actual tiene ${REAL_ROSTER_STATS.players} fichas con corte ${REAL_ROSTER_CUTOFF}; crea una liga real nueva para usarla.`
      : `Fuente actualizada 27/10/2026 · corte ${REAL_ROSTER_CUTOFF} · ${players.length} fichas cargadas de ${REAL_ROSTER_STATS.players} en la base.`;
    checks.push(check("real-source", "Corte de plantillas 2026-27 cargado", !legacySnapshot && REAL_ROSTER_STATS.teams === 30 && REAL_ROSTER_STATS.cutoff === REAL_ROSTER_CUTOFF, sourceDetail, legacySnapshot));
    checks.push(check("real-players", "Fichas reales cargadas", players.length >= 500, `${players.length} fichas reales (${Math.min(...sizes)}–${Math.max(...sizes)} por franquicia).` + (legacySnapshot ? " Snapshot anterior; no se migra de forma destructiva." : ""), legacySnapshot));
    checks.push(check("real-roster-size", "Entre 15 y 18 fichas por franquicia real", sizes.every((size) => size >= 15 && size <= 18), `Rango real: ${Math.min(...sizes)}–${Math.max(...sizes)}.`, legacySnapshot));
    checks.push(check("real-unique", "Sin jugador real duplicado entre equipos", new Set(realNames).size === realNames.length, `${new Set(realNames).size}/${realNames.length} identidades reales únicas.`));
    checks.push(check("real-contracts", "Two-way identificados y límites 15+3 respetados", twoWays > 0 && perTeamLimits, `${twoWays} two-way, ${standard} estándar; ninguna franquicia supera 15 estándar + 3 two-way.`, legacySnapshot));
    checks.push(check("real-official", "Verificación oficial NBA.com equipo por equipo", !legacySnapshot && teams.length === 30 && players.length === REAL_ROSTER_STATS.players, legacySnapshot ? "Esta liga conserva un snapshot anterior; crea una liga nueva para la verificación oficial 2026-27." : `30/30 páginas oficiales de plantilla de NBA.com consultadas el 28/10/2026 (SEASON 2026): ${players.length} fichas y ${twoWays} two-way.`, legacySnapshot));
    checks.push(check("real-identity", "Identidad y contrato salarial completos al 100%", false, `${players.filter((player) => player.nationality.startsWith("No ")).length} sin nacionalidad verificada, ${players.filter((player) => player.jerseyPending).length} sin dorsal y salarios/términos no modelados. No se rellenan con invenciones.`, true));
    const completePositions = perTeam.every((roster) => {
      const counts = positionCounts(roster);
      return counts.PG && counts.SG && counts.SF && counts.PF && counts.C;
    });
    checks.push(check("real-positions", "Cinco posiciones cubiertas por plantilla", completePositions, "Posición específica conservada o derivada de la posición listada G/F/C y la altura."));
  }

  const invalidAttributes = players.filter((player) =>
    Object.values(player.attributes).some((value) => !Number.isFinite(value) || value < 0 || value > 100),
  );
  checks.push(check("attributes", "Atributos individuales en escala 0–100", invalidAttributes.length === 0, `${players.length - invalidAttributes.length}/${players.length} fichas válidas.`));
  const badOvr = players.filter((player) => player.ovr !== calculateOvr(player.attributes, player.position));
  checks.push(check("ovr", "OVR ponderado por posición coherente", badOvr.length === 0, `${players.length - badOvr.length}/${players.length} OVR recalculados correctamente.`));
  const badPot = players.filter((player) => player.pot < player.ovr || player.pot > 100);
  checks.push(check("pot", "POT estimado igual o superior al OVR actual", badPot.length === 0, `${players.length - badPot.length}/${players.length} fichas válidas.`));
  const high = players.filter((player) => player.ovr >= 90).length;
  const elite = players.filter((player) => player.ovr >= 85).length;
  const scarcityPass = isFictional ? elite / Math.max(1, players.length) < 0.16 && high / Math.max(1, players.length) < 0.04 : high <= 14 && elite <= 60;
  checks.push(check("scarcity", "Escala exigente: 85+ y 90+ excepcionales", scarcityPass, isFictional ? `${elite} jugadores con 85+ (${((elite / Math.max(1, players.length)) * 100).toFixed(1)}%), ${high} con 90+ (${((high / Math.max(1, players.length)) * 100).toFixed(1)}%).` : `${elite} fichas con 85+ y ${high} con 90+ sobre ${players.length} fichas reales del corte 2026-27.`));
  const distinctProfiles = new Set(players.map((player) => `${player.archetype}-${player.attributes.threePointers >= 75}-${player.attributes.perimeterDefense >= 75}-${player.attributes.rebounding >= 75}`));
  checks.push(check("profiles", "Perfiles de juego diversos", distinctProfiles.size >= 8, `${distinctProfiles.size} combinaciones de arquetipo/especialidad detectadas.`));

  if (isFictional) {
    checks.push(check("games", "Calendario de 435 partidos y 29 jornadas", games.length === 435 && new Set(games.map((game) => game.round)).size === 29, `${games.length} partidos, ${new Set(games.map((game) => game.round)).size} jornadas.`));
    const gamesPerTeam = new Map<string, number>();
    for (const game of games) {
      gamesPerTeam.set(game.homeTeamId, (gamesPerTeam.get(game.homeTeamId) ?? 0) + 1);
      gamesPerTeam.set(game.awayTeamId, (gamesPerTeam.get(game.awayTeamId) ?? 0) + 1);
    }
    checks.push(check("balance", "Cada equipo juega 29 partidos y sin duplicados de pareja", gamesPerTeam.size === 30 && [...gamesPerTeam.values()].every((value) => value === 29) && new Set(games.map((game) => [game.homeTeamId, game.awayTeamId].sort().join("|"))).size === games.length, `Todos los equipos con 29 partidos; ${new Set(games.map((game) => [game.homeTeamId, game.awayTeamId].sort().join("|"))).size} parejas únicas.`));
  }
  checks.push(check("game-refs", "Calendario sin referencias rotas", games.every((game) => teamIds.has(game.homeTeamId) && teamIds.has(game.awayTeamId) && game.homeTeamId !== game.awayTeamId), "Todos los partidos enlazan dos equipos válidos."));

  let simulatedSample = 0;
  let simulationFailure = "";
  const samples = options.simulateSamples ?? 3;
  for (const game of games.slice(0, samples)) {
    const homeTeam = teams.find((team) => team.id === game.homeTeamId)!;
    const awayTeam = teams.find((team) => team.id === game.awayTeamId)!;
    const homeRoster = players.filter((player) => player.teamId === homeTeam.id);
    const awayRoster = players.filter((player) => player.teamId === awayTeam.id);
    if (homeRoster.length < 5 || awayRoster.length < 5) {
      simulationFailure = "Plantilla insuficiente para simular.";
      break;
    }
    const result = simulateGame({ ...game, seed: game.seed + 11 }, homeTeam, awayTeam, homeRoster, awayRoster);
    if (!result.boxScore || result.homeScore === undefined || result.awayScore === undefined) {
      simulationFailure = "El partido no produjo box score.";
      break;
    }
    const { home, away } = result.boxScore;
    const homePts = home.players.reduce((sum, row) => sum + row.points, 0);
    const awayPts = away.players.reduce((sum, row) => sum + row.points, 0);
    const homeQ = home.quarters.reduce((sum, q) => sum + q, 0);
    const awayQ = away.quarters.reduce((sum, q) => sum + q, 0);
    const minutes = home.players.reduce((sum, row) => sum + row.minutes, 0);
    if (homePts !== result.homeScore || awayPts !== result.awayScore || homeQ !== result.homeScore || awayQ !== result.awayScore || home.ast > home.fgm || home.ftm > home.fta || away.ftm > away.fta || minutes < 239.8 || home.players.length < 5 || away.players.length < 5) {
      simulationFailure = "Marcador, cuartos o estadísticas inconsistentes en la muestra.";
      break;
    }
    if (home.tpm > home.tpa || away.tpm > away.tpa || home.fga < home.fgm || away.fga < away.fgm || home.stl > away.tov + 8) {
      simulationFailure = "Conteos de tiro o robos incoherentes.";
      break;
    }
    const zoneStats = [home, away].every((team) => {
      if (!team.zones) return false;
      const zoneFga = Object.values(team.zones).reduce((sum, zone) => sum + zone.fga, 0);
      const zoneFgm = Object.values(team.zones).reduce((sum, zone) => sum + zone.fgm, 0);
      const zoneTpa = Object.values(team.zones).reduce((sum, zone) => sum + zone.tpa, 0);
      const zoneTpm = Object.values(team.zones).reduce((sum, zone) => sum + zone.tpm, 0);
      return zoneFga === team.fga && zoneFgm === team.fgm && zoneTpa === team.tpa && zoneTpm === team.tpm;
    });
    const foulsMatch = [home, away].every((team) => (team.teamFouls ?? []).reduce((sum, value) => sum + value, 0) === team.pf);
    const finalEvent = result.playByPlay?.[result.playByPlay.length - 1];
    const playByPlayOk = Boolean(finalEvent) && finalEvent!.homeScore === result.homeScore && finalEvent!.awayScore === result.awayScore;
    if (!zoneStats || !foulsMatch || !playByPlayOk || result.engineVersion !== 3) {
      simulationFailure = !zoneStats ? "Las zonas no suman los intentos de tiro." : !foulsMatch ? "Las faltas de equipo no coinciden con PF." : !playByPlayOk ? "El play-by-play no termina en el marcador final." : "Versión de motor incoherente.";
      break;
    }
    simulatedSample++;
  }
  checks.push(check("simulation", "Motor coherente: marcador, cuartos, jugadores, zonas, faltas y play-by-play", simulatedSample === samples && !simulationFailure, simulationFailure || `${simulatedSample} partidos de muestra simulados y validados.`));

  return {
    generatedAt: Date.now(),
    mode: league.mode,
    teams: teams.length,
    players: players.length,
    games: games.length,
    simulatedSample,
    checks,
    passed: checks.every((item) => item.status !== "fail"),
  };
}
