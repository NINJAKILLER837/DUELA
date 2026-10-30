import { Component, useCallback, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import type { Game, LeagueBundle, LeagueSaveMeta, PlayMode, Team, ThemeKey } from "@/types";
import { CreateLeague } from "@/screens/CreateLeague";
import { Exhibition } from "@/screens/Exhibition";
import { Hub } from "@/screens/Hub";
import { LeagueApp } from "@/screens/LeagueApp";
import {
  listLeagues,
  loadAppSettings,
  loadLeague,
  saveAppSettings,
  saveGames as saveGamesToDb,
  saveLeagueBundle,
  saveLeagueMeta,
  saveTeams,
} from "@/persistence/db";

type Route = "hub" | "create" | "exhibition" | "league";
type SaveState = "idle" | "saving" | "saved" | "error";

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("DUELA render error", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center p-6" style={{ background: "#0b0b0a", color: "#f3f1e9" }}>
          <div className="max-w-md rounded-2xl border border-white/20 p-6 text-center">
            <div className="mb-2 text-[0.6rem] font-bold uppercase tracking-[0.16em] opacity-50">DUELA · error de interfaz</div>
            <h1 className="text-2xl font-extrabold tracking-[-0.04em]">La pantalla no pudo renderizarse.</h1>
            <p className="mt-2 text-xs leading-relaxed opacity-60">{this.state.error.message}</p>
            <button type="button" className="mt-4 rounded-lg bg-[#f3f1e9] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#0b0b0a]" onClick={() => window.location.reload()}>Recargar la aplicación</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function DuelaApp() {
  const [route, setRoute] = useState<Route>("hub");
  const [createMode, setCreateMode] = useState<PlayMode>("manager");
  const [bundle, setBundle] = useState<LeagueBundle | null>(null);
  const [leagues, setLeagues] = useState<LeagueSaveMeta[]>([]);
  const [theme, setTheme] = useState<ThemeKey>("tinta");
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [openingLeagueId, setOpeningLeagueId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const lastOpenedRef = useRef<string | undefined>(undefined);

  const applyTheme = useCallback((next: ThemeKey, persist = true) => {
    setTheme(next);
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next === "papel" || next === "contraste" ? "light" : "dark";
    if (persist) {
      void saveAppSettings({ theme: next, lastOpenedLeagueId: lastOpenedRef.current }).catch(() => undefined);
    }
  }, []);

  const refreshLeagues = useCallback(async (): Promise<LeagueSaveMeta[]> => {
    try {
      const data = await listLeagues();
      setLeagues(data);
      setBootError(null);
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudieron leer las ligas locales.";
      setBootError(message);
      return [];
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const settings = await loadAppSettings();
        if (cancelled) return;
        lastOpenedRef.current = settings.lastOpenedLeagueId;
        setTheme(settings.theme);
        document.documentElement.dataset.theme = settings.theme;
        document.documentElement.style.colorScheme = settings.theme === "papel" || settings.theme === "contraste" ? "light" : "dark";
      } catch (error) {
        if (!cancelled) setBootError(error instanceof Error ? error.message : "No se pudo abrir el almacenamiento local.");
      }
      const data = await refreshLeagues();
      if (!cancelled) {
        if (!data.length && !bootError) setBootError(null);
        setBooting(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshLeagues]);

  const openCreate = (mode: PlayMode) => {
    setCreateMode(mode);
    setSaveError(null);
    setRoute("create");
  };

  const openExhibition = () => {
    setSaveError(null);
    setRoute("exhibition");
  };

  const openLeague = async (id: string): Promise<LeagueBundle> => {
    setOpeningLeagueId(id);
    setBootError(null);
    try {
      const loaded = await loadLeague(id);
      setBundle(loaded);
      lastOpenedRef.current = loaded.league.id;
      applyTheme(loaded.league.theme);
      void saveAppSettings({ theme: loaded.league.theme, lastOpenedLeagueId: loaded.league.id }).catch(() => undefined);
      setSaveState("saved");
      setSaveError(null);
      setRoute("league");
      return loaded;
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo abrir la liga.";
      setBootError(message);
      throw error;
    } finally {
      setOpeningLeagueId(null);
    }
  };

  const createBundle = async (created: LeagueBundle) => {
    const prepared: LeagueBundle = {
      ...created,
      league: {
        ...created.league,
        gamesPlayed: 0,
        gamesTotal: created.games.length,
        playerCount: created.players.length,
      },
    };
    try {
      await saveLeagueBundle(prepared);
      setBundle(prepared);
      lastOpenedRef.current = prepared.league.id;
      applyTheme(prepared.league.theme);
      setSaveState("saved");
      setSaveError(null);
      setRoute("league");
      void refreshLeagues();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo guardar la nueva liga.";
      setSaveError(message);
      throw new Error(message);
    }
  };

  const updateBundleLeague = (current: LeagueBundle, changes: Partial<LeagueBundle["league"]>, teams = current.teams): LeagueBundle => ({
    ...current,
    league: { ...current.league, ...changes, updatedAt: Date.now() },
    teams,
  });

  const handleSaveGames = async (games: Game[]) => {
    if (!bundle) throw new Error("No hay una liga activa para guardar.");
    const incoming = new Map(games.map((game) => [game.id, game]));
    const mergedGames = bundle.games.map((game) => incoming.get(game.id) ?? game);
    const next = updateBundleLeague(bundle, {
      gamesPlayed: mergedGames.filter((game) => game.played).length,
      gamesTotal: mergedGames.length,
      playerCount: bundle.players.length,
    });
    next.games = mergedGames;
    setBundle(next);
    setSaveState("saving");
    setSaveError(null);
    setLeagues((previous) => previous.map((league) => league.id === next.league.id ? { ...league, updatedAt: Date.now(), progress: next.league.gamesTotal ? Math.round(((next.league.gamesPlayed ?? 0) / next.league.gamesTotal) * 100) : 0 } : league));
    try {
      await saveGamesToDb(games, next.league);
      setSaveState("saved");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudieron guardar los resultados.";
      setSaveError(message);
      setSaveState("error");
      throw error;
    }
  };

  const handleUpdateTeam = async (team: Team) => {
    if (!bundle) throw new Error("No hay una liga activa.");
    const teams = bundle.teams.map((item) => item.id === team.id ? team : item);
    const next = { ...bundle, teams, league: { ...bundle.league, updatedAt: Date.now() } };
    setBundle(next);
    setSaveState("saving");
    setSaveError(null);
    try {
      await Promise.all([saveTeams([team]), saveLeagueMeta(next.league)]);
      setSaveState("saved");
    } catch (error) {
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : "No se pudo guardar el equipo.");
      throw error;
    }
  };

  const handleChangePlayMode = async (mode: PlayMode) => {
    if (!bundle) return;
    const teams = bundle.teams.map((team) => ({ ...team, aiControlled: mode === "spectator" || team.id !== bundle.league.userTeamId }));
    const next = updateBundleLeague(bundle, { playMode: mode }, teams);
    setBundle(next);
    setSaveState("saving");
    setSaveError(null);
    try {
      await Promise.all([saveLeagueMeta(next.league), saveTeams(teams)]);
      setSaveState("saved");
    } catch (error) {
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : "No se pudo cambiar el modo de juego.");
      throw error;
    }
  };

  const handleChangeTheme = async (nextTheme: ThemeKey) => {
    applyTheme(nextTheme);
    if (!bundle) return;
    const next = updateBundleLeague(bundle, { theme: nextTheme });
    setBundle(next);
    setSaveState("saving");
    setSaveError(null);
    try {
      await saveLeagueMeta(next.league);
      setSaveState("saved");
    } catch (error) {
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : "No se pudo guardar el tema de la liga.");
      throw error;
    }
  };

  const handleRenameLeague = async (name: string) => {
    if (!bundle) return;
    const next = updateBundleLeague(bundle, { name });
    setBundle(next);
    setLeagues((previous) => previous.map((league) => league.id === next.league.id ? { ...league, name } : league));
    setSaveState("saving");
    setSaveError(null);
    try {
      await saveLeagueMeta(next.league);
      setSaveState("saved");
    } catch (error) {
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : "No se pudo renombrar la liga.");
      throw error;
    }
  };

  const handleSaveNow = async () => {
    if (!bundle) return;
    setSaveState("saving");
    setSaveError(null);
    try {
      await Promise.all([saveLeagueMeta(bundle.league), saveTeams(bundle.teams)]);
      setSaveState("saved");
      void refreshLeagues();
    } catch (error) {
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : "No se pudo guardar la liga.");
      throw error;
    }
  };

  const exitLeague = () => {
    lastOpenedRef.current = undefined;
    void saveAppSettings({ theme, lastOpenedLeagueId: undefined }).catch(() => undefined);
    setBundle(null);
    setRoute("hub");
    void refreshLeagues();
  };

  if (route === "league" && bundle) {
    return (
      <LeagueApp
        key={bundle.league.id}
        bundle={bundle}
        savedLeagues={leagues}
        saveState={saveState}
        saveError={saveError}
        clearSaveError={() => setSaveError(null)}
        onSaveGames={handleSaveGames}
        onUpdateTeam={handleUpdateTeam}
        onChangePlayMode={handleChangePlayMode}
        onChangeTheme={handleChangeTheme}
        onRenameLeague={handleRenameLeague}
        onSaveNow={handleSaveNow}
        onExit={exitLeague}
        onOpenLeague={async (id) => { await openLeague(id); }}
      />
    );
  }

  if (route === "create") {
    return (
      <CreateLeague
        initialMode={createMode}
        theme={theme}
        onThemeChange={(nextTheme) => applyTheme(nextTheme)}
        onCancel={() => setRoute("hub")}
        onExhibition={() => setRoute("exhibition")}
        onCreated={createBundle}
      />
    );
  }

  if (route === "exhibition") {
    return (
      <Exhibition
        leagues={leagues}
        onLoadLeague={(id) => loadLeague(id)}
        onBack={() => { setRoute("hub"); void refreshLeagues(); }}
      />
    );
  }

  return (
    <Hub
      leagues={leagues}
      booting={booting}
      bootError={bootError}
      openingLeagueId={openingLeagueId}
      theme={theme}
      onCreate={openCreate}
      onExhibition={openExhibition}
      onOpenLeague={(id) => void openLeague(id).catch(() => undefined)}
      onRefresh={() => void refreshLeagues()}
      onThemeChange={(nextTheme) => applyTheme(nextTheme)}
    />
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <DuelaApp />
    </AppErrorBoundary>
  );
}
