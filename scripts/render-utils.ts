import type { Game } from "../src/types";

export function findUserNext(games: Game[], teamId: string): Game | undefined {
  return games
    .filter((game) => !game.played && (game.homeTeamId === teamId || game.awayTeamId === teamId))
    .sort((a, b) => a.round - b.round)[0];
}
