import { FRANCHISES } from "@/data/franchises";
import { NAME_CULTURES, type NameCulture } from "@/data/names";
import { REAL_ROSTERS_2026, REAL_ROSTERS_2026_FLAT, REAL_ROSTER_CUTOFF } from "@/data/realRosters2026";

export { REAL_ROSTER_CUTOFF, REAL_ROSTER_SOURCE, REAL_ROSTER_STATS } from "@/data/realRosters2026";
import type {
  Attributes,
  Conference,
  League,
  LeagueBundle,
  LeagueMode,
  PlayMode,
  Player,
  Position,
  Team,
  ThemeKey,
} from "@/types";
import {
  ARCHETYPE_LIST,
  POSITIONS,
  attributesFromReal,
  calculateOvr,
  calculatePot,
  createAttributes,
  ovrTier,
  type Archetype,
} from "./ratings";
import { chance, clamp, createRng, gaussian, hashSeed, pick, shuffle, slugify, weightedIndex, type RNG } from "./random";
import { generateSchedule } from "./schedule";

const SLOT_PLAN: Position[] = ["PG", "PG", "PG", "SG", "SG", "SG", "SF", "SF", "PF", "PF", "C", "C"];
const POSITION_HEIGHT: Record<Position, [number, number]> = {
  PG: [71, 78], SG: [74, 79], SF: [77, 83], PF: [80, 86], C: [82, 89],
};
const POSITION_ARCHETYPES: Record<Position, Archetype[]> = {
  PG: ["Base creador", "Organizador secundario", "Tirador de élite", "Especialista defensivo", "Atleta explosivo"],
  SG: ["Escolta anotador", "Tirador de élite", "Atleta explosivo", "Especialista defensivo", "Alero todoterreno"],
  SF: ["Alero todoterreno", "Atleta explosivo", "Especialista defensivo", "Tirador de élite", "Escolta anotador"],
  PF: ["Pívot dominante", "Pívot moderno", "Reboteador de área", "Alero todoterreno", "Especialista defensivo"],
  C: ["Pívot dominante", "Pívot moderno", "Reboteador de área", "Especialista defensivo"],
};

const STYLE_BY_ARCHETYPE: Record<Archetype, string> = {
  "Base creador": "un base que vive con el balón, lee ayudas y genera ventajas para otros",
  "Escolta anotador": "un escolta de triple amenaza que ataca el cierre y castiga desde media distancia",
  "Especialista defensivo": "un defensor de contacto que cambia asignaciones y complica la primera línea",
  "Tirador de élite": "un especialista sin balón con un lanzamiento rápido y profundo",
  "Alero todoterreno": "un alero de dos direcciones que conecta acciones sin necesitar el balón",
  "Atleta explosivo": "un jugador de transición y segundo salto que presiona el aro",
  "Pívot dominante": "un interior de área que impone peso, rebote y finalización cerca del aro",
  "Pívot moderno": "un interior que abre la cancha, pasa desde el poste alto y protege el aro",
  "Reboteador de área": "un especialista de rebote y segundas oportunidades",
  "Organizador secundario": "un segundo creador que mueve el balón y ordena la segunda unidad",
};

export function makeLeagueId(mode: LeagueMode): string {
  const time = Date.now().toString(36);
  const random = Math.floor(Math.random() * 1_679_616).toString(36);
  return `${mode}-${time}-${random}`;
}

function makeTeamId(leagueId: string, franchiseId: string): string {
  return `${leagueId}::team-${franchiseId}`;
}

function chooseCulture(rng: RNG): NameCulture {
  const index = weightedIndex(rng, NAME_CULTURES.map((culture) => culture.weight));
  return NAME_CULTURES[index];
}

function safeName(rng: RNG, usedNames: Set<string>): { first: string; last: string; culture: NameCulture } {
  for (let attempt = 0; attempt < 30; attempt++) {
    const culture = chooseCulture(rng);
    const first = pick(rng, culture.first);
    const last = pick(rng, culture.last);
    const full = `${first} ${last}`;
    if (!usedNames.has(full)) {
      usedNames.add(full);
      return { first, last, culture };
    }
  }
  const culture = NAME_CULTURES[0];
  const first = pick(rng, culture.first);
  const last = `${pick(rng, culture.last)}-${Math.floor(rng() * 90 + 10)}`;
  usedNames.add(`${first} ${last}`);
  return { first, last, culture };
}

function physicals(rng: RNG, position: Position): { heightIn: number; weightLb: number; wingspanIn: number } {
  const [min, max] = POSITION_HEIGHT[position];
  const heightIn = Math.round(min + rng() * (max - min));
  const frame = gaussian(rng, 0, 14);
  const baseWeight = 172 + (heightIn - 72) * 7.2;
  const weightLb = Math.round(clamp(baseWeight + frame, 160, 305));
  const wingspanIn = heightIn + clamp(Math.round(gaussian(rng, 2.6, 1.8)), 0, 7);
  return { heightIn, weightLb, wingspanIn };
}

function makeBio(
  rng: RNG,
  name: string,
  culture: NameCulture,
  archetype: Archetype,
  team: Team,
  age: number,
  position: Position,
  pathway: string,
): string {
  const city = pick(rng, culture.cities);
  const style = STYLE_BY_ARCHETYPE[archetype];
  const arrival = age <= 21
    ? `Llegó a ${team.city} como proyecto de desarrollo y pelea por minutos desde la segunda unidad.`
    : age >= 31
      ? `Aterrizó en ${team.city} como veterano de rotación, aportando oficio y estabilidad al vestuario.`
      : `Se consolidó en ${team.city} tras varias temporadas de crecimiento en la liga.`;
  const formative = chance(rng, 0.4)
    ? `Completó su etapa formativa en ${pathway} antes de dar el salto profesional.`
    : `Se formó entre ${pathway} y el circuito juvenil de ${pick(rng, culture.cities)}.`;
  return `${name} nació en ${city}, ${culture.nationality}. ${formative} En la cancha es ${style}. Juega de ${position === "PG" ? "base" : position === "SG" ? "escolta" : position === "SF" ? "alero" : position === "PF" ? "ala-pívot" : "pívot"} y construyó su identidad a partir de ${archetype.toLowerCase()}. ${arrival}`;
}

function makeFictionalHistory(rng: RNG, franchiseName: string, realHistory: string, city: string): string {
  const titles = weightedIndex(rng, [34, 26, 18, 12, 7, 3]);
  const eras = ["una final perdida en los noventa", "una reconstrucción tras el cambio de siglo", "una era dorada reciente", "un proyecto de cantera que llegó lejos", "una rivalidad regional que marcó época"];
  const year = 1970 + Math.floor(rng() * 55);
  return `${realHistory} En esta realidad alternativa, ${franchiseName} es una franquicia ${titles >= 3 ? "histórica" : titles >= 1 ? "competitiva" : "en construcción"} de ${city}. Acumula ${titles} ${titles === 1 ? "título" : "títulos"} ficticios de liga${titles ? `, uno de ellos en ${year}` : ""}, y su identidad deportiva nace de ${pick(rng, eras)}.`;
}

function assignUniqueJerseys(rng: RNG): number[] {
  const numbers = shuffle(rng, Array.from({ length: 60 }, (_, index) => index));
  return numbers.slice(0, 12);
}

function makeFictionalRoster(leagueId: string, team: Team, rng: RNG, usedNames: Set<string>): Player[] {
  const slots = shuffle(rng, SLOT_PLAN);
  const teamCenter = clamp(gaussian(rng, 62.5, 4.1), 55, 70);
  const starIndex = weightedIndex(rng, [5, 9, 12, 12, 12, 12, 9, 7, 6, 5, 4, 3]);
  const jerseys = assignUniqueJerseys(rng);
  return slots.map((position, index) => {
    const isStar = index === starIndex || (index === starIndex + 1 && chance(rng, 0.35));
    const target = isStar
      ? clamp(gaussian(rng, 85.4, 4.4), 79, 94)
      : clamp(gaussian(rng, teamCenter, 6.8), 43, 81);
    const archetype = POSITION_ARCHETYPES[position][weightedIndex(rng, [30, 23, 18, 15, 14])] ?? pick(rng, ARCHETYPE_LIST);
    const attributes: Attributes = createAttributes(rng, position, target, archetype);
    const ovr = calculateOvr(attributes, position);
    const age = chance(rng, 0.58)
      ? Math.floor(19 + rng() * 5)
      : Math.floor(24 + rng() * 13);
    const pot = calculatePot(ovr, age, rng);
    const { first, last, culture } = safeName(rng, usedNames);
    const name = `${first} ${last}`;
    const body = physicals(rng, position);
    const role = ovrTier(ovr);
    const pathway = pick(rng, culture.pathways);
    const id = `${team.id}::player-${String(index + 1).padStart(2, "0")}`;
    return {
      id,
      leagueId,
      teamId: team.id,
      name,
      firstName: first,
      lastName: last,
      position,
      age,
      heightIn: body.heightIn,
      weightLb: body.weightLb,
      wingspanIn: body.wingspanIn,
      jersey: jerseys[index],
      nationality: culture.nationality,
      college: pathway,
      role,
      archetype,
      attributes,
      ovr,
      pot,
      bio: makeBio(rng, name, culture, archetype, team, age, position, pathway),
      real: false,
      dataStatus: "verified",
    } satisfies Player;
  });
}

const ELITE_TARGETS: Record<string, number> = {
  "Nikola Jokic": 95,
  "Shai Gilgeous-Alexander": 94,
  "Luka Doncic": 93,
  "Giannis Antetokounmpo": 93,
  "Victor Wembanyama": 92,
  "Jayson Tatum": 91,
  "Anthony Edwards": 90,
  "Joel Embiid": 89,
  "Stephen Curry": 89,
  "Cooper Flagg": 88,
  "LeBron James": 88,
  "Donovan Mitchell": 88,
  "Jalen Brunson": 88,
  "Karl-Anthony Towns": 87,
  "Paolo Banchero": 87,
  "Evan Mobley": 87,
  "Cade Cunningham": 88,
  "Tyrese Haliburton": 87,
  "Devin Booker": 87,
  "Kawhi Leonard": 87,
  "Anthony Davis": 87,
  "Trae Young": 87,
  "Domantas Sabonis": 86,
  "Jalen Green": 84,
};

function makeRealRoster(leagueId: string, team: Team, franchiseId: string): Player[] {
  const seeds = REAL_ROSTERS_2026[franchiseId] ?? [];
  return seeds.map((seed) => {
    // Los targets 85+ son excepcionales; el 90+ se reserva a muy pocas estrellas.
    const elite = ELITE_TARGETS[seed.name];
    const baseTarget = [0, 88, 82, 77, 71, 65][seed.tier] ?? 65;
    const target = clamp(
      elite ?? baseTarget + (hashSeed(`${seed.name}-${franchiseId}`) % 3) - 1,
      48,
      96,
    );
    const { attributes, archetype } = attributesFromReal(seed.name, seed.pos, target, seed.profile, leagueId);
    const ovr = calculateOvr(attributes, seed.pos);
    const rng = createRng(`${seed.name}-${franchiseId}-bio`);
    const parts = seed.name.split(" ");
    const first = parts[0];
    const last = parts.slice(1).join(" ") || parts[0];
    const contract = seed.contractType === "two-way" ? "two-way" : seed.contractType === "standard" ? "estándar (inferido del listado)" : "pendiente";
    const national = seed.nationality.startsWith("No ") ? "nacionalidad no verificada" : seed.nationality;
    const formation = seed.college.startsWith("No ") ? "formación no verificada en esta fuente" : seed.college;
    return {
      id: `${team.id}::real-${slugify(seed.name)}`,
      leagueId,
      teamId: team.id,
      name: seed.name,
      firstName: first,
      lastName: last,
      position: seed.pos,
      age: seed.age,
      heightIn: seed.height,
      weightLb: seed.weight,
      wingspanIn: seed.height + clamp(2 + Math.round(gaussian(rng, 0, 1.4)), 0, 6),
      jersey: seed.jersey ?? 0,
      jerseyPending: seed.jerseyPending ?? false,
      weightPending: seed.weightPending ?? false,
      howAcquired: seed.howAcquired,
      nbaPlayerId: seed.nbaPlayerId,
      nationality: seed.nationality,
      college: seed.college,
      role: ovrTier(ovr),
      archetype,
      attributes,
      ovr,
      pot: calculatePot(ovr, seed.age, rng),
      bio: `Ficha real 2026-27 de ${team.city} ${team.name}, plantilla oficial NBA.com consultada el ${REAL_ROSTER_CUTOFF}. Dorsal: ${seed.jerseyPending ? "pendiente" : `#${seed.jersey}`}. Posición publicada: ${seed.listedPosition ?? "no disponible"}. Experiencia: ${seed.experience ?? "no verificada"} años. Contrato: ${contract}. Adquisición: ${seed.howAcquired ?? "no verificada"}. ${national}; ${formation}. Los atributos, OVR y POT son una evaluación interna del simulador, no estadísticas oficiales. No se muestran salarios, lesiones ni estadísticas reales no verificadas.`,
      real: true,
      dataStatus: "partial",
      ageEstimated: false,
      contractType: seed.contractType ?? "unknown",
      experience: seed.experience,
      listedPosition: seed.listedPosition,
    } satisfies Player;
  });
}

export function createFictionalUniverse(
  seed: string,
  options: { leagueId?: string; name?: string; playMode?: PlayMode; theme?: ThemeKey; userTeamId?: string; persistable?: boolean } = {},
): LeagueBundle {
  const leagueId = options.leagueId ?? `fic-demo-${slugify(seed) || "universo"}-${hashSeed(seed).toString(36)}`;
  const league: League = {
    id: leagueId,
    name: options.name ?? `Universo ${seed}`,
    mode: "fictional",
    playMode: options.playMode ?? "manager",
    seed,
    season: "2026-27",
    userTeamId: options.userTeamId ?? "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    schemaVersion: 1,
    theme: options.theme ?? "tinta",
    phase: 1,
    fictionalUniverse: seed,
  };
  const rng = createRng(`fic-${seed}`);
  // Los nombres ficticios nunca pueden coincidir con una ficha real del simulador.
  const usedNames = new Set<string>(REAL_ROSTERS_2026_FLAT.map((player) => player.name));
  const teams: Team[] = FRANCHISES.map((franchise) => ({
    id: makeTeamId(leagueId, franchise.id),
    leagueId,
    franchiseId: franchise.id,
    city: franchise.city,
    name: franchise.name,
    abbreviation: franchise.abbreviation,
    conference: franchise.conference as Conference,
    division: franchise.division,
    founded: franchise.founded,
    arena: franchise.arena,
    championships: franchise.championships,
    history: franchise.history,
    fictionalHistory: makeFictionalHistory(rng, `${franchise.city} ${franchise.name}`, franchise.history, franchise.city),
    aiControlled: (options.playMode ?? "manager") === "spectator",
    philosophy: "Equilibrado",
  }));
  const players = teams.flatMap((team) => makeFictionalRoster(leagueId, team, rng, usedNames));
  if (options.userTeamId) {
    const target = teams.find((team) => team.franchiseId === options.userTeamId || team.id === options.userTeamId);
    league.userTeamId = target?.id ?? teams[0].id;
    for (const team of teams) team.aiControlled = league.playMode === "spectator" || team.id !== league.userTeamId;
  }
  return { league, teams, players, games: [] };
}

export function createRealUniverse(
  options: { leagueId?: string; name?: string; playMode?: PlayMode; theme?: ThemeKey; userTeamId?: string } = {},
): LeagueBundle {
  const leagueId = options.leagueId ?? `real-demo-${Date.now().toString(36)}`;
  const league: League = {
    id: leagueId,
    name: options.name ?? "NBA Real · Temporada 2026-27",
    mode: "real",
    playMode: options.playMode ?? "manager",
    seed: "nba-real-cutoff-2026-10-28",
    season: "2026-27",
    userTeamId: options.userTeamId ?? "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    schemaVersion: 1,
    theme: options.theme ?? "tinta",
    phase: 1,
  };
  const teams: Team[] = FRANCHISES.map((franchise) => ({
    id: makeTeamId(leagueId, franchise.id),
    leagueId,
    franchiseId: franchise.id,
    city: franchise.city,
    name: franchise.name,
    abbreviation: franchise.abbreviation,
    conference: franchise.conference as Conference,
    division: franchise.division,
    founded: franchise.founded,
    arena: franchise.arena,
    championships: franchise.championships,
    history: franchise.history,
    aiControlled: (options.playMode ?? "manager") === "spectator",
    philosophy: "Equilibrado",
  }));
  const players = teams.flatMap((team) => makeRealRoster(leagueId, team, team.franchiseId));
  if (options.userTeamId) {
    const target = teams.find((team) => team.franchiseId === options.userTeamId || team.id === options.userTeamId);
    league.userTeamId = target?.id ?? teams[0].id;
    for (const team of teams) team.aiControlled = league.playMode === "spectator" || team.id !== league.userTeamId;
  }
  return { league, teams, players, games: [] };
}

export function validateLeagueBundle(bundle: LeagueBundle): void {
  const teamIds = new Set(bundle.teams.map((team) => team.id));
  const playerIds = new Set<string>();
  if (bundle.teams.length !== 30) throw new Error(`La liga debe contener 30 franquicias (recibidas: ${bundle.teams.length}).`);
  if (teamIds.size !== bundle.teams.length) throw new Error("Hay identificadores de equipo duplicados.");
  if (!teamIds.has(bundle.league.userTeamId)) throw new Error("El equipo del usuario no existe en la liga.");
  for (const team of bundle.teams) {
    const roster = bundle.players.filter((player) => player.teamId === team.id);
    const fictional = bundle.league.mode === "fictional";
    const min = fictional ? 10 : 15;
    const max = fictional ? 15 : 18;
    if (roster.length < min || roster.length > max) {
      throw new Error(`Plantilla inválida en ${team.city} ${team.name}: ${roster.length} jugadores (rango ${min}–${max}).`);
    }
    if (!fictional) {
      const twoWay = roster.filter((player) => player.contractType === "two-way").length;
      const standard = roster.filter((player) => player.contractType !== "two-way").length;
      if (twoWay > 3) throw new Error(`${team.abbreviation} supera el límite de 3 contratos two-way (${twoWay}).`);
      if (standard > 15) throw new Error(`${team.abbreviation} supera el límite de 15 contratos estándar (${standard}).`);
    }
    for (const player of roster) {
      if (playerIds.has(player.id)) throw new Error(`ID de jugador duplicado: ${player.id}`);
      playerIds.add(player.id);
      if (player.teamId !== team.id) throw new Error(`Referencia rota en la ficha de ${player.name}.`);
      const invalid = Object.values(player.attributes).some((value) => !Number.isFinite(value) || value < 0 || value > 100);
      if (invalid) throw new Error(`Atributo fuera de escala en ${player.name}.`);
    }
  }
  if (playerIds.size !== bundle.players.length) throw new Error("La liga contiene jugadores con referencias inconsistentes.");
  for (const game of bundle.games) {
    if (!teamIds.has(game.homeTeamId) || !teamIds.has(game.awayTeamId) || game.homeTeamId === game.awayTeamId) {
      throw new Error(`Partido con referencias inválidas: ${game.id}`);
    }
  }
}

export function createLeagueBundle(options: {
  name: string;
  mode: LeagueMode;
  playMode: PlayMode;
  theme: ThemeKey;
  userTeamId: string;
  seed: string;
}): LeagueBundle {
  const leagueId = makeLeagueId(options.mode);
  const base = options.mode === "fictional"
    ? createFictionalUniverse(options.seed || "universo-1", {
        leagueId, name: options.name, playMode: options.playMode, theme: options.theme, userTeamId: options.userTeamId,
      })
    : createRealUniverse({
        leagueId, name: options.name, playMode: options.playMode, theme: options.theme, userTeamId: options.userTeamId,
      });
  base.teams = base.teams.map((team) => ({
    ...team,
    rotation: team.id === base.league.userTeamId
      ? [...base.players.filter((player) => player.teamId === team.id)].sort((a, b) => b.ovr - a.ovr).slice(0, 10).map((player) => player.id)
      : undefined,
  }));
  base.games = generateSchedule(leagueId, base.teams, options.seed || "calendario-2026");
  validateLeagueBundle(base);
  return base;
}

export function randomSeed(): string {
  const adjectives = ["NOCTURNO", "CROMO", "ÁMBAR", "SAL", "HIELO", "TITANIO", "MERCURIO", "CENIZA"];
  const nouns = ["BALÓN", "CANCHA", "DUELA", "ARO", "PIZARRA", "VESTUARIO"];
  return `${pick(Math.random, adjectives)}-${pick(Math.random, nouns)}-${Math.floor(Math.random() * 900 + 100)}`;
}

export { POSITIONS };
