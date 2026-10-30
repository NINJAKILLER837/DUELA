import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import type { Game } from "../src/types";
import { createLeagueBundle } from "../src/game/generate";
import { simulateGame } from "../src/game/simulate";
import { findUserNext } from "./render-utils";
import { CreateLeague } from "../src/screens/CreateLeague";
import { Exhibition } from "../src/screens/Exhibition";
import { Hub } from "../src/screens/Hub";
import { LeagueApp } from "../src/screens/LeagueApp";
import { PlayersPage, RosterPage, TeamsPage } from "../src/screens/LeaguePages";
import { DataPage, GamesPage, SavesPage, SchedulePage, SettingsPage, StandingsPage, StatsPage } from "../src/screens/LeagueSystem";
import type { LeagueView } from "../src/screens/leagueTypes";
import { PlayerDrawer, TeamDrawer } from "../src/components/details";
import { GameDetailScreen } from "../src/screens/GameDetail";

const bundle = createLeagueBundle({
  name: "Render smoke",
  mode: "fictional",
  playMode: "manager",
  theme: "tinta",
  userTeamId: "nyk",
  seed: "RENDER-SMOKE",
});
const userTeam = bundle.teams.find((team) => team.id === bundle.league.userTeamId)!;
const firstGame = findUserNext(bundle.games, userTeam.id);
let selectedGame: Game | null = null;
if (firstGame) {
  const home = bundle.teams.find((team) => team.id === firstGame.homeTeamId)!;
  const away = bundle.teams.find((team) => team.id === firstGame.awayTeamId)!;
  selectedGame = simulateGame(
    firstGame,
    home,
    away,
    bundle.players.filter((player) => player.teamId === home.id),
    bundle.players.filter((player) => player.teamId === away.id),
  );
  bundle.games = bundle.games.map((game) => game.id === selectedGame!.id ? selectedGame! : game);
  bundle.league.gamesPlayed = 1;
}

const noop = () => undefined;
const noopAsync = async () => undefined;
const view: LeagueView = {
  bundle,
  userTeam,
  onNavigate: noop,
  simulateRound: noopAsync,
  playNextGame: noopAsync,
  simulateBusy: false,
  onUpdateTeam: noopAsync,
  onChangePlayMode: noopAsync,
  onChangeTheme: noopAsync,
  onRenameLeague: noopAsync,
  onSaveNow: noopAsync,
  onExit: noop,
  onOpenLeague: noopAsync,
  savedLeagues: [],
  saveState: "saved",
  saveError: null,
  clearSaveError: noop,
  onViewGame: noop,
  currentRoundNumber: bundle.games.find((game) => !game.played)?.round ?? 1,
};

const checks: { label: string; node: ReactElement }[] = [
  { label: "Hub", node: <Hub leagues={[]} booting={false} bootError={null} openingLeagueId={null} theme="tinta" onCreate={noop} onExhibition={noop} onOpenLeague={noop} onRefresh={noop} onThemeChange={noop} /> },
  { label: "Crear liga", node: <CreateLeague initialMode="manager" theme="papel" onThemeChange={noop} onCancel={noop} onExhibition={noop} onCreated={noopAsync} /> },
  { label: "Exhibición", node: <Exhibition leagues={[]} onLoadLeague={async () => bundle} onBack={noop} /> },
  { label: "Liga · shell + resumen", node: <LeagueApp bundle={bundle} savedLeagues={[]} saveState="saved" saveError={null} clearSaveError={noop} onSaveGames={noopAsync} onUpdateTeam={noopAsync} onChangePlayMode={noopAsync} onChangeTheme={noopAsync} onRenameLeague={noopAsync} onSaveNow={noopAsync} onExit={noop} onOpenLeague={noopAsync} /> },
  { label: "Equipos", node: <TeamsPage view={view} /> },
  { label: "Plantilla", node: <RosterPage view={view} /> },
  { label: "Jugadores", node: <PlayersPage view={view} /> },
  { label: "Calendario", node: <SchedulePage view={view} /> },
  { label: "Clasificación", node: <StandingsPage view={view} /> },
  { label: "Partidos", node: <GamesPage view={view} /> },
  { label: "Estadísticas", node: <StatsPage view={view} /> },
  { label: "Guardado", node: <SavesPage view={view} /> },
  { label: "Ajustes", node: <SettingsPage view={view} /> },
  { label: "Datos", node: <DataPage view={view} /> },
  { label: "Ficha jugador", node: <PlayerDrawer player={bundle.players[0]} team={bundle.teams[0]} onClose={noop} /> },
  { label: "Ficha equipo", node: <TeamDrawer team={userTeam} players={bundle.players.filter((player) => player.teamId === userTeam.id)} onClose={noop} onSelectPlayer={noop} record="0–0" /> },
];

let failed = 0;
for (const check of checks) {
  try {
    const html = renderToStaticMarkup(check.node);
    const pass = html.length > 200;
    console.log(`${pass ? "PASS" : "FAIL"}  Render ${check.label} (${html.length} caracteres)`);
    if (!pass) failed++;
  } catch (error) {
    console.log(`FAIL  Render ${check.label}: ${error instanceof Error ? error.message : String(error)}`);
    failed++;
  }
}

if (selectedGame) {
  const home = bundle.teams.find((team) => team.id === selectedGame!.homeTeamId)!;
  const away = bundle.teams.find((team) => team.id === selectedGame!.awayTeamId)!;
  const fromStorage = JSON.parse(JSON.stringify(selectedGame)) as Game;
  const homeRoster = bundle.players.filter((player) => player.teamId === home.id);
  const awayRoster = bundle.players.filter((player) => player.teamId === away.id);
  const dnp = homeRoster.filter((player) => !fromStorage.boxScore!.home.players.some((line) => line.playerId === player.id));
  try {
    const html = renderToStaticMarkup(
      <GameDetailScreen game={fromStorage} homeTeam={home} awayTeam={away} leagueName="Render smoke" onClose={noop} homeRoster={homeRoster} awayRoster={awayRoster} homeRecord="12–8" awayRecord="9–11" season="2026-27" competition="NBA Ficticia · Liga regular" />,
    );
    const showsBothTeams = html.includes(home.abbreviation) && html.includes(away.abbreviation);
    const showsStats = html.includes("Name") && html.includes("MP") && html.includes("PTS") && html.includes("TRB") && html.includes("TOV") && html.includes("BA") && html.includes("GmSc") && html.includes("+/-") && html.includes("Percentages");
    const showsPlayers = fromStorage.boxScore!.home.players.every((line) => html.includes(line.name)) && fromStorage.boxScore!.away.players.every((line) => html.includes(line.name));
    const showsScoreboard = html.includes("Parciales") && html.includes("récord 12–8") && html.includes("récord 9–11") && html.includes("Final") && html.includes("2026-27") && html.includes("NBA Ficticia · Liga regular");
    const showsTotals = html.includes("Total") && html.includes("Percentages") && html.includes("Totales cuadran");
    const showsDnp = dnp.length > 0 && dnp.every((player) => html.includes(player.name)) && html.includes("DNP - Coach");
    const firstLine = fromStorage.boxScore!.home.players.find((line) => line.minutes > 0)!;
    const expectedGs = firstLine.points + 0.4 * firstLine.fgm - 0.7 * firstLine.fga - 0.4 * (firstLine.fta - firstLine.ftm) + 0.7 * firstLine.oreb + 0.3 * (firstLine.dreb ?? (firstLine.reb - firstLine.oreb)) + firstLine.stl + 0.7 * firstLine.ast + 0.7 * firstLine.blk - 0.4 * firstLine.pf - firstLine.tov;
    const showsGameScore = html.includes(expectedGs.toFixed(1));
    const pass = html.length > 200 && showsBothTeams && showsStats && showsPlayers && showsScoreboard && showsTotals && showsDnp && showsGameScore;
    console.log(`${pass ? "PASS" : "FAIL"}  Render boxscore BBGM (2 equipos/participantes ${showsPlayers} · períodos/récord ${showsScoreboard} · columnas ${showsStats} · totales ${showsTotals} · ${dnp.length} DNP ${showsDnp} · GS ${showsGameScore})`);
    if (!pass) failed++;
    const advancedPass = html.includes("Cuadro de equipo") && html.includes("Parciales") && html.includes("Avanzadas") && html.includes("eFG%") && html.includes("TOV%") && html.includes("ORB%") && html.includes("FT/FGA") && html.includes("Derivadas del boxscore") && !html.includes("Avanzadas de equipo");
    console.log(`${advancedPass ? "PASS" : "FAIL"}  Render cuadro compacto de parciales y avanzadas`);
    if (!advancedPass) failed++;
    const pbpPass = html.includes("Play-by-play") && fromStorage.playByPlay!.some((event) => html.includes(event.clock));
    console.log(`${pbpPass ? "PASS" : "FAIL"}  Render play-by-play`);
    if (!pbpPass) failed++;
  } catch (error) {
    console.log(`FAIL  Render pantalla boxscore: ${error instanceof Error ? error.message : String(error)}`);
    failed++;
  }
}

const pendingGame = findUserNext(bundle.games, userTeam.id);
if (pendingGame) {
  const home = bundle.teams.find((team) => team.id === pendingGame.homeTeamId)!;
  const away = bundle.teams.find((team) => team.id === pendingGame.awayTeamId)!;
  try {
    const html = renderToStaticMarkup(<GameDetailScreen game={pendingGame} homeTeam={home} awayTeam={away} onClose={noop} onSimulate={noop} />);
    const pass = html.includes("Todavía no hay boxscore") && html.includes("Simular este partido");
    console.log(`${pass ? "PASS" : "FAIL"}  Render partido pendiente con acción de simular`);
    if (!pass) failed++;
  } catch (error) {
    console.log(`FAIL  Render partido pendiente: ${error instanceof Error ? error.message : String(error)}`);
    failed++;
  }
}

if (selectedGame) {
  const home = bundle.teams.find((team) => team.id === selectedGame!.homeTeamId)!;
  const away = bundle.teams.find((team) => team.id === selectedGame!.awayTeamId)!;
  try {
    const missing = { ...selectedGame, boxScore: undefined, playByPlay: undefined };
    const html = renderToStaticMarkup(<GameDetailScreen game={missing} homeTeam={home} awayTeam={away} onClose={noop} />);
    const pass = html.includes("Resultado sin boxscore guardado") && html.includes("Volver a partidos");
    console.log(`${pass ? "PASS" : "FAIL"}  Render resultado sin boxscore con estado explícito`);
    if (!pass) failed++;
  } catch (error) {
    console.log(`FAIL  Render resultado sin boxscore: ${error instanceof Error ? error.message : String(error)}`);
    failed++;
  }
}

// ── NBA Real 2026-27 + boxscore real ─────────────────────────────────────
const realBundle = createLeagueBundle({
  name: "Render real 2026-27",
  mode: "real",
  playMode: "manager",
  theme: "tinta",
  userTeamId: "nyk",
  seed: "RENDER-REAL-2026",
});
const realSizes = realBundle.teams.map((team) => realBundle.players.filter((player) => player.teamId === team.id).length);
const realTwoWay = realBundle.players.filter((player) => player.contractType === "two-way").length;
const realRosterPass = realBundle.teams.length === 30 && realBundle.players.length === 522 && realSizes.every((size) => size >= 16 && size <= 18) && realTwoWay === 89 && new Set(realBundle.players.map((player) => player.name)).size === 522;
console.log(`${realRosterPass ? "PASS" : "FAIL"}  Plantillas reales 2026-27 (30 equipos · 522 fichas · ${Math.min(...realSizes)}–${Math.max(...realSizes)} · ${realTwoWay} two-way)`);
if (!realRosterPass) failed++;

const realGame = realBundle.games.find((game) => game.round === 1)!;
const realHome = realBundle.teams.find((team) => team.id === realGame.homeTeamId)!;
const realAway = realBundle.teams.find((team) => team.id === realGame.awayTeamId)!;
const realHomeRoster = realBundle.players.filter((player) => player.teamId === realHome.id);
const realAwayRoster = realBundle.players.filter((player) => player.teamId === realAway.id);
const realSim = simulateGame(realGame, realHome, realAway, realHomeRoster, realAwayRoster);
const realDnp = realHomeRoster.filter((player) => !realSim.boxScore!.home.players.some((line) => line.playerId === player.id));
try {
  const html = renderToStaticMarkup(<GameDetailScreen game={realSim} homeTeam={realHome} awayTeam={realAway} onClose={noop} homeRoster={realHomeRoster} awayRoster={realAwayRoster} homeRecord="1–0" awayRecord="0–1" season="2026-27" competition="NBA Real · Liga regular" />);
  const allParticipants = realSim.boxScore!.home.players.every((line) => html.includes(line.name));
  const allDnp = realDnp.every((player) => html.includes(player.name));
  const realPass = allParticipants && allDnp && html.includes("two-way") && html.includes("récord 1–0") && html.includes("NBA Real · Liga regular") && realDnp.length === realHomeRoster.length - realSim.boxScore!.home.players.length;
  console.log(`${realPass ? "PASS" : "FAIL"}  Boxscore real con ${realSim.boxScore!.home.players.length + realSim.boxScore!.away.players.length} participantes, ${realDnp.length} DNP locales y two-way`);
  if (!realPass) failed++;
} catch (error) {
  console.log(`FAIL  Render boxscore real: ${error instanceof Error ? error.message : String(error)}`);
  failed++;
}

console.log(`\nRENDER SMOKE: ${failed === 0 ? "PASS" : `${failed} FALLOS`}`);
process.exitCode = failed ? 1 : 0;
