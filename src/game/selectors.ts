import type { Game, LeagueBundle, Player, PlayerGameStats, Team } from "@/types";

export interface TeamRecord {
  teamId: string;
  wins: number;
  losses: number;
  played: number;
  pointsFor: number;
  pointsAgainst: number;
}

export function teamRecord(teamId: string, games: Game[]): TeamRecord {
  let wins = 0;
  let losses = 0;
  let pointsFor = 0;
  let pointsAgainst = 0;
  for (const game of games) {
    if (!game.played || game.homeScore === undefined || game.awayScore === undefined) continue;
    if (game.homeTeamId === teamId) {
      pointsFor += game.homeScore;
      pointsAgainst += game.awayScore;
      if (game.homeScore > game.awayScore) wins++;
      else losses++;
    } else if (game.awayTeamId === teamId) {
      pointsFor += game.awayScore;
      pointsAgainst += game.homeScore;
      if (game.awayScore > game.homeScore) wins++;
      else losses++;
    }
  }
  return { teamId, wins, losses, played: wins + losses, pointsFor, pointsAgainst };
}

export function winPct(record: TeamRecord): number {
  return record.played ? record.wins / record.played : 0;
}

export function standings(teams: Team[], games: Game[]): Record<"Este" | "Oeste", { team: Team; record: TeamRecord; rank: number; gb: number }[]> {
  const grouped: Record<"Este" | "Oeste", Team[]> = { Este: [], Oeste: [] };
  for (const team of teams) grouped[team.conference].push(team);
  const result = {} as Record<"Este" | "Oeste", { team: Team; record: TeamRecord; rank: number; gb: number }[]>;
  for (const conference of ["Este", "Oeste"] as const) {
    const rows = grouped[conference].map((team) => ({ team, record: teamRecord(team.id, games) }));
    rows.sort((a, b) => winPct(b.record) - winPct(a.record) || b.record.pointsFor - b.record.pointsAgainst - (a.record.pointsFor - a.record.pointsAgainst) || b.record.pointsFor - a.record.pointsFor);
    const leaderWins = rows[0]?.record.wins ?? 0;
    const leaderLosses = rows[0]?.record.losses ?? 0;
    result[conference] = rows.map((row, index) => ({
      ...row,
      rank: index + 1,
      gb: Math.max(0, ((leaderWins - row.record.wins) + (row.record.losses - leaderLosses)) / 2),
    }));
  }
  return result;
}

export function teamById(teams: Team[], id: string): Team | undefined {
  return teams.find((team) => team.id === id);
}

export function rosterOf(players: Player[], teamId: string): Player[] {
  return players.filter((player) => player.teamId === teamId).sort((a, b) => b.ovr - a.ovr);
}

export function nextGameForTeam(games: Game[], teamId: string): Game | undefined {
  return games.filter((game) => !game.played && (game.homeTeamId === teamId || game.awayTeamId === teamId)).sort((a, b) => a.round - b.round || a.id.localeCompare(b.id))[0];
}

export function currentRound(games: Game[]): number {
  return games.find((game) => !game.played)?.round ?? Math.max(0, ...games.map((game) => game.round));
}

export function unplayedOfRound(games: Game[], round: number): Game[] {
  return games.filter((game) => game.round === round && !game.played);
}

export function playedGames(games: Game[]): Game[] {
  return games.filter((game) => game.played).sort((a, b) => (b.simulatedAt ?? 0) - (a.simulatedAt ?? 0));
}

export interface StatAggregate {
  player: Player;
  team: Team;
  games: number;
  total: PlayerGameStats;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  fgPct: number;
  tpPct: number;
  ftPct: number;
}

function emptyStat(playerId: string, name: string, position: Player["position"]): PlayerGameStats {
  return { playerId, name, position, minutes: 0, points: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, oreb: 0, dreb: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, plusMinus: 0 };
}

export function aggregatePlayerStats(bundle: LeagueBundle): StatAggregate[] {
  const map = new Map<string, PlayerGameStats>();
  for (const game of bundle.games) {
    if (!game.played || !game.boxScore) continue;
    for (const teamBox of [game.boxScore.home, game.boxScore.away]) {
      for (const line of teamBox.players) {
        const current = map.get(line.playerId) ?? emptyStat(line.playerId, line.name, line.position);
        current.minutes += line.minutes;
        current.points += line.points;
        current.fgm += line.fgm;
        current.fga += line.fga;
        current.tpm += line.tpm;
        current.tpa += line.tpa;
        current.ftm += line.ftm;
        current.fta += line.fta;
        current.oreb += line.oreb;
        current.dreb += line.dreb;
        current.reb += line.reb;
        current.ast += line.ast;
        current.stl += line.stl;
        current.blk += line.blk;
        current.tov += line.tov;
        current.pf += line.pf;
        map.set(line.playerId, current);
      }
    }
  }
  const players = new Map(bundle.players.map((player) => [player.id, player]));
  const teams = new Map(bundle.teams.map((team) => [team.id, team]));
  const result: StatAggregate[] = [];
  for (const stats of map.values()) {
    const player = players.get(stats.playerId);
    if (!player) continue;
    const team = teams.get(player.teamId);
    if (!team) continue;
    const games = new Set<string>();
    for (const game of bundle.games) {
      if (!game.played) continue;
      if (game.boxScore?.home.players.some((line) => line.playerId === player.id) || game.boxScore?.away.players.some((line) => line.playerId === player.id)) {
        games.add(game.id);
      }
    }
    const count = Math.max(1, games.size);
    result.push({
      player,
      team,
      games: games.size,
      total: stats,
      ppg: stats.points / count,
      rpg: stats.reb / count,
      apg: stats.ast / count,
      spg: stats.stl / count,
      bpg: stats.blk / count,
      fgPct: stats.fga ? (stats.fgm / stats.fga) * 100 : 0,
      tpPct: stats.tpa ? (stats.tpm / stats.tpa) * 100 : 0,
      ftPct: stats.fta ? (stats.ftm / stats.fta) * 100 : 0,
    });
  }
  return result.sort((a, b) => b.ppg - a.ppg);
}

export function teamAverageOvr(players: Player[], teamId: string): number {
  const roster = rosterOf(players, teamId).slice(0, 8);
  if (!roster.length) return 0;
  return Math.round(roster.reduce((sum, player) => sum + player.ovr, 0) / roster.length);
}

export function formatRecord(record: TeamRecord): string {
  return `${record.wins}–${record.losses}`;
}

export function gameResultLabel(game: Game, teamId: string): "G" | "P" | "—" {
  if (!game.played || game.homeScore === undefined || game.awayScore === undefined) return "—";
  const isHome = game.homeTeamId === teamId;
  const own = isHome ? game.homeScore : game.awayScore;
  const rival = isHome ? game.awayScore : game.homeScore;
  return own > rival ? "G" : "P";
}

export function playerById(players: Player[], id: string): Player | undefined {
  return players.find((player) => player.id === id);
}

export function formatHeight(inches: number): string {
  const feet = Math.floor(inches / 12);
  const rest = inches % 12;
  return `${feet}'${rest}"`;
}

export function formatMinutes(seconds: number): string {
  return `${Math.round(seconds / 60)} min`;
}
