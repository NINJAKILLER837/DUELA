# DUELA — Fase 3: sustituciones y rotaciones inteligentes

Implementación cerrada exclusivamente dentro de la Fase 3. No se ha avanzado a la Fase 4, no se ha cambiado el generador de jugadores ni los atributos de las plantillas, y no se han instalado dependencias ni ejecutado operaciones de Git.

## 1. Inspección previa

Antes de editar se comprobó:

- `src/game/engine.ts` era el único motor; `simulate.ts` solo reexporta la API.
- Los 10 jugadores del acta participaban en todas las posesiones; no existía un quinteto en cancha.
- Los minutos se preasignaban en `normalizeMinutes` y se normalizaban al final; no se derivaban del tiempo real.
- La fatiga usaba `targetMinutes` y el tiempo transcurrido, no el tiempo real en cancha ni el descanso.
- No existía ninguna infraestructura de sustitución, ventana de balón muerto ni registro de cambios.
- Ya existían: seis faltas personales, faltas de tiro/ofensivas, bonus, faltas tácticas, prórrogas, play-by-play y estadísticas por zona.
- No existía un sistema de lesiones, tiempos muertos ni estrategia 2-for-1.

## 2. Arquitectura

### Motor único

`simulateGame` sigue siendo el único motor. `simulateGameQuick` ejecuta la misma función con `recordPlayByPlay:false`; la única diferencia es la omisión de la narración. Las decisiones de sustitución no consumen RNG de narración: el play-by-play se escribe después de resolver la posesión.

### Nuevo módulo de entrenador

`src/game/rotation.ts` contiene lógica pura, sin tiros ni marcador:

- `coachValue`: valor de entrenador calculado con atributos individuales y posición, nunca con OVR/POT.
- `selectGameRotation`: respeta `team.rotation` cuando tiene 5–10 IDs; si no, crea una rotación equilibrada de 10.
- `chooseStartingFive`: elige un quinteto con cobertura de posiciones y calidad.
- `coachPreference`: usa `rotationMinutes` únicamente como preferencia táctica (0,94–1,04), nunca como minutos fijos.
- `chooseSubstitutions`: devuelve como máximo un cambio normal por ventana; las expulsiones se resuelven primero y pueden forzar un cambio. Si no hay reemplazo elegible, devuelve una lista vacía.

### Estado de cancha y balón muerto

Cada jugador del acta tiene:

`onCourt`, `secondsPlayed`, `fatigue`, `fouls`, `fouledOut`, `lastOffElapsed`, `stintStartElapsed` y `coachPreference`.

La sustitución se evalúa **después de resolver una posesión**, antes de la siguiente. Una posesión es la unidad de acción del motor, por lo que ese límite es la ventana legal de balón muerto. No se llama a `chooseSubstitutions` dentro de `resolvePossession`, `takeShot`, `attemptFreeThrows` ni `resolveRebound`. No hay cambios a mitad de una acción activa.

### Fatiga y minutos

- La fatiga se acumula por segundos reales en cancha y se recupera en el banco.
- `eff` aplica la fatiga a los atributos usados en cada acción.
- Los minutos se calculan al final desde `secondsPlayed`, en décimas de minuto y con reparto de resto para conservar el total exacto.
- Reglamentario: 240 minutos de jugador por equipo. Cada prórroga: 25 minutos de jugador por equipo.
- En el box score solo aparecen los jugadores que pisaron la cancha; el resto se muestra como DNP en la interfaz.

## 3. Comportamiento de las sustituciones

- Inicio: quinteto por posición/calidad; no se fuerza cambio al empezar un período.
- Fatiga: un tramo largo o fatiga alta proponen descanso si hay un suplente elegible.
- Faltas: 4–5 faltas en partido cerrado elevan la prioridad de salida; la sexta expulsa y obliga a buscar reemplazo en la siguiente ventana.
- Partido cerrado: en los últimos cinco minutos se prioriza calidad y se forma una alineación de cierre.
- Ventaja amplia: se descansan las estrellas y se dan minutos a la banca.
- Desventaja amplia: se buscan cambios de energía/calidad.
- Prórroga: se valora la fatiga acumulada además del contexto.
- Cooldown de 45 s entre cambios normales, mínimo de 100 s de tramo para salir, 90 s de descanso para volver a entrar, máximo 40 cambios normales por equipo y máximo 70 cambios totales verificados en la batería (incluidas expulsiones).
- Se evita repetir el mismo par salida/entrada en menos de 60 s y no se permite que entre un jugador expulsado.
- No se inventan jugadores si no hay reemplazo elegible.

Cada cambio se registra en `Game.substitutions` con equipo, período, reloj, tiempo transcurrido, jugador que sale, jugador que entra, motivo, si fue forzado y un ID único. También se escribe un evento `kind:"substitution"` en el play-by-play cuando se graba narración. La simulación rápida conserva el mismo registro de cambios y la misma caja.

## 4. Reglas implementadas y pendientes

### Implementadas

- Seis faltas personales y expulsión.
- Cinco jugadores en cancha cuando hay reemplazo elegible.
- Ventanas de sustitución entre posesiones.
- Alineación de cierre, gestión de fatiga, faltas y contexto de marcador/período/reloj.
- Faltas tácticas y bonus de Fase 2.
- Prórrogas con minutos acumulados reales.
- Registro de cambios y quintetos iniciales (`Game.startingLineups`).
- Determinismo con la misma semilla y plantilla.

### Pendientes / dependencias

- **Lesiones:** no existe sistema de lesiones; no se inventan. Una lesión no puede generar una sustitución porque no hay estado de lesión.
- **Tiempos muertos:** no se modelan ventanas de timeout; las ventanas legales son los límites de posesión.
- **2-for-1:** no implementado.
- **Rebotes de equipo:** no modelados; todos los rebotes se asignan a jugadores.
- **+/-:** no calculado; sigue siendo 0 y la interfaz lo muestra como “—”.
- **Expulsión durante tiros libres:** el jugador queda excluido de la selección de acciones (`available`), pero su reemplazo se aplica en la siguiente ventana de posesión. No se sustituye dentro de la misma posesión de tiros libres. Debe revisarse si se quiere una sustitución inmediata antes del primer tiro libre.
- **Rotación de 10:** el acta activa es de 10 jugadores; el resto de la plantilla son DNP. No hay expansión dinámica a los 15/18 de la plantilla.
- **Reproducibilidad NBA Real:** sigue existiendo el problema de Fase 2: `attributesFromReal` usa el `leagueId` temporal como semilla. No se ha corregido dentro de esta fase. Las auditorías de NBA Real con semilla declarada no son reproducibles entre ligas nuevas.
- **Alineaciones y banquillo:** no se modela química, jerarquía de vestuario ni instrucciones específicas del entrenador más allá de la calidad/preferencia.

## 5. Archivos

**Creados**
- `src/game/rotation.ts`
- `scripts/phase3-rotation.ts`
- `docs/PHASE3.md`

**Modificados**
- `src/game/engine.ts`
- `src/types.ts`
- `src/game/audit.ts`
- `src/screens/LeaguePages.tsx` (texto de rotación)
- `src/screens/GameDetail.tsx` (minutos redondeados y etiqueta de cambio en PBP)
- `scripts/phase1-audit.ts`
- `scripts/phase2-validation.ts`
- `scripts/phase2-causality.ts`
- `scripts/boxscore-presentation-check.tsx`
- `ROADMAP.md`

No se modificaron generadores, plantillas, atributos ni el sistema de ligas.

## 6. Pruebas ejecutadas y resultados reales

| Prueba | Resultado |
|---|---|
| `npx tsc --noEmit` | **PASS** |
| `npm run build` | **PASS** · `dist/index.html` 704,41 kB / 178,18 kB gzip |
| `scripts/phase3-rotation.ts` con 120 partidos por liga | **PASS · 38.910 comprobaciones, 0 fallos** |
| `scripts/phase2-causality.ts` con 300 pares (+ Endurance 1.600) | **PASS · 13/13** |
| `scripts/phase2-validation.ts` con 800 partidos | **PASS estructural** · 9 advertencias estadísticas |
| `scripts/phase1-audit.ts` | **PASS** |
| `scripts/render-check.tsx` | **PASS · 23/23** |
| `scripts/boxscore-presentation-check.tsx` | **PASS · 30/30** |
| `scripts/team-comparison-check.tsx` | **PASS · 20/20** |
| `scripts/drawer-scroll-check.tsx` | **PASS · 16/16** |

### Fase 3: muestra de 120 partidos por liga

| Métrica | NBA Ficticia | NBA Real |
|---|---:|---:|
| Partidos | 120 | 120 |
| Cambios por partido (ambos equipos) | 44,9 | 44,0 |
| Participantes por partido (ambos equipos) | 18,8 | 19,6 |
| Minutos de jugadores de mayor calidad | 35,3 | 34,6 |
| Minutos de jugadores de menor calidad | 13,0 | 16,7 |
| Comprobaciones | 38.910 | — |

La batería verificó: 5 jugadores en cada alineación, cambios solo en el log, minutos 240 + 25×OT, participantes positivos, 6 faltas máximas, ausencia de jugadores expulsados que reingresan, volumen limitado, no repetición de un mismo par en 60 s, quintetos iniciales, determinismo, equivalencia rápida/detallada, coherencia de totales/zonas/PBP y decisiones de cierre/descanso/faltas sin reemplazo inventado.

### Causalidad tras la integración

La prueba antigua de `endurance` pasó de 800 a 1.600 semillas porque ahora la resistencia también cambia las decisiones de rotación:

`q4Margin`: A −0,949 → B −0,019 · Δ +0,930 · IC95 [0,400; 1,460] · p < 0,001.

Las 13 rutas causales de Fase 2 siguen siendo significativas en la muestra indicada. La simulación rápida y la detallada produjeron la misma caja y la misma lista de sustituciones.

### Realismo agregado (Fase 2, muestra 800; no se declara validado)

| Métrica | Ficticia | Real | NBA 2024-25 |
|---|---:|---:|---:|
| PTS | 114,5 | 116,2 | 113,8 |
| FG% | 49,2% | 49,7% | 46,7% |
| 3P% | 36,8% | 35,6% | 36,0% |
| FT% | 78,4% | 79,7% | 78,0% |
| TOV | 11,5 | 11,7 | 14,3 |
| ORB | 9,6 | 9,8 | 11,1 |

Advertencias: 9, principalmente FG% alto, TOV bajo y ORB bajo. El motor sigue siendo plausible, no una réplica estadística validada de la NBA. No se ha añadido una referencia de ritmo/ORtg/zonas/OT/estrellas.

## 7. Decisiones de calibración

- Se mantuvieron las fórmulas de tiro, pase, rebote y defensa; solo se cambió el conjunto de jugadores elegibles (cinco en cancha) y se neutralizó `minuteFactor` para no introducir el reparto fijo de minutos.
- La calidad del entrenador es una heurística separada de la resolución de acciones. No usa OVR ni POT.
- Se conservó `rotationMinutes` como preferencia, no como minutos exactos, para no romper la persistencia ni el editor de Fase 1. La UI se ajustó para explicar que los minutos reales se acumulan en cancha.
- Los minutos se expresan con una décima y se reparte el resto para que el total sea 240 / 265 / 290… sin duplicar tiempo. La representación en pantalla está redondeada a una décima; el total de la tabla se redondea para evitar artefactos de coma flotante.
- El acta activa es de 10 jugadores. Es una decisión de alcance para no alterar las plantillas ni la UI; el resto queda como DNP.

## 8. Limitaciones y riesgos restantes

1. No hay lesiones, tiempos muertos ni 2-for-1; no se simulan.
2. La expulsión no sustituye dentro de la misma secuencia de tiros libres; se aplica en la siguiente ventana. El jugador expulsado queda excluido de selección de acciones mientras tanto.
3. No hay rebotes de equipo ni +/−.
4. La NBA Real sigue sin reproducibilidad de atributos por el `leagueId` temporal; es un bloqueo de una fase anterior.
5. La rotación activa es de 10, no toda la plantilla de 15–18.
6. La tasa de cambios (~44 por partido sumando ambos equipos) es alta; corresponde a cambios individuales, no a “eventos de cambio” con varios jugadores. Debe calibrarse con una referencia NBA real antes de considerarla realista.
7. No hay prueba E2E en navegador real ni IndexedDB tras recarga.
8. El realismo estadístico no está validado; hay 9 advertencias en la comparación y faltan referencias para varias métricas.

## 9. Próximo paso

La Fase 3 está implementada y validada en el alcance autorizado. **No se inicia la Fase 4.** Antes de autorizar una fase posterior, conviene decidir si se acepta el volumen de cambios actual, si se corrige la reproducibilidad de NBA Real y si se incorpora una referencia estadística más completa.
