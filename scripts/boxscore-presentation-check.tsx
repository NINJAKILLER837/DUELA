import fs from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import type { Game, PlayerGameStats } from "../src/types";
import { createLeagueBundle } from "../src/game/generate";
import { simulateGame } from "../src/game/simulate";
import { GameDetailScreen } from "../src/screens/GameDetail";

const EXPECTED_COLUMNS = ["name", "pos", "mp", "fg", "3p", "ft", "orb", "trb", "ast", "tov", "stl", "blk", "ba", "pf", "pts", "pm", "gmsc"];
const EXPECTED_HEADERS = ["Name", "Pos", "MP", "FG", "3P", "FT", "ORB", "TRB", "AST", "TOV", "STL", "BLK", "BA", "PF", "PTS", "+/-", "GmSc"];

const bundle = createLeagueBundle({ name: "Presentación", mode: "fictional", playMode: "manager", theme: "tinta", userTeamId: "nyk", seed: "PRESENTATION-AUDIT" });
const game = bundle.games.find((item) => item.round === 1)!;
const home = bundle.teams.find((team) => team.id === game.homeTeamId)!;
const away = bundle.teams.find((team) => team.id === game.awayTeamId)!;
const homeRoster = bundle.players.filter((player) => player.teamId === home.id);
const awayRoster = bundle.players.filter((player) => player.teamId === away.id);
const simulated: Game = JSON.parse(JSON.stringify(simulateGame(game, home, away, homeRoster, awayRoster)));
const html = renderToStaticMarkup(
  <GameDetailScreen game={simulated} homeTeam={home} awayTeam={away} onClose={() => undefined} homeRoster={homeRoster} awayRoster={awayRoster} homeRecord="0-0" awayRecord="0–0" season="2026-27" competition="NBA Ficticia" />,
);

let failures = 0;
function check(label: string, condition: boolean, detail = ""): void {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}${detail ? ` · ${detail}` : ""}`);
  if (!condition) failures++;
}

function strip(htmlText: string): string {
  return htmlText.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').trim();
}

function gameScore(line: PlayerGameStats): number {
  return line.points + 0.4 * line.fgm - 0.7 * line.fga - 0.4 * (line.fta - line.ftm) + 0.7 * line.oreb + 0.3 * line.dreb + line.stl + 0.7 * line.ast + 0.7 * line.blk - 0.4 * line.pf - line.tov;
}

function cellsOf(rowHtml: string): { key: string; text: string; colspan: number }[] {
  return [...rowHtml.matchAll(/<(th|td)([^>]*)data-col="([^"]+)"([^>]*)>([\s\S]*?)<\/\1>/g)].map((match) => {
    const attrs = `${match[2]} ${match[4]}`;
    const colspan = Number(/colSpan="(\d+)"/.exec(attrs)?.[1] ?? 1);
    return { key: match[3], text: strip(match[5]), colspan };
  });
}

const tables = [...html.matchAll(/<table class="bb-table bb-boxscore-table">([\s\S]*?)<\/table>/g)].map((match) => match[1]);
check("Hay dos tablas separadas, una por equipo", tables.length === 2, `${tables.length} tablas`);

for (const [teamIndex, table] of tables.entries()) {
  const box = teamIndex === 0 ? simulated.boxScore!.away : simulated.boxScore!.home;
  const roster = teamIndex === 0 ? awayRoster : homeRoster;
  const headerMatches = [...table.matchAll(/<th scope="col" data-col="([^"]+)"[^>]*>([^<]*)<\/th>/g)];
  check(`Tabla ${teamIndex + 1}: 17 encabezados`, headerMatches.length === 17, String(headerMatches.length));
  check(`Tabla ${teamIndex + 1}: 17 columnas declaradas en colgroup`, (table.match(/<col /g) ?? []).length === 17, `${(table.match(/<col /g) ?? []).length} col`);
  check(`Tabla ${teamIndex + 1}: orden exacto de encabezados`, headerMatches.map((match) => match[1]).join("|") === EXPECTED_COLUMNS.join("|") && headerMatches.map((match) => match[2]).join("|") === EXPECTED_HEADERS.join("|"), headerMatches.map((match) => match[2]).join(" | "));

  const groups = [...table.matchAll(/<th scope="colgroup" colSpan="(\d+)">([^<]*)<\/th>/g)].map((match) => [Number(match[1]), strip(match[2])] as const);
  check(`Tabla ${teamIndex + 1}: separa titulares, suplentes y DNP`, groups.some(([cols, label]) => cols === 17 && label === "Titulares") && groups.some(([cols, label]) => cols === 17 && label === "Suplentes") && groups.some(([cols, label]) => cols === 17 && label === "No participaron"), groups.map(([cols, label]) => `${label}:${cols}`).join(", "));

  const playerRows = [...table.matchAll(/<tr data-player-id="[^"]+">([\s\S]*?)<\/tr>/g)].map((match) => cellsOf(match[1]));
  check(`Tabla ${teamIndex + 1}: participantes renderizados`, playerRows.length >= 5 && playerRows.length <= 10, String(playerRows.length));
  check(`Tabla ${teamIndex + 1}: cada fila tiene 17 columnas`, playerRows.every((cells) => cells.length === 17 && cells.map((cell) => cell.key).join("|") === EXPECTED_COLUMNS.join("|")));

  const first = box.players[0];
  const firstCells = playerRows[0];
  const firstExpected: Record<string, string> = {
    name: first.name,
    pos: first.position,
    mp: String(first.minutes),
    fg: `${first.fgm}-${first.fga}`,
    "3p": `${first.tpm}-${first.tpa}`,
    ft: `${first.ftm}-${first.fta}`,
    orb: String(first.oreb),
    trb: String(first.reb),
    ast: String(first.ast),
    tov: String(first.tov),
    stl: String(first.stl),
    blk: String(first.blk),
    ba: "—",
    pf: String(first.pf),
    pts: String(first.points),
    pm: "—",
    gmsc: gameScore(first).toFixed(1),
  };
  const mappingErrors = firstCells.filter((cell) => cell.text !== firstExpected[cell.key]).map((cell) => `${cell.key}: "${cell.text}" != "${firstExpected[cell.key]}"`);
  check(`Tabla ${teamIndex + 1}: cada estadística cae en su columna`, mappingErrors.length === 0, mappingErrors.join(" | ") || `${first.name}: ${EXPECTED_HEADERS.join(" · ")}`);

  const participantIds = new Set(box.players.map((line) => line.playerId));
  const dnpPlayers = roster.filter((player) => !participantIds.has(player.id));
  const dnpRows = [...table.matchAll(/<tr class="bb-dnp-row" data-dnp="true">([\s\S]*?)<\/tr>/g)].map((match) => cellsOf(match[1]));
  check(`Tabla ${teamIndex + 1}: DNP sin duplicar participantes`, dnpRows.length === dnpPlayers.length && dnpRows.every((cells) => cells.reduce((sum, cell) => sum + cell.colspan, 0) === 17), `${dnpRows.length} DNP`);

  const totalRow = /<tr class="bb-total-row">([\s\S]*?)<\/tr>/.exec(table)?.[1] ?? "";
  const totalCells = cellsOf(totalRow);
  check(`Tabla ${teamIndex + 1}: fila Total con 17 columnas`, totalCells.length === 17 && totalCells.reduce((sum, cell) => sum + cell.colspan, 0) === 17, totalCells.map((cell) => cell.key).join("|"));
  const totalMapping: Record<string, string> = {
    name: "Total", pos: "", mp: String(box.players.reduce((sum, line) => sum + line.minutes, 0)),
    fg: `${box.fgm}-${box.fga}`, "3p": `${box.tpm}-${box.tpa}`, ft: `${box.ftm}-${box.fta}`,
    orb: String(box.oreb), trb: String(box.reb), ast: String(box.ast), tov: String(box.tov), stl: String(box.stl), blk: String(box.blk),
    ba: "—", pf: String(box.pf), pts: String(box.points), pm: "", gmsc: "",
  };
  const totalErrors = totalCells.filter((cell) => cell.text !== totalMapping[cell.key]).map((cell) => `${cell.key}: "${cell.text}" != "${totalMapping[cell.key]}"`);
  check(`Tabla ${teamIndex + 1}: Total mapeado a sus columnas`, totalErrors.length === 0, totalErrors.join(" | ") || "Total cuadra");

  const pctRow = /<tr class="bb-pct-row">([\s\S]*?)<\/tr>/.exec(table)?.[1] ?? "";
  const pctCells = cellsOf(pctRow);
  const pctWidth = pctCells.reduce((sum, cell) => sum + cell.colspan, 0);
  check(`Tabla ${teamIndex + 1}: Percentages conserva las 17 columnas`, pctCells.length === 17 && pctWidth === 17 && pctCells.map((cell) => cell.key).join("|") === EXPECTED_COLUMNS.join("|"), `${pctCells.length} celdas / ${pctWidth} columnas`);
  check(`Tabla ${teamIndex + 1}: FG/3P/FT bajo sus encabezados`, pctCells.find((cell) => cell.key === "fg")?.text === (box.fga ? `${((box.fgm / box.fga) * 100).toFixed(1)}%` : "—") && pctCells.find((cell) => cell.key === "3p")?.text === (box.tpa ? `${((box.tpm / box.tpa) * 100).toFixed(1)}%` : "—") && pctCells.find((cell) => cell.key === "ft")?.text === (box.fta ? `${((box.ftm / box.fta) * 100).toFixed(1)}%` : "—"));
}

const css = fs.readFileSync("src/index.css", "utf8");
const pageBlock = /\.game-detail\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
const scrollBlock = /\.bb-scroll\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
check("La capa de página bloquea el eje horizontal", /overflow-x:\s*hidden/.test(pageBlock) && /max-width:\s*100%/.test(pageBlock), "game-detail");
check("El scroll horizontal queda dentro del panel de la tabla", /width:\s*100%/.test(scrollBlock) && /max-width:\s*100%/.test(scrollBlock) && /overflow-x:\s*auto/.test(scrollBlock) && /overflow-y:\s*hidden/.test(scrollBlock), "bb-scroll");
check("La tabla usa layout fijo y un ancho mínimo controlado", /\.bb-boxscore-table\s*\{[^}]*table-layout:\s*fixed/.test(css) && /\.bb-boxscore-table\s*\{[^}]*min-width:\s*760px/.test(css), "760 px en móvil; scroll solo en el panel");

const legacyWidths = (css.match(/\.bb-boxscore-table[^}]*min-width:\s*(920|980|900)px/g) ?? []).length;
check("No quedan anchos antiguos de 900/920/980 px", legacyWidths === 0, `${legacyWidths} reglas antiguas`);

const awayNames = new Set(simulated.boxScore!.away.players.map((line) => line.name));
const homeNames = new Set(simulated.boxScore!.home.players.map((line) => line.name));
const awayOnlyInAwayTable = [...awayNames].every((name) => tables[0].includes(name)) && [...homeNames].every((name) => tables[1].includes(name));
const noCrossTeamStats = [...awayNames].every((name) => !tables[1].includes(name)) && [...homeNames].every((name) => !tables[0].includes(name));
check("La página no mezcla tablas de equipos", awayOnlyInAwayTable && noCrossTeamStats, `${awayNames.size} visitantes y ${homeNames.size} locales en su propia tabla`);

console.log(`\nBOXSCORE PRESENTATION: ${failures === 0 ? "PASS" : `${failures} FALLOS`}`);
console.log("Nota: esta comprobación es de DOM renderizado y CSS; el entorno no dispone de navegador para un screenshot a 360 px.");
process.exitCode = failures === 0 ? 0 : 1;
