import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { Game, Player, PlayerGameStats, Team, TeamBoxScore } from "@/types";
import { formatGameDate } from "@/game/schedule";
import { cn } from "@/utils/cn";
import { EmptyState, Icon, TeamMark } from "@/components/ui";

interface GameDetailScreenProps {
  game: Game;
  homeTeam: Team;
  awayTeam: Team;
  leagueName?: string;
  onClose: () => void;
  onSimulate?: () => void;
  simulating?: boolean;
  eyebrow?: string;
  homeRoster?: Player[];
  awayRoster?: Player[];
  homeRecord?: string;
  awayRecord?: string;
  season?: string;
  competition?: string;
}

function pct(made: number, attempted: number, digits = 1): string {
  if (!attempted) return "—";
  return `${((made / attempted) * 100).toFixed(digits)}%`;
}

function ftRate(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toFixed(3).replace(/^0/, "");
}

/** Hollinger Game Score: fórmula estándar calculable con el boxscore existente. */
export function gameScore(line: PlayerGameStats): number {
  const defensive = line.dreb ?? Math.max(0, line.reb - line.oreb);
  return (
    line.points +
    0.4 * line.fgm -
    0.7 * line.fga -
    0.4 * (line.fta - line.ftm) +
    0.7 * line.oreb +
    0.3 * defensive +
    line.stl +
    0.7 * line.ast +
    0.7 * line.blk -
    0.4 * line.pf -
    line.tov
  );
}

interface DerivedTeamStats {
  fgPct: string;
  tpPct: string;
  ftPct: string;
  efgPct: string;
  tovPct: string;
  orbPct: string;
  ftFga: string;
}

/**
 * Métricas derivadas EXCLUSIVAMENTE de totales completos del boxscore.
 * Si falta el denominador se muestra "—". No se usan datos de tracking.
 */
function deriveTeamStats(box: TeamBoxScore, opponent: TeamBoxScore): DerivedTeamStats {
  const efg = box.fga > 0 ? ((box.fgm + 0.5 * box.tpm) / box.fga) * 100 : null;
  const tovDenominator = box.fga + 0.44 * box.fta + box.tov;
  const orbDenominator = box.oreb + Math.max(0, opponent.reb - opponent.oreb);
  return {
    fgPct: pct(box.fgm, box.fga),
    tpPct: pct(box.tpm, box.tpa),
    ftPct: pct(box.ftm, box.fta),
    efgPct: efg === null ? "—" : efg.toFixed(1),
    tovPct: tovDenominator > 0 ? ((box.tov / tovDenominator) * 100).toFixed(1) : "—",
    orbPct: orbDenominator > 0 ? ((box.oreb / orbDenominator) * 100).toFixed(1) : "—",
    ftFga: box.fga > 0 ? ftRate(box.ftm / box.fga) : "—",
  };
}

function sum(lines: PlayerGameStats[]) {
  return {
    minutes: Math.round(lines.reduce((total, line) => total + line.minutes, 0) * 10) / 10,
    points: lines.reduce((total, line) => total + line.points, 0),
    fgm: lines.reduce((total, line) => total + line.fgm, 0),
    fga: lines.reduce((total, line) => total + line.fga, 0),
    tpm: lines.reduce((total, line) => total + line.tpm, 0),
    tpa: lines.reduce((total, line) => total + line.tpa, 0),
    ftm: lines.reduce((total, line) => total + line.ftm, 0),
    fta: lines.reduce((total, line) => total + line.fta, 0),
    oreb: lines.reduce((total, line) => total + line.oreb, 0),
    dreb: lines.reduce((total, line) => total + line.dreb, 0),
    reb: lines.reduce((total, line) => total + line.reb, 0),
    ast: lines.reduce((total, line) => total + line.ast, 0),
    stl: lines.reduce((total, line) => total + line.stl, 0),
    blk: lines.reduce((total, line) => total + line.blk, 0),
    tov: lines.reduce((total, line) => total + line.tov, 0),
    pf: lines.reduce((total, line) => total + line.pf, 0),
  };
}

function uniqueLines(lines: PlayerGameStats[]): PlayerGameStats[] {
  const seen = new Set<string>();
  return lines.filter((line) => {
    if (seen.has(line.playerId)) return false;
    seen.add(line.playerId);
    return true;
  });
}

function gameWinners(game: Game): { home: boolean; away: boolean } {
  if (!game.played || game.homeScore === undefined || game.awayScore === undefined) return { home: false, away: false };
  return { home: game.homeScore > game.awayScore, away: game.awayScore > game.homeScore };
}

function StateChip({ game }: { game: Game }) {
  const label = !game.played ? "Programado" : game.boxScore ? "Final" : "Final · sin boxscore";
  return <span className={cn("chip", game.played && "chip-solid")}><Icon name={game.played ? "check" : "clock"} size={10} />{label}</span>;
}

export function GameDetailScreen({
  game,
  homeTeam,
  awayTeam,
  leagueName,
  onClose,
  onSimulate,
  simulating = false,
  eyebrow,
  homeRoster = [],
  awayRoster = [],
  homeRecord = "—",
  awayRecord = "—",
  season = "2026-27",
  competition = "Liga regular",
}: GameDetailScreenProps) {
  const [eventTeam, setEventTeam] = useState<"all" | "away" | "home">("all");
  const [visibleEvents, setVisibleEvents] = useState(50);
  const box = game.boxScore;
  const hasBox = Boolean(box?.home && box?.away);
  const winners = gameWinners(game);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const playEvents = useMemo(() => {
    const all = game.playByPlay ?? [];
    const filtered = eventTeam === "all" ? all : all.filter((event) => event.teamId === (eventTeam === "home" ? homeTeam.id : awayTeam.id));
    return [...filtered].reverse();
  }, [game.playByPlay, eventTeam, homeTeam.id, awayTeam.id]);

  return (
    <div className="game-detail screen-fade fixed inset-0 z-[100] overflow-y-auto overscroll-contain bg-[var(--bg)]" role="dialog" aria-modal="true" aria-label="Boxscore del partido">
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--bg)_95%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex min-h-14 max-w-[1080px] items-center gap-2 px-2 py-2 sm:px-5">
          <button type="button" className="icon-btn shrink-0" onClick={onClose} aria-label="Volver a partidos"><Icon name="arrow-left" size={19} /></button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[0.52rem] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">{eyebrow ?? leagueName ?? "DUELA"} · Boxscore</div>
            <h1 className="truncate text-sm font-extrabold tracking-[-0.02em] sm:text-base">
              {game.played ? `${awayTeam.abbreviation} ${game.awayScore} – ${game.homeScore} ${homeTeam.abbreviation}` : `${awayTeam.abbreviation} @ ${homeTeam.abbreviation}`}
            </h1>
          </div>
          <StateChip game={game} />
          <button type="button" className="icon-btn shrink-0" onClick={onClose} aria-label="Cerrar boxscore"><Icon name="close" size={18} /></button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1080px] px-2 pb-28 pt-2 sm:px-5 sm:pb-8 sm:pt-4">
        <BoxScoreSummary game={game} homeTeam={homeTeam} awayTeam={awayTeam} homeRecord={homeRecord} awayRecord={awayRecord} season={season} competition={competition} />

        {game.played && !hasBox && (
          <div className="mt-3">
            <EmptyState
              icon="alert"
              title="Resultado sin boxscore guardado"
              message="El partido figura como finalizado, pero no hay estadísticas individuales guardadas. No se generan números nuevos: vuelve a la lista o revisa Guardado y carga."
              action={<button type="button" className="btn" onClick={onClose}>Volver a partidos</button>}
            />
          </div>
        )}

        {!game.played && (
          <section className="card mt-3 p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--line)]"><Icon name="clock" size={18} /></span>
              <div className="min-w-0 flex-1">
                <div className="overline">Partido programado</div>
                <h2 className="mt-0.5 text-base font-bold">Todavía no hay boxscore</h2>
                <p className="mt-1 text-[0.7rem] leading-relaxed text-[var(--muted)]">El encuentro aún no se ha simulado. Al jugarlo se generarán el marcador, los parciales, el boxscore completo y el play-by-play en la misma resolución, y se guardarán en la liga.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {[{ team: awayTeam, roster: awayRoster, role: "Visitante" }, { team: homeTeam, roster: homeRoster, role: "Local" }].map((item) => (
                    <div key={item.team.id} className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-2.5">
                      <div className="flex items-center gap-2"><TeamMark team={item.team} size={24} /><span className="text-[0.68rem] font-semibold">{item.team.city} {item.team.name}</span></div>
                      <div className="mt-1 text-[0.58rem] text-[var(--muted)]">{item.role} · {item.roster.length} en plantilla · {item.roster.filter((player) => player.contractType === "two-way").length} two-way</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              {onSimulate && <button type="button" className="btn btn-solid w-full sm:w-auto" onClick={onSimulate} disabled={simulating}><Icon name={simulating ? "refresh" : "play"} size={14} className={simulating ? "animate-spin" : ""} />{simulating ? "Simulando…" : "Simular este partido"}</button>}
              <button type="button" className="btn w-full sm:w-auto" onClick={onClose}>Volver a la lista</button>
            </div>
            {simulating && <div className="progress-sim mt-3"><span /></div>}
          </section>
        )}

        {game.played && hasBox && box && (
          <>
            <TeamComparisonBox game={game} homeTeam={homeTeam} awayTeam={awayTeam} season={season} />
            <div className="mt-3 space-y-3">
              <TeamBoxSection team={awayTeam} box={box.away} score={game.awayScore ?? 0} won={winners.away} roster={awayRoster} label="Visitante" season={season} />
              <TeamBoxSection team={homeTeam} box={box.home} score={game.homeScore ?? 0} won={winners.home} roster={homeRoster} label="Local" season={season} />
            </div>

            <PlayByPlaySection
              game={game}
              homeTeam={homeTeam}
              awayTeam={awayTeam}
              eventTeam={eventTeam}
              setEventTeam={setEventTeam}
              visibleEvents={visibleEvents}
              setVisibleEvents={setVisibleEvents}
              playEvents={playEvents}
            />
          </>
        )}
      </main>

      <div className="game-detail-actions safe-bottom">
        <div className="mx-auto flex max-w-[1080px] gap-2 px-2 py-2 sm:px-5">
          {game.played && hasBox && (
            <button type="button" className="btn flex-1 justify-between px-2.5" onClick={() => document.getElementById("pbp-section")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
              <span className="flex items-center gap-1.5"><Icon name="play" size={13} /><span className="sm:hidden">Jugadas</span><span className="hidden sm:inline">Ir al play-by-play</span></span>
              <Icon name="arrow-right" size={14} />
            </button>
          )}
          {!game.played && onSimulate && <button type="button" className="btn btn-solid flex-1" onClick={onSimulate} disabled={simulating}><Icon name="play" size={14} />{simulating ? "Simulando…" : "Simular"}</button>}
          <button type="button" className="btn btn-solid flex-1" onClick={onClose}><span className="sm:hidden">Volver</span><span className="hidden sm:inline">Volver a partidos</span></button>
        </div>
      </div>
    </div>
  );
}

function BoxScoreSummary({ game, homeTeam, awayTeam, homeRecord, awayRecord, season, competition }: {
  game: Game; homeTeam: Team; awayTeam: Team; homeRecord: string; awayRecord: string; season: string; competition: string;
}) {
  const winners = gameWinners(game);

  return (
    <section className="card overflow-hidden" aria-label="Marcador del partido">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-3 py-2 sm:px-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <StateChip game={game} />
          <span className="chip">J{game.round}</span>
          <span className="chip chip-outline">{season}</span>
          <span className="chip chip-outline">{competition}</span>
        </div>
        <div className="flex items-center gap-1 text-[0.6rem] text-[var(--muted)]"><Icon name="calendar" size={12} /><span>{formatGameDate(game.day)}</span></div>
      </div>

      <div className="divide-y divide-[var(--line)]">
        <TeamScoreRow team={awayTeam} score={game.awayScore} won={winners.away} lost={game.played && !winners.away} record={awayRecord} roster={awayRosterCount(game, awayTeam.id)} season={season} side="Visitante" />
        <TeamScoreRow team={homeTeam} score={game.homeScore} won={winners.home} lost={game.played && !winners.home} record={homeRecord} roster={awayRosterCount(game, homeTeam.id)} season={season} side="Local" />
      </div>
    </section>
  );
}

function awayRosterCount(game: Game, teamId: string): number {
  const box = game.boxScore;
  if (!box) return 0;
  return (box.home.teamId === teamId ? box.home.players.length : box.away.players.length);
}

function TeamScoreRow({ team, score, won, lost, record, roster, season, side }: {
  team: Team; score?: number; won: boolean; lost: boolean; record: string; roster: number; season: string; side: string;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
      <TeamMark team={team} size={34} outline={side === "Local"} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[0.56rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">{season}</span>
          <span className="text-sm font-black tracking-[-0.02em]">{team.abbreviation}</span>
          {won && <span className="chip chip-solid">Victoria</span>}
          {lost && <span className="chip">Derrota</span>}
        </div>
        <div className="truncate text-[0.66rem] text-[var(--muted)]">{team.city} {team.name} · {side} · récord {record}{roster ? ` · ${roster} acta` : ""}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className={cn("text-[1.7rem] font-black leading-none tabular sm:text-[2rem]", lost && "text-[var(--muted)]")}>{score ?? "—"}</div>
        <div className="text-[0.48rem] uppercase tracking-[0.12em] text-[var(--muted)]">{gameStatusText(lost, won)}</div>
      </div>
    </div>
  );
}

function gameStatusText(lost: boolean, won: boolean): string {
  if (won) return "Ganador";
  if (lost) return "Final";
  return "Pendiente";
}

function TeamComparisonBox({ game, homeTeam, awayTeam, season }: {
  game: Game; homeTeam: Team; awayTeam: Team; season: string;
}) {
  const box = game.boxScore;
  if (!box) return null;

  const awayQuarters = box.away.quarters ?? [];
  const homeQuarters = box.home.quarters ?? [];
  const regulation = 4;
  const quarterCount = Math.max(regulation, awayQuarters.length, homeQuarters.length);
  const overtimeCount = Math.max(0, quarterCount - regulation);
  const awayTotal = game.awayScore ?? box.away.points;
  const homeTotal = game.homeScore ?? box.home.points;
  const awaySum = awayQuarters.reduce((sum, value) => sum + value, 0);
  const homeSum = homeQuarters.reduce((sum, value) => sum + value, 0);
  const partialsMatch = awaySum === awayTotal && homeSum === homeTotal;

  const awayAdvanced = deriveTeamStats(box.away, box.home);
  const homeAdvanced = deriveTeamStats(box.home, box.away);

  const rows = [
    { team: awayTeam, side: "Visitante", quarters: awayQuarters, total: awayTotal, advanced: awayAdvanced },
    { team: homeTeam, side: "Local", quarters: homeQuarters, total: homeTotal, advanced: homeAdvanced },
  ];
  const advancedColumns: { key: "efgPct" | "tovPct" | "orbPct" | "ftFga"; label: string; hint: string }[] = [
    { key: "efgPct", label: "eFG%", hint: "Effective Field Goal %: (FG + 0.5 × 3P) / FGA" },
    { key: "tovPct", label: "TOV%", hint: "Turnover %: TOV / (FGA + 0.44 × FTA + TOV)" },
    { key: "orbPct", label: "ORB%", hint: "Offensive Rebound %: ORB / (ORB + DRB del rival)" },
    { key: "ftFga", label: "FT/FGA", hint: "Tiros libres anotados / tiros de campo intentados" },
  ];

  return (
    <section className="card mt-3 overflow-hidden" aria-label="Parciales y estadísticas avanzadas de ambos equipos">
      <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-[var(--line)] px-3 py-2 sm:px-4">
        <div className="overline">Cuadro de equipo</div>
        <div className="flex flex-wrap items-center gap-1.5">
          {!partialsMatch && <span className="chip chip-warn" title="La suma de parciales no coincide con el marcador guardado">Parciales no cuadran</span>}
          <span className="chip">{season} · boxscore</span>
        </div>
      </div>

      <div className="bb-compare-section">
        <div className="bb-compare-heading">
          <span>Parciales</span>
          <span className="bb-compare-hint">Puntos por cuarto{overtimeCount > 0 ? ` + ${overtimeCount} prórroga${overtimeCount > 1 ? "s" : ""}` : ""}</span>
        </div>
        <table className="bb-compare-table bb-compare-quarters">
          <colgroup>
            <col className="bb-compare-col-team" />
            {Array.from({ length: quarterCount }, (_, index) => <col key={index} className="bb-compare-col-period" />)}
            <col className="bb-compare-col-final" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Equipo</th>
              {Array.from({ length: regulation }, (_, index) => <th key={index} scope="col">{index + 1}</th>)}
              {Array.from({ length: overtimeCount }, (_, index) => <th key={`ot-${index}`} scope="col">{overtimeCount === 1 ? "OT" : `OT${index + 1}`}</th>)}
              <th scope="col">F</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.team.id}>
                <th scope="row" title={`${row.team.city} ${row.team.name}`}>
                  <span className="bb-compare-team" data-side={row.side === "Local" ? "home" : "away"}>{row.team.abbreviation}</span>
                </th>
                {Array.from({ length: quarterCount }, (_, index) => (
                  <td key={index}>{row.quarters[index] === undefined ? "—" : row.quarters[index]}</td>
                ))}
                <td className="bb-compare-final">{row.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bb-compare-section bb-compare-section--advanced">
        <div className="bb-compare-heading">
          <span>Avanzadas</span>
          <span className="bb-compare-hint">Derivadas del boxscore · sin tracking</span>
        </div>
        <table className="bb-compare-table bb-compare-advanced">
          <colgroup>
            <col className="bb-compare-col-team" />
            {advancedColumns.map((column) => <col key={column.key} className="bb-compare-col-metric" />)}
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Equipo</th>
              {advancedColumns.map((column) => <th key={column.key} scope="col" title={column.hint}>{column.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.team.id}>
                <th scope="row" title={`${row.team.city} ${row.team.name}`}>
                  <span className="bb-compare-team" data-side={row.side === "Local" ? "home" : "away"}>{row.team.abbreviation}</span>
                </th>
                {advancedColumns.map((column) => (
                  <td key={column.key} title={`${column.label}: ${column.hint}`}>{row.advanced[column.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="bb-compare-note">
        eFG% = (TC + 0.5 × 3P) / TCI · TOV% = pérdidas / (TCI + 0.44 × TLI + pérdidas) · ORB% = rebotes ofensivos / (ofensivos + defensivos del rival) · FT/FGA = TL anotados / TCI. «—» indica denominador no disponible; no se inventan valores.
      </p>
    </section>
  );
}

function TeamBoxSection({ team, box, score, won, roster, label, season }: {
  team: Team; box: TeamBoxScore; score: number; won: boolean; roster: Player[]; label: string; season: string;
}) {
  const rosterById = useMemo(() => new Map(roster.map((player) => [player.id, player])), [roster]);
  // El motor guarda a los jugadores en orden de rotación: los cinco primeros son los titulares.
  // No se reordena por minutos para no perder esa separación titular/suplente.
  const participants = uniqueLines(box.players ?? []);
  const participantIds = new Set(participants.map((line) => line.playerId));
  const starters = participants.slice(0, 5);
  const bench = participants.slice(5);
  const dnp = roster.filter((player) => !participantIds.has(player.id));
  const totals = sum(participants);
  const expected = { points: box.points, fgm: box.fgm, fga: box.fga, tpm: box.tpm, tpa: box.tpa, ftm: box.ftm, fta: box.fta, oreb: box.oreb, reb: box.reb, ast: box.ast, stl: box.stl, blk: box.blk, tov: box.tov, pf: box.pf };
  const mismatch = (Object.keys(expected) as (keyof typeof expected)[]).some((key) => totals[key] !== expected[key]) || totals.points !== score;
  const twoWay = roster.filter((player) => player.contractType === "two-way").length;

  return (
    <section className="card overflow-hidden" aria-label={`Boxscore de ${team.city} ${team.name}`}>
      <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <TeamMark team={team} size={32} outline={!won} />
          <div className="min-w-0">
            <div className="text-[0.52rem] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">{season} · {label}</div>
            <div className="truncate text-sm font-extrabold tracking-[-0.02em]">{team.city} {team.name}</div>
            <div className="flex flex-wrap items-center gap-1 text-[0.52rem] uppercase tracking-wide text-[var(--muted)]">
              <span>{starters.length + bench.length} en acta</span><span>·</span><span>{starters.length} titulares</span><span>·</span><span>{bench.length} suplentes</span>{twoWay > 0 && <><span>·</span><span>{twoWay} two-way</span></>}
              {won && <span className="chip chip-solid">Victoria</span>}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-black tabular">{score}</div>
          <div className="text-[0.48rem] uppercase tracking-wide text-[var(--muted)]">puntos</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-[var(--line)] bg-[var(--surface-2)] px-3 py-1.5 text-[0.55rem] text-[var(--muted)] sm:px-4">
        <span className="flex items-center gap-1"><Icon name="arrow-right" size={10} /> La tabla se desplaza dentro de su panel; la página no se mueve.</span>
        {mismatch ? <span className="chip chip-warn">Revisar totales</span> : <span className="chip">Totales cuadran</span>}
      </div>

      <div className="bb-scroll" role="region" aria-label={`Estadísticas de ${team.name}`} tabIndex={0}>
        <table className="bb-table bb-boxscore-table">
          <BoxColGroup />
          <thead>
            <tr>
              {BOX_COLUMNS.map((column) => (
                <th key={column.key} scope="col" data-col={column.key} className={column.headerClass} title={column.title}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <BoxGroupRow label="Titulares" />
            {starters.map((line) => <PlayerBoxRow key={line.playerId} line={line} rosterPlayer={rosterById.get(line.playerId)} />)}
            {bench.length > 0 && <BoxGroupRow label="Suplentes" />}
            {bench.map((line) => <PlayerBoxRow key={line.playerId} line={line} rosterPlayer={rosterById.get(line.playerId)} />)}
            {dnp.length > 0 && <BoxGroupRow label="No participaron" />}
            {dnp.map((player) => (
              <tr key={player.id} className="bb-dnp-row" data-dnp="true">
                <th scope="row" data-col="name" className="bb-player-cell" title={player.name}><span className="block truncate">{player.name}</span>{player.contractType === "two-way" && <span className="bb-two-way">2W</span>}</th>
                <td data-col="pos">{player.position}</td>
                <td data-col="dnp" colSpan={BOX_COLUMNS.length - 2} className="bb-dnp">DNP - Coach&apos;s decision</td>
              </tr>
            ))}
            {participants.length === 0 && <tr><td colSpan={BOX_COLUMNS.length} className="bb-empty">Sin jugadores en el acta.</td></tr>}
          </tbody>
          <tfoot>
            <tr className="bb-total-row">
              <th scope="row" data-col="name">Total</th>
              <td data-col="pos" />
              {BOX_COLUMNS.slice(2).map((column) => <td key={column.key} data-col={column.key} className={column.cellClass}>{column.total(totals)}</td>)}
            </tr>
            <tr className="bb-pct-row">
              <th scope="row" data-col="name">Percentages</th>
              {BOX_COLUMNS.slice(1).map((column) => (
                <td key={column.key} data-col={column.key}>{
                  column.key === "fg" ? pct(totals.fgm, totals.fga)
                    : column.key === "3p" ? pct(totals.tpm, totals.tpa)
                      : column.key === "ft" ? pct(totals.ftm, totals.fta)
                        : ""
                }</td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="border-t border-[var(--line)] px-3 py-2 text-[0.55rem] leading-relaxed text-[var(--muted)] sm:px-4">
        <p>Titulares: primeros cinco del orden de rotación guardado en este partido. Suplentes: resto del acta. DNP: no disputó minutos. La app no modela lesiones, suspensiones ni inactivos; no se atribuyen motivos médicos.</p>
        <p className="mt-1">BA (bloqueos recibidos) y +/- no los registra el motor de esta fase: se muestran como «—» y no se inventan. GmSc = Game Score de Hollinger, calculado con las estadísticas de esta tabla. MP son minutos enteros.</p>
      </div>
    </section>
  );
}

type BoxTotals = ReturnType<typeof sum>;

interface BoxColumn {
  key: string;
  label: string;
  title?: string;
  headerClass?: string;
  cellClass?: string;
  render: (line: PlayerGameStats) => ReactNode;
  total: (totals: BoxTotals) => ReactNode;
}

/**
 * Orden ÚNICO de la tabla. Encabezado de cabecera, filas de jugador, Total y
 * Percentages se generan desde esta misma definición para que no se desalineen.
 */
const BOX_COLUMNS: BoxColumn[] = [
  { key: "name", label: "Name", render: () => null, total: () => null },
  { key: "pos", label: "Pos", render: () => null, total: () => null },
  { key: "mp", label: "MP", title: "Minutos jugados (enteros)", render: (line) => line.minutes, total: (totals) => totals.minutes },
  { key: "fg", label: "FG", title: "Tiros de campo anotados-intentados", render: (line) => `${line.fgm}-${line.fga}`, total: (totals) => `${totals.fgm}-${totals.fga}` },
  { key: "3p", label: "3P", title: "Triples anotados-intentados", render: (line) => `${line.tpm}-${line.tpa}`, total: (totals) => `${totals.tpm}-${totals.tpa}` },
  { key: "ft", label: "FT", title: "Tiros libres anotados-intentados", render: (line) => `${line.ftm}-${line.fta}`, total: (totals) => `${totals.ftm}-${totals.fta}` },
  { key: "orb", label: "ORB", title: "Rebotes ofensivos", render: (line) => line.oreb, total: (totals) => totals.oreb },
  { key: "trb", label: "TRB", title: "Rebotes totales", render: (line) => line.reb, total: (totals) => totals.reb },
  { key: "ast", label: "AST", title: "Asistencias", render: (line) => line.ast, total: (totals) => totals.ast },
  { key: "tov", label: "TOV", title: "Pérdidas", render: (line) => line.tov, total: (totals) => totals.tov },
  { key: "stl", label: "STL", title: "Robos", render: (line) => line.stl, total: (totals) => totals.stl },
  { key: "blk", label: "BLK", title: "Tapones", render: (line) => line.blk, total: (totals) => totals.blk },
  { key: "ba", label: "BA", title: "Bloqueos recibidos: el motor de esta fase no lo registra", render: () => "—", total: () => "—" },
  { key: "pf", label: "PF", title: "Faltas personales", render: (line) => line.pf, total: (totals) => totals.pf },
  { key: "pts", label: "PTS", title: "Puntos", cellClass: "bb-points", render: (line) => line.points, total: (totals) => totals.points },
  { key: "pm", label: "+/-", title: "Más/menos: el motor de esta fase no registra datos on/off", render: () => "—", total: () => "" },
  { key: "gmsc", label: "GmSc", title: "Game Score de Hollinger", cellClass: "bb-gs", render: (line) => gameScore(line).toFixed(1), total: () => "" },
];

function BoxColGroup() {
  return (
    <colgroup>
      <col className="bb-col-name" />
      <col className="bb-col-pos" />
      <col className="bb-col-min" />
      <col className="bb-col-shot" />
      <col className="bb-col-shot" />
      <col className="bb-col-shot" />
      <col className="bb-col-num" />
      <col className="bb-col-num" />
      <col className="bb-col-num" />
      <col className="bb-col-num" />
      <col className="bb-col-num" />
      <col className="bb-col-num" />
      <col className="bb-col-small" />
      <col className="bb-col-small" />
      <col className="bb-col-num" />
      <col className="bb-col-num" />
      <col className="bb-col-gmsc" />
    </colgroup>
  );
}

function BoxGroupRow({ label }: { label: string }) {
  return (
    <tr className="bb-group-row">
      <th scope="colgroup" colSpan={BOX_COLUMNS.length}>{label}</th>
    </tr>
  );
}

function PlayerBoxRow({ line, rosterPlayer }: { line: PlayerGameStats; rosterPlayer?: Player }) {
  return (
    <tr data-player-id={line.playerId}>
      <th scope="row" data-col="name" className="bb-player-cell" title={line.name}>
        <span className="block truncate">{line.name}</span>
        {rosterPlayer?.contractType === "two-way" && <span className="bb-two-way">2W</span>}
      </th>
      <td data-col="pos">{line.position}</td>
      {BOX_COLUMNS.slice(2).map((column) => <td key={column.key} data-col={column.key} className={column.cellClass}>{column.render(line)}</td>)}
    </tr>
  );
}

function PlayByPlaySection({ game, homeTeam, awayTeam, eventTeam, setEventTeam, visibleEvents, setVisibleEvents, playEvents }: {
  game: Game; homeTeam: Team; awayTeam: Team;
  eventTeam: "all" | "away" | "home";
  setEventTeam: (value: "all" | "away" | "home") => void;
  visibleEvents: number;
  setVisibleEvents: Dispatch<SetStateAction<number>>;
  playEvents: Game["playByPlay"];
}) {
  return (
    <section id="pbp-section" className="mt-3 card overflow-hidden scroll-mt-16">
      <div className="flex flex-col gap-2 border-b border-[var(--line)] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div><div className="overline">Misma resolución del partido</div><h2 className="text-sm font-bold">Play-by-play</h2></div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="chip">{game.playByPlay?.length ?? 0} acciones</span>
          <div className="segmented compact">
            {([{ key: "all" as const, label: "Todos" }, { key: "away" as const, label: awayTeam.abbreviation }, { key: "home" as const, label: homeTeam.abbreviation }]).map((item) => (
              <button key={item.key} type="button" className={eventTeam === item.key ? "active" : ""} onClick={() => { setEventTeam(item.key); setVisibleEvents(50); }}>{item.label}</button>
            ))}
          </div>
        </div>
      </div>
      {(playEvents?.length ?? 0) === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-[var(--muted)]">Este partido no guardó acciones de play-by-play para el filtro elegido.</p>
      ) : (
        <div className="divide-y divide-[var(--line)]">
          {playEvents!.slice(0, visibleEvents).map((event) => {
            const isHome = event.teamId === homeTeam.id;
            return (
              <div key={event.seq} className={cn("grid grid-cols-[52px_1fr_auto] items-start gap-2 px-3 py-2.5 text-[0.7rem] sm:px-4", event.kind === "score" && "bg-[var(--surface-2)]")}>
                <span className="flex flex-col gap-0.5"><span className="font-bold tabular text-[var(--muted)]">{event.clock}</span><span className="text-[0.48rem] uppercase tracking-wide text-[var(--muted)]">{isHome ? "Local" : "Visit."}</span></span>
                <span className="leading-relaxed">{event.text}</span>
                <span className="rounded border border-[var(--line)] px-1.5 py-0.5 text-[0.58rem] font-bold tabular text-[var(--muted)]">{event.awayScore}–{event.homeScore}</span>
              </div>
            );
          })}
        </div>
      )}
      {(playEvents?.length ?? 0) > visibleEvents && (
        <div className="border-t border-[var(--line)] p-2">
          <button type="button" className="btn w-full" onClick={() => setVisibleEvents((count) => count + 80)}>Mostrar más acciones ({(playEvents?.length ?? 0) - visibleEvents})</button>
        </div>
      )}
    </section>
  );
}
