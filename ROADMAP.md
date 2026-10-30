# DUELA — Hoja de ruta del simulador

Proyecto propio de simulación de baloncesto. La identidad, el código y los recursos visuales son propios; no se copian código ni recursos protegidos de Basketball GM ni de la NBA.

## Estado actual: Fase 3 autorizada implementada (sustituciones y rotaciones) + Fase 2 + Fase 1

Mejora autorizada de boxscore y plantillas 2026-27:

- Boxscore BBGM con marcador, récord, períodos/prórrogas, estadísticas avanzadas derivadas, tabla individual completa, DNP, totales validados y play-by-play.
- Plantillas NBA Real 2026-27 con corte 28/10/2026: 30 equipos, 522 fichas, 89 two-way y 433 estándar verificadas en NBA.com. Ver `docs/BOXSCORE_ROSTERS_2026.md`.

Base de Fase 1:

- Dos ligas independientes: **NBA Real** y **NBA Ficticia**.
- 30 franquicias NBA en ambos modos.
- Generación ficticia con semilla reproducible, 12 jugadores por equipo (360).
- Base real documentada y parcial (ver `docs/PHASE1.md`).
- Atributos individuales, OVR ponderado por posición, POT estimado y perfiles.
- Calendario regular abreviado de 29 jornadas y 435 partidos.
- Motor inicial de partidos con marcador, cuartos, minutos, box score y play-by-play desde una única resolución.
- Modo Manager y Modo Espectador, activables por liga.
- Juego de exhibición antes de crear liga: real vs real, ficticio vs ficticio y universos cruzados, incluyendo equipos de ligas guardadas.
- Persistencia en IndexedDB con versionado no destructivo.
- Interfaz monocroma ajustable y guardada por liga (Tinta, Grafito, Papel, Contraste).
- Auditoría local integrada de datos y motor.

## Fase 2 — motor de partidos realista

Implementada dentro del alcance autorizado:

- Posesiones con reloj real, prórrogas y ritmo variable.
- Cinco zonas de tiro con registro por jugador y equipo.
- Atributos individuales conectados a tiro, pase, pérdidas, defensa, rebote, contacto, transición, fatiga y decisiones.
- Faltas de tiro, ofensivas, de equipo, bonus y faltas tácticas.
- Tiros libres, rebotes, tapones y play-by-play generados por la misma resolución.
- Fatiga con carga y recuperación relativa.
- API de simulación rápida sin narración equivalente a la detallada.
- Validación masiva y pruebas de causalidad en `scripts/phase2-validation.ts` y `scripts/phase2-causality.ts`.
- Informe: `docs/PHASE2.md`.

## Fase 3 — sustituciones y rotaciones inteligentes

Implementada dentro del alcance autorizado:

- Rotación dinámica de 10 jugadores con quinteto inicial por calidad y posición.
- Sustituciones entre posesiones (ventanas de balón muerto), nunca durante una acción.
- Fatiga por tiempo real en cancha con recuperación en el banquillo.
- Decisiones de cierre, descanso, faltas, prórroga y contexto de marcador.
- Minutos derivados de segundos reales: 240 por equipo + 25 por prórroga.
- Registro de cambios y quintetos iniciales en los datos del partido.
- Pruebas: `scripts/phase3-rotation.ts`, 38.910 comprobaciones en 240 partidos, 0 fallos.
- Informe: `docs/PHASE3.md`.

Limitaciones: no hay lesiones, tiempos muertos ni 2-for-1; la sustitución por sexta falta se aplica en la siguiente ventana; no hay rebotes de equipo ni +/-; se mantiene el bloqueo de reproducibilidad de NBA Real. No se avanza a Fase 4.

## Fases futuras (plan, no autorización)

- **Fase 4:** traspasos, contratos, agencia libre, salarios, límite salarial y finanzas.
- **Fase 5:** Draft NBA, scouting, rookies, historial y récords.
- **Fase 6:** entrenadores, tácticas, rotaciones, química y decisiones de la IA.
- **Fase 7:** múltiples temporadas, envejecimiento, retiradas, Hall of Fame y expansión histórica.
- **Fases posteriores:** mejoras de interfaz, estadísticas avanzadas y balance del motor.

Las fases 4–7 no deben implementarse hasta recibir autorización expresa.
