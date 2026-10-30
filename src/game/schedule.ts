import type { Game, Team } from "@/types";
import { hashSeed } from "./random";

export const REGULAR_SEASON_ROUNDS = 29;

function formatDay(round: number): string {
  // A Phase 1 calendar: one slate every three days from opening night 2026-10-20.
  const date = new Date(Date.UTC(2026, 9, 20 + round * 3, 0, 0, 0));
  return date.toISOString().slice(0, 10);
}

/**
 * Round-robin completo de 30 equipos (método del círculo).
 * Cada equipo juega 29 partidos; hay 15 por jornada y 435 en total.
 * En esta fase no se simulan playoffs ni el calendario de 82 partidos.
 */
export function generateSchedule(leagueId: string, teams: Team[], seed: string): Game[] {
  if (teams.length !== 30) {
    throw new Error("El calendario de la Fase 1 requiere exactamente 30 equipos.");
  }
  const games: Game[] = [];
  let rotation = [...teams];
  for (let round = 0; round < teams.length - 1; round++) {
    for (let pair = 0; pair < teams.length / 2; pair++) {
      const left = rotation[pair];
      const right = rotation[teams.length - 1 - pair];
      const swap = (round + pair) % 2 === 0;
      const home = swap ? left : right;
      const away = swap ? right : left;
      games.push({
        id: `${leagueId}::game-${String(round + 1).padStart(2, "0")}-${String(pair + 1).padStart(2, "0")}`,
        leagueId,
        round: round + 1,
        day: formatDay(round),
        homeTeamId: home.id,
        awayTeamId: away.id,
        played: false,
        seed: hashSeed(`${seed}-${leagueId}-${round}-${pair}`),
      });
    }
    rotation = [rotation[0], rotation[teams.length - 1], ...rotation.slice(1, teams.length - 1)];
  }
  return games;
}

export function formatGameDate(day: string): string {
  const parsed = new Date(`${day}T12:00:00Z`);
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(parsed);
}

export function shortGameDate(day: string): string {
  const parsed = new Date(`${day}T12:00:00Z`);
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", timeZone: "UTC" }).format(parsed);
}
