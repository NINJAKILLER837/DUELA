import fs from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import type { Game } from "../src/types";
import { createLeagueBundle } from "../src/game/generate";
import { simulateGame } from "../src/game/simulate";
import { GameDetailScreen } from "../src/screens/GameDetail";

interface TeamSide { fgm: number; fga: number; tpm: number; tpa: number; ftm: number; fta: number; oreb: number; reb: number; tov: number }

function expectedMetrics(team: TeamSide, opponent: TeamSide) {
  const efg = team.fga > 0 ? (((team.fgm + 0.5 * team.tpm) / team.fga) * 100).toFixed(1) : "—";
  const tovDen = team.fga + 0.44 * team.fta + team.tov;
  const tov = tovDen > 0 ? ((team.tov / tovDen) * 100).toFixed(1) : "—";
  const orbDen = team.oreb + Math.max(0, opponent.reb - opponent.oreb);
  const orb = orbDen > 0 ? ((team.oreb / orbDen) * 100).toFixed(1) : "—";
  const ftFga = team.fga > 0 ? (team.ftm / team.fga).toFixed(3).replace(/^0/, "") : "—";
  return [efg, tov, orb, ftFga];
}

const bundle = createLeagueBundle({ name: "Comparativa", mode: "fictional", playMode: "manager", theme: "tinta", userTeamId: "nyk", seed: "TEAM-COMPARISON" });
const baseGame = bundle.games.find((game) => game.round === 1)!;
const home = bundle.teams.find((team) => team.id === baseGame.homeTeamId)!;
const away = bundle.teams.find((team) => team.id === baseGame.awayTeamId)!;
const homeRoster = bundle.players.filter((player) => player.teamId === home.id);
const awayRoster = bundle.players.filter((player) => player.teamId === away.id);
const played: Game = JSON.parse(JSON.stringify(simulateGame(baseGame, home, away, homeRoster, awayRoster)));

function render(game: Game): string {
  return renderToStaticMarkup(
    <GameDetailScreen game={game} homeTeam={home} awayTeam={away} onClose={() => undefined} homeRoster={homeRoster} awayRoster={awayRoster} homeRecord="0–0" awayRecord="0–0" season="2026-27" competition="NBA Ficticia" />,
  );
}

let failures = 0;
function check(label: string, condition: boolean, detail = ""): void {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}${detail ? ` · ${detail}` : ""}`);
  if (!condition) failures++;
}

function strip(value: string): string {
  return value.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").trim();
}

function tableRows(tableHtml: string): string[][] {
  return [...tableHtml.matchAll(/<tr>([\s\S]*?)<\/tr>/g)]
    .map((row) => [...row[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((cell) => strip(cell[1])))
    .filter((cells) => cells.length > 0);
}

const html = render(played);
const containerStart = html.indexOf('aria-label="Parciales y estadísticas avanzadas de ambos equipos"');
const playerTableStart = html.indexOf('aria-label="Boxscore de ');
const scoreboardStart = html.indexOf('aria-label="Marcador del partido"');
check("Existe un único contenedor comparativo", containerStart > 0 && (html.match(/aria-label="Parciales y estadísticas avanzadas de ambos equipos"/g) ?? []).length === 1);
check("El cuadro está debajo del marcador y antes de las tablas de jugadores", scoreboardStart > 0 && scoreboardStart < containerStart && containerStart < playerTableStart, `marcador ${scoreboardStart} < cuadro ${containerStart} < jugadores ${playerTableStart}`);

const containerEnd = html.indexOf("</section>", playerTableStart > 0 ? containerStart : containerStart + 1);
const container = html.slice(containerStart, containerEnd > 0 ? containerEnd : containerStart + 6000);
const tables = [...container.matchAll(/<table class="bb-compare-table bb-compare-(quarters|advanced)">([\s\S]*?)<\/table>/g)];
check("Dos tablas dentro del mismo cuadro", tables.length === 2 && tables[0][1] === "quarters" && tables[1][1] === "advanced", tables.map((table) => table[1]).join(" + "));

const quartersTable = tables.find((table) => table[1] === "quarters")?.[2] ?? "";
const advancedTable = tables.find((table) => table[1] === "advanced")?.[2] ?? "";

const quarterRows = tableRows(quartersTable);
const quarterHeader = quarterRows[0] ?? [];
const regulationHeaders = ["Equipo", "1", "2", "3", "4", "F"];
check("Cabecera de parciales con los cuatro cuartos y F", quarterHeader.slice(0, 5).join("|") === "Equipo|1|2|3|4" && quarterHeader[quarterHeader.length - 1] === "F", quarterHeader.join(" | "));
check("Sin OT cuando no hay prórroga", !quarterHeader.includes("OT") && quarterHeader.length === 6, quarterHeader.join(" | "));
check("Una fila por equipo, visitante primero y local segundo", quarterRows.length === 3 && quarterRows[1][0] === away.abbreviation && quarterRows[2][0] === home.abbreviation, quarterRows.slice(1).map((row) => row[0]).join(" / "));
check("Parciales visitante exactos", quarterRows[1].slice(1, 5).join("|") === played.boxScore!.away.quarters.map(String).join("|"), quarterRows[1].join(" | "));
check("Parciales local exactos", quarterRows[2].slice(1, 5).join("|") === played.boxScore!.home.quarters.map(String).join("|"), quarterRows[2].join(" | "));
check("F visitante = marcador final", quarterRows[1][quarterRows[1].length - 1] === String(played.awayScore), `${quarterRows[1][quarterRows[1].length - 1]} vs ${played.awayScore}`);
check("F local = marcador final", quarterRows[2][quarterRows[2].length - 1] === String(played.homeScore), `${quarterRows[2][quarterRows[2].length - 1]} vs ${played.homeScore}`);

const advancedRows = tableRows(advancedTable);
const advancedHeader = advancedRows[0] ?? [];
check("Cabecera avanzada exacta", advancedHeader.join("|") === "Equipo|eFG%|TOV%|ORB%|FT/FGA", advancedHeader.join(" | "));
check("Avanzadas: visita y local en el mismo cuadro", advancedRows.length === 3 && advancedRows[1][0] === away.abbreviation && advancedRows[2][0] === home.abbreviation, advancedRows.slice(1).map((row) => row[0]).join(" / "));
const awayExpected = expectedMetrics(played.boxScore!.away, played.boxScore!.home);
const homeExpected = expectedMetrics(played.boxScore!.home, played.boxScore!.away);
check("Métricas avanzadas visitante correctas", advancedRows[1].slice(1).join("|") === awayExpected.join("|"), `${advancedRows[1].slice(1).join(" | ")} · esperado ${awayExpected.join(" | ")}`);
check("Métricas avanzadas local correctas", advancedRows[2].slice(1).join("|") === homeExpected.join("|"), `${advancedRows[2].slice(1).join(" | ")} · esperado ${homeExpected.join(" | ")}`);

const noMetricCards = !container.includes("grid-cols-4") && (container.match(/rounded-md border/g) ?? []).length === 0;
check("Sin tarjetas individuales por métrica", noMetricCards);

// Caso con prórroga: se añade una columna OT y sus puntos, sin tocar el motor.
const overtime: Game = JSON.parse(JSON.stringify(played));
overtime.boxScore!.away.quarters.push(7);
overtime.boxScore!.home.quarters.push(5);
overtime.awayScore = (overtime.awayScore ?? 0) + 7;
overtime.homeScore = (overtime.homeScore ?? 0) + 5;
overtime.boxScore!.away.points = overtime.awayScore;
overtime.boxScore!.home.points = overtime.homeScore;
const overtimeHtml = render(overtime);
const overtimeTable = /<table class="bb-compare-table bb-compare-quarters">([\s\S]*?)<\/table>/.exec(overtimeHtml)?.[1] ?? "";
const overtimeRows = tableRows(overtimeTable);
check("OT aparece solo cuando corresponde", overtimeRows[0].includes("OT") && overtimeRows[0].length === 7 && overtimeRows[0][5] === "OT" && overtimeRows[0][6] === "F", overtimeRows[0].join(" | "));
check("Puntos de OT y F correctos", [overtimeRows[1][5], overtimeRows[1][6]].join("|") === `7|${overtime.awayScore}` && [overtimeRows[2][5], overtimeRows[2][6]].join("|") === `5|${overtime.homeScore}`, `${overtimeRows[1].join(" | ")} / ${overtimeRows[2].join(" | ")}`);

// Sin denominadores disponibles: la celda debe ser «—», nunca 0 inventado.
const empty: Game = JSON.parse(JSON.stringify(played));
empty.boxScore!.away.fga = 0;
empty.boxScore!.away.fta = 0;
empty.boxScore!.away.tov = 0;
empty.boxScore!.away.oreb = 0;
empty.boxScore!.home.reb = 0;
empty.boxScore!.home.oreb = 0;
const emptyHtml = render(empty);
const emptyAdvanced = /<table class="bb-compare-table bb-compare-advanced">([\s\S]*?)<\/table>/.exec(emptyHtml)?.[1] ?? "";
const emptyRows = tableRows(emptyAdvanced);
check("Métrica sin denominador se muestra como «—»", emptyRows[1]?.slice(1).join("|") === "—|—|—|—", emptyRows[1]?.join(" | ") ?? "sin fila");

const css = fs.readFileSync("src/index.css", "utf8");
const compareBlock = /\.bb-compare-table\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
check("La tabla comparativa no fuerza ancho de página", /width:\s*100%/.test(compareBlock) && /max-width:\s*100%/.test(compareBlock) && /table-layout:\s*fixed/.test(compareBlock) && !/min-width:\s*[1-9]/.test(compareBlock), "width 100% · max-width 100% · fixed");
check("La página sigue sin scroll horizontal global", /\.game-detail\s*\{[^}]*overflow-x:\s*hidden/.test(css), "game-detail overflow-x hidden");

console.log(`\nTEAM COMPARISON: ${failures === 0 ? "PASS" : `${failures} FALLOS`}`);
process.exitCode = failures === 0 ? 0 : 1;
