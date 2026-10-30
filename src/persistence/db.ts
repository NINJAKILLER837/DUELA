import type { AppSettings, Game, League, LeagueBundle, LeagueSaveMeta, Player, Team, ThemeKey } from "@/types";

export const DB_NAME = "duela_gm_phase1";
export const DB_VERSION = 1;
export const APP_SCHEMA_VERSION = 1;
const SETTINGS_KEY = "app";

type StoreName = "leagues" | "teams" | "players" | "games" | "settings";

export class StorageError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "StorageError";
  }
}

let databasePromise: Promise<IDBDatabase> | null = null;

export function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Error de IndexedDB"));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Transacción de IndexedDB fallida"));
    transaction.onabort = () => reject(transaction.error ?? new Error("Transacción de IndexedDB abortada"));
  });
}

export function openDatabase(): Promise<IDBDatabase> {
  if (!isIndexedDbAvailable()) {
    return Promise.reject(new StorageError("Este navegador no expone IndexedDB. No se puede guardar la partida."));
  }
  if (databasePromise) return databasePromise;
  const promise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = event.oldVersion;
      // Migraciones aditivas. Nunca se borran partidas existentes.
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains("leagues")) db.createObjectStore("leagues", { keyPath: "id" });
        if (!db.objectStoreNames.contains("teams")) {
          const teams = db.createObjectStore("teams", { keyPath: "id" });
          teams.createIndex("leagueId", "leagueId");
        }
        if (!db.objectStoreNames.contains("players")) {
          const players = db.createObjectStore("players", { keyPath: "id" });
          players.createIndex("leagueId", "leagueId");
          players.createIndex("teamId", "teamId");
        }
        if (!db.objectStoreNames.contains("games")) {
          const games = db.createObjectStore("games", { keyPath: "id" });
          games.createIndex("leagueId", "leagueId");
        }
        if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings", { keyPath: "key" });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => {
      reject(new StorageError("No se pudo abrir la base local de IndexedDB.", request.error));
    };
    request.onblocked = () => {
      reject(new StorageError("IndexedDB está bloqueada por otra pestaña. Cierra las demás pestañas e inténtalo de nuevo."));
    };
  });
  databasePromise = promise;
  void promise.catch(() => {
    databasePromise = null;
  });
  return promise;
}

const THEMES: ThemeKey[] = ["tinta", "papel", "grafito", "contraste"];

function normalizeLeague(league: League): League {
  return {
    ...league,
    schemaVersion: APP_SCHEMA_VERSION,
    theme: THEMES.includes(league.theme) ? league.theme : "tinta",
    phase: 1,
    playMode: league.playMode === "spectator" ? "spectator" : "manager",
  };
}

export async function saveLeagueBundle(bundle: LeagueBundle): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(["leagues", "teams", "players", "games"] satisfies StoreName[], "readwrite");
  try {
    const leagues = transaction.objectStore("leagues");
    const teams = transaction.objectStore("teams");
    const players = transaction.objectStore("players");
    const gamesStore = transaction.objectStore("games");
    leagues.put(normalizeLeague({
      ...bundle.league,
      gamesPlayed: bundle.games.filter((game) => game.played).length,
      gamesTotal: bundle.games.length,
      playerCount: bundle.players.length,
    }));
    for (const team of bundle.teams) teams.put(team);
    for (const player of bundle.players) players.put(player);
    for (const game of bundle.games) gamesStore.put(game);
    await transactionDone(transaction);
  } catch (error) {
    throw new StorageError("No se pudo crear la liga en el almacenamiento local.", error);
  }
}

export async function listLeagues(): Promise<LeagueSaveMeta[]> {
  const db = await openDatabase();
  const leaguesTx = db.transaction(["leagues"], "readonly");
  const leagues = (await requestToPromise(leaguesTx.objectStore("leagues").getAll())) as League[];
  await transactionDone(leaguesTx);
  const teamsTx = db.transaction(["teams"], "readonly");
  const teams = (await requestToPromise(teamsTx.objectStore("teams").getAll())) as Team[];
  await transactionDone(teamsTx);
  return leagues
    .map((league) => {
      const leagueTeams = teams.filter((team) => team.leagueId === league.id);
      const userTeam = leagueTeams.find((team) => team.id === league.userTeamId);
      const total = league.gamesTotal ?? 0;
      const played = league.gamesPlayed ?? 0;
      return {
        id: league.id,
        name: league.name,
        mode: league.mode,
        playMode: league.playMode,
        theme: league.theme,
        userTeamId: league.userTeamId,
        userTeamName: userTeam ? `${userTeam.city} ${userTeam.name}` : "Equipo no disponible",
        createdAt: league.createdAt,
        updatedAt: league.updatedAt,
        progress: total ? Math.round((played / total) * 100) : 0,
        playerCount: league.playerCount ?? 0,
      } satisfies LeagueSaveMeta;
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadLeague(id: string): Promise<LeagueBundle> {
  const db = await openDatabase();
  const leagueTx = db.transaction(["leagues"], "readonly");
  const league = (await requestToPromise(leagueTx.objectStore("leagues").get(id))) as League | undefined;
  await transactionDone(leagueTx);
  if (!league) throw new StorageError("La liga solicitada no existe. Puede haber sido eliminada del navegador.");
  if ((league.schemaVersion ?? 1) > APP_SCHEMA_VERSION) {
    throw new StorageError(`Esta liga usa el esquema v${league.schemaVersion}, más reciente que la aplicación (v${APP_SCHEMA_VERSION}). Actualiza DUELA; no se modificará ni reiniciará la partida.`);
  }
  const teamsTx = db.transaction(["teams"], "readonly");
  const teams = (await requestToPromise(teamsTx.objectStore("teams").index("leagueId").getAll(id))) as Team[];
  await transactionDone(teamsTx);
  const playersTx = db.transaction(["players"], "readonly");
  const players = (await requestToPromise(playersTx.objectStore("players").index("leagueId").getAll(id))) as Player[];
  await transactionDone(playersTx);
  const gamesTx = db.transaction(["games"], "readonly");
  const games = (await requestToPromise(gamesTx.objectStore("games").index("leagueId").getAll(id))) as Game[];
  await transactionDone(gamesTx);
  const teamIds = new Set(teams.map((team) => team.id));
  if (teams.length !== 30) throw new StorageError(`Liga incompleta: se esperaban 30 equipos y se recuperaron ${teams.length}.`);
  const validPlayers = players.filter((player) => teamIds.has(player.teamId));
  if (validPlayers.length < teams.length * 8) throw new StorageError("Liga incompleta: faltan jugadores o hay referencias rotas.");
  const validGames = games.filter((game) => teamIds.has(game.homeTeamId) && teamIds.has(game.awayTeamId));
  return {
    league: normalizeLeague(league),
    teams: teams.sort((a, b) => a.city.localeCompare(b.city)),
    players: validPlayers.sort((a, b) => b.ovr - a.ovr),
    games: validGames.sort((a, b) => a.round - b.round || a.id.localeCompare(b.id)),
  };
}

export async function saveLeagueMeta(league: League): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(["leagues"], "readwrite");
  try {
    transaction.objectStore("leagues").put({ ...normalizeLeague(league), updatedAt: Date.now() });
    await transactionDone(transaction);
  } catch (error) {
    throw new StorageError("No se pudieron guardar los ajustes de la liga.", error);
  }
}

export async function saveTeams(teams: Team[]): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(["teams"], "readwrite");
  try {
    for (const team of teams) transaction.objectStore("teams").put(team);
    await transactionDone(transaction);
  } catch (error) {
    throw new StorageError("No se pudo guardar la rotación del equipo.", error);
  }
}

export async function saveGames(games: Game[], league: League): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(["games", "leagues"], "readwrite");
  try {
    for (const game of games) transaction.objectStore("games").put(game);
    transaction.objectStore("leagues").put({ ...normalizeLeague(league), updatedAt: Date.now(), schemaVersion: APP_SCHEMA_VERSION });
    await transactionDone(transaction);
  } catch (error) {
    throw new StorageError("El partido se simuló, pero no se pudo escribir el resultado en IndexedDB.", error);
  }
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(["settings"], "readwrite");
  try {
    transaction.objectStore("settings").put({ key: SETTINGS_KEY, ...settings });
    await transactionDone(transaction);
  } catch (error) {
    throw new StorageError("No se pudieron guardar las preferencias de la aplicación.", error);
  }
}

export async function loadAppSettings(): Promise<AppSettings> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(["settings"], "readonly");
    const record = (await requestToPromise(transaction.objectStore("settings").get(SETTINGS_KEY))) as
      | (AppSettings & { key: string })
      | undefined;
    await transactionDone(transaction);
    return {
      theme: record?.theme && THEMES.includes(record.theme) ? record.theme : "tinta",
      lastOpenedLeagueId: record?.lastOpenedLeagueId,
    };
  } catch {
    return { theme: "tinta" };
  }
}

export async function getStorageReport(): Promise<{ usage: number; quota: number; persisted: boolean }> {
  if (typeof navigator === "undefined" || !navigator.storage) return { usage: 0, quota: 0, persisted: false };
  const estimate = await navigator.storage.estimate();
  const persisted = typeof navigator.storage.persisted === "function" ? await navigator.storage.persisted() : false;
  return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0, persisted };
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
