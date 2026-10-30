import { createFictionalUniverse, createLeagueBundle, createRealUniverse } from "../src/game/generate";
import { auditBundle } from "../src/game/audit";
import { simulateGame } from "../src/game/simulate";

const createdReal = createLeagueBundle({
  name: "Auditoría Real",
  mode: "real",
  playMode: "manager",
  theme: "tinta",
  userTeamId: "nyk",
  seed: "audit-real",
});
const createdFictional = createLeagueBundle({
  name: "Auditoría Ficción",
  mode: "fictional",
  playMode: "manager",
  theme: "tinta",
  userTeamId: "nyk",
  seed: "AUDIT-SEED-2026",
});
const repeatFictional = createFictionalUniverse("AUDIT-SEED-2026", { leagueId: "repeat-seed-check" });

const reports = [
  { label: "NBA Real", bundle: createdReal, samples: 10 },
  { label: "NBA Ficticia", bundle: createdFictional, samples: 10 },
];

let failed = 0;
for (const { label, bundle, samples } of reports) {
  const report = auditBundle(bundle, { simulateSamples: samples });
  const failedChecks = report.checks.filter((check) => check.status === "fail");
  const warnings = report.checks.filter((check) => check.status === "warn");
  console.log(`\n== ${label} ==`);
  console.log(`Equipos: ${report.teams} | Jugadores: ${report.players} | Partidos: ${report.games} | Simulaciones: ${report.simulatedSample}`);
  for (const check of report.checks) {
    console.log(`${check.status === "pass" ? "PASS" : check.status === "warn" ? "WARN" : "FAIL"}  ${check.label}: ${check.detail}`);
  }
  console.log(`Resultado: ${failedChecks.length === 0 ? "sin fallos" : `${failedChecks.length} FALLOS`}${warnings.length ? `, ${warnings.length} advertencias documentadas` : ""}`);
  failed += failedChecks.length;
}

const fictionalNames = createdFictional.players.map((player) => player.name);
const repeatNames = repeatFictional.players.map((player) => player.name);
const reproducibility = fictionalNames.length === repeatNames.length && fictionalNames.every((name, index) => name === repeatNames[index]);
console.log(`\nReproducibilidad de semilla: ${reproducibility ? "PASS" : "FAIL"} (${fictionalNames.length} nombres comparados)`);
if (!reproducibility) failed++;

const realNames = new Set(createdReal.players.map((player) => player.name));
const copiedNames = fictionalNames.filter((name) => realNames.has(name));
console.log(`Nombres ficticios copiados de la base real: ${copiedNames.length === 0 ? "PASS" : `FAIL (${copiedNames.join(", ")})`}`);
if (copiedNames.length) failed++;

const ids = new Set([...createdReal.players, ...createdFictional.players].map((player) => player.id));
console.log(`IDs independientes entre Real y Ficticia: ${ids.size === createdReal.players.length + createdFictional.players.length ? "PASS" : "FAIL"}`);
if (ids.size !== createdReal.players.length + createdFictional.players.length) failed++;

const realTeam = createdReal.teams.find((team) => team.franchiseId === "nyk")!;
const fictionalTeam = createdFictional.team = createdFictional.teams.find((team) => team.franchiseId === "lal")!;
const crossGame = simulateGame(
  {
    id: "cross-audit-game",
    leagueId: "cross-audit",
    round: 1,
    day: "2026-10-20",
    homeTeamId: fictionalTeam.id,
    awayTeamId: realTeam.id,
    played: false,
    seed: 987654331,
  },
  fictionalTeam,
  realTeam,
  createdFictional.players.filter((player) => player.teamId === fictionalTeam.id),
  createdReal.players.filter((player) => player.teamId === realTeam.id),
);
const crossConsistent = Boolean(crossGame.boxScore) && crossGame.boxScore!.home.players.every((line, index, list) => list.findIndex((item) => item.playerId === line.playerId) === index) && crossGame.homeScore !== crossGame.awayScore;
console.log(`Exhibición cruzada real vs ficticia: ${crossConsistent ? "PASS" : "FAIL"} (${crossGame.awayScore}-${crossGame.homeScore})`);
if (!crossConsistent) failed++;

const realSizes = createdReal.teams.map((team) => createdReal.players.filter((player) => player.teamId === team.id).length);
const realTwoWay = createdReal.players.filter((player) => player.contractType === "two-way").length;
const realStandard = createdReal.players.filter((player) => player.contractType !== "two-way").length;
const realNamesUnique = new Set(createdReal.players.map((player) => player.name)).size === createdReal.players.length;
const realLimits = createdReal.teams.every((team) => {
  const roster = createdReal.players.filter((player) => player.teamId === team.id);
  const tw = roster.filter((player) => player.contractType === "two-way").length;
  return roster.length >= 15 && roster.length <= 18 && tw <= 3 && roster.length - tw <= 15;
});
const realOk = createdReal.teams.length === 30 && createdReal.players.length === 522 && realSizes.every((size) => size >= 16 && size <= 18) && realTwoWay === 89 && realStandard === 433 && realNamesUnique && realLimits;
console.log(`NBA Real 2026-27: ${realOk ? "PASS" : "FAIL"} · 30 equipos/522 fichas (${Math.min(...realSizes)}–${Math.max(...realSizes)}), ${realTwoWay} two-way, ${realStandard} estándar, nombres únicos ${realNamesUnique}, límites 15+3 ${realLimits}`);
if (!realOk) failed++;
if (createdFictional.teams.length !== 30 || createdFictional.players.length !== 360) {
  console.log("FAIL  Conteos ficticios esperados (30 equipos / 360 jugadores)");
  failed++;
}

// Motor + presentación: todas las columnas individuales deben sumar los totales del equipo,
// y la plantilla debe poder dividirse en participantes y DNP sin duplicar a nadie.
const realGame = createdReal.games.find((game) => game.round === 1)!;
const realHome = createdReal.teams.find((team) => team.id === realGame.homeTeamId)!;
const realAway = createdReal.teams.find((team) => team.id === realGame.awayTeamId)!;
const realHomeRoster = createdReal.players.filter((player) => player.teamId === realHome.id);
const realAwayRoster = createdReal.players.filter((player) => player.teamId === realAway.id);
const realSim = simulateGame(realGame, realHome, realAway, realHomeRoster, realAwayRoster);
const columnKeys = ["fgm","fga","tpm","tpa","ftm","fta","oreb","reb","ast","stl","blk","tov","pf","points"] as const;
const boxIntegrity = Boolean(realSim.boxScore) && [realSim.boxScore!.home, realSim.boxScore!.away].every((box) => {
  const lines = box.players;
  const unique = new Set(lines.map((line) => line.playerId)).size === lines.length;
  const sums = columnKeys.every((key) => lines.reduce((sum, line) => sum + line[key], 0) === box[key]);
  const defensiveRebounds = lines.reduce((sum, line) => sum + line.dreb, 0) === box.reb - box.oreb;
  const quarterSum = box.quarters.reduce((sum, value) => sum + value, 0) === box.points;
  return unique && sums && defensiveRebounds && quarterSum;
});
const participantsOk = realSim.boxScore!.home.players.length >= 5 && realSim.boxScore!.home.players.length <= 10 && realSim.boxScore!.home.players.every((line) => line.minutes > 0);
const dnpHome = realHomeRoster.filter((player) => !realSim.boxScore!.home.players.some((line) => line.playerId === player.id));
const dnpAway = realAwayRoster.filter((player) => !realSim.boxScore!.away.players.some((line) => line.playerId === player.id));
const dnpOk = dnpHome.length === realHomeRoster.length - 10 && dnpAway.length === realAwayRoster.length - 10 && dnpHome.every((player) => !realSim.boxScore!.home.players.some((line) => line.playerId === player.id));
console.log(`Boxscore real: ${boxIntegrity && participantsOk && dnpOk ? "PASS" : "FAIL"} · columnas suman totales ${boxIntegrity}, 10 participantes con minutos ${participantsOk}, DNP ${dnpHome.length}+${dnpAway.length} sin duplicar ${dnpOk}`);
if (!boxIntegrity || !participantsOk || !dnpOk) failed++;

const finalEvent = realSim.playByPlay?.[realSim.playByPlay.length - 1];
const pbpOk = Boolean(finalEvent) && finalEvent!.homeScore === realSim.homeScore && finalEvent!.awayScore === realSim.awayScore;
console.log(`Play-by-play termina en el marcador final: ${pbpOk ? "PASS" : "FAIL"} (${finalEvent?.awayScore}-${finalEvent?.homeScore})`);
if (!pbpOk) failed++;

// Payload de persistencia (JSON equivalente a IndexedDB, sin navegador): las 522 fichas,
// sus contratos y la plantilla completa deben sobrevivir a la serialización.
const realStored = JSON.parse(JSON.stringify({ ...createdReal, games: createdReal.games.map((game) => game.id === realSim.id ? realSim : game) })) as typeof createdReal;
const storedTwoWay = realStored.players.filter((player) => player.contractType === "two-way").length;
const storedJerseys = realStored.players.filter((player) => !player.jerseyPending).length;
const storedDnp = realHomeRoster.filter((player) => !realStored.games.find((game) => game.id === realSim.id)!.boxScore!.home.players.some((line) => line.playerId === player.id));
const persistOk = realStored.teams.length === 30 && realStored.players.length === 522 && storedTwoWay === 89 && storedJerseys === 521 && storedDnp.length === dnpHome.length && realStored.games.find((game) => game.id === realSim.id)!.boxScore!.home.players.length >= 5 && realStored.games.find((game) => game.id === realSim.id)!.boxScore!.home.players.length <= 10;
console.log(`Payload real serializado (proxy IndexedDB): ${persistOk ? "PASS" : "FAIL"} · ${realStored.players.length} jugadores, ${storedTwoWay} two-way, ${storedJerseys} con dorsal, ${storedDnp.length} DNP recalculables`);
if (!persistOk) failed++;

const sampleScores: number[] = [];
for (const game of createdFictional.games.slice(0, 40)) {
  const home = createdFictional.teams.find((team) => team.id === game.homeTeamId)!;
  const away = createdFictional.teams.find((team) => team.id === game.awayTeamId)!;
  const result = simulateGame(game, home, away,
    createdFictional.players.filter((player) => player.teamId === home.id),
    createdFictional.players.filter((player) => player.teamId === away.id),
  );
  sampleScores.push(result.homeScore ?? 0, result.awayScore ?? 0);
}
const min = Math.min(...sampleScores);
const max = Math.max(...sampleScores);
const average = sampleScores.reduce((sum, value) => sum + value, 0) / sampleScores.length;
const rangesOk = min >= 65 && max <= 165 && average >= 95 && average <= 125;
console.log(`Rango de marcadores (40 partidos ficticios): ${rangesOk ? "PASS" : "FAIL"} · ${min}–${max}, media ${average.toFixed(1)}`);
if (!rangesOk) failed++;

// Persistencia lógica: una jornada completa debe producir 15 boxscores con 10 jugadores por equipo
// y sobrevivir a una serialización JSON equivalente a la escritura en IndexedDB.
const roundOne = createdFictional.games.filter((game) => game.round === 1).map((game) => {
  const home = createdFictional.teams.find((team) => team.id === game.homeTeamId)!;
  const away = createdFictional.teams.find((team) => team.id === game.awayTeamId)!;
  return simulateGame(game, home, away,
    createdFictional.players.filter((player) => player.teamId === home.id),
    createdFictional.players.filter((player) => player.teamId === away.id),
  );
});
const roundStored = JSON.parse(JSON.stringify(roundOne)) as typeof roundOne;
const boxscoresOk = roundStored.length === 15 && roundStored.every((game) =>
  game.played &&
  Boolean(game.boxScore) &&
  game.boxScore!.home.players.length >= 5 && game.boxScore!.home.players.length <= 10 &&
  game.boxScore!.away.players.length >= 5 && game.boxScore!.away.players.length <= 10 &&
  game.boxScore!.home.players.every((line) => Number.isFinite(line.minutes) && Number.isFinite(line.points)) &&
  (game.playByPlay?.length ?? 0) > 0,
);
console.log(`Boxscore completo por jornada + serialización: ${boxscoresOk ? "PASS" : "FAIL"} (${roundStored.length}/15 partidos)`);
if (!boxscoresOk) failed++;

const alreadyPlayed = roundStored[0];
const repeated = simulateGame(alreadyPlayed,
  createdFictional.teams.find((team) => team.id === alreadyPlayed.homeTeamId)!,
  createdFictional.teams.find((team) => team.id === alreadyPlayed.awayTeamId)!,
  createdFictional.players.filter((player) => player.teamId === alreadyPlayed.homeTeamId),
  createdFictional.players.filter((player) => player.teamId === alreadyPlayed.awayTeamId),
);
const noDoubleSimulation = repeated === alreadyPlayed && repeated.homeScore === alreadyPlayed.homeScore;
console.log(`Un partido jugado no se vuelve a simular al abrir su boxscore: ${noDoubleSimulation ? "PASS" : "FAIL"}`);
if (!noDoubleSimulation) failed++;

console.log(`\nRESULTADO FINAL: ${failed === 0 ? "PASS" : `${failed} FALLOS`}`);
console.log("Nota: no se ha probado la UI en navegador real desde este runner; sí se ha validado el motor y la capa de datos pura.");
process.exitCode = failed === 0 ? 0 : 1;
