import type { Attributes, Player, Position } from "@/types";
import { clamp, createRng, gaussian, type RNG } from "./random";

export const POSITIONS: Position[] = ["PG", "SG", "SF", "PF", "C"];

export const POSITION_LABEL: Record<Position, string> = {
  PG: "Base",
  SG: "Escolta",
  SF: "Alero",
  PF: "Ala-pívot",
  C: "Pívot",
};

export const ATTRIBUTE_GROUPS: { label: string; keys: (keyof Attributes)[] }[] = [
  { label: "Físico", keys: ["strength", "speed", "jumping", "endurance"] },
  { label: "Anotación", keys: ["inside", "layups", "freeThrows", "midRange", "threePointers"] },
  { label: "Lectura y habilidad", keys: ["offensiveIQ", "defensiveIQ", "dribbling", "passing", "rebounding"] },
  { label: "Defensa", keys: ["perimeterDefense", "interiorDefense"] },
];

export const ATTRIBUTE_LABEL: Record<keyof Attributes, string> = {
  strength: "Fuerza",
  speed: "Velocidad",
  jumping: "Salto",
  endurance: "Resistencia",
  inside: "Juego interior",
  layups: "Finalización",
  freeThrows: "Tiros libres",
  midRange: "Media distancia",
  threePointers: "Triple",
  offensiveIQ: "IQ ofensivo",
  defensiveIQ: "IQ defensivo",
  dribbling: "Manejo",
  passing: "Pase",
  rebounding: "Rebote",
  perimeterDefense: "Defensa exterior",
  interiorDefense: "Defensa interior",
};

export const ATTRIBUTE_KEYS = Object.keys(ATTRIBUTE_LABEL) as (keyof Attributes)[];

const OVR_WEIGHTS: Record<Position, Attributes> = {
  PG: { strength: 2, speed: 6, jumping: 2, endurance: 4, inside: 4, layups: 9, freeThrows: 5, midRange: 8, threePointers: 9, offensiveIQ: 12, defensiveIQ: 5, dribbling: 12, passing: 13, rebounding: 1, perimeterDefense: 6, interiorDefense: 2 },
  SG: { strength: 3, speed: 6, jumping: 5, endurance: 4, inside: 6, layups: 9, freeThrows: 6, midRange: 11, threePointers: 12, offensiveIQ: 9, defensiveIQ: 5, dribbling: 8, passing: 5, rebounding: 3, perimeterDefense: 8, interiorDefense: 0 },
  SF: { strength: 5, speed: 6, jumping: 5, endurance: 4, inside: 8, layups: 9, freeThrows: 5, midRange: 9, threePointers: 10, offensiveIQ: 8, defensiveIQ: 6, dribbling: 6, passing: 5, rebounding: 6, perimeterDefense: 6, interiorDefense: 2 },
  PF: { strength: 9, speed: 4, jumping: 5, endurance: 4, inside: 11, layups: 8, freeThrows: 4, midRange: 7, threePointers: 7, offensiveIQ: 7, defensiveIQ: 7, dribbling: 4, passing: 4, rebounding: 11, perimeterDefense: 4, interiorDefense: 4 },
  C: { strength: 12, speed: 3, jumping: 5, endurance: 5, inside: 15, layups: 9, freeThrows: 4, midRange: 4, threePointers: 3, offensiveIQ: 6, defensiveIQ: 8, dribbling: 2, passing: 3, rebounding: 13, perimeterDefense: 2, interiorDefense: 6 },
};

const ARCHETYPES = {
  "Base creador": { offense: ["passing", "dribbling", "offensiveIQ"], defense: [], big: false },
  "Escolta anotador": { offense: ["threePointers", "midRange", "layups"], defense: [], big: false },
  "Especialista defensivo": { offense: [], defense: ["perimeterDefense", "defensiveIQ", "strength"], big: false },
  "Tirador de élite": { offense: ["threePointers", "freeThrows", "midRange"], defense: [], big: false },
  "Alero todoterreno": { offense: ["inside", "midRange", "passing"], defense: ["perimeterDefense"], big: false },
  "Atleta explosivo": { offense: ["layups", "inside"], defense: ["jumping", "speed"], big: false },
  "Pívot dominante": { offense: ["inside", "rebounding", "strength"], defense: ["interiorDefense"], big: true },
  "Pívot moderno": { offense: ["threePointers", "midRange", "passing"], defense: ["interiorDefense"], big: true },
  "Reboteador de área": { offense: ["rebounding", "inside"], defense: ["interiorDefense", "strength"], big: true },
  "Organizador secundario": { offense: ["passing", "offensiveIQ", "dribbling"], defense: [], big: false },
} as const;

export type Archetype = keyof typeof ARCHETYPES;

export const ARCHETYPE_LIST = Object.keys(ARCHETYPES) as Archetype[];

const POSITION_BASE: Record<Position, Partial<Record<keyof Attributes, number>>> = {
  PG: { strength: 48, speed: 79, jumping: 62, endurance: 68, inside: 51, layups: 71, freeThrows: 76, midRange: 68, threePointers: 68, offensiveIQ: 75, defensiveIQ: 62, dribbling: 82, passing: 81, rebounding: 38, perimeterDefense: 63, interiorDefense: 32 },
  SG: { strength: 54, speed: 75, jumping: 69, endurance: 66, inside: 55, layups: 70, freeThrows: 75, midRange: 70, threePointers: 71, offensiveIQ: 69, defensiveIQ: 61, dribbling: 71, passing: 61, rebounding: 44, perimeterDefense: 65, interiorDefense: 35 },
  SF: { strength: 62, speed: 69, jumping: 67, endurance: 67, inside: 61, layups: 68, freeThrows: 71, midRange: 65, threePointers: 65, offensiveIQ: 66, defensiveIQ: 64, dribbling: 61, passing: 59, rebounding: 56, perimeterDefense: 65, interiorDefense: 45 },
  PF: { strength: 72, speed: 58, jumping: 65, endurance: 65, inside: 72, layups: 68, freeThrows: 66, midRange: 57, threePointers: 54, offensiveIQ: 60, defensiveIQ: 64, dribbling: 45, passing: 48, rebounding: 73, perimeterDefense: 53, interiorDefense: 63 },
  C: { strength: 82, speed: 45, jumping: 57, endurance: 63, inside: 82, layups: 72, freeThrows: 58, midRange: 46, threePointers: 33, offensiveIQ: 58, defensiveIQ: 66, dribbling: 29, passing: 40, rebounding: 84, perimeterDefense: 33, interiorDefense: 78 },
};

const ARCHETYPE_BOOSTS: Partial<Record<keyof Attributes, number>> = {
  passing: 12, dribbling: 11, offensiveIQ: 9, threePointers: 14, midRange: 10,
  layups: 10, freeThrows: 9, perimeterDefense: 12, defensiveIQ: 10, strength: 7,
  inside: 9, rebounding: 8, interiorDefense: 13, speed: 7, jumping: 7,
};

export function calculateOvr(attributes: Attributes, position: Position): number {
  const weights = OVR_WEIGHTS[position];
  let total = 0;
  let weightTotal = 0;
  for (const key of ATTRIBUTE_KEYS) {
    const w = weights[key];
    total += attributes[key] * w;
    weightTotal += w;
  }
  return clamp(total / weightTotal);
}

export function createAttributes(
  rng: RNG,
  position: Position,
  targetOvr: number,
  archetype: Archetype,
): Attributes {
  const base = POSITION_BASE[position];
  const shift = (targetOvr - 61) * 0.92;
  const result = {} as Attributes;
  for (const key of ATTRIBUTE_KEYS) {
    result[key] = clamp((base[key] ?? 55) + shift + gaussian(rng, 0, 5.5));
  }
  const profile = ARCHETYPES[archetype];
  for (const key of profile.offense) {
    result[key as keyof Attributes] = clamp(result[key as keyof Attributes] + ARCHETYPE_BOOSTS[key as keyof Attributes]! + gaussian(rng, 0, 2.5));
  }
  for (const key of profile.defense) {
    result[key as keyof Attributes] = clamp(result[key as keyof Attributes] + ARCHETYPE_BOOSTS[key as keyof Attributes]! + gaussian(rng, 0, 2.5));
  }
  // Weaknesses are necessary: a specialist is not automatically good at everything.
  const weaknessKeys = ARCHETYPE_LIST.length ? ATTRIBUTE_KEYS.filter((key) => !profile.offense.includes(key as never) && !profile.defense.includes(key as never)) : [];
  for (const key of weaknessKeys) {
    if (rng() < 0.3) result[key] = clamp(result[key] - (5 + Math.floor(rng() * 9)));
  }
  const current = calculateOvr(result, position);
  const correction = targetOvr - current;
  for (const key of ATTRIBUTE_KEYS) result[key] = clamp(result[key] + correction);
  return result;
}

export function calculatePot(ovr: number, age: number, rng: RNG): number {
  const youth = Math.max(0, 24 - age) * 1.25;
  const late = age >= 31 ? -(age - 30) * 0.6 : 0;
  const developmentNoise = gaussian(rng, 0, 2.2);
  return clamp(Math.max(ovr, ovr + youth + developmentNoise + (rng() < 0.12 ? late : 0)));
}

export function ovrTier(ovr: number): string {
  if (ovr >= 90) return "Franquicia";
  if (ovr >= 85) return "All-NBA";
  if (ovr >= 79) return "Titular";
  if (ovr >= 72) return "Rotación";
  return "Desarrollo";
}

export function attributesFromReal(
  name: string,
  position: Position,
  targetOvr: number,
  profile: string | undefined,
  seed: string,
): { attributes: Attributes; archetype: Archetype } {
  const map: Record<string, Archetype> = {
    scorer: position === "C" || position === "PF" ? "Pívot dominante" : "Escolta anotador",
    shooter: position === "C" ? "Pívot moderno" : "Tirador de élite",
    playmaker: "Base creador",
    defender: position === "C" || position === "PF" ? "Reboteador de área" : "Especialista defensivo",
    big: position === "C" ? "Pívot dominante" : "Reboteador de área",
    wing: "Alero todoterreno",
    athlete: "Atleta explosivo",
    allround: position === "PG" ? "Organizador secundario" : "Alero todoterreno",
  };
  const archetype = map[profile ?? "allround"] ?? "Alero todoterreno";
  const rng = createRng(`${name}-${seed}-ratings`);
  return { attributes: createAttributes(rng, position, targetOvr, archetype), archetype };
}

export function overallOfRoster(players: Player[]): number {
  if (!players.length) return 0;
  const top = [...players].sort((a, b) => b.ovr - a.ovr).slice(0, 8);
  return Math.round(top.reduce((sum, player) => sum + player.ovr, 0) / top.length);
}

export function tierToTarget(tier: number): number {
  return [0, 92, 86, 80, 73, 66][tier] ?? 66;
}
