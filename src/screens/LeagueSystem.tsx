import { useEffect, useMemo, useState } from "react";
import type { Player, Position } from "@/types";
import { PlayerDrawer } from "@/components/details";
import { EmptyState, Icon, PageHeader, PlayerAvatar, StatBlock, TeamMark, ThemePicker } from "@/components/ui";
import { DATA_PROVENANCE, FRANCHISES } from "@/data/franchises";
import { auditBundle, type AuditReport } from "@/game/audit";
import { POSITIONS } from "@/game/ratings";
import { formatGameDate, REGULAR_SEASON_ROUNDS, shortGameDate } from "@/game/schedule";
import { aggregatePlayerStats, currentRound, formatRecord, playedGames, standings, teamRecord, winPct } from "@/game/selectors";
import { SIM_MODEL_NOTES } from "@/game/simulate";
import { APP_SCHEMA_VERSION, DB_NAME, DB_VERSION, formatBytes, getStorageReport } from "@/persistence/db";
import { cn } from "@/utils/cn";
import type { LeagueView } from "./leagueTypes";

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

export function SchedulePage({ view }: { view: LeagueView }) {
  const { bundle, userTeam, onViewGame, simulateRound, simulateBusy } = view;
  const [scope, setScope] = useState<"team" | "all">(bundle.league.playMode === "spectator" ? "all" : "team");
  const [round, setRound] = useState(currentRound(bundle.games) || 1);
  const roundGames = bundle.games.filter((game) => game.round === round);
  const games = roundGames.filter((game) => scope === "all" || game.homeTeamId === userTeam.id || game.awayTeamId === userTeam.id);
  const played = roundGames.filter((game) => game.played).length;
  const changeRound = (next: number) => setRound(Math.max(1, Math.min(REGULAR_SEASON_ROUNDS, next)));

  return (
    <div className="screen-fade">
      <PageHeader eyebrow={`Liga regular abreviada · ${REGULAR_SEASON_ROUNDS} jornadas`} title="Calendario" subtitle="Cada equipo disputa 29 partidos. Toca un partido para abrir su boxscore o, si está pendiente, simularlo desde su ficha." actions={<button type="button" className="btn btn-solid btn-sm" onClick={() => void simulateRound()} disabled={simulateBusy}><Icon name="play" size={12} /> Simular jornada {currentRound(bundle.games) || REGULAR_SEASON_ROUNDS}</button>} />
      <div className="card mb-3 p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="pill-nav">
            <button type="button" className={scope === "team" ? "active" : ""} onClick={() => setScope("team")}>Mi equipo</button>
            <button type="button" className={scope === "all" ? "active" : ""} onClick={() => setScope("all")}>Toda la liga</button>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" className="icon-btn" onClick={() => changeRound(round - 1)} disabled={round <= 1} aria-label="Jornada anterior"><Icon name="arrow-left" size={16} /></button>
            <select className="select w-auto min-w-[150px] text-xs" value={round} onChange={(event) => changeRound(Number(event.target.value))} aria-label="Seleccionar jornada">
              {Array.from({ length: REGULAR_SEASON_ROUNDS }, (_, index) => index + 1).map((value) => <option key={value} value={value}>Jornada {value} · {bundle.games.find((game) => game.round === value)?.day.slice(5) ?? ""}</option>)}
            </select>
            <button type="button" className="icon-btn" onClick={() => changeRound(round + 1)} disabled={round >= REGULAR_SEASON_ROUNDS} aria-label="Jornada siguiente"><Icon name="arrow-right" size={16} /></button>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-[var(--line)] pt-2 text-[0.62rem] text-[var(--muted)]"><span>{formatGameDate(roundGames[0]?.day ?? "2026-10-20")}</span><span>{played}/15 jugados</span></div>
      </div>

      <div className="card overflow-hidden">
        <div className="space-y-0">
          {games.map((game) => {
            const home = bundle.teams.find((team) => team.id === game.homeTeamId);
            const away = bundle.teams.find((team) => team.id === game.awayTeamId);
            const isUser = game.homeTeamId === userTeam.id || game.awayTeamId === userTeam.id;
            if (!home || !away) return null;
            return (
              <button key={game.id} type="button" onClick={() => onViewGame(game)} className={cn("flex min-h-[60px] w-full items-center gap-2 border-b border-[var(--line)] px-3 py-3 text-left transition last:border-0 hover:bg-[var(--surface-2)] sm:px-4", isUser && "bg-[var(--surface-2)]")} aria-label={game.played ? `Ver boxscore de ${away.city} contra ${home.city}` : `Abrir partido pendiente ${away.city} contra ${home.city}`}>
                <span className="w-9 shrink-0 text-[0.55rem] font-bold uppercase text-[var(--muted)]">{game.played ? <span className="chip">Final</span> : <span className="chip"><Icon name="clock" size={10} /></span>}</span>
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <TeamMark team={away} size={26} />
                  <span className="min-w-0 flex-1"><span className="block truncate text-[0.7rem] font-semibold">{away.city} {away.name}</span><span className="text-[0.52rem] uppercase tracking-wide text-[var(--muted)]">Visitante</span></span>
                  {game.played ? <span className="shrink-0 text-sm font-black tabular">{game.awayScore}</span> : <span className="chip">vs</span>}
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <TeamMark team={home} size={26} outline />
                  <span className="min-w-0 flex-1"><span className="block truncate text-[0.7rem] font-semibold">{home.city} {home.name}</span><span className="text-[0.52rem] uppercase tracking-wide text-[var(--muted)]">Local</span></span>
                  {game.played && <span className="shrink-0 text-sm font-black tabular">{game.homeScore}</span>}
                </div>
                <span className="hidden w-14 shrink-0 text-right text-[0.58rem] text-[var(--muted)] sm:block">{shortGameDate(game.day)}</span>
                <span className={cn("flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-1 text-[0.5rem] font-bold uppercase tracking-wide", game.played ? "border border-[var(--line-strong)] text-[var(--ink-soft)]" : "border border-[var(--line)] text-[var(--muted)]")}>
                  {game.played ? "Boxscore" : "Abrir"} <Icon name="chevron-right" size={10} />
                </span>
              </button>
            );
          })}
        </div>
        {games.length === 0 && <div className="px-4 py-12 text-center text-xs text-[var(--muted)]">No hay partidos programados para esta jornada con el filtro actual.</div>}
      </div>
      <p className="mt-2 text-[0.6rem] leading-relaxed text-[var(--muted)]">Toca cualquier partido: si es final, se abre directamente el boxscore completo; si está pendiente, su ficha permite simularlo. No hay resultados simulados automáticamente al abrir la pantalla.</p>
    </div>
  );
}

function StandingTable({ rows, userTeamId, conference }: { rows: ReturnType<typeof standings>["Este"]; userTeamId: string; conference: "Este" | "Oeste" }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
        <div><div className="overline">Conferencia</div><h2 className="text-sm font-bold">{conference}</h2></div>
        <span className="chip">Top 6 · corte directo</span>
      </div>
      <div className="grid grid-cols-[26px_1fr_repeat(4,minmax(27px,36px))] items-center gap-1 border-b border-[var(--line)] px-2.5 py-2 text-[0.52rem] font-bold uppercase tracking-wide text-[var(--muted)] sm:grid-cols-[26px_1fr_repeat(7,minmax(30px,44px))]">
        <span>#</span><span>Equipo</span><span className="text-center">G</span><span className="text-center">P</span><span className="text-center">%</span><span className="text-center">DIF</span>
        <span className="hidden text-center sm:block">GB</span><span className="hidden text-center sm:block">PF</span><span className="hidden text-center sm:block">PC</span>
      </div>
      {rows.map((row, index) => {
        const diff = row.record.pointsFor - row.record.pointsAgainst;
        return (
          <div key={row.team.id} className={cn("grid grid-cols-[26px_1fr_repeat(4,minmax(27px,36px))] items-center gap-1 border-b border-[var(--line)] px-2.5 py-2.5 text-[0.68rem] last:border-0 sm:grid-cols-[26px_1fr_repeat(7,minmax(30px,44px))]", row.team.id === userTeamId && "bg-[var(--surface-2)]")}>
            <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[0.55rem] font-bold tabular", index < 6 ? "bg-[var(--inverse)] text-[var(--inverse-ink)]" : index < 10 ? "border border-[var(--line-strong)]" : "text-[var(--muted)]")}>{row.rank}</span>
            <span className="flex min-w-0 items-center gap-1.5"><TeamMark team={row.team} size={21} outline={row.team.id !== userTeamId} /><span className="truncate font-semibold">{row.team.abbreviation} <span className="hidden text-[0.62rem] font-normal text-[var(--muted)] sm:inline">{row.team.name}</span></span></span>
            <span className="text-center font-bold tabular">{row.record.wins}</span>
            <span className="text-center tabular">{row.record.losses}</span>
            <span className="text-center tabular text-[var(--muted)]">{(winPct(row.record) * 1000).toFixed(0)}</span>
            <span className={cn("text-center tabular", diff > 0 ? "text-[var(--ink)]" : "text-[var(--muted)]")}>{diff > 0 ? "+" : ""}{diff}</span>
            <span className="hidden text-center tabular sm:block">{row.gb}</span>
            <span className="hidden text-center tabular text-[var(--muted)] sm:block">{row.record.played ? (row.record.pointsFor / row.record.played).toFixed(0) : "0"}</span>
            <span className="hidden text-center tabular text-[var(--muted)] sm:block">{row.record.played ? (row.record.pointsAgainst / row.record.played).toFixed(0) : "0"}</span>
          </div>
        );
      })}
    </div>
  );
}

export function StandingsPage({ view }: { view: LeagueView }) {
  const { bundle, userTeam, simulateRound, simulateBusy } = view;
  const table = useMemo(() => standings(bundle.teams, bundle.games), [bundle.teams, bundle.games]);
  const played = bundle.games.filter((game) => game.played).length;
  return (
    <div className="screen-fade">
      <PageHeader eyebrow={`W% oficial de la liga · ${played} partidos jugados`} title="Clasificación" subtitle="Los seis primeros de cada conferencia marcan el corte directo. En Fase 1 no se disputan playoffs; es una referencia de posición." actions={<button type="button" className="btn btn-solid btn-sm" onClick={() => void simulateRound()} disabled={simulateBusy}><Icon name="play" size={12} /> Avanzar jornada</button>} />
      {played === 0 && <div className="mb-3 flex items-center gap-2 rounded-xl border border-dashed border-[var(--line-strong)] p-3 text-[0.68rem] text-[var(--muted)]"><Icon name="info" size={14} /> Todavía no hay victorias ni derrotas. Simula la primera jornada para mover la tabla.</div>}
      <div className="grid gap-3 xl:grid-cols-2">
        <StandingTable rows={table[userTeam.conference]} userTeamId={userTeam.id} conference={userTeam.conference} />
        <StandingTable rows={table[userTeam.conference === "Este" ? "Oeste" : "Este"]} userTeamId={userTeam.id} conference={userTeam.conference === "Este" ? "Oeste" : "Este"} />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div className="card p-3"><div className="overline">Líder del Este</div><div className="mt-1 text-sm font-bold">{table.Este[0]?.team.city} {table.Este[0]?.team.name}</div><div className="text-[0.62rem] text-[var(--muted)]">{formatRecord(table.Este[0]?.record ?? teamRecord("", []))}</div></div>
        <div className="card p-3"><div className="overline">Líder del Oeste</div><div className="mt-1 text-sm font-bold">{table.Oeste[0]?.team.city} {table.Oeste[0]?.team.name}</div><div className="text-[0.62rem] text-[var(--muted)]">{formatRecord(table.Oeste[0]?.record ?? teamRecord("", []))}</div></div>
        <div className="card p-3"><div className="overline">Fuera de Play-in</div><div className="mt-1 text-sm font-bold">{table[userTeam.conference].slice(10).length} equipos</div><div className="text-[0.62rem] text-[var(--muted)]">Corte Fase 1: puestos 7–10 marcados como play-in.</div></div>
      </div>
    </div>
  );
}

export function GamesPage({ view }: { view: LeagueView }) {
  const { bundle, userTeam, onViewGame, simulateRound, simulateBusy } = view;
  const [scope, setScope] = useState<"team" | "all">(bundle.league.playMode === "spectator" ? "all" : "team");
  const [visible, setVisible] = useState(25);
  const results = playedGames(bundle.games).filter((game) => scope === "all" || game.homeTeamId === userTeam.id || game.awayTeamId === userTeam.id).slice(0, visible);
  return (
    <div className="screen-fade">
      <PageHeader eyebrow="Resultados finales · Fase 1" title="Partidos y boxscores" subtitle="Toca «Ver boxscore» en cualquier resultado final para consultar ambos equipos, minutos, cuartos y jugada a jugada. El boxscore guardado no vuelve a generarse." actions={<><span className="chip">{bundle.games.filter((game) => game.played).length} finales</span><button type="button" className="btn btn-sm" onClick={() => void simulateRound()} disabled={simulateBusy}><Icon name="play" size={12} /> Simular jornada</button></>} />
      <div className="mb-3 grid grid-cols-3 gap-2">
        <div className="card p-2.5 text-center"><div className="text-[0.5rem] font-bold uppercase tracking-wide text-[var(--muted)]">Finales</div><div className="mt-0.5 text-lg font-black tabular">{bundle.games.filter((game) => game.played).length}</div></div>
        <div className="card p-2.5 text-center"><div className="text-[0.5rem] font-bold uppercase tracking-wide text-[var(--muted)]">Con boxscore</div><div className="mt-0.5 text-lg font-black tabular">{bundle.games.filter((game) => game.played && game.boxScore).length}</div></div>
        <div className="card p-2.5 text-center"><div className="text-[0.5rem] font-bold uppercase tracking-wide text-[var(--muted)]">Pendientes</div><div className="mt-0.5 text-lg font-black tabular">{bundle.games.filter((game) => !game.played).length}</div></div>
      </div>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="pill-nav"><button type="button" className={scope === "team" ? "active" : ""} onClick={() => setScope("team")}>Mi equipo</button><button type="button" className={scope === "all" ? "active" : ""} onClick={() => setScope("all")}>Toda la liga</button></div>
        <span className="text-[0.62rem] text-[var(--muted)]">{scope === "team" ? `${results.length} boxscores recientes de ${userTeam.name}` : `${results.length} boxscores recientes de la liga`}</span>
      </div>
      {bundle.games.some((game) => game.played && !game.boxScore) && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-dashed border-[var(--line-strong)] p-3 text-[0.66rem] leading-relaxed">
          <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
          <span>Hay partidos finalizados sin boxscore guardado. Ábrelos para ver el diagnóstico; no se generarán estadísticas nuevas que contradigan el marcador.</span>
        </div>
      )}
      {results.length === 0 ? (
        <EmptyState icon="games" title="Aún no hay resultados" message="Simula tu primer partido. El motor genera el marcador, los minutos, todas las estadísticas y un play-by-play básico desde la misma resolución." action={<button type="button" className="btn btn-solid" onClick={() => void simulateRound()} disabled={simulateBusy}><Icon name="play" size={13} /> Simular primera jornada</button>} />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {results.map((game) => {
            const home = bundle.teams.find((team) => team.id === game.homeTeamId);
            const away = bundle.teams.find((team) => team.id === game.awayTeamId);
            if (!home || !away) return null;
            const isUser = game.homeTeamId === userTeam.id || game.awayTeamId === userTeam.id;
            return (
              <button key={game.id} type="button" onClick={() => onViewGame(game)} className={cn("card p-3.5 text-left transition hover:border-[var(--line-strong)]", isUser && "ring-1 ring-[var(--ink)]")}>
                <div className="flex items-center justify-between"><span className="chip">J{game.round}</span><span className="text-[0.56rem] text-[var(--muted)]">{shortGameDate(game.day)}</span></div>
                <div className="mt-2.5 space-y-1.5">
                  <div className="flex items-center gap-2"><TeamMark team={away} size={26} /><span className="min-w-0 flex-1 truncate text-[0.7rem] font-semibold">{away.city} {away.name}</span><span className={cn("text-sm font-black tabular", (game.awayScore ?? 0) > (game.homeScore ?? 0) && "font-black")}>{game.awayScore}</span></div>
                  <div className="flex items-center gap-2"><TeamMark team={home} size={26} outline /><span className="min-w-0 flex-1 truncate text-[0.7rem] font-semibold">{home.city} {home.name}</span><span className={cn("text-sm font-black tabular", (game.homeScore ?? 0) > (game.awayScore ?? 0) && "font-black")}>{game.homeScore}</span></div>
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-[var(--line)] pt-2 text-[0.56rem] text-[var(--muted)]"><span className="truncate">{game.boxScore ? `${game.boxScore.home.players.length + game.boxScore.away.players.length} jugadores · stats guardadas` : "Boxscore no disponible"}</span><span className="flex shrink-0 items-center gap-1 rounded-md border border-[var(--line-strong)] px-2 py-1 text-[0.54rem] font-bold uppercase tracking-wide text-[var(--ink)]">Ver boxscore <Icon name="chevron-right" size={11} /></span></div>
              </button>
            );
          })}
        </div>
      )}
      {visible < playedGames(bundle.games).filter((game) => scope === "all" || game.homeTeamId === userTeam.id || game.awayTeamId === userTeam.id).length && <button type="button" className="btn mt-3 w-full" onClick={() => setVisible((count) => count + 25)}>Mostrar más resultados</button>}
    </div>
  );
}

type StatCategory = "ppg" | "rpg" | "apg" | "spg" | "bpg";

export function StatsPage({ view }: { view: LeagueView }) {
  const { bundle, userTeam, simulateRound, simulateBusy } = view;
  const [category, setCategory] = useState<StatCategory>("ppg");
  const [scope, setScope] = useState<"all" | "team">("all");
  const [positionFilter, setPositionFilter] = useState<"all" | Position>("all");
  const [selected, setSelected] = useState<Player | null>(null);
  const [visible, setVisible] = useState(25);
  const stats = useMemo(() => aggregatePlayerStats(bundle), [bundle]);
  const complete = stats.filter((row) => row.games > 0 && (scope === "all" || row.player.teamId === userTeam.id) && (positionFilter === "all" || row.player.position === positionFilter));
  const sorted = [...complete].sort((a, b) => b[category] - a[category]);
  const shown = sorted.slice(0, visible);
  const labels: Record<StatCategory, string> = { ppg: "Puntos", rpg: "Rebotes", apg: "Asistencias", spg: "Robos", bpg: "Tapones" };
  const selectedTeam = selected ? bundle.teams.find((team) => team.id === selected.teamId) : undefined;

  return (
    <div className="screen-fade">
      <PageHeader eyebrow={`${bundle.games.filter((game) => game.played).length} partidos en la muestra`} title="Estadísticas" subtitle="Promedios individuales calculados exclusivamente con los box scores simulados y guardados en esta liga." actions={<button type="button" className="btn btn-sm" onClick={() => void simulateRound()} disabled={simulateBusy}><Icon name="play" size={12} /> Simular jornada</button>} />
      {stats.length === 0 ? (
        <EmptyState icon="stats" title="Sin estadísticas todavía" message="No se inventan números iniciales. Al simular el primer partido aparecerán los promedios, porcentajes y líderes de la liga." action={<button type="button" className="btn btn-solid" onClick={() => void simulateRound()} disabled={simulateBusy}>Simular primera jornada</button>} />
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { category: "ppg" as const, label: "Máximo anotador" },
              { category: "rpg" as const, label: "Más rebotes" },
              { category: "apg" as const, label: "Más asistencias" },
              { category: "spg" as const, label: "Más robos" },
            ].map((item) => {
              const leader = [...stats].sort((a, b) => b[item.category] - a[item.category])[0];
              return (
                <button key={item.category} type="button" className="card p-3 text-left transition hover:border-[var(--line-strong)]" onClick={() => setSelected(leader.player)}>
                  <div className="overline">{item.label}</div>
                  <div className="mt-1 truncate text-xs font-bold">{leader.player.name}</div>
                  <div className="mt-0.5 text-xl font-black tabular">{leader[item.category].toFixed(1)} <span className="text-[0.55rem] font-semibold uppercase text-[var(--muted)]">{item.category.slice(0, 3)}</span></div>
                </button>
              );
            })}
          </div>
          <div className="card mb-3 p-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div className="pill-nav">
                {(["ppg", "rpg", "apg", "spg", "bpg"] as const).map((item) => <button key={item} type="button" className={category === item ? "active" : ""} onClick={() => { setCategory(item); setVisible(25); }}>{item.toUpperCase()}</button>)}
              </div>
              <div className="flex gap-1.5">
                <button type="button" className={cn("btn btn-sm", scope === "all" && "btn-solid")} onClick={() => setScope("all")}>Liga</button>
                <button type="button" className={cn("btn btn-sm", scope === "team" && "btn-solid")} onClick={() => setScope("team")}>{userTeam.abbreviation}</button>
                <select className="select w-auto text-xs" value={positionFilter} onChange={(event) => setPositionFilter(event.target.value as typeof positionFilter)} aria-label="Filtrar por posición">
                  <option value="all">Todas</option>
                  {POSITIONS.map((position) => <option key={position} value={position}>{position}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-2 text-[0.6rem] text-[var(--muted)]">Ordenado por {labels[category].toLowerCase()} por partido. Mínimo un partido jugado.</div>
          </div>
          {shown.length === 0 ? <EmptyState title="Sin jugadores en este filtro" message="Cambia el equipo o la posición para ver otros jugadores." /> : (
            <>
              <div className="card hidden overflow-hidden md:block">
                <div className="table-wrap">
                  <table className="data-table">
                    <thead><tr><th>#</th><th>Jugador</th><th>Equipo</th><th>Pos</th><th>PJ</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>ROB</th><th>TAP</th><th>TC%</th><th>3P%</th><th>TL%</th></tr></thead>
                    <tbody>{shown.map((row, index) => (
                      <tr key={row.player.id} className="cursor-pointer" onClick={() => setSelected(row.player)}>
                        <td className="tabular text-[var(--muted)]">{index + 1}</td>
                        <td><div className="flex items-center gap-2"><PlayerAvatar player={row.player} size={26} /><span className="font-semibold">{row.player.name}</span></div></td>
                        <td><span className="flex items-center gap-1.5"><TeamMark team={row.team} size={20} />{row.team.abbreviation}</span></td>
                        <td><span className="chip">{row.player.position}</span></td>
                        <td className="tabular">{row.games}</td>
                        <td className="tabular text-[var(--muted)]">{(row.total.minutes / Math.max(1, row.games)).toFixed(0)}</td>
                        <td className="tabular font-bold">{row.ppg.toFixed(1)}</td><td className="tabular">{row.rpg.toFixed(1)}</td><td className="tabular">{row.apg.toFixed(1)}</td><td className="tabular">{row.spg.toFixed(1)}</td><td className="tabular">{row.bpg.toFixed(1)}</td>
                        <td className="tabular text-[var(--muted)]">{row.fgPct.toFixed(1)}</td><td className="tabular text-[var(--muted)]">{row.tpPct.toFixed(1)}</td><td className="tabular text-[var(--muted)]">{row.ftPct.toFixed(1)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
              <div className="grid gap-1.5 md:hidden">
                {shown.map((row, index) => (
                  <button type="button" key={row.player.id} className="row-card flex items-center gap-2.5" onClick={() => setSelected(row.player)}>
                    <span className="w-4 text-[0.58rem] text-[var(--muted)] tabular">{index + 1}</span>
                    <PlayerAvatar player={row.player} size={31} />
                    <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{row.player.name}</span><span className="block text-[0.55rem] text-[var(--muted)]">{row.team.abbreviation} · {row.games} PJ · {Math.round(row.total.minutes / Math.max(1, row.games))} MIN</span></span>
                    <span className="text-right"><span className="block text-sm font-black tabular">{row[category].toFixed(1)}</span><span className="block text-[0.5rem] uppercase text-[var(--muted)]">{labels[category]}</span></span>
                  </button>
                ))}
              </div>
              {visible < sorted.length && <button type="button" className="btn mt-3 w-full" onClick={() => setVisible((count) => count + 25)}>Mostrar más jugadores</button>}
            </>
          )}
        </>
      )}
      {selected && <PlayerDrawer player={selected} team={selectedTeam} onClose={() => setSelected(null)} />}
    </div>
  );
}

export function SavesPage({ view }: { view: LeagueView }) {
  const { bundle, savedLeagues, onSaveNow, onOpenLeague, onExit, saveState, saveError, clearSaveError } = view;
  const [storage, setStorage] = useState<{ usage: number; quota: number; persisted: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refreshStorage = async () => {
    setLoading(true);
    try {
      setStorage(await getStorageReport());
      setStorageError(null);
    } catch (caught) {
      setStorageError(caught instanceof Error ? caught.message : "No se pudo leer el estado del almacenamiento.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refreshStorage(); }, []);

  const save = async () => {
    setNotice(null);
    try {
      await onSaveNow();
      setNotice("Liga y equipos guardados en IndexedDB. Los partidos ya se guardan automáticamente.");
      await refreshStorage();
    } catch (caught) {
      setStorageError(caught instanceof Error ? caught.message : "No se pudo guardar la liga.");
    }
  };

  const open = async (id: string) => {
    setOpening(id);
    setStorageError(null);
    try {
      await onOpenLeague(id);
    } catch (caught) {
      setStorageError(caught instanceof Error ? caught.message : "No se pudo abrir la liga.");
      setOpening(null);
    }
  };

  const played = bundle.games.filter((game) => game.played).length;
  return (
    <div className="screen-fade">
      <PageHeader eyebrow="Persistencia local" title="Guardado y carga" subtitle="Todo vive en la IndexedDB de este navegador. No hay cuentas, servidores ni reseteos automáticos al actualizar el esquema." actions={<button type="button" className="btn btn-solid btn-sm" onClick={() => void save()} disabled={saveState === "saving"}><Icon name="save" size={13} /> {saveState === "saving" ? "Guardando…" : "Guardar ahora"}</button>} />
      {(saveError || storageError) && <div className="mb-3 flex items-start gap-2 rounded-xl border border-[var(--line-strong)] p-3 text-[0.7rem]"><Icon name="alert" size={15} className="mt-0.5 shrink-0" /><span className="flex-1">{saveError ?? storageError}</span><button type="button" onClick={() => { clearSaveError(); setStorageError(null); }} className="text-[var(--muted)]" aria-label="Cerrar error"><Icon name="close" size={14} /></button></div>}
      {notice && <div className="mb-3 flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3 text-[0.7rem]"><Icon name="check" size={14} className="text-[var(--good)]" /><span>{notice}</span></div>}
      <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3"><div><div className="overline">Liga activa</div><h2 className="text-sm font-bold">{bundle.league.name}</h2></div><span className="chip chip-solid">{bundle.league.mode === "real" ? "Real" : "Ficticia"}</span></div>
          <div className="grid grid-cols-2 gap-2 p-3">
            <StatBlock label="Equipos" value={bundle.teams.length} />
            <StatBlock label="Jugadores" value={bundle.players.length} />
            <StatBlock label="Partidos jugados" value={`${played}/${bundle.games.length}`} />
            <StatBlock label="Progreso" value={`${bundle.games.length ? Math.round((played / bundle.games.length) * 100) : 0}%`} />
          </div>
          <div className="space-y-2 px-4 pb-4 text-[0.65rem]">
            <div className="flex justify-between gap-2 border-b border-[var(--line)] pb-2"><span className="text-[var(--muted)]">Modo de juego</span><span className="font-semibold">{bundle.league.playMode === "manager" ? "Manager" : "Espectador"}</span></div>
            <div className="flex justify-between gap-2 border-b border-[var(--line)] pb-2"><span className="text-[var(--muted)]">Tu equipo</span><span className="font-semibold">{bundle.teams.find((team) => team.id === bundle.league.userTeamId)?.name ?? "—"}</span></div>
            <div className="flex justify-between gap-2 border-b border-[var(--line)] pb-2"><span className="text-[var(--muted)]">Esquema de liga</span><span className="font-semibold">v{bundle.league.schemaVersion} / app v{APP_SCHEMA_VERSION}</span></div>
            <div className="flex justify-between gap-2 border-b border-[var(--line)] pb-2"><span className="text-[var(--muted)]">Creada</span><span className="font-semibold">{formatDate(bundle.league.createdAt)}</span></div>
            <div className="flex justify-between gap-2"><span className="text-[var(--muted)]">Última escritura</span><span className="font-semibold">{formatDate(bundle.league.updatedAt)}</span></div>
          </div>
        </div>
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3"><div><div className="overline">Almacenamiento</div><h2 className="text-sm font-bold">IndexedDB</h2></div><button type="button" className="btn btn-sm btn-quiet" onClick={() => void refreshStorage()}><Icon name="refresh" size={13} /> Actualizar</button></div>
          <div className="p-4">
            {loading ? <div className="animate-pulse space-y-2"><div className="h-3 w-2/3 rounded bg-[var(--surface-3)]" /><div className="h-3 w-1/2 rounded bg-[var(--surface-3)]" /></div> : storage && (
              <>
                <div className="flex items-baseline justify-between"><span className="text-[0.62rem] text-[var(--muted)]">Uso aproximado</span><span className="text-lg font-black tabular">{formatBytes(storage.usage)}</span></div>
                <div className="meter mt-1"><span style={{ width: `${storage.quota ? Math.min(100, Math.max(2, (storage.usage / storage.quota) * 100)) : 2}%` }} /></div>
                <div className="mt-1 flex justify-between text-[0.55rem] text-[var(--muted)]"><span>{formatBytes(storage.quota)} disponibles según el navegador</span><span>{storage.persisted ? "Persistente" : "No persistente"}</span></div>
              </>
            )}
            <div className="mt-4 space-y-1.5 text-[0.62rem] text-[var(--muted)]">
              <div className="flex items-center gap-1.5"><Icon name="database" size={12} /> Base: <span className="font-mono text-[var(--ink-soft)]">{DB_NAME}</span></div>
              <div className="flex items-center gap-1.5"><Icon name="shield" size={12} /> Versión de IndexedDB: {DB_VERSION}. Migraciones aditivas.</div>
              <div className="flex items-center gap-1.5"><Icon name="save" size={12} /> Resultados con escritura automática por jornada.</div>
            </div>
            <div className="mt-4 flex flex-col gap-1.5">
              <button type="button" className="btn btn-solid w-full justify-between" onClick={() => void save()}><span>Guardar metadatos y equipos</span><Icon name="save" size={14} /></button>
              <button type="button" className="btn w-full justify-between" onClick={onExit}><span>Volver al inicio</span><Icon name="home" size={14} /></button>
            </div>
          </div>
        </div>
      </div>

      <section className="mt-5">
        <div className="mb-2 flex items-end justify-between"><div><div className="overline">Partidas recuperables</div><h2 className="text-lg font-extrabold tracking-[-0.035em]">Ligas guardadas</h2></div><span className="chip">{savedLeagues.length} ligas</span></div>
        {savedLeagues.length === 0 ? <div className="card p-6 text-center text-xs text-[var(--muted)]"><Icon name="database" size={20} className="mx-auto mb-2" />No hay metadatos de ligas recuperables.</div> : (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {savedLeagues.map((league) => (
              <div key={league.id} className={cn("card p-3.5", league.id === bundle.league.id && "ring-1 ring-[var(--ink)]")}>
                <div className="flex items-center justify-between gap-1"><span className="chip">{league.mode === "real" ? "NBA Real" : "NBA Ficticia"}</span><span className="text-[0.56rem] text-[var(--muted)]">{league.playerCount} jugadores</span></div>
                <h3 className="mt-2 truncate text-sm font-bold">{league.name}</h3>
                <div className="mt-0.5 truncate text-[0.62rem] text-[var(--muted)]">{league.userTeamName} · {league.playMode === "manager" ? "Manager" : "Espectador"}</div>
                <div className="mt-2.5"><div className="mb-1 flex justify-between text-[0.55rem] text-[var(--muted)]"><span>Progreso</span><span>{league.progress}%</span></div><div className="meter"><span style={{ width: `${Math.max(2, league.progress)}%` }} /></div></div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-[0.55rem] text-[var(--muted)]">{formatDate(league.updatedAt)}</span>
                  <button type="button" className="btn btn-sm" onClick={() => void open(league.id)} disabled={league.id === bundle.league.id || opening !== null}>{league.id === bundle.league.id ? "Abierta" : opening === league.id ? "Abriendo…" : "Abrir"}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <p className="mt-3 flex items-start gap-1.5 text-[0.6rem] leading-relaxed text-[var(--muted)]"><Icon name="info" size={12} className="mt-0.5 shrink-0" /> No existe borrado automático ni migración destructiva. Si el navegador borra los datos del sitio (por ejemplo, limpieza manual o modo privado), la partida no se puede recuperar desde aquí.</p>
    </div>
  );
}

export function SettingsPage({ view }: { view: LeagueView }) {
  const { bundle, userTeam, onChangePlayMode, onChangeTheme, onRenameLeague, onSaveNow, onExit, saveState } = view;
  const [name, setName] = useState(bundle.league.name);
  const [savingName, setSavingName] = useState(false);
  const [modeSaving, setModeSaving] = useState(false);
  const [themeSaving, setThemeSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setName(bundle.league.name); }, [bundle.league.name]);

  const run = async (task: () => Promise<void>, message: string) => {
    setError(null);
    setNotice(null);
    try { await task(); setNotice(message); } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo guardar el cambio."); }
  };

  const rename = async (event: React.FormEvent) => {
    event.preventDefault();
    if (name.trim().length < 3) { setError("El nombre debe tener al menos 3 caracteres."); return; }
    setSavingName(true);
    await run(() => onRenameLeague(name.trim()), "Nombre de liga actualizado.");
    setSavingName(false);
  };

  const changeMode = async (mode: "manager" | "spectator") => {
    setModeSaving(true);
    await run(() => onChangePlayMode(mode), mode === "manager" ? "Modo manager activado. Puedes editar tu rotación." : "Modo espectador activado. La IA controla todo.");
    setModeSaving(false);
  };

  const changeTheme = async (theme: typeof bundle.league.theme) => {
    setThemeSaving(true);
    await run(() => onChangeTheme(theme), "Tema de la liga actualizado.");
    setThemeSaving(false);
  };

  return (
    <div className="screen-fade">
      <PageHeader eyebrow="Configuración de liga" title="Ajustes de liga" subtitle="El modo Manager/Espectador y el tema se guardan con esta liga, no afectan a tus otras partidas." actions={<button type="button" className="btn btn-sm" onClick={() => void onSaveNow()} disabled={saveState === "saving"}><Icon name="save" size={13} /> Guardar</button>} />
      {(notice || error) && <div className={cn("mb-3 flex items-center gap-2 rounded-xl border p-3 text-[0.7rem]", error ? "border-[var(--line-strong)]" : "border-[var(--line)] bg-[var(--surface-2)]")}><Icon name={error ? "alert" : "check"} size={14} /><span className="flex-1">{error ?? notice}</span><button type="button" onClick={() => { setNotice(null); setError(null); }} aria-label="Cerrar mensaje"><Icon name="close" size={13} /></button></div>}
      <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-3">
          <section className="card p-4">
            <div className="overline">Identidad</div>
            <h2 className="mt-1 text-sm font-bold">Nombre de la liga</h2>
            <form className="mt-2.5 flex flex-col gap-2 sm:flex-row" onSubmit={(event) => void rename(event)}>
              <input className="field text-xs" value={name} maxLength={60} onChange={(event) => setName(event.target.value)} aria-label="Nombre de la liga" />
              <button type="submit" className="btn shrink-0" disabled={savingName || name.trim() === bundle.league.name}>{savingName ? "Guardando…" : "Renombrar"}</button>
            </form>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="card-soft p-2.5"><div className="text-[0.52rem] font-bold uppercase tracking-wide text-[var(--muted)]">Universo</div><div className="mt-1 text-xs font-semibold">{bundle.league.mode === "real" ? "NBA Real" : "NBA Ficticia"}</div></div>
              <div className="card-soft p-2.5"><div className="text-[0.52rem] font-bold uppercase tracking-wide text-[var(--muted)]">Tu franquicia</div><div className="mt-1 truncate text-xs font-semibold">{userTeam.city} {userTeam.name}</div></div>
              <div className="card-soft p-2.5"><div className="text-[0.52rem] font-bold uppercase tracking-wide text-[var(--muted)]">Semilla</div><div className="mt-1 truncate font-mono text-[0.68rem]">{bundle.league.seed}</div></div>
              <div className="card-soft p-2.5"><div className="text-[0.52rem] font-bold uppercase tracking-wide text-[var(--muted)]">ID de liga</div><div className="mt-1 truncate font-mono text-[0.62rem] text-[var(--muted)]">{bundle.league.id}</div></div>
            </div>
          </section>

          <section className="card p-4">
            <div className="overline">Control de la partida</div>
            <h2 className="mt-1 text-sm font-bold">Modo de juego</h2>
            <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
              {(["manager", "spectator"] as const).map((mode) => (
                <button key={mode} type="button" onClick={() => void changeMode(mode)} disabled={modeSaving || bundle.league.playMode === mode} className={cn("row-card p-3", bundle.league.playMode === mode && "border-[var(--ink)] bg-[var(--surface-2)] ring-1 ring-[var(--ink)]")}>
                  <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-xs font-bold"><Icon name={mode === "manager" ? "target" : "eye"} size={16} />{mode === "manager" ? "Manager" : "Espectador"}</span>{bundle.league.playMode === mode && <span className="chip">Activo</span>}</div>
                  <p className="mt-1.5 text-[0.62rem] leading-relaxed text-[var(--muted)]">{mode === "manager" ? "Controlas la rotación y la filosofía de tu equipo. La IA gestiona los otros 29." : "La IA gestiona absolutamente todo. No hay edición de rotación ni decisiones del usuario."}</p>
                </button>
              ))}
            </div>
            <p className="mt-2 flex items-start gap-1.5 text-[0.6rem] leading-relaxed text-[var(--muted)]"><Icon name="info" size={12} className="mt-0.5 shrink-0" /> Cambiar de modo no borra resultados ni jugadores. En Espectador se conserva la rotación previa por si vuelves a Manager.</p>
          </section>

          <section className="card p-4">
            <div className="overline">Apariencia</div>
            <h2 className="mt-1 text-sm font-bold">Tema blanco y negro</h2>
            <p className="mt-1 text-[0.62rem] text-[var(--muted)]">Ajuste independiente de esta liga. Los cuatro tonos mantienen la paleta monocroma.</p>
            <div className="mt-2.5"><ThemePicker value={bundle.league.theme} onChange={(theme) => void changeTheme(theme)} /></div>
            {themeSaving && <div className="mt-2 flex items-center gap-1.5 text-[0.6rem] text-[var(--muted)]"><Icon name="refresh" size={12} className="animate-spin" /> Aplicando y guardando…</div>}
          </section>

          <section className="card p-4">
            <div className="overline">Datos de la partida</div>
            <div className="mt-2 space-y-1.5 text-[0.65rem]">
              <div className="flex justify-between border-b border-[var(--line)] pb-2"><span className="text-[var(--muted)]">Equipos</span><span className="font-semibold">{bundle.teams.length}</span></div>
              <div className="flex justify-between border-b border-[var(--line)] pb-2"><span className="text-[var(--muted)]">Jugadores</span><span className="font-semibold">{bundle.players.length} ({bundle.players.filter((player) => player.real).length} reales / {bundle.players.filter((player) => !player.real).length} ficticios)</span></div>
              <div className="flex justify-between border-b border-[var(--line)] pb-2"><span className="text-[var(--muted)]">Calendario</span><span className="font-semibold">{bundle.games.length} partidos / 29 jornadas</span></div>
              <div className="flex justify-between border-b border-[var(--line)] pb-2"><span className="text-[var(--muted)]">Esquema</span><span className="font-semibold">v{bundle.league.schemaVersion}</span></div>
              <div className="flex justify-between"><span className="text-[var(--muted)]">Temporada</span><span className="font-semibold">{bundle.league.season} · Fase 1</span></div>
            </div>
          </section>
        </div>

        <aside className="space-y-3">
          <div className="card-inverse p-4">
            <div className="overline opacity-60">Cómo se juega</div>
            <h2 className="mt-1 text-base font-extrabold">Una sola resolución.</h2>
            <p className="mt-2 text-[0.68rem] leading-relaxed opacity-70">El marcador, las estadísticas individuales y el play-by-play salen del mismo motor de posesiones. No hay dos simuladores que puedan contradecirse.</p>
            <div className="mt-3 flex flex-wrap gap-1">{["100 posesiones", "16 atributos", "OVR posicional", "POT estimado", "IndexedDB"].map((item) => <span key={item} className="rounded-full border border-current/25 px-2 py-1 text-[0.55rem] font-bold uppercase tracking-wide">{item}</span>)}</div>
          </div>
          <div className="card p-4">
            <div className="overline">Atajos</div>
            <div className="mt-2 space-y-1.5">
              <button type="button" className="btn w-full justify-between" onClick={() => void onSaveNow()}><span>Guardar ahora</span><Icon name="save" size={14} /></button>
              <button type="button" className="btn w-full justify-between" onClick={onExit}><span>Salir al inicio</span><Icon name="home" size={14} /></button>
            </div>
            <p className="mt-2 text-[0.58rem] leading-relaxed text-[var(--muted)]">No se puede eliminar una liga desde esta pantalla. Esta fase evita operaciones destructivas.</p>
          </div>
          {bundle.league.mode === "real" && (
            <div className="card p-4">
              <div className="flex items-center justify-between"><div className="overline">Base real</div><span className="chip chip-warn">{bundle.players.filter((player) => player.real).length < 500 ? "Snapshot anterior" : "Corte 28/10/2026"}</span></div>
              <h3 className="mt-1 text-xs font-bold">{bundle.players.filter((player) => player.real).length < 500 ? "Liga real creada con base anterior" : "Plantillas 2026-27 · identidad parcial"}</h3>
              <p className="mt-1 text-[0.62rem] leading-relaxed text-[var(--muted)]">Pertenencia y two-way contrastados con fuentes del 27 y 24 de octubre de 2026. Nacionalidad, universidad, algunos dorsales y salarios siguen pendientes. Las ligas anteriores conservan su snapshot sin migración destructiva. Consulta Datos y fuentes.</p>
              <button type="button" className="btn btn-sm mt-2 w-full" onClick={() => view.onNavigate("data")}>Ver procedencia</button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

export function DataPage({ view }: { view: LeagueView }) {
  const { bundle, simulateRound, simulateBusy } = view;
  const [report, setReport] = useState<AuditReport | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teamListOpen, setTeamListOpen] = useState(false);
  const real = bundle.league.mode === "real";
  const realTeams = real ? bundle.teams : [];
  const playableReal = bundle.players.filter((player) => player.real);
  const legacyReal = real && playableReal.length < 500;
  const realTwoWay = playableReal.filter((player) => player.contractType === "two-way").length;
  const realRosterSizes = realTeams.map((team) => bundle.players.filter((player) => player.teamId === team.id).length);

  const runAudit = () => {
    setRunning(true);
    setError(null);
    window.setTimeout(() => {
      try {
        setReport(auditBundle(bundle, { simulateSamples: 3 }));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "La auditoría no pudo completarse.");
      } finally {
        setRunning(false);
      }
    }, 40);
  };

  return (
    <div className="screen-fade">
      <PageHeader eyebrow="Procedencia, límites y validación" title="Datos y fuentes" subtitle="La Fase 1 distingue datos reales parciales de contenido ficticio generado. Ningún dato desconocido se rellena con una invención silenciosa." actions={<button type="button" className="btn btn-solid btn-sm" onClick={runAudit} disabled={running}>{running ? <Icon name="refresh" size={13} className="animate-spin" /> : <Icon name="shield" size={13} />} {running ? "Validando…" : "Ejecutar auditoría"}</button>} />
      {error && <div className="mb-3 rounded-xl border border-[var(--line-strong)] p-3 text-[0.7rem]"><Icon name="alert" size={14} className="mr-1 inline" />{error}</div>}

      <div className="grid gap-3 lg:grid-cols-3">
        <div className={cn("card p-4", real && "ring-1 ring-[var(--line-strong)]")}>
          <div className="flex items-center justify-between"><div className="overline">Universo</div><span className={cn("chip", real && "chip-warn")}>{real ? "NBA Real" : "NBA Ficticia"}</span></div>
          <h2 className="mt-1 text-lg font-extrabold tracking-[-0.03em]">{real ? "Base real documentada" : "Generación reproducible"}</h2>
          <div className="mt-2 space-y-1 text-[0.65rem]">
            <div className="flex justify-between border-b border-[var(--line)] pb-1.5"><span className="text-[var(--muted)]">Franquicias</span><span className="font-bold">{bundle.teams.length}/30</span></div>
            <div className="flex justify-between border-b border-[var(--line)] pb-1.5"><span className="text-[var(--muted)]">Jugadores por equipo</span><span className="font-bold">{real ? `${Math.min(...realRosterSizes)}–${Math.max(...realRosterSizes)} reales` : "12 ficticios"}</span></div>
            <div className="flex justify-between border-b border-[var(--line)] pb-1.5"><span className="text-[var(--muted)]">Jugadores totales</span><span className="font-bold">{bundle.players.length}</span></div>
            <div className="flex justify-between"><span className="text-[var(--muted)]">Semilla</span><span className="max-w-[160px] truncate font-mono text-[0.6rem]">{bundle.league.seed}</span></div>
          </div>
          {real && <p className="mt-2 rounded-lg border border-dashed border-[var(--line-strong)] p-2 text-[0.6rem] leading-relaxed text-[var(--muted)]">{DATA_PROVENANCE.note}</p>}
        </div>
        <div className="card p-4">
          <div className="overline">Estado de los datos reales</div>
          <h2 className="mt-1 text-lg font-extrabold tracking-[-0.03em]">{real ? `${realTeams.length}/30 plantillas 2026-27 cargadas` : "No aplica a este universo"}</h2>
          {real ? (
            <>
              <div className="mt-2 space-y-1.5 text-[0.64rem]">
                <div className="flex items-start gap-2"><Icon name={legacyReal ? "alert" : "check"} size={13} className="mt-0.5 shrink-0" /><span><strong>{legacyReal ? "Snapshot anterior:" : "Corte 28/10/2026:"}</strong> {legacyReal ? "esta liga se creó con una base real anterior y conserva sus jugadores y resultados. No se migra de forma destructiva; crea una liga nueva para usar las plantillas 2026-27." : `${playableReal.length} fichas reales, ${realTwoWay} two-way y ${playableReal.length - realTwoWay} estándar. Pertenencia contrastada con el páginas oficiales de NBA.com consultadas el 28/10/2026.`}</span></div>
                <div className="flex items-start gap-2"><Icon name="alert" size={13} className="mt-0.5 shrink-0" /><span><strong>Verificación oficial NBA.com por equipo:</strong> 30/30 páginas de NBA.com consultadas el 28/10/2026 (SEASON 2026). El tracker two-way del 24/10/2026 se usó como contraste; la base oficial registra 89 two-way.</span></div>
                <div className="flex items-start gap-2"><Icon name="info" size={13} className="mt-0.5 shrink-0" /><span><strong>Dorsal, nacionalidad y universidad:</strong> {playableReal.filter((player) => player.jerseyPending).length} sin dorsal y {playableReal.filter((player) => player.college.startsWith("No ")).length} sin universidad verificada en la fuente. La nacionalidad ({playableReal.filter((player) => player.nationality.startsWith("No ")).length} pendientes) no forma parte del JSON oficial de plantillas. Salarios y términos de contrato no se inventan.</span></div>
              </div>
              <div className="mt-3 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-2.5"><div className="text-[0.52rem] font-bold uppercase tracking-wide text-[var(--muted)]">Resumen exacto de esta liga</div><p className="mt-1 text-[0.62rem] leading-relaxed">{realTeams.length} equipos cargados. {playableReal.length} fichas reales. {realTwoWay} two-way · {playableReal.length - realTwoWay} estándar. Tamaño por equipo: {Math.min(...realRosterSizes)}–{Math.max(...realRosterSizes)}.</p></div>
            </>
          ) : <p className="mt-2 text-[0.68rem] leading-relaxed text-[var(--muted)]">Los 30 clubs y sus 360 jugadores son ficticios. La historia de cada franquicia parte de datos reales de la NBA, pero la historia deportiva de esta liga es independiente y alternativa. Nada se presenta como dato real.</p>}
        </div>
        <div className="card p-4">
          <div className="overline">Motor y biografías</div>
          <h2 className="mt-1 text-lg font-extrabold tracking-[-0.03em]">{real ? "Atributos = evaluación interna" : "360 perfiles únicos"}</h2>
          <ul className="mt-2 space-y-1.5 text-[0.64rem] leading-relaxed text-[var(--muted)]">
            <li className="flex gap-1.5"><Icon name="check" size={12} className="mt-0.5 shrink-0" /> Las valoraciones reales son estimaciones del simulador, no estadísticas oficiales.</li>
            <li className="flex gap-1.5"><Icon name="check" size={12} className="mt-0.5 shrink-0" /> POT es una estimación de desarrollo basada en edad, nivel y variación; no una predicción estadística avanzada.</li>
            <li className="flex gap-1.5"><Icon name="check" size={12} className="mt-0.5 shrink-0" /> Ningún jugador ficticio copia el nombre de un jugador real: se controla la unicidad de los 360 nombres.</li>
            <li className="flex gap-1.5"><Icon name="check" size={12} className="mt-0.5 shrink-0" /> {real ? "No se inventan contratos, traspasos ni estadísticas oficiales." : "Biografías, trayectorias y arquetipos se generan de forma coherente con atributos y edad."}</li>
          </ul>
        </div>
      </div>

      {report ? (
        <section className="card mt-3 overflow-hidden">
          <div className="flex flex-col gap-2 border-b border-[var(--line)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div><div className="overline">Auditoría ejecutada</div><h2 className="text-sm font-bold">{report.passed ? "Sin fallos bloqueantes" : "Se encontraron fallos"}</h2></div>
            <div className="flex flex-wrap gap-1"><span className="chip">{report.teams} equipos</span><span className="chip">{report.players} jugadores</span><span className="chip">{report.games} partidos</span><span className="chip">{report.simulatedSample} simulaciones de muestra</span></div>
          </div>
          <div className="divide-y divide-[var(--line)]">
            {report.checks.map((check) => (
              <div key={check.id} className="flex items-start gap-2.5 px-4 py-2.5">
                <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border", check.status === "pass" ? "border-[var(--line-strong)] text-[var(--good)]" : check.status === "warn" ? "border-dashed border-[var(--line-strong)] text-[var(--muted)]" : "border-[var(--line-strong)] text-[var(--danger)]")}><Icon name={check.status === "pass" ? "check" : check.status === "warn" ? "info" : "close"} size={11} /></span>
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-1.5"><span className="text-[0.7rem] font-semibold">{check.label}</span><span className="chip">{check.status === "pass" ? "OK" : check.status === "warn" ? "Pendiente" : "Fallo"}</span></div><p className="mt-0.5 text-[0.6rem] leading-relaxed text-[var(--muted)]">{check.detail}</p></div>
              </div>
            ))}
          </div>
          <div className="border-t border-[var(--line)] p-3 text-[0.58rem] text-[var(--muted)]">Auditoría local ejecutada el {new Date(report.generatedAt).toLocaleString("es-ES")}. No sustituye a una validación externa ni verifica datos de la NBA en internet.</div>
        </section>
      ) : (
        <section className="card mt-3 flex flex-col items-center p-6 text-center">
          <Icon name="shield" size={24} className="text-[var(--muted)]" />
          <h2 className="mt-2 text-sm font-bold">Auditoría de la Fase 1 disponible</h2>
          <p className="mt-1 max-w-xl text-[0.68rem] leading-relaxed text-[var(--muted)]">Comprueba 30 equipos, integridad de referencias, atributos 0–100, OVR/POT, perfiles, calendario y tres simulaciones reales con marcador, cuartos y suma de jugadores coherentes.</p>
          <button type="button" className="btn btn-solid mt-3" onClick={runAudit} disabled={running}>{running ? "Ejecutando…" : "Ejecutar ahora"}</button>
        </section>
      )}

      <section className="card mt-3 overflow-hidden">
        <button type="button" className="flex w-full items-center justify-between px-4 py-3 text-left" onClick={() => setTeamListOpen((open) => !open)}>
          <div><div className="overline">Detalle de plantillas reales</div><h2 className="text-sm font-bold">Las 30 franquicias y sus datos pendientes</h2></div>
          <Icon name={teamListOpen ? "chevron-down" : "chevron-right"} size={16} className="text-[var(--muted)]" />
        </button>
        {teamListOpen && (
          <div className="border-t border-[var(--line)]">
            <div className="bg-[var(--surface-2)] px-4 py-2.5 text-[0.62rem] leading-relaxed text-[var(--muted)]"><strong className="text-[var(--ink-soft)]">Campos pendientes según ficha:</strong> nacionalidad (no incluida en el JSON oficial), 1 dorsal, edad exacta y envergadura (estimada cuando falta). Términos y salarios del contrato no verificados. El two-way procede del estado oficial de NBA.com; el estándar se infiere de la pertenencia y la regla 15+3. Las posiciones específicas se conservan o derivan de G/F/C y altura; la posición publicada se muestra en la ficha. Los atributos, OVR y POT son del simulador.</div>
            <div className="max-h-[340px] overflow-y-auto">
              {FRANCHISES.map((franchise) => {
                const team = realTeams.find((item) => item.franchiseId === franchise.id);
                const roster = team ? bundle.players.filter((player) => player.teamId === team.id) : [];
                return (
                  <div key={franchise.id} className="flex items-center gap-2 border-b border-[var(--line)] px-4 py-2 last:border-0">
                    <span className="w-8 font-mono text-[0.58rem] text-[var(--muted)]">{franchise.abbreviation}</span>
                    <span className="min-w-0 flex-1 truncate text-[0.68rem] font-semibold">{franchise.city} {franchise.name}</span>
                    <span className="hidden text-[0.55rem] text-[var(--muted)] sm:block">{franchise.arena}</span>
                    <span className="chip">{real && team ? `${roster.length} fichas · ${roster.filter((player) => player.contractType === "two-way").length} 2W` : "Ficticia"}</span>
                    {real ? <span className="chip chip-warn">{legacyReal ? "Snapshot" : "2026-27"}</span> : <span className="chip">Generada</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <section className="card p-4">
          <div className="flex items-center justify-between"><div className="overline">Fuentes de referencia</div><button type="button" className="btn btn-sm btn-quiet" onClick={() => setTeamListOpen(true)}>Ver cobertura</button></div>
          <div className="mt-2 space-y-2">
            {DATA_PROVENANCE.sources.map((source) => <a key={source.label} href={source.url} target="_blank" rel="noreferrer" className="flex items-start gap-2 text-[0.65rem] text-[var(--ink-soft)] underline-offset-2 hover:underline"><Icon name="sources" size={13} className="mt-0.5 shrink-0 text-[var(--muted)]" /><span className="flex-1">{source.label}</span><Icon name="arrow-right" size={11} className="mt-0.5 shrink-0 text-[var(--muted)]" /></a>)}
          </div>
          <div className="mt-3 rounded-lg border border-dashed border-[var(--line-strong)] p-2.5 text-[0.58rem] leading-relaxed text-[var(--muted)]">Corte de referencia: {DATA_PROVENANCE.cutoff}. Objetivo: {DATA_PROVENANCE.target}. Estado: {DATA_PROVENANCE.status}. La aplicación muestra la fecha y el estado en lugar de afirmar una verificación no realizada.</div>
        </section>
        <section className="card p-4">
          <div className="overline">Motor de partidos</div>
          <h2 className="mt-1 text-sm font-bold">Alcance real de la Fase 1</h2>
          <ul className="mt-2 space-y-1.5">{SIM_MODEL_NOTES.map((note) => <li key={note} className="flex gap-1.5 text-[0.65rem] leading-relaxed text-[var(--muted)]"><Icon name="check" size={12} className="mt-0.5 shrink-0" />{note}</li>)}</ul>
          <button type="button" className="btn btn-sm mt-3" onClick={() => void simulateRound()} disabled={simulateBusy}><Icon name="play" size={12} /> Simular muestra real de la liga</button>
        </section>
      </div>

      <section className="card mt-3 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><div className="overline">Hoja de ruta documentada</div><h2 className="mt-1 text-lg font-extrabold tracking-[-0.03em]">No continuar automáticamente a Fase 2</h2></div><span className="chip">Fase 1 activa</span></div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { phase: "Fase 1", title: "Base del simulador", detail: "Ligas, generación, atributos, OVR/POT, calendario, motor inicial, IndexedDB, exhibición y modos.", current: true },
            { phase: "Fase 2", title: "Motor profundo", detail: "Posesiones completas, play-by-play detallado, faltas y sustituciones realistas.", current: false },
            { phase: "Fase 3", title: "Temporada", detail: "Playoffs, desarrollo, lesiones y premios.", current: false },
            { phase: "Fase 4", title: "Mercado", detail: "Traspasos, contratos, agencia libre, salarios, tope y finanzas.", current: false },
            { phase: "Fase 5", title: "Draft", detail: "Draft NBA, scouting, rookies, historial y récords.", current: false },
            { phase: "Fase 6", title: "Cuerpo técnico", detail: "Entrenadores, tácticas, rotaciones, química y decisiones de la IA.", current: false },
            { phase: "Fase 7", title: "Legado", detail: "Múltiples temporadas, envejecimiento, retiradas, Hall of Fame y expansión histórica.", current: false },
            { phase: "Después", title: "Mejoras", detail: "Interfaz, estadísticas avanzadas y balance del motor.", current: false },
          ].map((item) => (
            <div key={item.phase} className={cn("rounded-lg border p-3", item.current ? "border-[var(--line-strong)] bg-[var(--surface-2)]" : "border-[var(--line)]")}>
              <div className="flex items-center justify-between"><span className="text-[0.52rem] font-bold uppercase tracking-wide text-[var(--muted)]">{item.phase}</span>{item.current ? <span className="chip chip-solid">Ahora</span> : <span className="chip">Plan</span>}</div>
              <div className="mt-1.5 text-xs font-bold">{item.title}</div>
              <p className="mt-1 text-[0.6rem] leading-relaxed text-[var(--muted)]">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
