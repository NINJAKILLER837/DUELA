import { useState } from "react";
import type { LeagueSaveMeta, PlayMode, ThemeKey } from "@/types";
import { Icon, PlayerAvatar, ThemePicker, TeamMark } from "@/components/ui";
import { FRANCHISES } from "@/data/franchises";
import { cn } from "@/utils/cn";

interface HubProps {
  leagues: LeagueSaveMeta[];
  booting: boolean;
  bootError: string | null;
  openingLeagueId: string | null;
  theme: ThemeKey;
  onCreate: (mode: PlayMode) => void;
  onExhibition: () => void;
  onOpenLeague: (id: string) => void;
  onRefresh: () => void;
  onThemeChange: (theme: ThemeKey) => void;
}

function updatedLabel(timestamp: number): string {
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return new Date(timestamp).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

export function Hub({ leagues, booting, bootError, openingLeagueId, theme, onCreate, onExhibition, onOpenLeague, onRefresh, onThemeChange }: HubProps) {
  const [savedFilter, setSavedFilter] = useState<"todas" | "real" | "fictional">("todas");
  const filtered = leagues.filter((league) => savedFilter === "todas" || league.mode === savedFilter);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <a href="#inicio" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[var(--inverse)] text-[var(--inverse-ink)]"><Icon name="games" size={19} strokeWidth={1.8} /></span>
            <span className="display text-[1.35rem] leading-none">DUELA</span>
            <span className="mt-0.5 hidden border-l border-[var(--line)] pl-2 text-[0.52rem] font-bold uppercase leading-tight tracking-[0.14em] text-[var(--muted)] sm:block">NBA<br/>Simulator</span>
          </a>
          <nav className="hidden items-center gap-1 lg:flex">
            <a href="#inicio" className="rounded-lg px-3 py-2 text-[0.66rem] font-bold uppercase tracking-[0.08em] text-[var(--ink)]">Inicio</a>
            <a href="#modos" className="rounded-lg px-3 py-2 text-[0.66rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)] transition hover:text-[var(--ink)]">Dos modos</a>
            <a href="#exhibicion" className="rounded-lg px-3 py-2 text-[0.66rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)] transition hover:text-[var(--ink)]">Exhibición</a>
            <a href="#guardados" className="rounded-lg px-3 py-2 text-[0.66rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)] transition hover:text-[var(--ink)]">Mis ligas</a>
            <span className="ml-2 rounded-full border border-[var(--line)] px-2.5 py-1 text-[0.55rem] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">Fase 1 / v1.0</span>
          </nav>
          <div className="flex items-center gap-2">
            <details className="relative">
              <summary className="icon-btn list-none" aria-label="Ajustar tema visual" title="Tema de la interfaz">
                <Icon name="spark" size={17} />
              </summary>
              <div className="absolute right-0 top-12 z-50 w-[290px] rounded-xl border border-[var(--line)] bg-[var(--bg)] p-3 shadow-[var(--shadow)]">
                <div className="mb-2.5 flex items-center justify-between">
                  <div><div className="overline">Interfaz</div><div className="text-xs font-bold">Blanco y negro ajustable</div></div>
                  <span className="chip">4 tonos</span>
                </div>
                <ThemePicker value={theme} onChange={onThemeChange} />
                <p className="mt-2 text-[0.6rem] leading-relaxed text-[var(--muted)]">El tema también se guarda de forma independiente en cada liga.</p>
              </div>
            </details>
            <button type="button" className="btn btn-solid btn-sm sm:btn" onClick={() => onCreate("manager")}>
              <Icon name="plus" size={15} /> <span className="hidden sm:inline">Crear liga</span><span className="sm:hidden">Liga</span>
            </button>
          </div>
        </div>
      </header>

      <main id="inicio" className="mx-auto max-w-[1440px] px-3 pb-16 pt-4 sm:px-6 sm:pt-6 lg:px-8">
        <section className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[#0b0b0a] text-[#f3f1e9]">
          <div className="hero-image" aria-hidden="true" />
          <div className="relative grid min-h-[430px] gap-6 p-5 sm:min-h-[470px] sm:p-8 lg:grid-cols-[1.35fr_0.65fr] lg:items-end lg:p-10">
            <div className="flex flex-col justify-between gap-8">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/25 bg-black/25 px-2.5 py-1 text-[0.56rem] font-bold uppercase tracking-[0.14em] backdrop-blur">Simulador de baloncesto</span>
                <span className="rounded-full border border-white/25 bg-black/25 px-2.5 py-1 text-[0.56rem] font-bold uppercase tracking-[0.14em] backdrop-blur">Temporada 2026-27</span>
              </div>
              <div>
                <div className="mb-3 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-white/55">Fase 1 · oficina de franquicias</div>
                <h1 className="display max-w-[790px] text-[3rem] uppercase sm:text-[4.5rem] lg:text-[5.1rem]">
                  El juego<br />empieza en
                  <span className="block text-transparent" style={{ WebkitTextStroke: "1px #f3f1e9" }}>la pizarra.</span>
                </h1>
                <p className="mt-4 max-w-md text-[0.78rem] leading-relaxed text-white/65">
                  Dirige una franquicia o deja que la IA controle absolutamente todo. 30 clubes, atributos individuales, simulación partido a partido y una liga que sobrevive al cierre del navegador.
                </p>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <button type="button" className="btn btn-lg bg-[#f3f1e9] text-[#0b0b0a] border-[#f3f1e9] hover:bg-white hover:text-black" onClick={() => onCreate("manager")}>
                  <Icon name="plus" size={16} /> Crear mi liga
                </button>
                <button type="button" className="btn btn-lg border-white/35 bg-black/25 text-white backdrop-blur hover:bg-white/10" onClick={onExhibition}>
                  <Icon name="games" size={16} /> Jugar exhibición
                </button>
              </div>
            </div>

            <div className="hidden justify-self-end lg:block">
              <div className="w-[285px] rounded-xl border border-white/20 bg-black/45 p-4 backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <span className="text-[0.56rem] font-bold uppercase tracking-[0.14em] text-white/50">Motor de identidad</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-[#f3f1e9]" />
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <PlayerAvatar player={{ firstName: "Perfil", lastName: "X", position: "PG" }} size={40} />
                  <div><div className="text-sm font-bold">16 atributos</div><div className="text-[0.6rem] text-white/50">No todos valen lo mismo</div></div>
                </div>
                <div className="mt-4 space-y-2">
                  {[["Tiros de tres", 92], ["Defensa exterior", 61], ["Rebote", 38], ["POT asignado", 87]].map(([label, value]) => (
                    <div key={String(label)}>
                      <div className="mb-1 flex justify-between text-[0.56rem] text-white/60"><span>{label}</span><span className="tabular text-white/90">{value}</span></div>
                      <div className="h-[3px] overflow-hidden rounded bg-white/15"><span className="block h-full bg-white/85" style={{ width: `${value}%` }} /></div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 border-t border-white/15 pt-3 text-[0.56rem] leading-relaxed text-white/45">OVR ponderado por posición. POT es una estimación, no una garantía.</div>
              </div>
            </div>
          </div>
          <div className="relative grid grid-cols-3 border-t border-white/15 bg-black/35 backdrop-blur">
            {[["30", "franquicias NBA"], ["882", "jugadores reales y ficticios"], ["2", "modos de control"]].map(([value, label]) => (
              <div key={label} className="border-r border-white/10 px-4 py-3 last:border-0 sm:px-6">
                <span className="text-xl font-black tracking-[-0.05em] sm:text-2xl">{value}</span>
                <span className="ml-2 text-[0.55rem] uppercase tracking-[0.08em] text-white/50 sm:text-[0.62rem]">{label}</span>
              </div>
            ))}
          </div>
        </section>

        <section id="modos" className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_0.86fr]">
          <article className="card group relative flex flex-col justify-between overflow-hidden p-5 sm:p-6">
            <div className="absolute right-3 top-2 text-[4.3rem] font-black leading-none tracking-[-0.08em] text-[var(--surface-3)] select-none">01</div>
            <div className="relative">
              <div className="flex items-center gap-2">
                <span className="icon-btn h-8 w-8 rounded-lg"><Icon name="target" size={16} /></span>
                <span className="chip">Manager</span>
                <span className="chip chip-outline">Control total</span>
              </div>
              <h2 className="mt-5 text-2xl font-extrabold tracking-[-0.04em]">Construye el equipo.</h2>
              <p className="mt-2 max-w-sm text-xs leading-relaxed text-[var(--muted)]">Elige tu franquicia, ajusta la rotación y la filosofía, decide cuándo simular y lleva la gestión desde tu mesa de mando.</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                <span className="chip"><Icon name="roster" size={11} /> rotación</span>
                <span className="chip"><Icon name="target" size={11} /> filosofía</span>
                <span className="chip"><Icon name="play" size={11} /> partidos</span>
              </div>
            </div>
            <button type="button" className="btn mt-6 w-full justify-between" onClick={() => onCreate("manager")}>Empezar como manager <Icon name="arrow-right" size={15} /></button>
          </article>

          <article className="card-inverse group relative flex flex-col justify-between overflow-hidden p-5 sm:p-6">
            <div className="absolute right-3 top-2 select-none text-[4.3rem] font-black leading-none tracking-[-0.08em] opacity-10">02</div>
            <div className="relative">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-current/25"><Icon name="eye" size={16} /></span>
                <span className="rounded-full border border-current/25 px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-wide">Espectador</span>
              </div>
              <h2 className="mt-5 text-2xl font-extrabold tracking-[-0.04em]">Observa la liga.</h2>
              <p className="mt-2 max-w-sm text-xs leading-relaxed opacity-60">La IA toma cada decisión: rotaciones, partidos y avance de la liga. Tú solo miras, comparas y sigues a tus jugadores favoritos.</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                <span className="rounded-full border border-current/25 px-2.5 py-1 text-[0.58rem] font-bold uppercase tracking-wide">IA al mando</span>
                <span className="rounded-full border border-current/25 px-2.5 py-1 text-[0.58rem] font-bold uppercase tracking-wide">sin gestión</span>
              </div>
            </div>
            <button type="button" className="btn mt-6 w-full justify-between border-current bg-transparent text-current hover:bg-current/10" onClick={() => onCreate("spectator")}>Empezar como espectador <Icon name="arrow-right" size={15} /></button>
          </article>

          <article id="exhibicion" className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] p-5 sm:p-6">
            <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full border border-[var(--line-strong)] opacity-50" />
            <div className="absolute -right-2 -top-2 h-24 w-24 rounded-full border border-[var(--line)] opacity-50" />
            <div className="relative">
              <div className="eyebrow">Antes de crear una liga</div>
              <h2 className="mt-2 text-xl font-extrabold tracking-[-0.035em]">Exhibición libre</h2>
              <p className="mt-1.5 text-[0.7rem] leading-relaxed text-[var(--muted)]">Real vs real, ficticio vs ficticio o universos cruzados. No modifica ninguna liga guardada.</p>
              <div className="mt-4 flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2">
                <div className="flex items-center gap-1.5"><TeamMark team={FRANCHISES[10]} size={27} /><span className="text-[0.65rem] font-bold">NYK</span></div>
                <div className="flex flex-col items-center"><span className="text-[0.5rem] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">vs</span><Icon name="games" size={12} /></div>
                <div className="flex items-center gap-1.5"><span className="text-[0.65rem] font-bold">LAL</span><TeamMark team={FRANCHISES[20]} size={27} /></div>
              </div>
            </div>
            <button type="button" className="btn mt-4 w-full justify-between" onClick={onExhibition}>Montar el partido <Icon name="arrow-right" size={15} /></button>
          </article>
        </section>

        <section id="guardados" className="mt-8 scroll-mt-20">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="overline">Continuar donde lo dejaste</div>
              <h2 className="mt-1 text-xl font-extrabold tracking-[-0.04em] sm:text-2xl">Mis ligas</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="pill-nav">
                {(["todas", "real", "fictional"] as const).map((filter) => (
                  <button key={filter} type="button" className={savedFilter === filter ? "active" : ""} onClick={() => setSavedFilter(filter)}>{filter === "todas" ? "Todas" : filter === "real" ? "Real" : "Ficticias"}</button>
                ))}
              </div>
              <button type="button" className="icon-btn" onClick={onRefresh} aria-label="Actualizar ligas guardadas"><Icon name="refresh" size={16} /></button>
            </div>
          </div>

          {bootError && (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-[var(--line-strong)] p-3 text-xs text-[var(--muted)]">
              <Icon name="alert" size={15} className="mt-0.5 shrink-0" /> {bootError}
            </div>
          )}

          {booting ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3].map((item) => <div key={item} className="card h-[146px] animate-pulse p-4"><div className="h-3 w-20 rounded bg-[var(--surface-3)]" /><div className="mt-4 h-5 w-2/3 rounded bg-[var(--surface-3)]" /><div className="mt-3 h-2 w-full rounded bg-[var(--surface-3)]" /></div>)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="card flex flex-col items-center justify-center px-5 py-10 text-center">
              <Icon name="database" size={24} className="text-[var(--muted)]" />
              <h3 className="mt-3 text-sm font-bold">{leagues.length ? "No hay ligas en este filtro" : "Todavía no hay ninguna liga guardada"}</h3>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-[var(--muted)]">{leagues.length ? "Cambia el filtro para ver tus otros universos." : "Crea una liga real o ficticia. Todo el progreso se guardará en IndexedDB y podrás continuar al volver a abrir la aplicación."}</p>
              <button type="button" className="btn btn-solid mt-4" onClick={() => onCreate("manager")}><Icon name="plus" size={15} /> Crear mi primera liga</button>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((league) => (
                <article key={league.id} className="card flex flex-col justify-between p-4 transition hover:border-[var(--line-strong)]">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("chip", league.mode === "real" ? "chip-solid" : "chip-outline")}>{league.mode === "real" ? "NBA Real" : "NBA Ficticia"}</span>
                      <span className="text-[0.6rem] text-[var(--muted)]">{updatedLabel(league.updatedAt)}</span>
                    </div>
                    <h3 className="mt-3 truncate text-base font-bold tracking-[-0.02em]">{league.name}</h3>
                    <div className="mt-0.5 flex items-center gap-1.5 truncate text-[0.68rem] text-[var(--muted)]"><Icon name={league.playMode === "manager" ? "target" : "eye"} size={12} />{league.playMode === "manager" ? "Manager" : "Espectador"} · {league.userTeamName}</div>
                    <div className="mt-3">
                      <div className="mb-1 flex justify-between text-[0.58rem] text-[var(--muted)]"><span>Progreso de temporada</span><span className="tabular">{league.progress}%</span></div>
                      <div className="meter"><span style={{ width: `${Math.max(2, league.progress)}%` }} /></div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-2">
                    <span className="text-[0.58rem] text-[var(--muted)]">{league.playerCount} jugadores · IndexedDB</span>
                    <button type="button" className="btn btn-sm" disabled={openingLeagueId !== null} onClick={() => onOpenLeague(league.id)}>
                      {openingLeagueId === league.id ? "Abriendo…" : "Continuar"} <Icon name="arrow-right" size={13} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="card p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="overline">Transparencia de datos</div>
              <span className="chip chip-warn">Corte 28/10/2026</span>
            </div>
            <h2 className="mt-2 text-lg font-extrabold tracking-[-0.03em]">Plantillas reales 2026-27, sin relleno inventado.</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="card-soft p-3">
                <div className="text-[0.58rem] font-bold uppercase tracking-wide text-[var(--muted)]">NBA Real · 2026-27</div>
                <p className="mt-1.5 text-[0.7rem] leading-relaxed">30 franquicias y 522 fichas reales (16–18 por club), con 89 contratos two-way identificados. Pertenencia verificada en las páginas oficiales de NBA.com el 28/10/2026; nacionalidad y salarios pendientes se marcan sin inventarse.</p>
              </div>
              <div className="card-soft p-3">
                <div className="text-[0.58rem] font-bold uppercase tracking-wide text-[var(--muted)]">NBA Ficticia</div>
                <p className="mt-1.5 text-[0.7rem] leading-relaxed">30 clubes con 12 jugadores cada uno: 360 perfiles generados con semilla reproducible. Nombres, biografías e historia deportiva alterna propios.</p>
              </div>
            </div>
          </div>
          <div className="card p-5">
            <div className="overline">Fase 1 · alcance autorizado</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {["Ligas separadas", "Atributos", "OVR / POT", "Calendario", "Motor inicial", "IndexedDB", "Exhibición", "Manager + Espectador"].map((item) => <span key={item} className="chip">{item}</span>)}
            </div>
            <div className="divider my-4" />
            <div className="overline">Hoja de ruta</div>
            <p className="mt-1.5 text-[0.68rem] leading-relaxed text-[var(--muted)]">Fase 2: motor de posesiones y play-by-play detallado. Las fases 3–7 se mantienen documentadas, no implementadas todavía.</p>
            <div className="mt-3 flex items-center gap-2 text-[0.58rem] text-[var(--muted)]"><Icon name="database" size={12} /> Guardado local, sin servidores externos.</div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--line)]">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-4 py-5 text-[0.58rem] text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>DUELA · simulador de baloncesto propio. Sin logos ni recursos protegidos de la NBA.</span>
          <span>Fase 1 · React + TypeScript + IndexedDB · 2026</span>
        </div>
      </footer>
    </div>
  );
}
