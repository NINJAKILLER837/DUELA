import type { Game, LeagueBundle, LeagueSaveMeta, PlayMode, Team, ThemeKey } from "@/types";
import type { IconName } from "@/components/ui";

export type LeaguePage = "dashboard" | "teams" | "roster" | "players" | "schedule" | "standings" | "games" | "stats" | "saves" | "settings" | "data";

export interface LeagueActions {
  onNavigate: (page: LeaguePage) => void;
  simulateRound: () => Promise<void>;
  playNextGame: () => Promise<void>;
  simulateBusy: boolean;
  onUpdateTeam: (team: Team) => Promise<void>;
  onChangePlayMode: (mode: PlayMode) => Promise<void>;
  onChangeTheme: (theme: ThemeKey) => Promise<void>;
  onRenameLeague: (name: string) => Promise<void>;
  onSaveNow: () => Promise<void>;
  onExit: () => void;
  onOpenLeague: (id: string) => Promise<void>;
  savedLeagues: LeagueSaveMeta[];
  saveState: "idle" | "saving" | "saved" | "error";
  saveError: string | null;
  clearSaveError: () => void;
  onViewGame: (game: Game) => void;
  currentRoundNumber: number;
}

export interface LeagueView extends LeagueActions {
  bundle: LeagueBundle;
  userTeam: Team;
}

export interface NavItem {
  key: LeaguePage;
  label: string;
  shortLabel: string;
  icon: IconName;
  group: "Liga" | "Competición" | "Sistema";
}

export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Resumen", shortLabel: "Inicio", icon: "home", group: "Liga" },
  { key: "teams", label: "Equipos", shortLabel: "Equipos", icon: "teams", group: "Liga" },
  { key: "roster", label: "Mi plantilla", shortLabel: "Plantilla", icon: "roster", group: "Liga" },
  { key: "players", label: "Jugadores", shortLabel: "Jugadores", icon: "players", group: "Liga" },
  { key: "schedule", label: "Calendario", shortLabel: "Calendario", icon: "calendar", group: "Competición" },
  { key: "standings", label: "Clasificación", shortLabel: "Tabla", icon: "standings", group: "Competición" },
  { key: "games", label: "Partidos", shortLabel: "Partidos", icon: "games", group: "Competición" },
  { key: "stats", label: "Estadísticas", shortLabel: "Stats", icon: "stats", group: "Competición" },
  { key: "saves", label: "Guardado y carga", shortLabel: "Guardado", icon: "database", group: "Sistema" },
  { key: "settings", label: "Ajustes de liga", shortLabel: "Ajustes", icon: "settings", group: "Sistema" },
  { key: "data", label: "Datos y fuentes", shortLabel: "Datos", icon: "sources", group: "Sistema" },
];

export const PAGE_TITLES: Record<LeaguePage, { title: string; eyebrow: string }> = {
  dashboard: { title: "Centro de mando", eyebrow: "Temporada 2026-27 · Fase 1" },
  teams: { title: "Equipos", eyebrow: "30 franquicias" },
  roster: { title: "Mi plantilla", eyebrow: "Construcción del equipo" },
  players: { title: "Jugadores", eyebrow: "Base de jugadores" },
  schedule: { title: "Calendario", eyebrow: "Liga regular abreviada" },
  standings: { title: "Clasificación", eyebrow: "Conferencias Este y Oeste" },
  games: { title: "Partidos y boxscores", eyebrow: "Resultados finales" },
  stats: { title: "Estadísticas", eyebrow: "Rendimiento individual" },
  saves: { title: "Guardado y carga", eyebrow: "Persistencia local" },
  settings: { title: "Ajustes de liga", eyebrow: "Configuración" },
  data: { title: "Datos y fuentes", eyebrow: "Procedencia y validación" },
};
