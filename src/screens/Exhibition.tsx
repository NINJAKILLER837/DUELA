import { useState } from "react";
import type { Game, LeagueBundle, LeagueSaveMeta, Player, Team } from "@/types";
import { createFictionalUniverse, createRealUniverse, randomSeed } from "@/game/generate";
import { hashSeed } from "@/game/random";
import { rosterOf, teamAverageOvr } from "@/game/selectors";
import { simulateGame } from "@/game/simulate";
import { GameDetailScreen } from "./GameDetail";
import { Icon, PlayerAvatar, TeamMark } from "@/components/ui";
import { cn } from "@/utils/cn";

type SourceKey = "nba-real" | "nba-fictional" | `saved:${string}`;
interface SideState { source: SourceKey; teamId: string }
interface ResolvedUniverse { bundle: LeagueBundle; label: string; kindLabel: string; mode: "real" | "fictional" }

interface ExhibitionProps {
  leagues: LeagueSaveMeta[];
  onLoadLeague: (id: string) => Promise<LeagueBundle>;
  onBack: () => void;
}

const REAL_LEAGUE_META = { leagueId: "exhb-real-universe", name: "NBA Real · Exhibición", playMode: "spectator" as const, theme: "tinta" as const };
const FICTION_META = { name: "NBA Ficticia · Exhibición", playMode: "spectator" as const, theme: "tinta" as const };

function TeamPanel({ label, side, universe, universes, onSource, onTeam, players, loading }: {
  label: string;
  side: SideState;
  universe: ResolvedUniverse | null;
  universes: { key: SourceKey; label: string }[];
  onSource: (source: SourceKey) => void;
  onTeam: (teamId: string) => void;
  players: Player[];
  loading: boolean;
}) {
  const team = universe?.bundle.teams.find((item) => item.id === side.teamId) ?? universe?.bundle.teams[0];
  const roster = team ? rosterOf(players, team.id) : [];
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--line)] px-3.5 py-2.5">
        <span className="overline">{label}</span>
        {universe && <span className="chip">{universe.kindLabel}</span>}
      </div>
      <div className="p-3.5">
        <label className="block">
          <span className="label text-[0.58rem] font-bold uppercase tracking-wide text-[var(--muted)]">Universo</span>
          <select className="select text-xs" value={side.source} onChange={(event) => onSource(event.target.value as SourceKey)} disabled={loading}>
            {universes.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select>
        </label>
        <label className="mt-2.5 block">
          <span className="label text-[0.58rem] font-bold uppercase tracking-wide text-[var(--muted)]">Equipo</span>
          <select className="select text-xs" value={team?.id ?? ""} onChange={(event) => onTeam(event.target.value)} disabled={!universe || loading}>
            {(universe?.bundle.teams ?? []).map((item) => <option key={item.id} value={item.id}>{item.city} {item.name}</option>)}
          </select>
        </label>

        {loading ? (
          <div className="py-8 text-center text-xs text-[var(--muted)]"><div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--ink)]" />Cargando equipo…</div>
        ) : team && universe ? (
          <>
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3">
              <TeamMark team={team} size={52} />
              <div className="min-w-0">
                <div className="truncate text-sm font-extrabold tracking-[-0.02em]">{team.city}</div>
                <div className="truncate text-sm font-extrabold tracking-[-0.02em] text-[var(--muted)]">{team.name}</div>
                <div className="mt-1 flex flex-wrap gap-1"><span className="chip">{team.conference}</span><span className="chip">OVR {teamAverageOvr(players, team.id)}</span></div>
              </div>
            </div>
            <div className="mt-3 space-y-1">
              <div className="flex items-center justify-between text-[0.58rem] uppercase tracking-wide text-[var(--muted)]"><span>Jugadores clave</span><span>{players.length} activos</span></div>
              {roster.slice(0, 4).map((player) => (
                <div key={player.id} className="flex items-center gap-2 border-b border-[var(--line)] py-1.5 last:border-0">
                  <PlayerAvatar player={player} size={25} />
                  <span className="min-w-0 flex-1 truncate text-[0.68rem]">{player.name}</span>
                  <span className="chip">{player.position}</span>
                  <span className="w-6 text-right text-xs font-bold tabular">{player.ovr}</span>
                </div>
              ))}
            </div>
            <div className="mt-2.5 rounded-lg border border-dashed border-[var(--line-strong)] p-2 text-[0.58rem] leading-relaxed text-[var(--muted)]">{universe.mode === "real" ? "Plantillas 2026-27 · corte 28/10/2026 · two-way identificados" : "Universo ficticio verificado internamente"} · {universe.bundle.league.name}</div>
          </>
        ) : (
          <div className="py-8 text-center text-xs text-[var(--muted)]">Selecciona un universo para ver la plantilla.</div>
        )}
      </div>
    </div>
  );
}

export function Exhibition({ leagues, onLoadLeague, onBack }: ExhibitionProps) {
  const [realBundle] = useState<LeagueBundle>(() => createRealUniverse({ ...REAL_LEAGUE_META, leagueId: REAL_LEAGUE_META.leagueId }));
  const [seed, setSeed] = useState("EXHIBICION-ARO-26");
  const [appliedSeed, setAppliedSeed] = useState("EXHIBICION-ARO-26");
  const [fictionBundle, setFictionBundle] = useState<LeagueBundle>(() => createFictionalUniverse("EXHIBICION-ARO-26", { ...FICTION_META, leagueId: "exhb-fic-exhibicion-aro-26" }));
  const [savedBundles, setSavedBundles] = useState<Record<string, LeagueBundle>>({});
  const [sideA, setSideA] = useState<SideState>({ source: "nba-real", teamId: realBundle.teams.find((team) => team.franchiseId === "nyk")?.id ?? "" });
  const [sideB, setSideB] = useState<SideState>({ source: "nba-real", teamId: realBundle.teams.find((team) => team.franchiseId === "lal")?.id ?? "" });
  const [loadingSide, setLoadingSide] = useState<"A" | "B" | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ game: Game; home: Team; away: Team; homeRoster: Player[]; awayRoster: Player[] } | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const sourceOptions: { key: SourceKey; label: string }[] = [
    { key: "nba-real", label: "NBA Real" },
    { key: "nba-fictional", label: `NBA Ficticia · ${appliedSeed}` },
    ...leagues.map((league) => ({ key: `saved:${league.id}` as SourceKey, label: `Liga guardada · ${league.name}` })),
  ];

  const resolve = (source: SourceKey): ResolvedUniverse | null => {
    if (source === "nba-real") return { bundle: realBundle, label: "NBA Real", kindLabel: "REAL", mode: "real" };
    if (source === "nba-fictional") return { bundle: fictionBundle, label: "NBA Ficticia", kindLabel: "FICTICIA", mode: "fictional" };
    const bundle = savedBundles[source.slice(6)];
    return bundle ? { bundle, label: bundle.league.name, kindLabel: bundle.league.mode === "real" ? "REAL · GUARDADA" : "FICTICIA · GUARDADA", mode: bundle.league.mode } : null;
  };

  const universeA = resolve(sideA.source);
  const universeB = resolve(sideB.source);
  const playersA = universeA?.bundle.players ?? [];
  const playersB = universeB?.bundle.players ?? [];

  const loadSource = async (side: "A" | "B", source: SourceKey) => {
    setError(null);
    const current = side === "A" ? sideA : sideB;
    const baseUniverse = resolve(source);
    if (baseUniverse) {
      const team = baseUniverse.bundle.teams.find((item) => item.id === current.teamId) ?? baseUniverse.bundle.teams[0];
      const next = { source, teamId: team.id };
      if (side === "A") setSideA(next); else setSideB(next);
      return;
    }
    if (!source.startsWith("saved:")) return;
    const leagueId = source.slice(6);
    setLoadingSide(side);
    try {
      const bundle = await onLoadLeague(leagueId);
      setSavedBundles((previous) => ({ ...previous, [leagueId]: bundle }));
      const firstTeamId = bundle.teams[0]?.id ?? "";
      const next = { source, teamId: firstTeamId };
      if (side === "A") setSideA(next); else setSideB(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo cargar la liga guardada.");
    } finally {
      setLoadingSide(null);
    }
  };

  const changeTeam = (side: "A" | "B", teamId: string) => {
    if (side === "A") setSideA((previous) => ({ ...previous, teamId })); else setSideB((previous) => ({ ...previous, teamId }));
  };

  const regenerate = () => {
    const nextSeed = seed.trim().toUpperCase() || randomSeed();
    const bundle = createFictionalUniverse(nextSeed, { ...FICTION_META, leagueId: `exhb-fic-${nextSeed.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` });
    setFictionBundle(bundle);
    setAppliedSeed(nextSeed);
    const remap = (previous: SideState, fallbackFranchise: string): SideState => {
      if (previous.source !== "nba-fictional") return previous;
      const previousTeam = fictionBundle.teams.find((team) => team.id === previous.teamId);
      const franchiseId = previousTeam?.franchiseId ?? fallbackFranchise;
      const nextTeam = bundle.teams.find((team) => team.franchiseId === franchiseId) ?? bundle.teams[0];
      return { ...previous, teamId: nextTeam.id };
    };
    setSideA((previous) => remap(previous, "nyk"));
    setSideB((previous) => remap(previous, "lal"));
  };

  const swapSides = () => {
    setSideA(sideB);
    setSideB(sideA);
  };

  const preset = (kind: "real-real" | "fic-fic" | "fic-real") => {
    setError(null);
    const realNyk = realBundle.teams.find((team) => team.franchiseId === "nyk") ?? realBundle.teams[0];
    const realLal = realBundle.teams.find((team) => team.franchiseId === "lal") ?? realBundle.teams[1];
    const ficA = fictionBundle.teams.find((team) => team.franchiseId === "bos") ?? fictionBundle.teams[0];
    const ficB = fictionBundle.teams.find((team) => team.franchiseId === "gsw") ?? fictionBundle.teams[1];
    if (kind === "real-real") {
      setSideA({ source: "nba-real", teamId: realNyk.id });
      setSideB({ source: "nba-real", teamId: realLal.id });
    } else if (kind === "fic-fic") {
      setSideA({ source: "nba-fictional", teamId: ficA.id });
      setSideB({ source: "nba-fictional", teamId: ficB.id });
    } else {
      setSideA({ source: "nba-fictional", teamId: ficA.id });
      setSideB({ source: "nba-real", teamId: realLal.id });
    }
  };

  const simulate = () => {
    if (!universeA || !universeB) {
      setError("Espera a que los dos universos estén cargados.");
      return;
    }
    const away = universeA.bundle.teams.find((team) => team.id === sideA.teamId) ?? universeA.bundle.teams[0];
    const home = universeB.bundle.teams.find((team) => team.id === sideB.teamId) ?? universeB.bundle.teams[0];
    const awayPlayers = universeA.bundle.players.filter((player) => player.teamId === away.id);
    const homePlayers = universeB.bundle.players.filter((player) => player.teamId === home.id);
    if (awayPlayers.length < 5 || homePlayers.length < 5) {
      setError("Una de las plantillas no tiene suficientes jugadores para simular.");
      return;
    }
    setSimulating(true);
    setError(null);
    window.setTimeout(() => {
      try {
        const game: Game = {
          id: `exhibition-${Date.now()}`,
          leagueId: "exhibition",
          round: 1,
          day: new Date().toISOString().slice(0, 10),
          homeTeamId: home.id,
          awayTeamId: away.id,
          played: false,
          seed: hashSeed(`${appliedSeed}-${away.id}-${home.id}-${Math.random()}`),
        };
        const simulated = simulateGame(game, home, away, homePlayers, awayPlayers);
        setResult({ game: simulated, home, away, homeRoster: homePlayers, awayRoster: awayPlayers });
        setDetailOpen(true);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "La simulación falló.");
      } finally {
        setSimulating(false);
      }
    }, 90);
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1160px] items-center justify-between px-4 sm:px-6">
          <button type="button" className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)] transition hover:text-[var(--ink)]" onClick={onBack}><Icon name="arrow-left" size={17} /> Inicio</button>
          <div className="flex items-center gap-2"><span className="display text-lg leading-none">DUELA</span><span className="chip chip-solid">Exhibición</span></div>
          <span className="hidden text-[0.6rem] uppercase tracking-[0.12em] text-[var(--muted)] sm:block">Sin impacto en tus ligas</span>
        </div>
      </header>

      <main className="mx-auto max-w-[1160px] px-3 pb-20 pt-5 sm:px-6 sm:pt-8">
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <div className="overline">Partido único · antes de crear una liga</div>
            <h1 className="mt-1 text-[2rem] font-extrabold leading-none tracking-[-0.055em] sm:text-[2.8rem]">Exhibición.</h1>
            <p className="mt-2 max-w-lg text-xs leading-relaxed text-[var(--muted)]">Elige un universo para cada lado. Puedes cruzar equipos reales con ficticios, incluso de universos guardados distintos. El resultado no se escribe en tus ligas.</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className="btn btn-sm" onClick={() => preset("real-real")}>NYK vs LAL</button>
            <button type="button" className="btn btn-sm" onClick={() => preset("fic-fic")}>Ficticio vs ficticio</button>
            <button type="button" className="btn btn-sm" onClick={() => preset("fic-real")}>Ficticio vs real</button>
          </div>
        </div>

        <div className="relative grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
          <TeamPanel label="Visitante · lado A" side={sideA} universe={universeA} universes={sourceOptions} onSource={(source) => void loadSource("A", source)} onTeam={(teamId) => changeTeam("A", teamId)} players={playersA} loading={loadingSide === "A"} />
          <div className="flex items-center justify-center gap-3 md:flex-col md:px-1">
            <span className="display text-3xl text-[var(--muted)] md:text-4xl">VS</span>
            <button type="button" className="icon-btn" onClick={swapSides} aria-label="Intercambiar lados" title="Intercambiar lados"><Icon name="swap" size={16} /></button>
          </div>
          <TeamPanel label="Local · lado B" side={sideB} universe={universeB} universes={sourceOptions} onSource={(source) => void loadSource("B", source)} onTeam={(teamId) => changeTeam("B", teamId)} players={playersB} loading={loadingSide === "B"} />
        </div>

        <div className="card mt-3 p-3.5 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <label className="block w-full sm:max-w-sm">
              <span className="label text-[0.58rem] font-bold uppercase tracking-wide text-[var(--muted)]">Semilla del universo ficticio de exhibición</span>
              <div className="flex gap-1.5">
                <input className="field text-xs uppercase" value={seed} maxLength={32} onChange={(event) => setSeed(event.target.value)} />
                <button type="button" className="icon-btn shrink-0" onClick={() => setSeed(randomSeed())} aria-label="Nueva semilla"><Icon name="dice" size={16} /></button>
                <button type="button" className="btn btn-sm shrink-0" onClick={regenerate}>Generar</button>
              </div>
              <span className="mt-1 block text-[0.58rem] text-[var(--muted)]">Semilla activa: <strong className="text-[var(--ink-soft)]">{appliedSeed}</strong> · misma semilla, mismos jugadores.</span>
            </label>
            <div className="flex w-full flex-col gap-1.5 sm:w-auto">
              <button type="button" className="btn btn-solid btn-lg justify-between sm:min-w-[260px]" onClick={simulate} disabled={simulating || Boolean(loadingSide) || !universeA || !universeB}>
                {simulating ? "Simulando posesiones…" : "Simular partido"} <Icon name={simulating ? "refresh" : "play"} size={16} className={simulating ? "animate-spin" : ""} />
              </button>
              {simulating && <div className="progress-sim"><span /></div>}
            </div>
          </div>
          {error && <div className="mt-3 rounded-lg border border-[var(--line-strong)] p-2.5 text-[0.68rem]"><Icon name="alert" size={14} className="mr-1 inline" /> {error}</div>}
          {!error && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-[var(--line)] pt-2.5 text-[0.6rem] text-[var(--muted)]">
              <span className="flex items-center gap-1"><Icon name="shield" size={11} /> Resultado de solo lectura</span>
              <span className="flex items-center gap-1"><Icon name="database" size={11} /> No se guarda automáticamente</span>
              <span className="flex items-center gap-1"><Icon name="games" size={11} /> Mismo motor de la liga, una sola resolución</span>
              {leagues.length > 0 && <span className="flex items-center gap-1"><Icon name="list" size={11} /> {leagues.length} ligas disponibles como fuente</span>}
            </div>
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { title: "Real vs real", text: "Dos franquicias de la NBA Real. El ejemplo NYK vs LAL está a un clic.", icon: "shield" as const },
            { title: "Ficticio vs ficticio", text: "Dos equipos del universo ficticio activo, con 12 jugadores por plantilla.", icon: "dice" as const },
            { title: "Universos cruzados", text: "Un equipo ficticio contra uno real. También puedes abrir dos ligas guardadas como fuentes.", icon: "swap" as const },
          ].map((item) => (
            <div key={item.title} className="card-soft p-3.5">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--line)]"><Icon name={item.icon} size={14} /></span>
              <h3 className="mt-2 text-xs font-bold">{item.title}</h3>
              <p className="mt-1 text-[0.65rem] leading-relaxed text-[var(--muted)]">{item.text}</p>
            </div>
          ))}
        </div>
      </main>

      {result && (
        <div className="px-3 pb-6 sm:px-6">
          <div className="mx-auto max-w-[1160px]">
            <div id="exhibicion-resultado" className={cn("card flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center", detailOpen && "invisible")}>
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <TeamMark team={result.away} size={32} />
                <span className="text-xs font-bold">{result.game.awayScore}</span>
                <span className="text-[0.55rem] uppercase text-[var(--muted)]">final</span>
                <span className="text-xs font-bold">{result.game.homeScore}</span>
                <TeamMark team={result.home} size={32} outline />
                <span className="ml-1 truncate text-[0.62rem] text-[var(--muted)]">{result.away.abbreviation} @ {result.home.abbreviation}</span>
              </div>
              <button type="button" className="btn btn-solid btn-sm w-full sm:w-auto" onClick={() => setDetailOpen(true)}>
                <Icon name="stats" size={13} /> Ver boxscore
              </button>
            </div>
          </div>
        </div>
      )}
      {result && detailOpen && (
        <GameDetailScreen
          game={result.game}
          homeTeam={result.home}
          awayTeam={result.away}
          leagueName="Exhibición · no guardada en ligas"
          eyebrow="Exhibición finalizada"
          homeRoster={result.homeRoster}
          awayRoster={result.awayRoster}
          season="2026-27"
          competition="Exhibición"
          onClose={() => {
            setDetailOpen(false);
            window.setTimeout(() => document.getElementById("exhibicion-resultado")?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
          }}
        />
      )}
    </div>
  );
}
