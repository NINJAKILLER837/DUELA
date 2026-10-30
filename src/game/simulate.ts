/**
 * API pública del motor de partidos. La implementación completa vive en
 * `engine.ts`; la simulación rápida y el play-by-play comparten la misma
 * resolución de posesiones.
 */
export {
  simulateGame,
  simulateGameQuick,
  emptyBox,
  formatClock,
  ENGINE_VERSION,
  SHOT_ZONES,
  SIM_MODEL_NOTES,
} from "./engine";
export type { SimulationOptions } from "./engine";
