import { useMemo, useState } from "react";
import type { Player, Position, Team } from "@/types";
import { PlayerDrawer, TeamDrawer } from "@/components/details";
import { EmptyState, Icon, OvrBadge, PageHeader, PlayerAvatar, TeamMark } from "@/components/ui";
import { formatHeight, formatRecord, rosterOf, teamAverageOvr, teamRecord } from "@/game/selectors";
import { POSITION_LABEL, POSITIONS } from "@/game/ratings";
import { cn } from "@/utils/cn";
import type { LeagueView } from "./leagueTypes";

export function TeamsPage({ view }: { view: LeagueView }) {
  const { bundle, userTeam, onNavigate } = view;
  const [conference, setConference] = useState<"Todas" | "Este" | "Oeste">("Todas");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"ovr" | "record" | "city">("ovr");
  const [team, setTeam] = useState<Team | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);

  const teams = useMemo(() => {
    const list = [...bundle.teams].filter((item) =>
      (conference === "Todas" || item.conference === conference) &&
      `${item.city} ${item.name} ${item.abbreviation} ${item.division}`.toLowerCase().includes(query.toLowerCase()),
    );
    return list.sort((a, b) => {
      if (sort === "city") return a.city.localeCompare(b.city);
      if (sort === "record") {
        const ra = teamRecord(a.id, bundle.games);
        const rb = teamRecord(b.id, bundle.games);
        const diffA = ra.pointsFor - ra.pointsAgainst;
        const diffB = rb.pointsFor - rb.pointsAgainst;
        return rb.wins - ra.wins || diffB - diffA || rb.pointsFor - ra.pointsFor;
      }
      return teamAverageOvr(bundle.players, b.id) - teamAverageOvr(bundle.players, a.id);
    });
  }, [bundle, conference, query, sort]);

  return (
    <div className="screen-fade">
      <PageHeader eyebrow="Directorio de franquicias" title="Equipos" subtitle="Consulta plantillas, historia, arena y rendimiento. Los equipos no tienen escudos oficiales: usamos un sello tipográfico propio." actions={<button type="button" className="btn btn-sm" onClick={() => onNavigate("standings")}><Icon name="standings" size={13} /> Clasificación</button>} />
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="pill-nav">
          {(["Todas", "Este", "Oeste"] as const).map((item) => <button key={item} type="button" className={conference === item ? "active" : ""} onClick={() => setConference(item)}>{item}</button>)}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1 sm:w-56">
            <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input className="field pl-9 text-xs" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar franquicia…" aria-label="Buscar equipo" />
          </div>
          <select className="select w-36 text-xs" value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} aria-label="Ordenar equipos">
            <option value="ovr">Media OVR</option>
            <option value="record">Récord</option>
            <option value="city">Ciudad</option>
          </select>
        </div>
      </div>
      {teams.length === 0 ? (
        <EmptyState title="Ningún equipo coincide" message="Prueba con otra búsqueda o cambia la conferencia." action={<button type="button" className="btn" onClick={() => { setQuery(""); setConference("Todas"); }}>Limpiar filtros</button>} />
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {teams.map((item) => {
            const record = teamRecord(item.id, bundle.games);
            const roster = rosterOf(bundle.players, item.id);
            return (
              <button key={item.id} type="button" onClick={() => setTeam(item)} className={cn("card p-3.5 text-left transition hover:border-[var(--line-strong)]", item.id === userTeam.id && "ring-1 ring-[var(--ink)]")}>
                <div className="flex items-start gap-3">
                  <TeamMark team={item} size={44} outline={item.id !== userTeam.id} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-[0.62rem] text-[var(--muted)]">{item.city}</span>
                      {item.id === userTeam.id && <span className="chip">Tu equipo</span>}
                    </div>
                    <div className="truncate text-sm font-extrabold tracking-[-0.02em]">{item.name}</div>
                    <div className="mt-1 flex flex-wrap gap-1"><span className="chip">{item.conference}</span><span className="chip chip-outline">{item.division}</span></div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[var(--line)] pt-2.5 text-center">
                  <div><div className="text-[0.5rem] font-bold uppercase tracking-wide text-[var(--muted)]">Récord</div><div className="mt-0.5 text-xs font-bold tabular">{formatRecord(record)}</div></div>
                  <div><div className="text-[0.5rem] font-bold uppercase tracking-wide text-[var(--muted)]">Media OVR</div><div className="mt-0.5 text-xs font-bold tabular">{teamAverageOvr(bundle.players, item.id)}</div></div>
                  <div><div className="text-[0.5rem] font-bold uppercase tracking-wide text-[var(--muted)]">Plantilla</div><div className="mt-0.5 text-xs font-bold tabular">{roster.length}</div></div>
                </div>
              </button>
            );
          })}
        </div>
      )}
      {team && !player && <TeamDrawer team={team} players={bundle.players.filter((item) => item.teamId === team.id)} onClose={() => setTeam(null)} onSelectPlayer={(item) => setPlayer(item)} record={formatRecord(teamRecord(team.id, bundle.games))} />}
      {player && <PlayerDrawer player={player} team={bundle.teams.find((item) => item.id === player.teamId)} onClose={() => setPlayer(null)} />}
    </div>
  );
}

function activeRotation(team: Team, roster: Player[]): string[] {
  const valid = (team.rotation ?? []).filter((id) => roster.some((player) => player.id === id));
  if (valid.length >= 5) return valid.slice(0, 10);
  const fallback = roster.map((player) => player.id);
  const combined = [...valid, ...fallback.filter((id) => !valid.includes(id))];
  return combined.slice(0, 10);
}

export function RosterPage({ view }: { view: LeagueView }) {
  const { bundle, userTeam, onUpdateTeam, onNavigate, onChangePlayMode } = view;
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const isManager = bundle.league.playMode === "manager";
  const roster = rosterOf(bundle.players, userTeam.id);
  const activeIds = activeRotation(userTeam, roster);
  const active = activeIds.map((id) => roster.find((player) => player.id === id)).filter((player): player is Player => Boolean(player));
  const inactive = roster.filter((player) => !activeIds.includes(player.id));
  const positions = POSITIONS.map((position) => ({ position, count: roster.filter((player) => player.position === position).length }));
  const avg = teamAverageOvr(bundle.players, userTeam.id);
  const record = teamRecord(userTeam.id, bundle.games);

  const persist = async (next: Team, message: string) => {
    setError(null);
    setSavedNotice(null);
    setSaving(true);
    try {
      await onUpdateTeam(next);
      setSavedNotice(message);
      window.setTimeout(() => setSavedNotice(null), 2500);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar el ajuste.");
    } finally {
      setSaving(false);
    }
  };

  const updateOrder = (id: string, direction: -1 | 1) => {
    const index = activeIds.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= activeIds.length) return;
    const next = [...activeIds];
    [next[index], next[target]] = [next[target], next[index]];
    void persist({ ...userTeam, rotation: next }, "Rotación guardada.");
  };

  const setMinutes = (playerId: string, value: number) => {
    const current = userTeam.rotationMinutes ?? {};
    const fallback = activeIds.indexOf(playerId) < 5 ? 34 : 14;
    const nextMinutes = { ...current, [playerId]: Math.min(42, Math.max(4, (current[playerId] ?? fallback) + value)) };
    void persist({ ...userTeam, rotation: activeIds, rotationMinutes: nextMinutes }, "Minutos actualizados.");
  };

  const include = (playerId: string) => {
    if (activeIds.length < 10) void persist({ ...userTeam, rotation: [...activeIds, playerId] }, "Jugador activado.");
    else void persist({ ...userTeam, rotation: [...activeIds.slice(0, 9), playerId] }, "Jugador activado en el último puesto.");
  };

  const exclude = (playerId: string) => {
    if (activeIds.length <= 5) { setError("La rotación necesita al menos 5 jugadores."); return; }
    const minutes = { ...(userTeam.rotationMinutes ?? {}) };
    delete minutes[playerId];
    void persist({ ...userTeam, rotation: activeIds.filter((id) => id !== playerId), rotationMinutes: minutes }, "Jugador enviado al banquillo.");
  };

  const restoreAuto = () => void persist({ ...userTeam, rotation: roster.slice(0, 10).map((player) => player.id), rotationMinutes: undefined, philosophy: "Equilibrado" }, "Rotación automática restablecida.");

  return (
    <div className="screen-fade">
      <PageHeader eyebrow="Construcción del equipo" title={`${userTeam.city} ${userTeam.name}`} subtitle={isManager ? "Gestiona la rotación y la prioridad de minutos. La IA decide los cambios y los minutos reales se acumulan por tiempo en cancha." : "Modo espectador activo: la IA mantiene la rotación. Puedes consultar todas las fichas."} actions={<><span className="chip">{formatRecord(record)}</span><span className="chip">OVR medio {avg}</span><button type="button" className="btn btn-sm" onClick={() => onNavigate("teams")}><Icon name="teams" size={13} /> Equipos</button></>} />

      <div className="mb-3 grid gap-2 sm:grid-cols-4">
        <div className="card p-3"><div className="overline">Plantilla</div><div className="mt-1 text-xl font-black tabular">{roster.length}<span className="ml-1 text-[0.6rem] font-semibold text-[var(--muted)]">jugadores</span></div></div>
        <div className="card p-3"><div className="overline">Rotación activa</div><div className="mt-1 text-xl font-black tabular">{active.length}<span className="ml-1 text-[0.6rem] font-semibold text-[var(--muted)]">/ 10</span></div></div>
        <div className="card p-3"><div className="overline">Potencial medio</div><div className="mt-1 text-xl font-black tabular">{roster.length ? Math.round(roster.reduce((sum, player) => sum + player.pot, 0) / roster.length) : 0}</div></div>
        <div className="card p-3"><div className="overline">Edad media</div><div className="mt-1 text-xl font-black tabular">{roster.length ? (roster.reduce((sum, player) => sum + player.age, 0) / roster.length).toFixed(1) : "—"}</div></div>
      </div>

      {!isManager && (
        <div className="mb-3 flex flex-col gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3 text-xs sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2 text-[var(--muted)]"><Icon name="eye" size={15} /> Estás observando. La IA decide rotaciones y minutos de las 30 franquicias.</span>
          <button type="button" className="btn btn-sm" onClick={() => void onChangePlayMode("manager")}>Activar modo manager</button>
        </div>
      )}

      {isManager && (
        <div className="card mb-3 p-3.5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <label className="block sm:max-w-xs">
              <span className="label overline">Filosofía de equipo</span>
              <select className="select text-xs" value={userTeam.philosophy ?? "Equilibrado"} onChange={(event) => void persist({ ...userTeam, rotation: activeIds, philosophy: event.target.value }, "Filosofía guardada.")} disabled={saving}>
                <option>Equilibrado</option>
                <option>Triple</option>
                <option>Interior</option>
                <option>Defensa</option>
              </select>
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className="btn btn-sm" onClick={restoreAuto} disabled={saving}><Icon name="refresh" size={12} /> Rotación automática</button>
              <button type="button" className="btn btn-sm btn-quiet" onClick={() => onNavigate("dashboard")}>Volver al resumen</button>
            </div>
          </div>
          <p className="mt-2 text-[0.6rem] leading-relaxed text-[var(--muted)]">La filosofía modifica la selección de tiro del motor (más triple, más juego interior o una defensa más conservadora). Ajusta minutos con − / +. No se muestran contratos ni traspasos porque pertenecen a fases posteriores.</p>
          {(error || savedNotice) && <div className={cn("mt-2 rounded-lg border p-2 text-[0.62rem]", error ? "border-[var(--line-strong)]" : "border-[var(--line)] text-[var(--muted)]")}>{error ?? savedNotice}</div>}
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-1.5">
        {positions.map((item) => <span key={item.position} className="chip">{item.position} · {item.count}</span>)}
        <span className="chip">Altura media {formatHeight(Math.round(roster.reduce((sum, player) => sum + player.heightIn, 0) / Math.max(1, roster.length)))}</span>
        <span className="chip">Envergadura media {formatHeight(Math.round(roster.reduce((sum, player) => sum + player.wingspanIn, 0) / Math.max(1, roster.length)))}</span>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-3.5 py-3 sm:px-4">
          <div><div className="overline">Rotación</div><h2 className="text-sm font-bold">Diez jugadores activos</h2></div>
          <span className="chip">{isManager ? "Control manager" : "IA"}</span>
        </div>
        <div className="p-2 sm:p-3">
          {active.map((player, index) => {
            const minutes = userTeam.rotationMinutes?.[player.id] ?? (index < 5 ? 34 : 14);
            return (
              <div key={player.id} className={cn("mb-1.5 flex flex-col gap-2 rounded-lg border border-[var(--line)] px-2.5 py-2 sm:flex-row sm:items-center", index < 5 && "bg-[var(--surface-2)]")}>
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="w-9 shrink-0 text-[0.52rem] font-bold uppercase leading-tight tracking-wide text-[var(--muted)]">{index < 5 ? `Titular ${index + 1}` : `Rot. ${index + 1}`}</span>
                  <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setSelectedPlayer(player)}>
                    <PlayerAvatar player={player} size={30} />
                    <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{player.name}</span><span className="block text-[0.55rem] text-[var(--muted)]">{player.position} · {player.age} años · {player.archetype}</span></span>
                    <OvrBadge ovr={player.ovr} pot={player.pot} compact />
                  </button>
                </div>
                {isManager ? (
                  <div className="flex items-center justify-between gap-1 sm:justify-end">
                    <div className="flex items-center gap-0.5">
                      <button type="button" className="icon-btn h-7 w-7" onClick={() => updateOrder(player.id, -1)} disabled={index === 0 || saving} aria-label="Subir en la rotación"><Icon name="arrow-left" size={12} className="rotate-90" /></button>
                      <button type="button" className="icon-btn h-7 w-7" onClick={() => updateOrder(player.id, 1)} disabled={index === active.length - 1 || saving} aria-label="Bajar en la rotación"><Icon name="arrow-right" size={12} className="rotate-90" /></button>
                    </div>
                    <div className="flex items-center gap-0.5 rounded-md border border-[var(--line)]">
                      <button type="button" className="h-7 w-7 text-sm" onClick={() => setMinutes(player.id, -1)} disabled={saving || minutes <= 4} aria-label="Restar un minuto">−</button>
                      <span className="min-w-[40px] text-center text-[0.65rem] font-bold tabular">{minutes}′</span>
                      <button type="button" className="h-7 w-7 text-sm" onClick={() => setMinutes(player.id, 1)} disabled={saving || minutes >= 42} aria-label="Sumar un minuto">+</button>
                    </div>
                    <button type="button" className="btn btn-sm btn-quiet h-7 px-2 text-[0.56rem]" onClick={() => exclude(player.id)} disabled={saving || active.length <= 5}>Quitar</button>
                  </div>
                ) : (
                  <span className="chip">{minutes}′ · IA</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {inactive.length > 0 && (
        <div className="card mt-3 overflow-hidden">
          <div className="border-b border-[var(--line)] px-3.5 py-3"><div className="overline">Profundidad</div><h2 className="text-sm font-bold">Banquillo / no activos</h2></div>
          <div className="p-2 sm:p-3">
            {inactive.map((player) => (
              <div key={player.id} className="mb-1.5 flex items-center gap-2 rounded-lg border border-[var(--line)] px-2.5 py-2">
                <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setSelectedPlayer(player)}>
                  <PlayerAvatar player={player} size={28} />
                  <span className="min-w-0 flex-1"><span className="block truncate text-xs">{player.name}</span><span className="block text-[0.55rem] text-[var(--muted)]">{player.position} · {player.age} años</span></span>
                  <OvrBadge ovr={player.ovr} pot={player.pot} compact />
                </button>
                {isManager && <button type="button" className="btn btn-sm" onClick={() => include(player.id)} disabled={saving}>Activar</button>}
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedPlayer && <PlayerDrawer player={selectedPlayer} team={userTeam} onClose={() => setSelectedPlayer(null)} />}
    </div>
  );
}

const POSITION_ORDER: Record<Position, number> = { PG: 0, SG: 1, SF: 2, PF: 3, C: 4 };

export function PlayersPage({ view }: { view: LeagueView }) {
  const { bundle } = view;
  const [query, setQuery] = useState("");
  const [teamFilter, setTeamFilter] = useState("all");
  const [positionFilter, setPositionFilter] = useState<"all" | Position>("all");
  const [sort, setSort] = useState<"ovr" | "pot" | "name" | "age" | "threePointers" | "rebounding" | "defense">("ovr");
  const [visible, setVisible] = useState(60);
  const [selected, setSelected] = useState<Player | null>(null);

  const filtered = useMemo(() => {
    const list = bundle.players.filter((player) => {
      if (teamFilter !== "all" && player.teamId !== teamFilter) return false;
      if (positionFilter !== "all" && player.position !== positionFilter) return false;
      if (query && !`${player.name} ${player.nationality} ${player.college} ${player.archetype}`.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
    return list.sort((a, b) => {
      if (sort === "name") return a.lastName.localeCompare(b.lastName);
      if (sort === "age") return a.age - b.age;
      if (sort === "pot") return b.pot - a.pot;
      if (sort === "threePointers") return b.attributes.threePointers - a.attributes.threePointers;
      if (sort === "rebounding") return b.attributes.rebounding - a.attributes.rebounding;
      if (sort === "defense") return (b.attributes.perimeterDefense + b.attributes.interiorDefense) - (a.attributes.perimeterDefense + a.attributes.interiorDefense);
      return b.ovr - a.ovr;
    });
  }, [bundle.players, query, teamFilter, positionFilter, sort]);

  const shown = filtered.slice(0, visible);
  const selectedTeam = selected ? bundle.teams.find((team) => team.id === selected.teamId) : undefined;
  const resetFilters = () => { setQuery(""); setTeamFilter("all"); setPositionFilter("all"); setSort("ovr"); setVisible(60); };
  const countsByPosition = POSITIONS.map((position) => [position, filtered.filter((player) => player.position === position).length] as const);

  return (
    <div className="screen-fade">
      <PageHeader eyebrow="Scouting interno · Fase 1" title="Jugadores" subtitle="Cada ficha conserva sus 16 atributos, OVR ponderado por posición, POT estimado y una identidad propia." actions={<><span className="chip">{bundle.players.length} fichas</span><span className="chip">{bundle.players.filter((player) => player.ovr >= 85).length} con 85+</span></>} />
      <div className="card mb-3 p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_0.8fr_1fr]">
          <div className="relative">
            <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input className="field pl-9 text-xs" placeholder="Nombre, país, formación…" value={query} onChange={(event) => { setQuery(event.target.value); setVisible(60); }} aria-label="Buscar jugadores" />
          </div>
          <select className="select text-xs" value={teamFilter} onChange={(event) => { setTeamFilter(event.target.value); setVisible(60); }} aria-label="Filtrar por equipo">
            <option value="all">Todos los equipos</option>
            {[...bundle.teams].sort((a, b) => a.city.localeCompare(b.city)).map((team) => <option key={team.id} value={team.id}>{team.city} {team.name}</option>)}
          </select>
          <select className="select text-xs" value={positionFilter} onChange={(event) => { setPositionFilter(event.target.value as typeof positionFilter); setVisible(60); }} aria-label="Filtrar por posición">
            <option value="all">Todas las posiciones</option>
            {POSITIONS.map((position) => <option key={position} value={position}>{position} · {POSITION_LABEL[position]}</option>)}
          </select>
          <select className="select text-xs" value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} aria-label="Ordenar jugadores">
            <option value="ovr">Ordenar por OVR</option>
            <option value="pot">Mayor POT</option>
            <option value="threePointers">Mejor triple</option>
            <option value="rebounding">Mejor rebote</option>
            <option value="defense">Mejor defensa</option>
            <option value="age">Más jóvenes</option>
            <option value="name">Nombre A–Z</option>
          </select>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[0.6rem] text-[var(--muted)]">{filtered.length} resultados · {shown.length} visibles</span>
          {countsByPosition.map(([position, count]) => <span key={position} className="chip">{position} {count}</span>)}
          {(query || teamFilter !== "all" || positionFilter !== "all" || sort !== "ovr") && <button type="button" className="text-[0.6rem] font-semibold underline underline-offset-2" onClick={resetFilters}>Limpiar filtros</button>}
        </div>
      </div>

      {shown.length === 0 ? (
        <EmptyState icon="search" title="Sin jugadores que mostrar" message="No hay fichas que coincidan con los filtros actuales." action={<button type="button" className="btn" onClick={resetFilters}>Limpiar filtros</button>} />
      ) : (
        <>
          <div className="card hidden overflow-hidden md:block">
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Jugador</th><th>Equipo</th><th>Pos</th><th>Edad</th><th>Altura</th><th>OVR</th><th>POT</th><th>Arquetipo</th><th>Estado</th></tr></thead>
                <tbody>
                  {shown.map((player) => {
                    const team = bundle.teams.find((item) => item.id === player.teamId);
                    return (
                      <tr key={player.id} className="cursor-pointer" onClick={() => setSelected(player)}>
                        <td><div className="flex items-center gap-2"><PlayerAvatar player={player} size={28} /><div><div className="font-semibold">{player.name}</div><div className="text-[0.56rem] text-[var(--muted)]">{player.nationality}</div></div></div></td>
                        <td>{team ? <span className="flex items-center gap-1.5"><TeamMark team={team} size={21} />{team.abbreviation}</span> : "—"}</td>
                        <td><span className="chip">{player.position}</span></td>
                        <td className="tabular">{player.age}</td>
                        <td className="tabular">{formatHeight(player.heightIn)}</td>
                        <td><strong className="tabular">{player.ovr}</strong></td>
                        <td className="tabular text-[var(--muted)]">{player.pot}</td>
                        <td className="max-w-[160px] truncate text-[0.7rem] text-[var(--muted)]">{player.archetype}</td>
                        <td><span className="flex flex-wrap gap-1">{player.real ? <span className="chip chip-warn">Real · 2026-27</span> : <span className="chip">Ficticio</span>}{player.contractType === "two-way" && <span className="chip">2W</span>}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="grid gap-1.5 md:hidden">
            {shown.map((player) => {
              const team = bundle.teams.find((item) => item.id === player.teamId);
              return (
                <button type="button" key={player.id} className="row-card flex items-center gap-2.5" onClick={() => setSelected(player)}>
                  <PlayerAvatar player={player} size={34} />
                  <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{player.name}</span><span className="block truncate text-[0.56rem] text-[var(--muted)]">{team?.abbreviation ?? "—"} · {player.position} · {player.age} años · {player.archetype}{player.contractType === "two-way" ? " · 2W" : ""}</span></span>
                  <span className="text-right"><span className="block text-sm font-black tabular">{player.ovr}</span><span className="block text-[0.52rem] text-[var(--muted)]">POT {player.pot}</span></span>
                  <Icon name="chevron-right" size={13} className="text-[var(--muted)]" />
                </button>
              );
            })}
          </div>
          {visible < filtered.length && <button type="button" className="btn mt-3 w-full" onClick={() => setVisible((count) => count + 60)}>Mostrar más jugadores ({filtered.length - visible})</button>}
        </>
      )}
      {selected && <PlayerDrawer player={selected} team={selectedTeam} onClose={() => setSelected(null)} />}
    </div>
  );
}

export function rosterPositionIndex(position: Position): number {
  return POSITION_ORDER[position];
}
