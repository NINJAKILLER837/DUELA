import { useEffect, useMemo, useState } from "react";
import type { Game, LeagueBundle, LeagueSaveMeta, PlayMode, Player, Team, ThemeKey } from "@/types";
import { PlayerDrawer } from "@/components/details";
import { Icon, ModeTag, OvrBadge, PlayerAvatar, StatBlock, TeamMark } from "@/components/ui";
import { GameDetailScreen } from "./GameDetail";
import { formatGameDate, shortGameDate } from "@/game/schedule";
import { currentRound, formatRecord, gameResultLabel, nextGameForTeam, playedGames, rosterOf, standings, teamAverageOvr, teamRecord } from "@/game/selectors";
import { simulateGame } from "@/game/simulate";
import { cn } from "@/utils/cn";
import { NAV_ITEMS, PAGE_TITLES, type LeagueActions, type LeaguePage, type LeagueView } from "./leagueTypes";
import { PlayersPage, RosterPage, TeamsPage } from "./LeaguePages";
import { DataPage, GamesPage, SavesPage, SchedulePage, SettingsPage, StandingsPage, StatsPage } from "./LeagueSystem";

export interface LeagueAppProps {
  bundle: LeagueBundle;
  savedLeagues: LeagueSaveMeta[];
  saveState: "idle" | "saving" | "saved" | "error";
  saveError: string | null;
  clearSaveError: () => void;
  onSaveGames: (games: Game[]) => Promise<void>;
  onUpdateTeam: (team: Team) => Promise<void>;
  onChangePlayMode: (mode: PlayMode) => Promise<void>;
  onChangeTheme: (theme: ThemeKey) => Promise<void>;
  onRenameLeague: (name: string) => Promise<void>;
  onSaveNow: () => Promise<void>;
  onExit: () => void;
  onOpenLeague: (id: string) => Promise<void>;
}

export function LeagueApp(props: LeagueAppProps) {
  const { bundle, savedLeagues, saveState, saveError, clearSaveError, onSaveGames, onUpdateTeam, onChangePlayMode, onChangeTheme, onRenameLeague, onSaveNow, onExit, onOpenLeague } = props;
  const [page, setPage] = useState<LeaguePage>("dashboard");
  const [busy, setBusy] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [lastResult, setLastResult] = useState<Game | null>(null);
  const userTeam = bundle.teams.find((team) => team.id === bundle.league.userTeamId) ?? bundle.teams[0];

  const teamsById = useMemo(() => new Map(bundle.teams.map((team) => [team.id, team])), [bundle.teams]);
  const playersByTeam = useMemo(() => {
    const map = new Map<string, Player[]>();
    for (const player of bundle.players) {
      const list = map.get(player.teamId) ?? [];
      list.push(player);
      map.set(player.teamId, list);
    }
    return map;
  }, [bundle.players]);

  const roundNumber = currentRound(bundle.games);
  const playedCount = bundle.games.filter((game) => game.played).length;
  const progress = bundle.games.length ? Math.round((playedCount / bundle.games.length) * 100) : 0;

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

  useEffect(() => {
    if (!selectedGame) return;
    const handlePop = () => setSelectedGame(null);
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, [selectedGame]);

  const navigate = (next: LeaguePage) => {
    setPage(next);
    setDrawerOpen(false);
  };

  const runSimulation = async (targets: Game[], openUserGame = true): Promise<Game[]> => {
    const unplayed = targets.filter((game) => !game.played);
    if (!unplayed.length) {
      setNotice("Este partido ya se jugó. Abre su boxscore para ver las estadísticas guardadas.");
      return [];
    }
    setBusy(true);
    setSimulationError(null);
    setNotice(null);
    await new Promise((resolve) => window.setTimeout(resolve, 70));
    try {
      const results: Game[] = [];
      for (const target of unplayed) {
        const home = teamsById.get(target.homeTeamId);
        const away = teamsById.get(target.awayTeamId);
        if (!home || !away) throw new Error("El calendario contiene una referencia de equipo rota.");
        const homePlayers = playersByTeam.get(home.id) ?? [];
        const awayPlayers = playersByTeam.get(away.id) ?? [];
        results.push(simulateGame(target, home, away, homePlayers, awayPlayers));
      }
      await onSaveGames(results);
      const userResult = results.find((game) => game.homeTeamId === userTeam.id || game.awayTeamId === userTeam.id);
      const shownResult = userResult ?? results[0];
      if (shownResult) setLastResult(shownResult);
      setNotice(`${results.length} ${results.length === 1 ? "partido simulado" : "partidos simulados"} con el motor de Fase 1. Boxscore disponible y guardado en IndexedDB.`);
      if (openUserGame && shownResult) setSelectedGame(shownResult);
      return results;
    } catch (caught) {
      setSimulationError(caught instanceof Error ? caught.message : "La simulación no pudo completarse.");
      return [];
    } finally {
      setBusy(false);
    }
  };

  const simulateRound = async () => {
    const roundToSimulate = bundle.games.filter((game) => !game.played).sort((a, b) => a.round - b.round)[0]?.round;
    if (!roundToSimulate) {
      setNotice("La temporada regular ya está completa. No hay más jornadas en Fase 1.");
      return;
    }
    await runSimulation(bundle.games.filter((game) => game.round === roundToSimulate), true);
  };

  const playNextGame = async () => {
    const next = nextGameForTeam(bundle.games, userTeam.id);
    if (!next) {
      setNotice("Tu equipo ya completó sus 29 partidos de la temporada regular.");
      return;
    }
    await runSimulation([next], true);
  };

  const viewGame = (game: Game) => {
    setSelectedGame(game);
    window.history.pushState({ duelaGame: game.id }, "");
  };

  const closeGame = () => {
    setSelectedGame(null);
    if (typeof window !== "undefined" && window.history.state?.duelaGame) window.history.back();
  };

  const simulateSingle = async (game: Game) => {
    const results = await runSimulation([game], false);
    const simulated = results.find((item) => item.id === game.id);
    if (simulated) setSelectedGame({ ...simulated });
  };

  const actions: LeagueActions = {
    onNavigate: navigate,
    simulateRound,
    playNextGame,
    simulateBusy: busy,
    onUpdateTeam,
    onChangePlayMode,
    onChangeTheme,
    onRenameLeague,
    onSaveNow,
    onExit,
    onOpenLeague,
    savedLeagues,
    saveState,
    saveError,
    clearSaveError,
    onViewGame: viewGame,
    currentRoundNumber: roundNumber,
  };
  const view: LeagueView = { bundle, userTeam, ...actions };
  const selectedHome = selectedGame ? teamsById.get(selectedGame.homeTeamId) : undefined;
  const selectedAway = selectedGame ? teamsById.get(selectedGame.awayTeamId) : undefined;
  const selectedHomeRoster = selectedGame ? playersByTeam.get(selectedGame.homeTeamId) ?? [] : [];
  const selectedAwayRoster = selectedGame ? playersByTeam.get(selectedGame.awayTeamId) ?? [] : [];
  const selectedHomeRecord = selectedGame ? formatRecord(teamRecord(selectedGame.homeTeamId, bundle.games)) : "—";
  const selectedAwayRecord = selectedGame ? formatRecord(teamRecord(selectedGame.awayTeamId, bundle.games)) : "—";
  const isManager = bundle.league.playMode === "manager";
  const simulationLabel = isManager ? "Jugar partido" : "Avanzar jornada";

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[244px_1fr]">
      <aside className="hidden border-r border-[var(--line)] bg-[var(--surface)] lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="flex h-16 items-center justify-between border-b border-[var(--line)] px-4">
          <button type="button" className="flex items-center gap-2" onClick={onExit} title="Volver al inicio">
            <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-[var(--inverse)] text-[var(--inverse-ink)]"><Icon name="games" size={17} /></span>
            <span className="display text-lg leading-none">DUELA</span>
          </button>
          <span className="rounded border border-[var(--line)] px-1.5 py-0.5 text-[0.5rem] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">F1</span>
        </div>
        <div className="px-3 pt-3">
          <button type="button" className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3 text-left transition hover:border-[var(--line-strong)]" onClick={() => navigate("dashboard")}>
            <div className="flex items-center gap-2.5">
              <TeamMark team={userTeam} size={36} />
              <div className="min-w-0 flex-1"><div className="truncate text-xs font-bold">{userTeam.city}</div><div className="truncate text-[0.62rem] text-[var(--muted)]">{userTeam.name}</div></div>
              <ModeTag mode={bundle.league.playMode} />
            </div>
            <div className="mt-2.5 flex items-center justify-between text-[0.58rem] text-[var(--muted)]"><span>{formatRecord(teamRecord(userTeam.id, bundle.games))} · J{roundNumber || "29"}</span><span>{progress}%</span></div>
            <div className="meter mt-1.5"><span style={{ width: `${Math.max(2, progress)}%` }} /></div>
          </button>
        </div>
        <nav className="mt-2 flex-1 overflow-y-auto px-2 pb-3">
          {(["Liga", "Competición", "Sistema"] as const).map((group) => (
            <div key={group} className="mt-3">
              <div className="px-2 pb-1.5 text-[0.52rem] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">{group}</div>
              {NAV_ITEMS.filter((item) => item.group === group).map((item) => (
                <button key={item.key} type="button" onClick={() => navigate(item.key)} className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[0.72rem] font-semibold transition", page === item.key ? "bg-[var(--inverse)] text-[var(--inverse-ink)]" : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]")}>
                  <Icon name={item.icon} size={16} />
                  <span className="flex-1">{item.label}</span>
                  {item.key === "games" && playedCount > 0 && <span className={cn("rounded px-1 py-0.5 text-[0.5rem] tabular", page === item.key ? "bg-black/15" : "bg-[var(--surface-3)]")}>{playedCount}</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="border-t border-[var(--line)] p-3">
          <button type="button" className="btn w-full justify-between" onClick={onExit}>Salir al inicio <Icon name="arrow-right" size={14} /></button>
          <div className="mt-2 flex items-center justify-between text-[0.55rem] text-[var(--muted)]"><span className="flex items-center gap-1"><span className={cn("h-1.5 w-1.5 rounded-full", saveState === "error" ? "bg-[var(--danger)]" : saveState === "saving" ? "animate-pulse bg-[var(--muted)]" : "bg-[var(--good)]")} />{saveState === "error" ? "Error de guardado" : saveState === "saving" ? "Guardando…" : "Guardado local"}</span><span>v1 · Fase 1</span></div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between gap-2 px-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-2">
              <button type="button" className="icon-btn lg:hidden" onClick={() => setDrawerOpen(true)} aria-label="Abrir menú de liga"><Icon name="menu" size={18} /></button>
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-1.5 text-[0.52rem] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
                  <span className="hidden sm:inline">{PAGE_TITLES[page].eyebrow} · {bundle.league.name}</span>
                  <span className="truncate sm:hidden">{userTeam.abbreviation} · J{roundNumber || 29}/29 · {bundle.league.playMode === "manager" ? "Manager" : "Espectador"}</span>
                </div>
                <div className="truncate text-sm font-bold">{PAGE_TITLES[page].title}</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="hidden md:block"><ModeTag mode={bundle.league.playMode} /></span>
              <span className="hidden rounded-full border border-[var(--line)] px-2 py-1 text-[0.56rem] font-bold uppercase tracking-wide text-[var(--muted)] lg:flex">J{roundNumber || 29} / 29</span>
              <button type="button" className={cn("icon-btn hidden sm:inline-flex", saveState === "error" && "border-[var(--danger)]")} onClick={() => navigate("saves")} aria-label="Estado del guardado"><Icon name="database" size={16} /></button>
              <button type="button" className="btn btn-solid btn-sm" onClick={() => void (isManager ? playNextGame() : simulateRound())} disabled={busy}>
                {busy ? <Icon name="refresh" size={14} className="animate-spin" /> : <Icon name="play" size={13} />}
                <span className="hidden sm:inline">{busy ? "Simulando…" : simulationLabel}</span>
                <span className="sm:hidden">{busy ? "…" : isManager ? "Jugar" : "Avanzar"}</span>
              </button>
            </div>
          </div>
          {busy && <div className="progress-sim h-[2px]"><span /></div>}
        </header>

        <main className="mx-auto max-w-[1250px] px-3 pb-28 pt-4 sm:px-5 sm:pt-5 lg:pb-10">
          {lastResult && !selectedGame && (() => {
            const home = teamsById.get(lastResult.homeTeamId);
            const away = teamsById.get(lastResult.awayTeamId);
            if (!home || !away) return null;
            return (
              <button type="button" className="mb-3 flex min-h-[46px] w-full items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-left transition hover:border-[var(--line-strong)]" onClick={() => viewGame(lastResult)} aria-label="Reabrir el último boxscore">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--line-strong)]"><Icon name="stats" size={13} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.52rem] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">Último boxscore</span>
                  <span className="block truncate text-[0.7rem] font-semibold">{away.abbreviation} {lastResult.awayScore} – {lastResult.homeScore} {home.abbreviation} · J{lastResult.round}</span>
                </span>
                <span className="chip shrink-0">Ver boxscore</span>
                <Icon name="chevron-right" size={13} className="shrink-0 text-[var(--muted)]" />
              </button>
            );
          })()}
          {(notice || simulationError || saveError) && (
            <div className="mb-3 space-y-2">
              {notice && <div className="flex items-start gap-2 rounded-xl border border-[var(--line-strong)] bg-[var(--surface-2)] p-3 text-[0.7rem]"><Icon name="check" size={15} className="mt-0.5 shrink-0 text-[var(--good)]" /><span className="flex-1">{notice}</span><button type="button" className="text-[var(--muted)]" onClick={() => setNotice(null)} aria-label="Cerrar aviso"><Icon name="close" size={14} /></button></div>}
              {simulationError && <div className="flex items-start gap-2 rounded-xl border border-[var(--line-strong)] p-3 text-[0.7rem]"><Icon name="alert" size={15} className="mt-0.5 shrink-0" /><span className="flex-1">{simulationError}</span><button type="button" className="text-[var(--muted)]" onClick={() => setSimulationError(null)} aria-label="Cerrar error"><Icon name="close" size={14} /></button></div>}
              {saveError && <div className="flex items-start gap-2 rounded-xl border border-[var(--line-strong)] p-3 text-[0.7rem]"><Icon name="database" size={15} className="mt-0.5 shrink-0" /><span className="flex-1">{saveError}</span><button type="button" className="text-[var(--muted)]" onClick={clearSaveError} aria-label="Cerrar error de guardado"><Icon name="close" size={14} /></button></div>}
            </div>
          )}

          {page === "dashboard" && <Dashboard view={view} isManager={isManager} roundNumber={roundNumber} progress={progress} />}
          {page === "teams" && <TeamsPage view={view} />}
          {page === "roster" && <RosterPage view={view} />}
          {page === "players" && <PlayersPage view={view} />}
          {page === "schedule" && <SchedulePage view={view} />}
          {page === "standings" && <StandingsPage view={view} />}
          {page === "games" && <GamesPage view={view} />}
          {page === "stats" && <StatsPage view={view} />}
          {page === "saves" && <SavesPage view={view} />}
          {page === "settings" && <SettingsPage view={view} />}
          {page === "data" && <DataPage view={view} />}
        </main>

        <nav className="mobile-tabbar fixed bottom-0 left-0 right-0 z-30 border-t border-[var(--line)] bg-[color-mix(in_srgb,var(--bg)_96%,transparent)] backdrop-blur-xl lg:hidden" aria-label="Navegación principal de liga">
          <div className="grid grid-cols-5">
            {[
              { page: "dashboard" as const, label: "Inicio", icon: "home" as const },
              { page: "teams" as const, label: "Equipos", icon: "teams" as const },
              { page: "schedule" as const, label: "Calendario", icon: "calendar" as const },
              { page: "games" as const, label: "Partidos", icon: "games" as const },
            ].map((item) => (
              <button key={item.page} type="button" onClick={() => navigate(item.page)} aria-current={page === item.page ? "page" : undefined} className={cn("relative flex min-h-[58px] flex-col items-center justify-center gap-1 text-[0.52rem] font-bold uppercase tracking-wide transition", page === item.page ? "text-[var(--ink)]" : "text-[var(--muted)]")}>
                {page === item.page && <span className="absolute top-0 h-[2px] w-8 rounded-full bg-[var(--ink)]" />}
                <Icon name={item.icon} size={19} />
                {item.label}
                {item.page === "games" && playedCount > 0 && <span className="absolute right-3 top-1.5 min-w-[15px] rounded-full bg-[var(--inverse)] px-1 text-[0.45rem] font-bold leading-[15px] text-[var(--inverse-ink)]">{playedCount > 99 ? "99+" : playedCount}</span>}
              </button>
            ))}
            <button type="button" onClick={() => setDrawerOpen(true)} className="relative flex min-h-[58px] flex-col items-center justify-center gap-1 text-[0.52rem] font-bold uppercase tracking-wide text-[var(--muted)]" aria-label="Abrir más opciones de liga">
              <Icon name="menu" size={19} /> Más
            </button>
          </div>
        </nav>
      </div>

      {drawerOpen && (
        <div className="drawer-backdrop lg:hidden" role="presentation" onClick={() => setDrawerOpen(false)}>
          <div className="safe-bottom absolute left-0 top-0 h-full w-[86%] max-w-[330px] overflow-y-auto border-r border-[var(--line)] bg-[var(--bg)] p-4" role="dialog" aria-modal="true" aria-label="Menú de liga" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><TeamMark team={userTeam} size={36} /><div><div className="text-xs font-bold">{userTeam.city} {userTeam.name}</div><div className="text-[0.58rem] text-[var(--muted)]">{bundle.league.name}</div></div></div>
              <button type="button" className="icon-btn" onClick={() => setDrawerOpen(false)} aria-label="Cerrar menú"><Icon name="close" size={17} /></button>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5"><ModeTag mode={bundle.league.playMode} /><span className="chip">{bundle.league.mode === "real" ? "NBA Real" : "NBA Ficticia"}</span><span className="chip">J{roundNumber || 29}</span><span className="chip">{formatRecord(teamRecord(userTeam.id, bundle.games))}</span></div>
            <div className="mt-4 space-y-4">
              {(["Liga", "Competición", "Sistema"] as const).map((group) => (
                <div key={group}>
                  <div className="mb-1 text-[0.52rem] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">{group}</div>
                  {NAV_ITEMS.filter((item) => item.group === group).map((item) => (
                    <button key={item.key} type="button" className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-xs font-semibold", page === item.key ? "bg-[var(--inverse)] text-[var(--inverse-ink)]" : "text-[var(--muted)]")} onClick={() => navigate(item.key)}><Icon name={item.icon} size={16} /><span className="flex-1">{item.label}</span><Icon name="chevron-right" size={13} /></button>
                  ))}
                </div>
              ))}
            </div>
            <button type="button" className="btn mt-5 w-full justify-between" onClick={() => { setDrawerOpen(false); onExit(); }}>Salir al inicio <Icon name="arrow-right" size={14} /></button>
          </div>
        </div>
      )}

      {selectedGame && selectedHome && selectedAway && (
        <GameDetailScreen
          game={selectedGame}
          homeTeam={selectedHome}
          awayTeam={selectedAway}
          leagueName={bundle.league.name}
          eyebrow={bundle.league.mode === "real" ? "NBA Real" : "NBA Ficticia"}
          onClose={closeGame}
          onSimulate={selectedGame.played ? undefined : () => void simulateSingle(selectedGame)}
          simulating={busy}
          homeRoster={selectedHomeRoster}
          awayRoster={selectedAwayRoster}
          homeRecord={selectedHomeRecord}
          awayRecord={selectedAwayRecord}
          season={bundle.league.season}
          competition={bundle.league.mode === "real" ? "NBA Real · Liga regular" : "NBA Ficticia · Liga regular"}
        />
      )}
    </div>
  );
}

function Dashboard({ view, isManager, roundNumber, progress }: { view: LeagueView; isManager: boolean; roundNumber: number; progress: number }) {
  const { bundle, userTeam, onNavigate, playNextGame, simulateRound, simulateBusy, onViewGame } = view;
  const legacyRealRoster = bundle.league.mode === "real" && bundle.players.filter((player) => player.real).length < 500;
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const record = teamRecord(userTeam.id, bundle.games);
  const conferenceRows = standings(bundle.teams, bundle.games)[userTeam.conference];
  const rank = conferenceRows.find((row) => row.team.id === userTeam.id)?.rank ?? 0;
  const nextGame = nextGameForTeam(bundle.games, userTeam.id);
  const opponent = nextGame ? bundle.teams.find((team) => team.id === (nextGame.homeTeamId === userTeam.id ? nextGame.awayTeamId : nextGame.homeTeamId)) : undefined;
  const roster = rosterOf(bundle.players, userTeam.id);
  const avg = teamAverageOvr(bundle.players, userTeam.id);
  const recent = playedGames(bundle.games).filter((game) => game.homeTeamId === userTeam.id || game.awayTeamId === userTeam.id).slice(0, 4);
  const nextGames = bundle.games.filter((game) => !game.played && (game.homeTeamId === userTeam.id || game.awayTeamId === userTeam.id)).sort((a, b) => a.round - b.round).slice(0, 4);
  const roundGamesLeft = bundle.games.filter((game) => game.round === roundNumber && !game.played).length;
  const seasonFinished = !nextGame && bundle.games.every((game) => game.played);
  const leagueResults = playedGames(bundle.games).filter((game) => game.homeTeamId !== userTeam.id && game.awayTeamId !== userTeam.id).slice(0, 4);

  return (
    <div className="screen-fade space-y-3">
      <section className="grid gap-3 xl:grid-cols-[1.5fr_1fr]">
        <div className="card relative overflow-hidden p-4 sm:p-5">
          <div className="pointer-events-none absolute -bottom-14 -right-6 select-none text-[9rem] font-black leading-none tracking-[-0.1em] text-[var(--surface-2)] sm:text-[12rem]">{userTeam.abbreviation}</div>
          <div className="relative">
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip chip-solid">{bundle.league.mode === "real" ? "NBA REAL" : "NBA FICTICIA"}</span>
              <ModeTag mode={bundle.league.playMode} />
              {bundle.league.mode === "fictional" && <span className="chip">Semilla {bundle.league.seed}</span>}
            </div>
            <div className="mt-4 flex items-start gap-3">
              <TeamMark team={userTeam} size={56} />
              <div className="min-w-0">
                <div className="overline">Tu franquicia</div>
                <h1 className="mt-0.5 text-[2rem] font-extrabold leading-[0.92] tracking-[-0.055em] sm:text-[2.8rem]">{userTeam.city}<br /><span className="text-[var(--muted)]">{userTeam.name}</span></h1>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              {recent.length ? [...recent].reverse().map((game) => <span key={game.id} className={cn("flex h-6 w-6 items-center justify-center rounded-full text-[0.58rem] font-bold", gameResultLabel(game, userTeam.id) === "G" ? "bg-[var(--inverse)] text-[var(--inverse-ink)]" : "border border-[var(--line-strong)] text-[var(--muted)]")}>{gameResultLabel(game, userTeam.id)}</span>) : <span className="text-[0.65rem] text-[var(--muted)]">Sin partidos jugados todavía</span>}
              <span className="ml-1 text-[0.6rem] text-[var(--muted)]">últimos {recent.length || 0}</span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatBlock label="Récord" value={formatRecord(record)} hint={`${record.pointsFor ? (record.pointsFor / record.played).toFixed(1) : "0.0"} PPP`} inverse />
              <StatBlock label="Conferencia" value={`#${rank || "—"}`} hint={`${userTeam.conference} · Fase 1`} />
              <StatBlock label="Media OVR" value={avg} hint={`${roster.length} jugadores`} />
              <StatBlock label="Jornada" value={`${roundNumber || 29}/29`} hint={`${progress}% de liga`} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="btn btn-solid" onClick={() => void (isManager ? playNextGame() : simulateRound())} disabled={simulateBusy || seasonFinished}>
                <Icon name="play" size={14} /> {simulateBusy ? "Simulando…" : isManager ? "Jugar próximo partido" : "Avanzar jornada"}
              </button>
              <button type="button" className="btn" onClick={() => onNavigate("roster")}>Gestionar plantilla</button>
              {isManager && roundGamesLeft > 0 && (
                <button type="button" className="btn btn-quiet" onClick={() => void simulateRound()} disabled={simulateBusy}>Completar jornada ({roundGamesLeft})</button>
              )}
            </div>
            {bundle.league.mode === "real" && (
              <button type="button" className="mt-3 flex w-full items-center gap-2 rounded-lg border border-dashed border-[var(--line-strong)] px-2.5 py-2 text-left text-[0.6rem] leading-relaxed text-[var(--muted)] transition hover:text-[var(--ink)]" onClick={() => onNavigate("data")}>
                <Icon name="info" size={13} className="shrink-0" />
                <span className="flex-1">{legacyRealRoster ? "Esta liga conserva el snapshot real con el que se creó. Las nuevas ligas reales usan plantillas 2026-27; no se migra de forma destructiva. Consulta Datos y fuentes." : "Plantillas reales 2026-27 con corte 28/10/2026 y contratos two-way identificados. Procedencia y campos pendientes, en Datos y fuentes."}</span>
                <Icon name="arrow-right" size={12} className="shrink-0" />
              </button>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {!isManager && (
            <div className="card-inverse p-4">
              <div className="flex items-center gap-2 text-[0.62rem] font-bold uppercase tracking-[0.13em] opacity-60"><Icon name="eye" size={14} /> Modo espectador activo</div>
              <p className="mt-1.5 text-[0.72rem] leading-relaxed opacity-70">La IA gestiona las 30 franquicias. Tú observas. Al avanzar una jornada se simulan los 15 partidos y se guarda el box score.</p>
              <button type="button" className="btn btn-sm mt-3 border-current text-current hover:bg-current/10" onClick={() => onNavigate("settings")}>Ver configuración del modo</button>
            </div>
          )}
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div className="overline">Próximo partido</div>
              {nextGame && <span className="chip">J{nextGame.round}</span>}
            </div>
            {nextGame && opponent ? (
              <>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="min-w-0"><div className="truncate text-sm font-bold">{nextGame.homeTeamId === userTeam.id ? "En casa" : "Visitante"}</div><div className="text-[0.6rem] text-[var(--muted)]">{formatGameDate(nextGame.day)}</div></div>
                  <div className="flex items-center gap-2">
                    <TeamMark team={userTeam} size={33} />
                    <span className="text-[0.58rem] font-bold text-[var(--muted)]">VS</span>
                    <TeamMark team={opponent} size={33} outline />
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2">
                  <div><div className="text-xs font-semibold">{opponent.city} {opponent.name}</div><div className="text-[0.58rem] text-[var(--muted)]">{formatRecord(teamRecord(opponent.id, bundle.games))} · OVR {teamAverageOvr(bundle.players, opponent.id)}</div></div>
                  <button type="button" className="btn btn-sm" onClick={() => void playNextGame()} disabled={simulateBusy}><Icon name="play" size={12} /> Simular</button>
                </div>
                <button type="button" className="mt-2 w-full text-center text-[0.6rem] font-semibold text-[var(--muted)] transition hover:text-[var(--ink)]" onClick={() => onNavigate("schedule")}>Ver calendario completo →</button>
              </>
            ) : (
              <div className="py-6 text-center">
                <Icon name="trophy" size={22} className="mx-auto text-[var(--muted)]" />
                <p className="mt-2 text-xs font-semibold">{seasonFinished ? "Temporada regular completada" : "Sin próximo partido disponible"}</p>
                <p className="mt-1 text-[0.6rem] leading-relaxed text-[var(--muted)]">{seasonFinished ? "La Fase 1 termina aquí. Playoffs y premios pertenecen a una fase posterior." : "Revisa el calendario o la configuración de la liga."}</p>
              </div>
            )}
          </div>
          <div className="card p-4">
            <div className="flex items-center justify-between"><div className="overline">Ritmo de la liga</div><span className="text-[0.6rem] text-[var(--muted)]">{progress}%</span></div>
            <div className="mt-2 meter"><span style={{ width: `${Math.max(2, progress)}%` }} /></div>
            <div className="mt-2.5 flex items-center justify-between text-[0.6rem] text-[var(--muted)]"><span>{bundle.games.filter((game) => game.played).length} de {bundle.games.length} partidos</span><span>29 jornadas</span></div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3"><div><div className="overline">Vestuario</div><h2 className="text-sm font-bold">Líderes del equipo</h2></div><button type="button" className="btn btn-sm btn-quiet" onClick={() => onNavigate("roster")}>Ver todos</button></div>
          <div className="p-2">
            {roster.slice(0, 5).map((player, index) => (
              <button type="button" key={player.id} className="row-card flex items-center gap-2.5 border-transparent bg-transparent px-2 py-2 hover:bg-[var(--surface-2)]" onClick={() => setSelectedPlayer(player)}>
                <span className="w-4 text-center text-[0.58rem] tabular text-[var(--muted)]">{String(index + 1).padStart(2, "0")}</span>
                <PlayerAvatar player={player} size={30} />
                <span className="min-w-0 flex-1"><span className="block truncate text-[0.72rem] font-semibold">{player.name}</span><span className="block text-[0.55rem] text-[var(--muted)]">{player.position} · {player.age} años · {player.archetype}</span></span>
                <OvrBadge ovr={player.ovr} pot={player.pot} compact />
              </button>
            ))}
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3"><div><div className="overline">Conferencia {userTeam.conference}</div><h2 className="text-sm font-bold">Clasificación</h2></div><button type="button" className="btn btn-sm btn-quiet" onClick={() => onNavigate("standings")}>Completa</button></div>
          <div>
            {conferenceRows.slice(0, 6).map((row) => (
              <div key={row.team.id} className={cn("flex items-center gap-2 border-b border-[var(--line)] px-3 py-2 last:border-0", row.team.id === userTeam.id && "bg-[var(--surface-2)]")}>
                <span className="w-4 text-[0.58rem] tabular text-[var(--muted)]">{row.rank}</span>
                <TeamMark team={row.team} size={24} outline={row.team.id !== userTeam.id} />
                <span className="min-w-0 flex-1 truncate text-[0.68rem] font-semibold">{row.team.city} {row.team.name}</span>
                <span className="text-[0.65rem] tabular font-bold">{formatRecord(row.record)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3"><div><div className="overline">Calendario</div><h2 className="text-sm font-bold">Tus próximos duelos</h2></div><button type="button" className="btn btn-sm btn-quiet" onClick={() => onNavigate("schedule")}>Ver todo</button></div>
          <div>
            {nextGames.length ? nextGames.map((game) => {
              const rival = bundle.teams.find((team) => team.id === (game.homeTeamId === userTeam.id ? game.awayTeamId : game.homeTeamId));
              return rival ? (
                <div key={game.id} className="flex items-center gap-2 border-b border-[var(--line)] px-3 py-2.5 last:border-0">
                  <TeamMark team={rival} size={25} outline />
                  <div className="min-w-0 flex-1"><div className="truncate text-[0.68rem] font-semibold">{rival.city} {rival.name}</div><div className="text-[0.55rem] text-[var(--muted)]">{game.homeTeamId === userTeam.id ? "Local" : "Visitante"} · {shortGameDate(game.day)}</div></div>
                  <span className="chip">J{game.round}</span>
                </div>
              ) : null;
            }) : <p className="px-4 py-8 text-center text-[0.65rem] text-[var(--muted)]">No quedan partidos de temporada regular.</p>}
          </div>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3"><div><div className="overline">Resultados</div><h2 className="text-sm font-bold">Últimos boxscores</h2></div><button type="button" className="btn btn-sm btn-quiet" onClick={() => onNavigate("games")}>Ver todos <Icon name="arrow-right" size={12} /></button></div>
          {recent.length ? (
            <div className="p-2">
              {recent.map((game) => {
                const home = bundle.teams.find((team) => team.id === game.homeTeamId);
                const away = bundle.teams.find((team) => team.id === game.awayTeamId);
                if (!home || !away) return null;
                return (
                  <button type="button" key={game.id} onClick={() => onViewGame(game)} className="row-card mb-1.5 min-h-[46px] border-transparent bg-transparent px-2 py-2 hover:bg-[var(--surface-2)]" aria-label={`Ver boxscore de ${home.city} contra ${away.city}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.56rem] font-bold", gameResultLabel(game, userTeam.id) === "G" ? "bg-[var(--inverse)] text-[var(--inverse-ink)]" : "border border-[var(--line-strong)] text-[var(--muted)]")}>{gameResultLabel(game, userTeam.id)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[0.7rem] font-semibold">{home.abbreviation} {game.homeScore} – {game.awayScore} {away.abbreviation}</div>
                        <div className="text-[0.55rem] text-[var(--muted)]">J{game.round} · {shortGameDate(game.day)} · {game.boxScore ? `${game.boxScore.home.players.length + game.boxScore.away.players.length} jugadores` : "Sin boxscore"}</div>
                      </div>
                      <span className="flex shrink-0 items-center gap-1 rounded-md border border-[var(--line)] px-1.5 py-1 text-[0.5rem] font-bold uppercase tracking-wide text-[var(--ink-soft)]">Boxscore <Icon name="chevron-right" size={11} /></span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="px-4 py-8 text-center"><p className="text-xs font-semibold">Todavía no hay resultados</p><p className="mt-1 text-[0.62rem] leading-relaxed text-[var(--muted)]">Simula tu primer partido para generar marcador, minutos, boxscore y play-by-play.</p><button type="button" className="btn btn-solid btn-sm mt-3" onClick={() => void (isManager ? playNextGame() : simulateRound())} disabled={simulateBusy}><Icon name="play" size={12} /> Simular ahora</button></div>
          )}
        </div>
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3"><div><div className="overline">Toda la liga</div><h2 className="text-sm font-bold">Boxscores recientes</h2></div><span className="chip">{bundle.games.filter((game) => game.played).length} finales</span></div>
          <div className="p-2">
            {leagueResults.length ? leagueResults.map((game) => {
              const home = bundle.teams.find((team) => team.id === game.homeTeamId);
              const away = bundle.teams.find((team) => team.id === game.awayTeamId);
              if (!home || !away) return null;
              return (
                <button type="button" key={game.id} className="mb-1 flex min-h-[44px] w-full items-center gap-2 rounded-lg border border-transparent px-2 py-2 text-left transition last:mb-0 hover:border-[var(--line)] hover:bg-[var(--surface-2)]" onClick={() => onViewGame(game)} aria-label={`Ver boxscore de ${home.city} contra ${away.city}`}>
                  <span className="flex min-w-0 flex-1 items-center gap-1.5"><TeamMark team={away} size={21} /><span className="truncate text-[0.62rem]">{away.abbreviation}</span><strong className="text-[0.66rem] tabular">{game.awayScore}</strong></span>
                  <span className="text-[0.52rem] uppercase text-[var(--muted)]">final</span>
                  <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5"><strong className="text-[0.66rem] tabular">{game.homeScore}</strong><TeamMark team={home} size={21} outline /><span className="truncate text-[0.62rem]">{home.abbreviation}</span></span>
                  <Icon name="chevron-right" size={12} className="shrink-0 text-[var(--muted)]" />
                </button>
              );
            }) : <p className="px-4 py-6 text-center text-[0.62rem] leading-relaxed text-[var(--muted)]">No hay resultados de otros equipos todavía. Simula una jornada para ver los boxscores de toda la liga.</p>}
            <button type="button" className="btn btn-sm mt-1.5 w-full justify-between" onClick={() => onNavigate("games")}>Ver todos los boxscores <Icon name="arrow-right" size={13} /></button>
          </div>
        </div>
      </section>

      {isManager && roster.length > 0 && (
        <section className="card p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div><div className="overline">Mesa de mando · manager</div><h2 className="mt-0.5 text-sm font-bold">Rotación actual</h2></div>
            <button type="button" className="btn btn-sm" onClick={() => onNavigate("roster")}><Icon name="settings" size={13} /> Ajustar rotación</button>
          </div>
          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {roster.slice(0, 10).map((player, index) => (
              <button type="button" key={player.id} className="min-w-[128px] rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-2 text-left transition hover:border-[var(--line-strong)]" onClick={() => setSelectedPlayer(player)}>
                <div className="text-[0.5rem] font-bold uppercase tracking-wide text-[var(--muted)]">{index < 5 ? `Titular ${index + 1}` : `Banquillo ${index - 4}`}</div>
                <div className="mt-1 truncate text-[0.68rem] font-semibold">{player.name}</div>
                <div className="mt-0.5 flex items-center justify-between text-[0.55rem] text-[var(--muted)]"><span>{player.position} · {player.ovr} OVR</span><span>{userTeam.rotationMinutes?.[player.id] ?? (index < 5 ? 36 : 13)}′</span></div>
              </button>
            ))}
          </div>
        </section>
      )}

      {selectedPlayer && <PlayerDrawer player={selectedPlayer} team={userTeam} onClose={() => setSelectedPlayer(null)} />}
    </div>
  );
}


