import { useMemo, useState } from "react";
import type { Conference, LeagueBundle, LeagueMode, PlayMode, ThemeKey } from "@/types";
import { FRANCHISES, REAL_TEAMS_COUNT } from "@/data/franchises";
import { createLeagueBundle, randomSeed } from "@/game/generate";
import { Icon, TeamMark, ThemePicker } from "@/components/ui";
import { cn } from "@/utils/cn";

interface CreateLeagueProps {
  initialMode: PlayMode;
  theme: ThemeKey;
  onThemeChange: (theme: ThemeKey) => void;
  onCancel: () => void;
  onExhibition: () => void;
  onCreated: (bundle: LeagueBundle) => Promise<void>;
}

export function CreateLeague({ initialMode, theme, onThemeChange, onCancel, onExhibition, onCreated }: CreateLeagueProps) {
  const [leagueMode, setLeagueMode] = useState<LeagueMode>("fictional");
  const [playMode, setPlayMode] = useState<PlayMode>(initialMode);
  const [seed, setSeed] = useState(() => randomSeed().toLowerCase());
  const [franchiseId, setFranchiseId] = useState("nyk");
  const [conference, setConference] = useState<Conference>("Este");
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = FRANCHISES.find((franchise) => franchise.id === franchiseId) ?? FRANCHISES[0];
  const defaultName = leagueMode === "real" ? `NBA Real · ${selected.city} ${selected.name}` : `Universo ${seed || "sin semilla"} · ${selected.name}`;
  const leagueName = nameTouched ? name : defaultName;
  const filteredTeams = useMemo(() => FRANCHISES.filter((franchise) => franchise.conference === conference), [conference]);

  const changeMode = (mode: LeagueMode) => {
    setLeagueMode(mode);
    setError(null);
    if (!nameTouched) setName("");
  };

  const create = async () => {
    setError(null);
    if (leagueName.trim().length < 3) {
      setError("La liga necesita un nombre de al menos 3 caracteres.");
      return;
    }
    if (leagueMode === "fictional" && seed.trim().length < 2) {
      setError("Introduce una semilla ficticia de al menos 2 caracteres para poder reproducir el universo.");
      return;
    }
    setBusy(true);
    await new Promise((resolve) => window.setTimeout(resolve, 80));
    try {
      const bundle = createLeagueBundle({
        name: leagueName.trim(),
        mode: leagueMode,
        playMode,
        theme,
        userTeamId: franchiseId,
        seed: leagueMode === "fictional" ? seed.trim() : "nba-real-cutoff-2026-10-28",
      });
      await onCreated(bundle);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo crear la liga. Inténtalo de nuevo.");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-4 sm:px-6">
          <button type="button" className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)] transition hover:text-[var(--ink)]" onClick={onCancel}>
            <Icon name="arrow-left" size={17} /> Volver al inicio
          </button>
          <div className="flex items-center gap-2">
            <span className="display text-lg leading-none">DUELA</span>
            <span className="chip">Nueva liga</span>
          </div>
          <span className="hidden text-[0.6rem] uppercase tracking-[0.12em] text-[var(--muted)] sm:block">Paso 1 de 1</span>
        </div>
      </header>

      <main className="mx-auto max-w-[1240px] px-3 pb-24 pt-5 sm:px-6 sm:pt-8">
        <div className="mb-6 max-w-2xl">
          <div className="overline">Configurar partida</div>
          <h1 className="mt-1.5 text-[2rem] font-extrabold leading-[0.95] tracking-[-0.055em] sm:text-[2.7rem]">Elige un mundo.<br />Después elige tu silla.</h1>
          <p className="mt-2 max-w-xl text-xs leading-relaxed text-[var(--muted)] sm:text-sm">Los dos modos de liga viven separados. Puedes tener varias ligas reales y ficticias abiertas sin mezclar plantillas ni resultados.</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_330px]">
          <div className="space-y-4">
            <section className="card p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div><div className="overline">01 / Universo</div><h2 className="mt-1 text-base font-bold">Tipo de liga</h2></div>
                <span className="chip">{REAL_TEAMS_COUNT} franquicias</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <button type="button" onClick={() => changeMode("real")} className={cn("row-card relative p-4 text-left", leagueMode === "real" && "border-[var(--ink)] bg-[var(--surface-2)] ring-1 ring-[var(--ink)]")} aria-pressed={leagueMode === "real"}>
                  <div className="flex items-center justify-between">
                    <span className="chip chip-solid">NBA Real</span>
                    {leagueMode === "real" && <Icon name="check" size={16} />}
                  </div>
                  <h3 className="mt-3 text-sm font-bold">Plantillas 2026-27</h3>
                  <p className="mt-1 text-[0.68rem] leading-relaxed text-[var(--muted)]">30 franquicias reales y 522 fichas al corte 28/10/2026, con 89 contratos two-way identificados. Procedencia visible y campos pendientes marcados.</p>
                  <div className="mt-2.5 flex flex-wrap gap-1"><span className="chip">historia real</span><span className="chip chip-warn">identidad parcial</span></div>
                </button>
                <button type="button" onClick={() => changeMode("fictional")} className={cn("row-card relative p-4 text-left", leagueMode === "fictional" && "border-[var(--ink)] bg-[var(--surface-2)] ring-1 ring-[var(--ink)]")} aria-pressed={leagueMode === "fictional"}>
                  <div className="flex items-center justify-between">
                    <span className="chip chip-solid">NBA Ficticia</span>
                    {leagueMode === "fictional" && <Icon name="check" size={16} />}
                  </div>
                  <h3 className="mt-3 text-sm font-bold">Universo propio</h3>
                  <p className="mt-1 text-[0.68rem] leading-relaxed text-[var(--muted)]">30 franquicias y 12 jugadores ficticios por equipo: 360 fichas con biografía, atributos y perfil propios.</p>
                  <div className="mt-2.5 flex flex-wrap gap-1"><span className="chip">semilla reproducible</span><span className="chip">360 jugadores</span></div>
                </button>
              </div>
              {leagueMode === "real" && (
                <div className="mt-3 flex gap-2 rounded-lg border border-dashed border-[var(--line-strong)] p-3 text-[0.65rem] leading-relaxed text-[var(--muted)]">
                  <Icon name="info" size={14} className="mt-0.5 shrink-0" />
                  <span>Plantillas y two-way obtenidos de NBA.com el 28/10/2026 (522 fichas, 16–18 por club). La nacionalidad, un dorsal y los términos salariales siguen pendientes y se marcan como tal. No se inventan jugadores, contratos ni estadísticas.</span>
                </div>
              )}
            </section>

            <section className="card p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div><div className="overline">02 / Franquicia</div><h2 className="mt-1 text-base font-bold">Tu equipo</h2></div>
                <div className="flex gap-1">
                  {(["Este", "Oeste"] as const).map((item) => (
                    <button key={item} type="button" className={cn("rounded-md px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-wide", conference === item ? "bg-[var(--inverse)] text-[var(--inverse-ink)]" : "border border-[var(--line)] text-[var(--muted)]")} onClick={() => setConference(item)}>{item}</button>
                  ))}
                </div>
              </div>
              <div className="grid max-h-[300px] gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
                {filteredTeams.map((franchise) => (
                  <button key={franchise.id} type="button" onClick={() => setFranchiseId(franchise.id)} className={cn("flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition", franchiseId === franchise.id ? "border-[var(--ink)] bg-[var(--surface-2)]" : "border-[var(--line)] hover:border-[var(--line-strong)]")}>
                    <TeamMark team={franchise} size={30} outline={franchiseId !== franchise.id} />
                    <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{franchise.city} {franchise.name}</span><span className="block truncate text-[0.58rem] text-[var(--muted)]">{franchise.division} · desde {franchise.founded}</span></span>
                    {franchiseId === franchise.id && <Icon name="check" size={14} />}
                  </button>
                ))}
              </div>
            </section>

            <section className="card p-4 sm:p-5">
              <div className="mb-3"><div className="overline">03 / Control</div><h2 className="mt-1 text-base font-bold">Modo de juego</h2></div>
              <div className="grid gap-2 sm:grid-cols-2">
                {(["manager", "spectator"] as const).map((mode) => (
                  <button key={mode} type="button" onClick={() => setPlayMode(mode)} className={cn("row-card flex flex-col p-3.5 text-left", playMode === mode && "border-[var(--ink)] bg-[var(--surface-2)] ring-1 ring-[var(--ink)]")} aria-pressed={playMode === mode}>
                    <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-xs font-bold"><Icon name={mode === "manager" ? "target" : "eye"} size={16} />{mode === "manager" ? "Manager" : "Espectador"}</span>{playMode === mode && <Icon name="check" size={15} />}</div>
                    <p className="mt-1.5 text-[0.65rem] leading-relaxed text-[var(--muted)]">{mode === "manager" ? "Tú controlas rotación, filosofía y cuándo avanzar. La IA gestiona al resto de la liga." : "La IA controla absolutamente todo. Tú observas resultados, clasificación y estadísticas sin editar nada."}</p>
                  </button>
                ))}
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-[0.6rem] text-[var(--muted)]"><Icon name="info" size={12} /> Podrás activar o desactivar el modo desde Ajustes de la liga sin perder el progreso.</p>
            </section>

            <section className="card p-4 sm:p-5">
              <div className="mb-3"><div className="overline">04 / Identidad visual</div><h2 className="mt-1 text-base font-bold">Tema blanco y negro</h2></div>
              <ThemePicker value={theme} onChange={onThemeChange} />
              <p className="mt-2 text-[0.62rem] leading-relaxed text-[var(--muted)]">El tema quedará guardado en esta liga. Podrás ajustarlo después junto al resto de su configuración.</p>
            </section>
          </div>

          <aside className="space-y-3 lg:sticky lg:top-20 lg:self-start">
            <div className="card overflow-hidden">
              <div className="border-b border-[var(--line)] bg-[var(--surface-2)] p-4">
                <div className="overline">Resumen</div>
                <div className="mt-3 flex items-center gap-3">
                  <TeamMark team={selected} size={46} />
                  <div className="min-w-0"><div className="truncate text-sm font-bold">{selected.city}</div><div className="truncate text-sm font-bold text-[var(--muted)]">{selected.name}</div></div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1"><span className="chip">{leagueMode === "real" ? "NBA Real" : "NBA Ficticia"}</span><span className="chip">{playMode === "manager" ? "Manager" : "Espectador"}</span></div>
              </div>
              <div className="space-y-3 p-4">
                <label className="block">
                  <span className="label overline">Nombre de la liga</span>
                  <input className="field" value={leagueName} maxLength={60} onChange={(event) => { setName(event.target.value); setNameTouched(true); }} placeholder="Mi temporada" />
                </label>
                {leagueMode === "fictional" && (
                  <label className="block">
                    <span className="label overline">Semilla del universo</span>
                    <div className="flex gap-1.5">
                      <input className="field font-mono text-xs" value={seed} maxLength={32} onChange={(event) => setSeed(event.target.value.toUpperCase())} placeholder="TITANIO-ARO-2026" />
                      <button type="button" className="icon-btn shrink-0" title="Generar semilla" aria-label="Generar semilla" onClick={() => setSeed(randomSeed().toLowerCase())}><Icon name="dice" size={17} /></button>
                    </div>
                    <span className="mt-1 block text-[0.58rem] leading-relaxed text-[var(--muted)]">La misma semilla reproduce los mismos 360 jugadores e historias.</span>
                  </label>
                )}
                <div className="space-y-1.5 border-t border-[var(--line)] pt-3 text-[0.65rem]">
                  <div className="flex justify-between gap-2"><span className="text-[var(--muted)]">Franquicias</span><span className="font-semibold">30</span></div>
                  <div className="flex justify-between gap-2"><span className="text-[var(--muted)]">Jugadores</span><span className="font-semibold">{leagueMode === "fictional" ? "360 ficticios" : "522 reales · 16–18/equipo"}</span></div>
                  <div className="flex justify-between gap-2"><span className="text-[var(--muted)]">Calendario</span><span className="font-semibold">29 jornadas</span></div>
                  <div className="flex justify-between gap-2"><span className="text-[var(--muted)]">Guardado</span><span className="font-semibold">IndexedDB</span></div>
                </div>
                {error && <div className="rounded-lg border border-[var(--line-strong)] p-2.5 text-[0.65rem] leading-relaxed"><Icon name="alert" size={13} className="mr-1 inline" />{error}</div>}
                <button type="button" className="btn btn-solid btn-lg w-full justify-between" disabled={busy} onClick={create}>
                  {busy ? "Generando universo…" : "Crear y abrir liga"} <Icon name={busy ? "refresh" : "arrow-right"} size={16} className={busy ? "animate-spin" : ""} />
                </button>
                <button type="button" className="btn w-full justify-between" onClick={onExhibition} disabled={busy}>
                  Solo quiero una exhibición <Icon name="games" size={15} />
                </button>
                <p className="text-center text-[0.56rem] leading-relaxed text-[var(--muted)]">Se crearán equipos, jugadores y calendario en una única transacción local.</p>
              </div>
            </div>
            {busy && <div className="card p-3"><div className="progress-sim"><span /></div><p className="mt-2 text-center text-[0.6rem] text-[var(--muted)]">Validando plantillas y escribiendo en IndexedDB…</p></div>}
          </aside>
        </div>
      </main>
    </div>
  );
}
