# DUELA — Fase 2: motor de partidos basado en atributos

Alcance ejecutado: únicamente la Fase 2 autorizada. No se ha iniciado la Fase 3, no se han modificado plantillas ni la interfaz, no se han instalado dependencias y no se han ejecutado operaciones de Git.

## 1. Arquitectura antes y después

### Antes

- `src/game/simulate.ts` contenía el motor completo.
- 100 posesiones fijas por equipo; no existía reloj de partido ni posesiones de duración variable.
- Tres tipos de tiro (`rim`, `mid`, `three`), sin zonas y sin registro por zona.
- Defensa basada en una media ponderada del equipo y un único defensor elegido por pesos; sin ayuda ni asignación por zona.
- Uso ofensivo calculado a partir del OVR y minutos.
- Sin fatiga, sin faltas de equipo, sin bonus, sin faltas tácticas y sin recuperación entre períodos.
- El play-by-play se generaba en la misma función, pero no existía una opción de simulación rápida sin narración.
- No había datos por zona ni posesiones en el boxscore.

### Después

- **`src/game/engine.ts`** contiene la implementación nueva del motor.
- **`src/game/simulate.ts`** conserva la API pública (`simulateGame`, `emptyBox`, `formatClock`, `SIM_MODEL_NOTES`) y añade `simulateGameQuick`, `ENGINE_VERSION` y `SHOT_ZONES` como reexportaciones.
- El partido avanza con **reloj de 4 × 12 minutos + prórrogas de 5 minutos**. Cada posesión consume tiempo real según transición, ritmo, táctica y situación de marcador.
- La misma función `simulateGame` resuelve todas las decisiones. El parámetro opcional `{ recordPlayByPlay: false }` omite la narración sin consumir aleatoriedad distinta.
- Se registran zonas por jugador y equipo, posesiones, faltas por período, puntos en pintura y puntos de contragolpe como campos opcionales compatibles con boxscores antiguos.
- La rotación sigue siendo preasignada, como en Fase 1; no se han introducido sustituciones en vivo.

## 2. Flujo de una posesión

1. Se determina el equipo atacante y el tiempo disponible.
2. Se elige un manejador con Dribbling, Passing y Off IQ.
3. Se calcula el riesgo de pérdida con Dribbling/Passing/Off IQ frente a Def IQ, defensa exterior y fatiga.
4. Se comprueba falta táctica al final (equipo que va por detrás), falta sin tiro y bonus.
5. Se selecciona una zona de tiro a partir de táctica, atributos del equipo, defensa, IQ y contexto.
6. Se elige tirador por uso ofensivo, habilidad en la zona, IQ, minutos y fatiga.
7. Se elige defensor primario por zona y un ayudante interior.
8. Se resuelve falta de tiro, tapón, acierto o fallo. Los tiros libres usan FT.
9. Un fallo genera rebote ofensivo o defensivo con altura, fuerza, salto, Rebounding y posición; un rebote ofensivo puede generar putback.
10. Se actualizan marcador, cuartos, reloj, estadísticas, faltas, posesiones y play-by-play.
11. Se decide la siguiente posesión o el final del período. Las prórrogas continúan hasta que haya un ganador, con límite de seguridad.

## 3. Atributos conectados

| Atributo | Acciones concretas en el motor |
|---|---|
| Height | Finalización cerca del aro, peso en rebotes, probabilidad de tapón, rating interior defensivo |
| Strength | Contacto y finalización interior, faltas recibidas/provocadas, rebotes, defensa interior |
| Speed | Transiciones, ritmo/posesiones, selección de penetración, defensa exterior, robos |
| Jumping | Rebotes, tapones, finalizaciones aéreas y ventaja de salto |
| Endurance | Carga de fatiga, recuperación entre cuartos y rendimiento en el último cuarto |
| Inside | Tiros cercanos y juego interior |
| Layups | Bandejas y finalizaciones en movimiento |
| Free Throws | Probabilidad de tiros libres y decisión de clutch desde la línea |
| Mid Range | Eficacia en media distancia |
| Three Pointers | Eficacia y preferencia por el triple |
| Offensive IQ | Selección de tiro, calidad de decisiones, creación de ventaja, asistencias |
| Defensive IQ | Selección del defensor, contención, robos, tapones y calidad defensiva |
| Dribbling | Control del balón, pérdidas, penetración y creación |
| Passing | Pérdidas por pase, asistencias, calidad del tiro creado |
| Rebounding | Rebotes ofensivos y defensivos |
| Perimeter Defense | Defensa del tiro exterior y de la penetración |
| Interior Defense | Defensa en pintura, tapones y poste |

OVR no interviene en tiros, pases, rebotes ni defensa. `chooseRotation` todavía puede usar OVR para elegir la plantilla de 10 si no hay rotación explícita, como sistema de selección de personal. POT no se usa en absoluto en la simulación.

## 4. Zonas de tiro

Se implementan cinco zonas explícitas:

1. `restricted`: área restringida / aro.
2. `close`: pintura y tiro cercano fuera del área restringida.
3. `mid`: media distancia.
4. `corner3`: triple de esquina.
5. `wing3`: triple frontal y laterales fuera de esquinas.

Cada lanzamiento registra `fga`, `fgm`, `tpa`, `tpm` y `points` por zona en `PlayerGameStats.zones` y `TeamBoxScore.zones`. Las sumas de zona se validan contra los totales del equipo. La selección depende de la habilidad y tendencia del tirador, la media del equipo, el IQ ofensivo, la defensa interior/exterior, la táctica, el contragolpe y el marcador/reloj.

Distribución global 2024-25 simulada (800 partidos, 1.600 actuaciones de equipo):

| Zona | Intentos | Acierto |
|---|---:|---:|
| Área restringida | 33,8% | 67,3% |
| Cerca del aro | 12,9% | 47,7% |
| Media distancia | 12,7% | 38,6% |
| Triple de esquina | 13,5% | 38,4% |
| Triple frontal/lateral | 27,0% | 34,8% |

## 5. Faltas, tiros libres, rebotes y final de partido

- Faltas de tiro según zona, fuerza, velocidad, SQ y Def IQ; 2 o 3 tiros libres.
- Faltas sin tiro: si el equipo defensor ya está en bonus (5 faltas de equipo en el período), 2 tiros libres; si no, el ataque conserva la posesión.
- Faltas ofensivas: pérdida y falta personal.
- Faltas tácticas al final si el equipo que defiende va por detrás por ≤3 con ≤30 segundos.
- Faltas de equipo por cuarto, reseteadas en cada período y prórroga.
- Un jugador deja de ser elegido tras su sexta falta personal. Limitación documentada: la distribución de minutos es preasignada y no se recalcula por una sustitución en vivo.
- Tiros libres dependen de FT, fatiga y presión de marcador.
- Rebotes dependen de posición, altura, salto, fuerza, Rebounding y contexto del fallo. Los rebotes de tiro libre también se resuelven.
- Prórrogas de 5 minutos hasta que el marcador deje de estar empatado; el play-by-play conserva cuartos y OT.
- Gestión del reloj: el equipo que va por delante consume más tiempo; el que va por detrás acelera, busca triples y puede cometer falta táctica.

## 6. Un solo motor: play-by-play y simulación rápida

- `simulateGame(...)` usa el motor completo y registra eventos.
- `simulateGameQuick(...)` llama a `simulateGame(..., { recordPlayByPlay: false })`.
- Las decisiones, el consumo de RNG, las estadísticas y el marcador son idénticos; solo cambia el array de narración.
- Con la misma semilla, la caja rápida y la caja detallada son exactamente iguales. También se comprueba que repetir la misma semilla produce la misma caja.
- Los textos del play-by-play no consumen RNG ni inventan acciones: se generan a partir de la resolución ya ocurrida.

## 7. Validación masiva

Comando ejecutado realmente:

```bash
GAMES=500 npx esbuild scripts/phase2-validation.ts --bundle --platform=node --outfile=/tmp/validation-final2.cjs --alias:@=./src --log-level=warning
GAMES=500 node /tmp/validation-final2.cjs
```

Muestra: **500 partidos de NBA Ficticia + 300 de NBA Real 2026-27 = 800 partidos** y 1.600 actuaciones de equipo. Las semillas de cada partido derivan de FNV-1a de `label-index` más un paso multiplicativo.

**Limitación de reproducibilidad comprobada:** la liga ficticia es reproducible entre procesos (mismos nombres, atributos y resultados). En la **NBA Real**, `attributesFromReal` usa el `leagueId` como semilla y ese ID contiene la hora de creación; por eso los atributos reales cambian al crear cada liga y el agregado de validación real varía ligeramente entre ejecuciones. El motor sí es determinista dada la misma plantilla y la misma semilla (verificado con hashes numéricos de boxscore en procesos distintos). No se ha modificado la generación real en esta corrección por estar fuera del alcance de interfaz solicitado. Está documentado como pendiente.

| Métrica | Ficción | Real | Global | NBA 2024-25 |
|---|---:|---:|---:|---:|
| PTS | 110,3 | 113,1 | 111,4 | 113,8 |
| Posesiones/equipo | 98,4 | 100,3 | 99,1 | ~99,0 |
| ORtg | 112,0 | 112,8 | 112,3 | ~113–114 |
| FG% | 48,1% | 48,9% | 48,4% | 46,7% |
| 3P% | 35,9% | 36,0% | 36,0% | 36,0% |
| FT% | 77,0% | 78,7% | 77,6% | 78,0% |
| 3PA/FGA | 41,1% | 39,8% | 40,6% | 42,2% |
| ORB | 9,7 | 9,7 | 9,7 | 11,1 |
| TRB | 47,9 | 47,6 | 47,8 | 44,1 |
| AST | 25,0 | 27,0 | 25,8 | 26,5 |
| STL | 7,4 | 7,6 | 7,5 | 8,2 |
| BLK | 5,5 | 6,0 | 5,7 | 4,9 |
| TOV | 11,9 | 12,2 | 12,0 | 14,3 |
| PF | 16,3 | 16,5 | 16,4 | 18,6 |
| Minutos/equipo | 240,1 | 240,1 | 240,1 | 240 (+OT) |
| OT | 2,0% | 2,0% | 2,0% | ~5% |
| Margen medio | 18,6 | 14,2 | 16,9 | ~12 |
| Cierres ≤5 | 17,0% | 22,7% | 19,1% | — |

Otros datos:

- 10,0 jugadores con minutos por equipo; 321 eventos de play-by-play por partido.
- Bonus: 1,67 eventos/partido.
- Faltas tácticas: 0,14/partido.
- Uso ofensivo medio por jugador: 10,7% del equipo.
- Máximo anotador en un partido de la muestra: 65 puntos.
- Correlación 3P% ↔ atributo Three Pointers en los 120 jugadores con más volumen: 0,74 (control descriptivo, no la prueba causal).

Invariantes comprobadas en los 800 partidos (**PASS**): marcador = cuartos = suma de puntos individuales; fórmula 2×FGM + 3PM + FTM; totales de equipo = suma de jugadores; zonas = intentos/aciertos/triples; minutos = 240 + 5×OT; 10 jugadores con minutos; posesiones finitas; sin empates finales; último evento del play-by-play = marcador final; suma de puntos narrados = marcador; faltas de equipo = PF; sin valores no finitos; sin jugador con más de 6 faltas.

### Comparación y desviaciones declaradas

Se usa la media de la liga NBA 2024-25 de Basketball-Reference. El motor se calibró para el rango moderno, no para imitar una temporada concreta.

- FG% global 48,4% frente a 46,7% (+1,7 puntos). Se mantiene dentro del rango de validación, pero es la desviación más clara.
- TOV 12,0 frente a 14,3 (−15,8%), ORB 9,7 frente a 11,1 (−12,8%) y PF 16,4 frente a 18,6 (−11,8% en el caso ficticio). Son las principales diferencias estadísticas.
- TRB 47,8 frente a 44,1: el motor acredita todos los rebotes a jugadores, mientras la NBA contabiliza team rebounds.
- OT 2,0% frente a ~5% NBA; el modelo de final de partido es más simple que la secuencia real de faltas/tiros libres y no genera el mismo número de empates.
- El margen medio es superior al de la NBA, especialmente en la liga ficticia por la mayor dispersión de talento de sus plantillas.
- El motor no tuvo un modelo de fuerza de calendario ni ventaja local.

Las advertencias anteriores no se ocultan: la validación estructural da **PASS**, pero la comparación estadística registra **8 advertencias**.

## 8. Pruebas de causalidad

Comando ejecutado realmente:

```bash
PAIRS=400 npx esbuild scripts/phase2-causality.ts --bundle --platform=node --outfile=/tmp/causal-lay.cjs --alias:@=./src --log-level=warning
PAIRS=400 node /tmp/causal-lay.cjs
```

Cada escenario usa las mismas semillas emparejadas. Salvo el caso de Layups, que compara un jugador de control con 40 vs 90 en ese atributo, se modifica un atributo en +25 en la rotación objetivo (la altura +4"). Se exige dirección esperada e IC95% que excluya cero.

| Escenario | Métrica | Δ | IC95% | p |
|---|---|---:|---|---:|
| 3 Pointers +25 | 3P% | +5,09 pp | [4,11; 6,07] | <0,001 |
| 3 Pointers +25 | 3PA/FGA | +10,12 pp | [9,50; 10,75] | <0,001 |
| Free Throws +25 | FT% | +5,84 pp | [5,15; 6,52] | <0,001 |
| Layups 40→90 | acierto pintura del jugador | +12,51 pp | [8,79; 16,23] | <0,001 |
| Passing +25 | AST/FGM | +8,98 pp | [8,10; 9,86] | <0,001 |
| Passing +25 | TOV% | −0,72 pp | [−1,07; −0,36] | <0,001 |
| Dribbling +25 | TOV% | −1,21 pp | [−1,53; −0,89] | <0,001 |
| Off IQ +25 | ORtg | +3,19 | [1,91; 4,47] | <0,001 |
| Off IQ +25 | eFG% | +2,01 pp | [1,27; 2,74] | <0,001 |
| Def IQ +25 | ORtg rival | −5,81 | [−6,96; −4,67] | <0,001 |
| Rebounding +25 | cuota de rebote | +2,44 pp | [2,00; 2,89] | <0,001 |
| Height +4" | cuota de rebote | +1,15 pp | [0,76; 1,55] | <0,001 |
| Height +4" | tapones | +0,49 | [0,31; 0,67] | <0,001 |
| Jumping +25 | tapones | +1,49 | [1,26; 1,71] | <0,001 |
| Jumping +25 | cuota de rebote | +0,91 pp | [0,50; 1,33] | <0,001 |
| Strength +25 | FTA/FGA | +5,02 pp | [3,96; 6,07] | <0,001 |
| Strength +25 | cuota de rebote | +0,88 pp | [0,40; 1,35] | <0,001 |
| Speed +25 | puntos de contragolpe | +6,50 | [5,95; 7,05] | <0,001 |
| Speed +25 | posesiones | +2,98 | [2,61; 3,35] | <0,001 |
| Endurance −25 vs +25 | margen de Q4 | +1,36 | [0,42; 2,30] | 0,004 |

Resultado: **13/13 escenarios PASS**. La simulación rápida y la detallada produjeron la **misma caja**; la misma semilla reprodujo la misma caja. La muestra de causalidad supone aproximadamente 6.003 simulaciones (400 semillas emparejadas para 12 variantes, 400 para la comparación baja/alta de Endurance, más las pruebas de equivalencia).

## 9. Pruebas ejecutadas realmente

| Prueba | Resultado |
|---|---|
| `npx tsc --noEmit` | **PASS** |
| `npm run build` | **PASS** · producción generada |
| `scripts/phase2-validation.ts` (500 + 300 partidos) | **PASS estructural**; 8 advertencias estadísticas documentadas |
| `scripts/phase2-causality.ts` (400 pares) | **PASS · 13/13** |
| Equivalencia rápida/detallada | **PASS** · caja idéntica y misma semilla reproducible |
| `scripts/phase1-audit.ts` | **PASS** |
| `scripts/render-check.tsx` | **PASS · 23/23** |
| `scripts/boxscore-presentation-check.tsx` | **PASS** |
| `scripts/team-comparison-check.tsx` | **PASS** |

No existe un runner formal (`npm test`) ni un navegador/Chromium en el entorno. No se ha ejecutado un E2E de IndexedDB tras cerrar el navegador ni una prueba en dispositivo Android. La compatibilidad de datos se apoya en campos nuevos opcionales y en que la API anterior sigue disponible.

## 10. Limitaciones y decisiones de calibración

- **Sustituciones en vivo:** no implementadas. La rotación se preasigna y la fatiga usa carga prevista y recuperación relativa entre cuartos.
- **Falta eliminatoria:** el jugador deja de ser elegido al llegar a 6 faltas, pero los minutos del boxscore siguen la distribución preasignada; no se recolocan como en una sustitución real.
- **Rebotes de equipo:** no se modelan; todos los rebotes se asignan a jugadores. Esto eleva el TRB individual agregado frente a la NBA.
- **Reglas no modeladas:** and-one, faltas técnicas, flagrantes, goaltending, violaciones de 3/5 segundos/8 segundos, revisiones, lesiones y disponibilidad. No se inventan estados.
- **Ritmo:** hay variación natural, pero no ventaja de local ni un modelo de calendario/descanso entre partidos.
- **Posesiones:** pueden superar 100 en partidos con prórrogas; la validación usa el número de OT para fijar el rango.
- **Estadísticas:** el motor prioriza puntos y porcentajes; TOV, PF y ORB quedan por debajo de la media NBA 2024-25. El FG% queda algo por encima. Las diferencias están cuantificadas en la sección 7.
- **OT:** 2,0% en la muestra frente a ~5% NBA. No se fuerza el empate.
- **Máximo anotador:** 65 puntos en un partido de 800. El uso ofensivo está acotado para que ningún jugador acapare la mitad de los tiros, pero los mejores anotadores pueden tener partidos extremos.
- **Fatiga:** no se obtiene de un reloj de sustitución individual; usa minutos previstos, minutos jugados por período y recuperación entre cuartos. Es una aproximación conservadora.
- **Uso de OVR:** solo en la selección de rotación de reserva si no hay una rotación explícita. POT no se lee durante la simulación.
- **UI:** no se ha rediseñado. El boxscore existente recibe los mismos campos; los nuevos campos de zonas/posesiones/faltas son opcionales y no se muestran, respetando el límite de la autorización.

## 11. Archivos

**Creados**
- `src/game/engine.ts`
- `scripts/phase2-validation.ts`
- `scripts/phase2-causality.ts`
- `docs/PHASE2.md`

**Modificados**
- `src/game/simulate.ts` (API pública; motor delega en `engine.ts`)
- `src/types.ts` (campos opcionales de zonas, posesiones, faltas y eventos)
- `src/game/audit.ts` (coherencia de zonas/faltas/play-by-play)
- `ROADMAP.md`

## 12. Nota de integración con Fase 3

La Fase 3 sustituyó la rotación preasignada por una rotación dinámica. Consecuencias documentadas:

- `minuteFactor` quedó neutralizado; los minutos ya no se preasignan.
- Los jugadores participantes pueden ser 5–10 por equipo y el resto se muestra como DNP.
- Cada prórroga añade 25 minutos de jugador por equipo (antes la suite comprobaba 5, que era una expectativa incorrecta).
- La prueba causal de `endurance` necesita 1.600 semillas porque la resistencia ahora también influye en las sustituciones.
- Las pruebas de Fase 1 y Fase 2 se actualizaron para aceptar participantes dinámicos; las fórmulas de tiro/pase/rebote/defensa no se cambiaron.

## 13. Corrección posterior de interfaz (scroll del perfil de jugador)

Corrección solicitada tras la Fase 2, sin tocar motor, plantillas, resultados ni boxscore:

- Causa: el cajón usaba `position: fixed` con `overflow-y: auto` directo y el bloqueo de `body`/`html` no garantizaba un área de scroll con altura resuelta en Android; además el `backdrop-filter` del overlay y del encabezado añadía problemas de composición táctil.
- Solución: `.drawer` es ahora una columna flex con `height: 100dvh` y un contenedor interno `.drawer-scroll` (`flex: 1 1 auto`, `min-height: 0`, `overflow-y: auto`, `touch-action: pan-y`, `overscroll-behavior: contain`, safe-area inferior).
- Los overlays se montan mediante `createPortal` en `document.body`, fuera de contenedores animados con `transform`.
- El bloqueo de página usa un contador para overlays anidados y solo cambia `overflow`, sin bloquear `touch-action`.
- El encabezado fijo del perfil usa fondo opaco y ya no `backdrop-blur`.
- El modal de resultados mantiene su propio scroll táctil (`touch-action: pan-y`, `overscroll-behavior: contain`, `100dvh`).
- Nueva prueba: `scripts/drawer-scroll-check.tsx` (16 comprobaciones PASS), que verifica que todos los atributos y la biografía están dentro del contenedor desplazable.

No se modificaron componentes de interfaz ajenos al cajón/modal. No se eliminó ningún archivo.
