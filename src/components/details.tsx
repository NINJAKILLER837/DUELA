import { useState } from "react";
import type { Game, Player, Team } from "@/types";
import { ATTRIBUTE_GROUP_ORDER, formatAttributeValue } from "@/components/playerUtils";
import { POSITION_LABEL } from "@/game/ratings";
import { formatHeight } from "@/game/selectors";
import { cn } from "@/utils/cn";
import { DrawerShell, Icon, ModalShell, OvrBadge, PlayerAvatar, TeamMark } from "./ui";

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2">
      <div className="text-[0.55rem] font-bold uppercase tracking-[0.11em] text-[var(--muted)]">{label}</div>
      <div className="mt-0.5 truncate text-xs font-semibold">{value}</div>
    </div>
  );
}

export function PlayerDrawer({ player, team, onClose }: { player: Player; team?: Team; onClose: () => void }) {
  const topSkills = (Object.entries(player.attributes) as [keyof Player["attributes"], number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  return (
    <DrawerShell onClose={onClose} label={`Ficha de ${player.name}`}>
      <div className="drawer-header sticky top-0 z-10 flex items-center justify-between border-b border-[var(--line)] px-4 py-3 sm:px-6">
        <span className="overline">Ficha de jugador</span>
        <button type="button" onClick={onClose} className="icon-btn" aria-label="Cerrar ficha"><Icon name="close" size={18} /></button>
      </div>
      <div className="px-4 pb-8 pt-5 sm:px-6">
        <div className="flex items-start gap-4">
          <PlayerAvatar player={player} size={64} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="chip chip-solid">{player.position}</span>
              <span className="chip">{POSITION_LABEL[player.position]}</span>
              {player.real ? <span className="chip chip-warn">Real · 2026-27</span> : <span className="chip chip-outline">Ficticio</span>}
              {player.contractType === "two-way" && <span className="chip">Two-way</span>}
              {player.listedPosition && <span className="chip chip-outline">Fuente: {player.listedPosition}</span>}
            </div>
            <h2 className="mt-2 truncate text-[1.7rem] font-extrabold leading-none tracking-[-0.05em]">{player.name}</h2>
            <div className="mt-1 truncate text-xs text-[var(--muted)]">{team ? `${team.city} ${team.name}` : "Sin equipo"} · {player.archetype}</div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <div className="card-inverse p-3">
            <div className="text-[0.55rem] font-bold uppercase tracking-[0.12em] opacity-60">OVR actual</div>
            <div className="mt-1 text-4xl font-black tracking-[-0.07em] tabular">{player.ovr}</div>
          </div>
          <div className="card-soft p-3">
            <div className="text-[0.55rem] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">POT estimado</div>
            <div className="mt-1 text-4xl font-black tracking-[-0.07em] tabular">{player.pot}</div>
          </div>
          <div className="card-soft p-3">
            <div className="text-[0.55rem] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">Rol</div>
            <div className="mt-2 text-sm font-bold leading-tight">{player.role}</div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {topSkills.map(([key, value]) => (
            <span className="chip" key={key}>{formatAttributeValue(key)} · {value}</span>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <InfoCell label="Edad" value={`${player.age}${player.ageEstimated ? " · est." : ""} años`} />
          <InfoCell label="Altura" value={formatHeight(player.heightIn)} />
          <InfoCell label="Envergadura" value={formatHeight(player.wingspanIn)} />
          <InfoCell label="Peso" value={player.weightPending ? "Pendiente" : `${player.weightLb} lb`} />
          <InfoCell label="Nacionalidad" value={player.nationality} />
          <InfoCell label="Dorsal" value={player.jerseyPending ? "Pendiente" : `#${player.jersey}`} />
          <InfoCell label="Experiencia" value={player.experience === undefined ? "No verificada" : player.experience === 0 ? "Rookie" : `${player.experience} años`} />
          <InfoCell label="Contrato" value={player.contractType === "two-way" ? "Two-way" : player.contractType === "standard" ? "Estándar · inferido" : "No verificado"} />
          <InfoCell label="Posición fuente" value={player.listedPosition ?? "No disponible"} />
          <div className="col-span-2 sm:col-span-3">
            <InfoCell label="Formación" value={player.college} />
          </div>
          <div className="col-span-2 sm:col-span-3">
            <InfoCell label="Adquisición (fuente NBA.com)" value={player.howAcquired || "No disponible"} />
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold">Atributos individuales</h3>
            <span className="text-[0.6rem] text-[var(--muted)]">Escala 0–100</span>
          </div>
          <div className="space-y-4">
            {ATTRIBUTE_GROUP_ORDER.map((group) => (
              <div key={group.label} className="card-soft p-3.5">
                <div className="mb-2.5 text-[0.6rem] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">{group.label}</div>
                <div className="grid gap-x-5 gap-y-2.5 sm:grid-cols-2">
                  {group.keys.map((key) => (
                    <div key={key}>
                      <div className="mb-1 flex items-center justify-between text-[0.68rem]">
                        <span className="text-[var(--ink-soft)]">{formatAttributeValue(key)}</span>
                        <span className="font-bold tabular">{player.attributes[key]}</span>
                      </div>
                      <div className="meter"><span style={{ width: `${player.attributes[key]}%` }} /></div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <h3 className="mb-2 text-sm font-bold">Biografía</h3>
          <p className="card-soft p-3.5 text-[0.78rem] leading-relaxed text-[var(--ink-soft)]">{player.bio}</p>
          {player.real && (
            <p className="mt-2 flex gap-2 rounded-lg border border-dashed border-[var(--line-strong)] p-2.5 text-[0.63rem] leading-relaxed text-[var(--muted)]">
              <Icon name="info" size={14} className="mt-0.5 shrink-0" />
              Ficha real del corte 28/10/2026. Pertenencia, dorsal, edad, altura, peso y experiencia proceden del listado de plantillas actualizado el 27/10/2026; el two-way se contrastó con el tracker del 24/10/2026. «Estándar» se infiere del listado (15+3), no de un contrato revisado. Nacionalidad, universidad, salarios, lesiones y estadísticas reales se muestran solo si estaban verificados; si no, se marcan como pendientes. Los atributos, OVR y POT son evaluación del simulador.
            </p>
          )}
        </div>
      </div>
    </DrawerShell>
  );
}

export function TeamDrawer({ team, players, onClose, onSelectPlayer, record }: { team: Team; players: Player[]; onClose: () => void; onSelectPlayer: (player: Player) => void; record?: string }) {
  const roster = [...players].sort((a, b) => (a.position === b.position ? b.ovr - a.ovr : a.position.localeCompare(b.position)));
  const avg = players.length ? Math.round(players.reduce((sum, player) => sum + player.ovr, 0) / players.length) : 0;
  return (
    <DrawerShell onClose={onClose} label={`Ficha de ${team.city} ${team.name}`}>
      <div className="drawer-header sticky top-0 z-10 flex items-center justify-between border-b border-[var(--line)] px-4 py-3 sm:px-6">
        <span className="overline">Ficha de franquicia</span>
        <button type="button" onClick={onClose} className="icon-btn" aria-label="Cerrar ficha"><Icon name="close" size={18} /></button>
      </div>
      <div className="px-4 pb-8 pt-5 sm:px-6">
        <div className="flex items-start gap-4">
          <TeamMark team={team} size={68} />
          <div className="min-w-0">
            <div className="flex flex-wrap gap-1.5">
              <span className="chip chip-solid">{team.abbreviation}</span>
              <span className="chip">{team.conference} · {team.division}</span>
              {team.fictionalHistory && <span className="chip chip-outline">Universo ficticio</span>}
            </div>
            <h2 className="mt-2 text-[1.65rem] font-extrabold leading-none tracking-[-0.05em]">{team.city}</h2>
            <div className="text-[1.65rem] font-extrabold leading-none tracking-[-0.05em] text-[var(--muted)]">{team.name}</div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <InfoCell label="Fundación" value={String(team.founded)} />
          <InfoCell label="Títulos NBA" value={String(team.championships)} />
          <InfoCell label="Media OVR" value={String(avg)} />
          <InfoCell label="Récord" value={record ?? "—"} />
        </div>
        <div className="mt-2"><InfoCell label="Arena" value={team.arena} /></div>

        <div className="mt-5">
          <h3 className="mb-2 text-sm font-bold">Historia de la franquicia</h3>
          <p className="text-[0.78rem] leading-relaxed text-[var(--ink-soft)]">{team.history}</p>
          {team.fictionalHistory && <p className="mt-2 rounded-lg border border-dashed border-[var(--line-strong)] p-3 text-[0.72rem] leading-relaxed text-[var(--muted)]">{team.fictionalHistory}</p>}
          {players.some((player) => player.real) && <p className="mt-2 flex gap-1.5 rounded-lg border border-dashed border-[var(--line-strong)] p-2.5 text-[0.64rem] leading-relaxed text-[var(--muted)]"><Icon name="info" size={13} className="mt-0.5 shrink-0" />Plantilla real 2026-27: {players.length} fichas ({players.filter((player) => player.contractType === "two-way").length} two-way). Pertenencia verificada en las 30 páginas oficiales de NBA.com el 28/10/2026. Nacionalidad, un dorsal, tres pesos y los términos salariales siguen pendientes y se marcan como tal.</p>}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <h3 className="text-sm font-bold">Plantilla</h3>
          <span className="text-[0.62rem] text-[var(--muted)]">{players.length} jugadores · Media {avg}</span>
        </div>
        <div className="mt-2 space-y-1.5">
          {roster.map((player) => (
            <button key={player.id} type="button" className="row-card flex items-center gap-3 py-2.5" onClick={() => onSelectPlayer(player)}>
              <span className="w-7 text-center text-[0.6rem] font-bold uppercase text-[var(--muted)]">{player.position}</span>
              <PlayerAvatar player={player} size={32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold">{player.name}</span>
                <span className="block truncate text-[0.6rem] text-[var(--muted)]">{player.age} años · {player.archetype}</span>
              </span>
              <OvrBadge ovr={player.ovr} pot={player.pot} compact />
              <Icon name="chevron-right" size={14} className="text-[var(--muted)]" />
            </button>
          ))}
        </div>
      </div>
    </DrawerShell>
  );
}

function Scoreline({ game, homeTeam, awayTeam }: { game: Game; homeTeam: Team; awayTeam: Team }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
      <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:text-left">
        <TeamMark team={awayTeam} size={46} />
        <div className="min-w-0">
          <div className="truncate text-sm font-bold">{awayTeam.name}</div>
          <div className="text-[0.6rem] uppercase tracking-wide text-[var(--muted)]">{awayTeam.city} · VISITANTE</div>
        </div>
      </div>
      <div className="text-center">
        <div className="text-[2.15rem] font-black leading-none tracking-[-0.07em] tabular sm:text-[2.8rem]">
          {game.awayScore}<span className="mx-1.5 text-[var(--muted)]">–</span>{game.homeScore}
        </div>
        <div className="mt-1 text-[0.55rem] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">Final</div>
      </div>
      <div className="flex flex-col items-center gap-2 text-center sm:flex-row-reverse sm:text-right">
        <TeamMark team={homeTeam} size={46} />
        <div className="min-w-0">
          <div className="truncate text-sm font-bold">{homeTeam.name}</div>
          <div className="text-[0.6rem] uppercase tracking-wide text-[var(--muted)]">{homeTeam.city} · LOCAL</div>
        </div>
      </div>
    </div>
  );
}

function TeamBoxTable({ team, box }: { team: Team; box: NonNullable<Game["boxScore"]>["home"] }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2"><TeamMark team={team} size={26} /><span className="text-xs font-bold">{team.city} {team.name}</span></div>
        <span className="text-[0.62rem] text-[var(--muted)]">{box.points} pts</span>
      </div>
      <div className="space-y-1.5 md:hidden">
        {box.players.map((line) => (
          <div key={line.playerId} className="row-card py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs font-semibold">{line.name}</span>
              <span className="chip">{line.position}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[0.64rem] text-[var(--muted)]">
              <span><strong className="text-[var(--ink)]">{line.points}</strong> PTS</span>
              <span>{line.reb} REB</span><span>{line.ast} AST</span><span>{line.minutes} MIN</span>
              <span>TC {line.fgm}/{line.fga}</span><span>3P {line.tpm}/{line.tpa}</span><span>TL {line.ftm}/{line.fta}</span>
              <span>{line.stl} ROB</span><span>{line.blk} TAP</span><span>{line.tov} PER</span><span>{line.pf} F</span>
            </div>
          </div>
        ))}
      </div>
      <div className="table-wrap hidden md:block">
        <table className="data-table">
          <thead><tr><th>Jugador</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>ROB</th><th>TAP</th><th>PER</th><th>F</th><th>TC</th><th>3P</th><th>TL</th></tr></thead>
          <tbody>
            {box.players.map((line) => (
              <tr key={line.playerId}>
                <td className="font-semibold">{line.name} <span className="ml-1 text-[0.58rem] text-[var(--muted)]">{line.position}</span></td>
                <td className="tabular text-[var(--muted)]">{line.minutes}</td>
                <td className="tabular font-bold">{line.points}</td>
                <td className="tabular">{line.reb}</td><td className="tabular">{line.ast}</td>
                <td className="tabular">{line.stl}</td><td className="tabular">{line.blk}</td>
                <td className="tabular">{line.tov}</td><td className="tabular">{line.pf}</td>
                <td className="tabular text-[var(--muted)]">{line.fgm}/{line.fga}</td>
                <td className="tabular text-[var(--muted)]">{line.tpm}/{line.tpa}</td>
                <td className="tabular text-[var(--muted)]">{line.ftm}/{line.fta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function GameResultModal({ game, homeTeam, awayTeam, onClose, eyebrow = "Resultado final" }: { game: Game; homeTeam: Team; awayTeam: Team; onClose: () => void; eyebrow?: string }) {
  const [tab, setTab] = useState<"resumen" | "box" | "pbp">("resumen");
  const [side, setSide] = useState<"home" | "away">("home");
  const [visibleEvents, setVisibleEvents] = useState(30);
  const box = game.boxScore;
  const metadata = box ? [box.home, box.away] : [];
  const top = (which: "home" | "away") => [...(box?.[which].players ?? [])].sort((a, b) => b.points - a.points).slice(0, 3);
  const selectedTeam = side === "home" ? homeTeam : awayTeam;
  return (
    <ModalShell onClose={onClose} label="Resultado del partido">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--line)] bg-[var(--bg)] px-4 py-3 sm:px-6">
        <div>
          <div className="overline">{eyebrow}</div>
          <div className="text-xs font-semibold">{new Date(`${game.day || "2026-10-20"}T12:00:00Z`).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}</div>
        </div>
        <button type="button" onClick={onClose} className="icon-btn" aria-label="Cerrar resultado"><Icon name="close" size={18} /></button>
      </div>
      <div className="p-4 sm:p-6">
        <Scoreline game={game} homeTeam={homeTeam} awayTeam={awayTeam} />
        <div className="pill-nav mt-5">
          {(["resumen", "box", "pbp"] as const).map((item) => (
            <button key={item} type="button" className={tab === item ? "active" : ""} onClick={() => setTab(item)}>
              {item === "resumen" ? "Resumen" : item === "box" ? "Estadísticas" : "Play-by-play"}
            </button>
          ))}
        </div>

        {tab === "resumen" && box && (
          <div className="mt-4 space-y-4">
            <div className="card overflow-hidden">
              <div className="grid items-center gap-1 border-b border-[var(--line)] px-3 py-2 text-[0.56rem] font-bold uppercase tracking-wide text-[var(--muted)]" style={{ gridTemplateColumns: `1fr repeat(${Math.max(4, box.home.quarters.length)}, minmax(28px, 40px))` }}>
                <span>Equipo</span>{Array.from({ length: Math.max(4, box.home.quarters.length) }, (_, index) => <span key={index} className="text-center">{index < 4 ? `Q${index + 1}` : `OT${index - 3}`}</span>)}
              </div>
              {[{ team: awayTeam, data: box.away, total: game.awayScore ?? 0 }, { team: homeTeam, data: box.home, total: game.homeScore ?? 0 }].map((row) => (
                <div key={row.team.id} className="grid items-center gap-1 border-b border-[var(--line)] px-3 py-2.5 text-xs last:border-0" style={{ gridTemplateColumns: `1fr repeat(${Math.max(4, box.home.quarters.length)}, minmax(28px, 40px))` }}>
                  <span className="flex min-w-0 items-center gap-2"><TeamMark team={row.team} size={22} /><span className="truncate font-semibold">{row.team.abbreviation}</span><strong className="tabular">{row.total}</strong></span>
                  {Array.from({ length: Math.max(4, box.home.quarters.length) }, (_, index) => <span key={index} className="text-center tabular text-[var(--muted)]">{row.data.quarters[index] ?? 0}</span>)}
                </div>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(["away", "home"] as const).map((which) => (
                <div key={which} className="card-soft p-3.5">
                  <div className="flex items-center gap-2"><TeamMark team={which === "home" ? homeTeam : awayTeam} size={24} /><span className="text-[0.62rem] font-bold uppercase tracking-wide text-[var(--muted)]">Líderes · {which === "home" ? "Local" : "Visitante"}</span></div>
                  <div className="mt-2 space-y-1.5">
                    {top(which).map((line) => (
                      <div key={line.playerId} className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate">{line.name}</span>
                        <span className="shrink-0 tabular font-bold">{line.points} PTS <span className="font-normal text-[var(--muted)]">· {line.reb} REB · {line.ast} AST</span></span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {[
                ["TC", box.home.fgm, box.away.fgm, box.home.fga, box.away.fga],
                ["3P", box.home.tpm, box.away.tpm, box.home.tpa, box.away.tpa],
                ["TL", box.home.ftm, box.away.ftm, box.home.fta, box.away.fta],
                ["REB", box.home.reb, box.away.reb],
                ["AST", box.home.ast, box.away.ast],
                ["PÉR", box.home.tov, box.away.tov],
              ].map(([label, home, away, homeAttempts, awayAttempts]) => (
                <div key={String(label)} className="rounded-lg border border-[var(--line)] p-2.5 text-center">
                  <div className="text-[0.55rem] font-bold uppercase tracking-wide text-[var(--muted)]">{label}</div>
                  <div className="mt-1 text-[0.72rem] font-bold tabular">{String(home)}{homeAttempts !== undefined ? `/${homeAttempts}` : ""} <span className="text-[var(--muted)]">–</span> {String(away)}{awayAttempts !== undefined ? `/${awayAttempts}` : ""}</div>
                </div>
              ))}
            </div>
            {metadata.length === 0 && <p className="text-xs text-[var(--muted)]">Sin datos de box score.</p>}
          </div>
        )}

        {tab === "box" && box && (
          <div className="mt-4">
            <div className="pill-nav mb-4">
              <button type="button" className={side === "away" ? "active" : ""} onClick={() => setSide("away")}>{awayTeam.abbreviation}</button>
              <button type="button" className={side === "home" ? "active" : ""} onClick={() => setSide("home")}>{homeTeam.abbreviation}</button>
            </div>
            <TeamBoxTable team={selectedTeam} box={box[side]} />
          </div>
        )}

        {tab === "pbp" && (
          <div className="mt-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[0.62rem] text-[var(--muted)]">{game.playByPlay?.length ?? 0} acciones registradas en este partido</span>
              <span className="chip">{game.playByPlay?.some((event) => event.period > 4) ? "Prórroga" : "Tiempo reglamentario"}</span>
            </div>
            <div className="card divide-y divide-[var(--line)] overflow-hidden">
              {[...(game.playByPlay ?? [])].reverse().slice(0, visibleEvents).map((event) => (
                <div key={event.seq} className={cn("grid grid-cols-[54px_1fr_auto] items-start gap-2.5 px-3 py-2.5 text-[0.68rem]", event.kind === "score" && "bg-[var(--surface-2)]")}>
                  <span className="font-semibold tabular text-[var(--muted)]">{event.clock}</span>
                  <span className="leading-relaxed">{event.text}</span>
                  <span className="font-bold tabular text-[var(--muted)]">{event.awayScore}–{event.homeScore}</span>
                </div>
              ))}
              {(game.playByPlay?.length ?? 0) === 0 && <p className="px-4 py-8 text-center text-xs text-[var(--muted)]">Este partido no guardó acciones de play-by-play.</p>}
            </div>
            {(game.playByPlay?.length ?? 0) > visibleEvents && (
              <button type="button" className="btn mt-3 w-full" onClick={() => setVisibleEvents((count) => count + 50)}>Mostrar más acciones</button>
            )}
          </div>
        )}
      </div>
    </ModalShell>
  );
}

export function ScorelineMini({ game, homeTeam, awayTeam }: { game: Game; homeTeam: Team; awayTeam: Team }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2"><TeamMark team={awayTeam} size={25} /><span className="truncate text-xs">{awayTeam.abbreviation}</span><strong className="tabular text-xs">{game.awayScore}</strong></div>
      <span className="text-[0.58rem] text-[var(--muted)]">Final</span>
      <div className="flex min-w-0 flex-row-reverse items-center gap-2"><TeamMark team={homeTeam} size={25} /><span className="truncate text-xs">{homeTeam.abbreviation}</span><strong className="tabular text-xs">{game.homeScore}</strong></div>
    </div>
  );
}
