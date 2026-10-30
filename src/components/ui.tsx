import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Player, Team, ThemeKey } from "@/types";
import { cn } from "@/utils/cn";

export type IconName =
  | "home" | "teams" | "roster" | "players" | "calendar" | "standings" | "games" | "stats"
  | "settings" | "database" | "sources" | "arrow-left" | "arrow-right" | "plus" | "close"
  | "search" | "chevron-down" | "chevron-right" | "play" | "trophy" | "alert" | "check"
  | "refresh" | "save" | "menu" | "more" | "dice" | "swap" | "info" | "eye" | "spark"
  | "filter" | "back" | "trash" | "shield" | "clock" | "target" | "bolt" | "list";

const paths: Record<IconName, ReactNode> = {
  home: <><path d="M3 10.8 12 3l9 7.8"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/></>,
  teams: <><rect x="3" y="3" width="7.5" height="7.5" rx="1.4"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.4"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.4"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.4"/></>,
  roster: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
  players: <><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="M8 14h2M14 14h2M8 18h2M14 18h2"/></>,
  standings: <><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></>,
  games: <><circle cx="12" cy="12" r="9"/><path d="M5.7 5.7c3.1 2.4 3.1 10.2 0 12.6M18.3 5.7c-3.1 2.4-3.1 10.2 0 12.6M3 12h18M12 3v18"/></>,
  stats: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
  settings: <><path d="M4 6h6M14 6h6M4 12h10M18 12h2M4 18h3M11 18h9"/><circle cx="12" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="9" cy="18" r="2"/></>,
  database: <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></>,
  sources: <><path d="M5 3h9l5 5v13H5z"/><path d="M14 3v5h5M8 13h8M8 17h6"/></>,
  "arrow-left": <><path d="m15 18-6-6 6-6"/></>,
  "arrow-right": <><path d="m9 18 6-6-6-6"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  close: <><path d="M18 6 6 18M6 6l12 12"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></>,
  "chevron-down": <><path d="m6 9 6 6 6-6"/></>,
  "chevron-right": <><path d="m9 18 6-6-6-6"/></>,
  play: <><path d="m7 4 13 8-13 8z"/></>,
  trophy: <><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4"/></>,
  alert: <><path d="M12 3 2 21h20z"/><path d="M12 9v5M12 17.5h.01"/></>,
  check: <><path d="m4 12 5 5L20 6"/></>,
  refresh: <><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></>,
  save: <><path d="M4 4h13l3 3v13H4z"/><path d="M8 4v6h8V4M8 20v-6h8v6"/></>,
  menu: <><path d="M3 6h18M3 12h18M3 18h18"/></>,
  more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
  dice: <><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1"/><circle cx="16" cy="8" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="8" cy="16" r="1"/><circle cx="16" cy="16" r="1"/></>,
  swap: <><path d="M7 4 3 8l4 4M3 8h13a4 4 0 0 1 0 8h-2M17 20l4-4-4-4"/></>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>,
  spark: <><path d="m12 2 2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z"/></>,
  filter: <><path d="M3 5h18l-7 8v6l-4 2v-8z"/></>,
  back: <><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></>,
  trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6"/></>,
  shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  target: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>,
  bolt: <><path d="m13 2-8 12h6l-1 8 8-12h-6z"/></>,
  list: <><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></>,
};

export function Icon({ name, size = 18, className, strokeWidth = 1.7 }: { name: IconName; size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {paths[name]}
    </svg>
  );
}

export const THEME_OPTIONS: { key: ThemeKey; name: string; description: string; bg: string; ink: string; line: string }[] = [
  { key: "tinta", name: "Tinta", description: "Negro profundo · texto marfil", bg: "#0b0b0a", ink: "#f3f1e9", line: "#2c2c28" },
  { key: "grafito", name: "Grafito", description: "Carbón suave · alto contraste", bg: "#1a1b1c", ink: "#f2f1ed", line: "#3b3e40" },
  { key: "papel", name: "Papel", description: "Marfil · tinta negra", bg: "#edeae2", ink: "#11110f", line: "#d5d0c3" },
  { key: "contraste", name: "Contraste", description: "Blanco puro · negro puro", bg: "#ffffff", ink: "#000000", line: "#c9c9c9" },
];

export function ThemePicker({ value, onChange }: { value: ThemeKey; onChange: (theme: ThemeKey) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {THEME_OPTIONS.map((theme) => {
        const style = { "--swatch-bg": theme.bg, "--swatch-ink": theme.ink, "--swatch-line": theme.line, background: theme.bg, color: theme.ink } as CSSProperties;
        return (
          <button key={theme.key} type="button" onClick={() => onChange(theme.key)} className={cn("theme-swatch transition", value === theme.key ? "ring-2 ring-[var(--ink)] ring-offset-2 ring-offset-[var(--bg)]" : "opacity-80 hover:opacity-100")} style={style} aria-pressed={value === theme.key}>
            <span className="relative z-10 block text-[0.68rem] font-bold uppercase tracking-[0.08em]">{theme.name}</span>
            <span className="relative z-10 mt-1 block text-[0.58rem] opacity-65">{theme.description}</span>
          </button>
        );
      })}
    </div>
  );
}

export function TeamMark({ team, size = 40, outline = false }: { team: Pick<Team, "abbreviation" | "name">; size?: number; outline?: boolean }) {
  return (
    <span className={cn("team-mark", outline && "team-mark-outline")} style={{ width: size, height: size, fontSize: Math.max(9, size * 0.3) }} aria-label={`Escudo ${team.name}`}>
      <span>{team.abbreviation}</span>
    </span>
  );
}

export function PlayerAvatar({ player, size = 40 }: { player: Pick<Player, "firstName" | "lastName" | "position">; size?: number }) {
  const initials = `${player.firstName.charAt(0)}${player.lastName.charAt(0)}`.toUpperCase();
  return (
    <span className="team-mark team-mark-outline" style={{ width: size, height: size, fontSize: Math.max(9, size * 0.28), borderRadius: size > 50 ? 14 : 10 }} aria-hidden="true">
      <span>{initials}</span>
    </span>
  );
}

export function OvrBadge({ ovr, pot, compact = false }: { ovr: number; pot?: number; compact?: boolean }) {
  return (
    <span className="inline-flex items-baseline gap-1 tabular">
      <span className={cn("inline-flex items-center justify-center font-black tracking-[-0.04em]", compact ? "text-[0.86rem]" : "text-base", ovr >= 85 ? "text-[var(--ink)]" : "text-[var(--ink-soft)]")}>{ovr}</span>
      {pot !== undefined && <span className="text-[0.6rem] font-semibold text-[var(--muted)]">/ {pot} POT</span>}
    </span>
  );
}

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow: string; title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="overline">{eyebrow}</div>
        <h1 className="mt-1.5 text-[1.7rem] font-extrabold tracking-[-0.045em] sm:text-[2rem]">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[var(--muted)] sm:text-sm">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon = "info", title, message, action }: { icon?: IconName; title: string; message: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full border border-[var(--line)] text-[var(--muted)]"><Icon name={icon} size={22} /></span>
      <h3 className="text-base font-bold">{title}</h3>
      <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-[var(--muted)]">{message}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function LoadingState({ title = "Cargando", message = "Leyendo datos locales…" }: { title?: string; message?: string }) {
  return (
    <div className="card px-6 py-16 text-center">
      <div className="mx-auto mb-6 h-8 w-8 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--ink)]" />
      <h3 className="text-sm font-bold">{title}</h3>
      <p className="mt-1 text-xs text-[var(--muted)]">{message}</p>
    </div>
  );
}

export function ErrorState({ title = "Algo no salió bien", message, action }: { title?: string; message: string; action?: ReactNode }) {
  return (
    <div className="card border-[var(--line-strong)] px-6 py-12 text-center">
      <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full border border-[var(--line-strong)]"><Icon name="alert" size={22} /></span>
      <h3 className="text-base font-bold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-[var(--muted)]">{message}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function StatBlock({ label, value, hint, inverse = false }: { label: string; value: ReactNode; hint?: string; inverse?: boolean }) {
  return (
    <div className={cn("min-w-0 rounded-xl border p-3.5 sm:p-4", inverse ? "border-[var(--inverse)] bg-[var(--inverse)] text-[var(--inverse-ink)]" : "border-[var(--line)] bg-[var(--surface)]")}>
      <div className={cn("text-[0.58rem] font-bold uppercase tracking-[0.13em]", inverse ? "opacity-60" : "text-[var(--muted)]")}>{label}</div>
      <div className="mt-1.5 truncate text-2xl font-extrabold tracking-[-0.05em] tabular sm:text-[1.7rem]">{value}</div>
      {hint && <div className={cn("mt-1 text-[0.62rem]", inverse ? "opacity-65" : "text-[var(--muted)]")}>{hint}</div>}
    </div>
  );
}

let overlayLocks = 0;
const savedPageOverflow = { body: "", html: "" };

function useOverlayBehavior(onClose: () => void): void {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (overlayLocks === 0) {
      savedPageOverflow.body = document.body.style.overflow;
      savedPageOverflow.html = document.documentElement.style.overflow;
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    }
    overlayLocks++;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      overlayLocks = Math.max(0, overlayLocks - 1);
      if (overlayLocks === 0) {
        document.body.style.overflow = savedPageOverflow.body;
        document.documentElement.style.overflow = savedPageOverflow.html;
      }
    };
  }, []);
}

function OverlayPortal({ children }: { children: ReactNode }) {
  // En SSR no hay document; se renderiza inline para las pruebas de DOM.
  if (typeof document === "undefined") return <>{children}</>;
  return createPortal(children, document.body);
}

export function ModalShell({ children, onClose, label }: { children: ReactNode; onClose: () => void; label: string }) {
  useOverlayBehavior(onClose);
  return (
    <OverlayPortal>
      <div className="drawer-backdrop" role="presentation" onClick={onClose}>
        <div className="modal" role="dialog" aria-modal="true" aria-label={label} onClick={(event) => event.stopPropagation()}>
          {children}
        </div>
      </div>
    </OverlayPortal>
  );
}

export function DrawerShell({ children, onClose, label }: { children: ReactNode; onClose: () => void; label: string }) {
  useOverlayBehavior(onClose);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Cada ficha se abre desde arriba, nunca heredando el scroll de la anterior.
    scrollRef.current?.scrollTo({ top: 0 });
  }, []);
  return (
    <OverlayPortal>
      <div className="drawer-backdrop" role="presentation" onClick={onClose}>
        <aside className="drawer" role="dialog" aria-modal="true" aria-label={label} onClick={(event) => event.stopPropagation()}>
          <div ref={scrollRef} className="drawer-scroll" data-scroll-container="drawer" tabIndex={0}>
            {children}
          </div>
        </aside>
      </div>
    </OverlayPortal>
  );
}

export function SectionCard({ title, eyebrow, action, children, className }: { title: string; eyebrow?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("card overflow-hidden", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3.5 sm:px-5">
        <div>
          {eyebrow && <div className="overline">{eyebrow}</div>}
          <h2 className="text-sm font-bold tracking-[-0.01em]">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function ModeTag({ mode }: { mode: "manager" | "spectator" }) {
  return (
    <span className="chip">
      <Icon name={mode === "manager" ? "target" : "eye"} size={11} />
      {mode === "manager" ? "Manager" : "Espectador"}
    </span>
  );
}

export function ToneTag({ tone, children }: { tone: "neutral" | "warn" | "good"; children: ReactNode }) {
  return <span className={cn("chip", tone === "warn" && "chip-warn", tone === "good" && "chip-good")}>{children}</span>;
}
