import type { Game, Player } from "../src/types";
import { createLeagueBundle } from "../src/game/generate";
import { simulateGame, simulateGameQuick } from "../src/game/simulate";

/**
 * Causalidad controlada: mismo equipo, mismos rivales y las mismas semillas
 * emparejadas. Solo cambia un atributo del equipo objetivo entre la muestra A
 * (base) y la muestra B (atributo +25, altura +4"). Se comparan métricas
 * agregadas y la diferencia emparejada por partido con IC 95%.
 */

const PAIRS = Number(process.env.PAIRS ?? 400);
const bundle = createLeagueBundle({ name: "Causalidad", mode: "fictional", playMode: "manager", theme: "tinta", userTeamId: "nyk", seed: "PHASE2-CAUSALITY" });
const target = bundle.teams.find((team) => team.id === bundle.league.userTeamId)!;
const opponent = bundle.teams.find((team) => team.id !== target.id && team.abbreviation !== target.abbreviation)!;
const baseRoster = bundle.players.filter((player) => player.teamId === target.id);
const opponentRoster = bundle.players.filter((player) => player.teamId === opponent.id);
const schedule = bundle.games.filter((game) => game.id.includes("game-")).slice(0, Math.max(20, PAIRS));
const scheduleSource = bundle.games.filter((game) => game.homeTeamId === target.id || game.awayTeamId === target.id);
const rotationIds = new Set(target.rotation ?? []);
const rotationRoster = [...baseRoster].filter((player) => rotationIds.size === 0 || rotationIds.has(player.id));
const starters = rotationRoster.slice(0, 5);
// Titular con menor capacidad de finalización: hay margen real de mejora y
// mantiene un uso ofensivo suficiente para medir acciones cerca del aro.
const focusPlayer = [...starters].sort((a, b) => a.attributes.layups - b.attributes.layups)[0] ?? rotationRoster[0] ?? baseRoster[0];
console.log(`Jugador de control para acciones cercanas: ${focusPlayer.name} (${focusPlayer.position}) · layups base ${focusPlayer.attributes.layups}`);

interface Sample { points: number; oppPoints: number; poss: number; fga: number; fgm: number; tpa: number; tpm: number; fta: number; ftm: number; ast: number; tov: number; blk: number; stl: number; reb: number; oppReb: number; orb: number; paintFga: number; paintFgm: number; oppPaintFga: number; oppPaintFgm: number; focusPaintFga: number; focusPaintFgm: number; fastBreak: number; q1: number; q4: number; oppQ4: number; oppOrtg: number; }

function mutate(mutation: (player: Player) => void): Player[] {
  return structuredClone(baseRoster).map((player) => { mutation(player); return player; });
}

function metric(sample: Sample, key: string): number {
  switch (key) {
    case "3pPct": return sample.tpa ? (sample.tpm / sample.tpa) * 100 : 0;
    case "threeRate": return sample.fga ? (sample.tpa / sample.fga) * 100 : 0;
    case "ftPct": return sample.fta ? (sample.ftm / sample.fta) * 100 : 0;
    case "paintPct": return sample.paintFga ? (sample.paintFgm / sample.paintFga) * 100 : 0;
    case "astPerFgm": return sample.fgm ? (sample.ast / sample.fgm) * 100 : 0;
    case "tovRate": return sample.poss ? (sample.tov / sample.poss) * 100 : 0;
    case "ortg": return sample.poss ? (sample.points / sample.poss) * 100 : 0;
    case "efg": return sample.fga ? ((sample.fgm + 0.5 * sample.tpm) / sample.fga) * 100 : 0;
    case "oppOrtg": return sample.oppOrtg;
    case "rebShare": return sample.reb + sample.oppReb ? (sample.reb / (sample.reb + sample.oppReb)) * 100 : 0;
    case "blocks": return sample.blk;
    case "steals": return sample.stl;
    case "fastBreak": return sample.fastBreak;
    case "q4": return sample.q4;
    case "q4Margin": return sample.q4 - sample.oppQ4;
    case "focusPaintPct": return sample.focusPaintFga ? (sample.focusPaintFgm / sample.focusPaintFga) * 100 : 0;
    case "oppPaintPct": return sample.oppPaintFga ? (sample.oppPaintFgm / sample.oppPaintFga) * 100 : 0;
    case "q4Delta": return sample.q4 - sample.q1;
    case "ftRate": return sample.fga ? (sample.fta / sample.fga) * 100 : 0;
    case "poss": return sample.poss;
    case "points": return sample.points;
    default: return 0;
  }
}

function normalCdf(value: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(value));
  const d = 0.3989423 * Math.exp((-value * value) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return value > 0 ? 1 - p : p;
}

function pValue(z: number): number {
  return 2 * (1 - normalCdf(Math.abs(z)));
}

function summarize(label: string, valuesA: number[], valuesB: number[]) {
  const diffs = valuesA.map((value, index) => valuesB[index] - value);
  const mean = diffs.reduce((sum, value) => sum + value, 0) / diffs.length;
  const variance = diffs.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, diffs.length - 1);
  const se = Math.sqrt(variance / diffs.length);
  const z = se > 0 ? mean / se : 0;
  const p = pValue(z);
  const aggregateA = valuesA.reduce((sum, value) => sum + value, 0) / valuesA.length;
  const aggregateB = valuesB.reduce((sum, value) => sum + value, 0) / valuesB.length;
  console.log(`${label}: A ${aggregateA.toFixed(3)} → B ${aggregateB.toFixed(3)} · Δ ${mean.toFixed(3)} · IC95% [${(mean - 1.96 * se).toFixed(3)}, ${(mean + 1.96 * se).toFixed(3)}] · p≈${p < 0.001 ? "<0.001" : p.toFixed(3)}`);
  return { mean, se, p, aggregateA, aggregateB };
}

function run(roster: Player[], gameSeeds: number[], quick = false): Sample[] {
  const samples: Sample[] = [];
  for (const seed of gameSeeds) {
    const template = scheduleSource[(seed >>> 0) % scheduleSource.length];
    const game: Game = { ...template, seed, played: false, homeTeamId: target.id, awayTeamId: opponent.id, homeScore: undefined, awayScore: undefined, boxScore: undefined, playByPlay: undefined };
    const result = quick ? simulateGameQuick(game, target, opponent, roster, opponentRoster) : simulateGame(game, target, opponent, roster, opponentRoster);
    const box = result.boxScore!;
    const h = box.home;
    const a = box.away;
    const paint = { fga: (h.zones?.restricted.fga ?? 0) + (h.zones?.close.fga ?? 0), fgm: (h.zones?.restricted.fgm ?? 0) + (h.zones?.close.fgm ?? 0) };
    const focusLine = h.players.find((line) => line.playerId === focusPlayer.id);
    const focusPaint = { fga: (focusLine?.zones?.restricted.fga ?? 0) + (focusLine?.zones?.close.fga ?? 0), fgm: (focusLine?.zones?.restricted.fgm ?? 0) + (focusLine?.zones?.close.fgm ?? 0) };
    const oppPaint = { fga: (a.zones?.restricted.fga ?? 0) + (a.zones?.close.fga ?? 0), fgm: (a.zones?.restricted.fgm ?? 0) + (a.zones?.close.fgm ?? 0) };
    samples.push({
      points: h.points, oppPoints: a.points, poss: h.possessions ?? 0, fga: h.fga, fgm: h.fgm, tpa: h.tpa, tpm: h.tpm,
      fta: h.fta, ftm: h.ftm, ast: h.ast, tov: h.tov, blk: h.blk, stl: h.stl, reb: h.reb, oppReb: a.reb, orb: h.oreb,
      paintFga: paint.fga, paintFgm: paint.fgm, oppPaintFga: oppPaint.fga, oppPaintFgm: oppPaint.fgm, focusPaintFga: focusPaint.fga, focusPaintFgm: focusPaint.fgm, fastBreak: h.fastBreakPoints ?? 0,
      q1: h.quarters[0] ?? 0, q4: h.quarters[3] ?? 0, oppQ4: a.quarters[3] ?? 0, oppOrtg: a.possessions ? (a.points / a.possessions) * 100 : 0,
    });
  }
  return samples;
}

const seeds = Array.from({ length: PAIRS }, (_, index) => (hashSeedLocal(`causal-${index}`) + index * 104729) >>> 0);
function hashSeedLocal(text: string): number { let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

const base = run(baseRoster, seeds);
const scenario = (name: string, mutation: (player: Player) => void, checks: [string, (summary: ReturnType<typeof summarize>) => boolean][]) => {
  const variant = run(mutate(mutation), seeds);
  console.log(`\n== ${name} ==`);
  let passed = true;
  for (const [metricName, acceptance] of checks) {
    const summary = summarize(metricName, base.map((sample) => metric(sample, metricName)), variant.map((sample) => metric(sample, metricName)));
    if (!acceptance(summary)) passed = false;
  }
  return passed;
};

let passed = 0;
let total = 0;
// Exigimos efecto en la dirección esperada y un IC95% que excluya cero.
const positive = (threshold = 0) => (summary: ReturnType<typeof summarize>) => summary.mean > threshold && summary.mean - 1.96 * summary.se > 0;
const negative = (threshold = 0) => (summary: ReturnType<typeof summarize>) => summary.mean < threshold && summary.mean + 1.96 * summary.se < 0;
const effect = (name: string, mutation: (player: Player) => void, checks: [string, (summary: ReturnType<typeof summarize>) => boolean][]) => {
  total++;
  if (scenario(name, mutation, checks)) passed++;
};

effect("3 Pointers +25", (p) => { p.attributes.threePointers = Math.min(99, p.attributes.threePointers + 25); }, [["3pPct", positive(0.3)], ["threeRate", positive(0.3)]]);
effect("Free Throws +25", (p) => { p.attributes.freeThrows = Math.min(99, p.attributes.freeThrows + 25); }, [["ftPct", positive(0.3)]]);
// Layups se contrasta en un rango controlado del jugador de referencia (40 → 90),
// sin tocar el resto de atributos, para evitar un techo de acierto ya saturado.
const lowLayups = run(mutate((p) => { if (p.id === focusPlayer.id) p.attributes.layups = 40; }), seeds);
const highLayups = run(mutate((p) => { if (p.id === focusPlayer.id) p.attributes.layups = 90; }), seeds);
console.log("\n== Layups 40 vs 90 (jugador de control) ==");
total++;
const layupSummary = summarize("focusPaintPct", lowLayups.map((sample) => metric(sample, "focusPaintPct")), highLayups.map((sample) => metric(sample, "focusPaintPct")));
if (layupSummary.mean > 0.5 && layupSummary.mean - 1.96 * layupSummary.se > 0) passed++;
effect("Passing +25", (p) => { p.attributes.passing = Math.min(99, p.attributes.passing + 25); }, [["astPerFgm", positive(0.2)], ["tovRate", negative(-0.1)]]);
effect("Dribbling +25", (p) => { p.attributes.dribbling = Math.min(99, p.attributes.dribbling + 25); }, [["tovRate", negative(-0.2)]]);
effect("Offensive IQ +25", (p) => { p.attributes.offensiveIQ = Math.min(99, p.attributes.offensiveIQ + 25); }, [["ortg", positive(0.5)], ["efg", positive(0.2)]]);
effect("Defensive IQ +25", (p) => { p.attributes.defensiveIQ = Math.min(99, p.attributes.defensiveIQ + 25); }, [["oppOrtg", negative(-0.5)]]);
effect("Rebounding +25", (p) => { p.attributes.rebounding = Math.min(99, p.attributes.rebounding + 25); }, [["rebShare", positive(0.2)]]);
effect("Height +4 in", (p) => { p.heightIn += 4; }, [["rebShare", positive(0.1)], ["blocks", positive(0.05)]]);
effect("Jumping +25", (p) => { p.attributes.jumping = Math.min(99, p.attributes.jumping + 25); }, [["blocks", positive(0.1)], ["rebShare", positive(0.05)]]);
effect("Strength +25", (p) => { p.attributes.strength = Math.min(99, p.attributes.strength + 25); }, [["ftRate", positive(0.01)], ["rebShare", positive(0.05)]]);
effect("Speed +25", (p) => { p.attributes.speed = Math.min(99, p.attributes.speed + 25); }, [["fastBreak", positive(0.2)], ["poss", positive(0.05)]]);
// Endurance se contrasta entre un equipo de baja resistencia y otro de alta
// resistencia, manteniendo el resto de atributos idénticos. Desde Fase 3 la
// resistencia también modifica las decisiones de sustitución; por eso este
// escenario necesita 800 semillas para separar el efecto de la rotación.
const enduranceSeeds = Array.from({ length: Math.max(1600, PAIRS) }, (_, index) => (hashSeedLocal(`causal-endurance-${index}`) + index * 104729) >>> 0);
const lowerEndurance = run(mutate((p) => { p.attributes.endurance = Math.max(20, p.attributes.endurance - 25); }), enduranceSeeds);
const higherEndurance = run(mutate((p) => { p.attributes.endurance = Math.min(99, p.attributes.endurance + 25); }), enduranceSeeds);
console.log("\n== Endurance -25 vs +25 ==");
total++;
const enduranceSummary = summarize("q4Margin", lowerEndurance.map((sample) => metric(sample, "q4Margin")), higherEndurance.map((sample) => metric(sample, "q4Margin")));
if (enduranceSummary.mean > 0.2 && enduranceSummary.mean - 1.96 * enduranceSummary.se > 0) passed++;

console.log(`\nCAUSALIDAD: ${passed}/${total} escenarios con el efecto esperado`);
console.log("Cada escenario usa las mismas semillas emparejadas; la incertidumbre es la desviación de la diferencia por partido.");

// Equivalencia rápida vs play-by-play
const quickRoster = structuredClone(baseRoster);
const fullGame: Game = { ...scheduleSource[0], seed: 424242, played: false, homeTeamId: target.id, awayTeamId: opponent.id };
const quickGame = { ...fullGame };
const full = simulateGame(fullGame, target, opponent, quickRoster, opponentRoster);
const quick = simulateGameQuick(quickGame, target, opponent, quickRoster, opponentRoster);
const repeated = simulateGame({ ...fullGame }, target, opponent, quickRoster, opponentRoster);
const equivalence = JSON.stringify(full.boxScore) === JSON.stringify(quick.boxScore) && JSON.stringify(full.boxScore) === JSON.stringify(repeated.boxScore) && (quick.playByPlay?.length ?? 0) === 0 && (full.playByPlay?.length ?? 0) > 0;
console.log(`\nSIMULACIÓN RÁPIDA vs PLAY-BY-PLAY: ${equivalence ? "PASS" : "FAIL"} · misma caja rápida/detallada ${JSON.stringify(full.boxScore) === JSON.stringify(quick.boxScore)} · misma semilla reproducida ${JSON.stringify(full.boxScore) === JSON.stringify(repeated.boxScore)} · eventos detallados ${full.playByPlay?.length ?? 0} · eventos rápidos ${quick.playByPlay?.length ?? 0}`);
if (!equivalence) passed = -1;

console.log(`\nRESULTADO CAUSALIDAD: ${passed === total && equivalence ? "PASS" : "FAIL"}`);
process.exitCode = passed === total && equivalence ? 0 : 1;
