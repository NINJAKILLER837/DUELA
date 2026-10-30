export type LeagueMode = "real" | "fictional";
export type PlayMode = "manager" | "spectator";
export type Conference = "Este" | "Oeste";
export type Position = "PG" | "SG" | "SF" | "PF" | "C";
export type ThemeKey = "tinta" | "papel" | "grafito" | "contraste";
export type DataStatus = "verified" | "partial" | "pending";
export type ContractType = "standard" | "two-way" | "unknown";
export type ShotZone = "restricted" | "close" | "mid" | "corner3" | "wing3";

export interface ShotZoneStats {
  fga: number;
  fgm: number;
  tpa: number;
  tpm: number;
  points: number;
}

export type ShotZoneRecord = Record<ShotZone, ShotZoneStats>;

export interface Attributes {
  strength: number;
  speed: number;
  jumping: number;
  endurance: number;
  inside: number;
  layups: number;
  freeThrows: number;
  midRange: number;
  threePointers: number;
  offensiveIQ: number;
  defensiveIQ: number;
  dribbling: number;
  passing: number;
  rebounding: number;
  perimeterDefense: number;
  interiorDefense: number;
}

export interface Player {
  id: string;
  leagueId: string;
  teamId: string;
  name: string;
  firstName: string;
  lastName: string;
  position: Position;
  age: number;
  heightIn: number;
  weightLb: number;
  wingspanIn: number;
  jersey: number;
  weightPending?: boolean;
  nationality: string;
  college: string;
  role: string;
  archetype: string;
  attributes: Attributes;
  ovr: number;
  pot: number;
  bio: string;
  real: boolean;
  dataStatus: DataStatus;
  ageEstimated?: boolean;
  /** Solo informado para fichas reales; el simulador no modela salarios. */
  contractType?: ContractType;
  /** Años de experiencia NBA según la fuente de plantillas 2026-27. */
  experience?: number;
  /** Posición ampliada publicada por la fuente (G/F/C). */
  listedPosition?: string;
  /** true cuando la fuente no publica dorsal; 0 puede ser un dorsal válido. */
  jerseyPending?: boolean;
  /** Procedencia pública de la adquisición (draft, firma, traspaso). */
  howAcquired?: string;
  /** ID oficial de jugador en NBA.com, cuando está disponible. */
  nbaPlayerId?: number;
}

export interface Team {
  id: string;
  leagueId: string;
  franchiseId: string;
  city: string;
  name: string;
  abbreviation: string;
  conference: Conference;
  division: string;
  founded: number;
  arena: string;
  championships: number;
  history: string;
  fictionalHistory?: string;
  aiControlled: boolean;
  rotation?: string[];
  rotationMinutes?: Record<string, number>;
  philosophy?: string;
}

export interface League {
  id: string;
  name: string;
  mode: LeagueMode;
  playMode: PlayMode;
  seed: string;
  season: string;
  userTeamId: string;
  createdAt: number;
  updatedAt: number;
  schemaVersion: number;
  theme: ThemeKey;
  phase: 1;
  fictionalUniverse?: string;
  gamesPlayed?: number;
  gamesTotal?: number;
  playerCount?: number;
}

export interface PlayerGameStats {
  playerId: string;
  name: string;
  position: Position;
  minutes: number;
  points: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
  oreb: number;
  dreb: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pf: number;
  plusMinus: number;
  /** Registro opcional por zona; las partidas antiguas pueden no tenerlo. */
  zones?: ShotZoneRecord;
  /** Faltas personales por período (regulación y prórrogas). */
  periodFouls?: number[];
}

export interface TeamBoxScore {
  teamId: string;
  points: number;
  quarters: number[];
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
  reb: number;
  oreb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pf: number;
  players: PlayerGameStats[];
  /** Campos opcionales de Fase 2; compatibles con cajas guardadas de Fase 1. */
  zones?: ShotZoneRecord;
  possessions?: number;
  teamFouls?: number[];
  fastBreakPoints?: number;
  pointsInPaint?: number;
  engineVersion?: number;
}

export interface PlayEvent {
  seq: number;
  period: number;
  clock: string;
  teamId: string;
  text: string;
  homeScore: number;
  awayScore: number;
  kind: "score" | "miss" | "turnover" | "foul" | "rebound" | "block" | "period" | "substitution";
  /** Metadatos opcionales de Fase 2; la narración no inventa la acción. */
  shotZone?: ShotZone;
  points?: number;
  shooterId?: string;
  playerId?: string;
  possession?: number;
  side?: "home" | "away";
  /** Solo en eventos de sustitución. */
  inPlayerId?: string;
  reason?: string;
}

export interface SubstitutionRecord {
  id: string;
  teamId: string;
  period: number;
  clock: string;
  elapsed: number;
  outPlayerId: string;
  outPlayerName: string;
  inPlayerId: string;
  inPlayerName: string;
  reason: string;
  forced: boolean;
}

export interface BoxScore {
  home: TeamBoxScore;
  away: TeamBoxScore;
}

export interface Game {
  id: string;
  leagueId: string;
  round: number;
  day: string;
  homeTeamId: string;
  awayTeamId: string;
  played: boolean;
  homeScore?: number;
  awayScore?: number;
  boxScore?: BoxScore;
  playByPlay?: PlayEvent[];
  seed: number;
  simulatedAt?: number;
  engineVersion?: number;
  /** Registro de cambios de Fase 3; opcional para partidas antiguas. */
  substitutions?: SubstitutionRecord[];
  /** Quintetos iniciales de Fase 3 (IDs de jugador). */
  startingLineups?: { home: string[]; away: string[] };
}

export interface LeagueSaveMeta {
  id: string;
  name: string;
  mode: LeagueMode;
  playMode: PlayMode;
  theme: ThemeKey;
  userTeamId: string;
  userTeamName: string;
  updatedAt: number;
  createdAt: number;
  progress: number;
  playerCount: number;
}

export interface AppSettings {
  theme: ThemeKey;
  lastOpenedLeagueId?: string;
}

export interface FranchiseSeed {
  id: string;
  city: string;
  name: string;
  abbreviation: string;
  conference: Conference;
  division: string;
  founded: number;
  arena: string;
  championships: number;
  history: string;
}

export interface RealPlayerSeed {
  name: string;
  pos: Position;
  age: number;
  height: number;
  weight: number;
  nationality: string;
  college: string;
  tier: number;
  profile?: "scorer" | "shooter" | "playmaker" | "defender" | "big" | "wing" | "athlete" | "allround";
  note?: string;
  jersey?: number;
  experience?: number;
  listedPosition?: string;
  contractType?: ContractType;
  jerseyPending?: boolean;
  weightPending?: boolean;
  howAcquired?: string;
  nbaPlayerId?: number;
}

export interface ExhibitionTeam {
  team: Team;
  players: Player[];
  label: string;
  leagueName: string;
  mode: LeagueMode | "mixed";
}

export type LeagueBundle = {
  league: League;
  teams: Team[];
  players: Player[];
  games: Game[];
};
