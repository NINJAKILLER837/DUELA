# DUELA — Boxscore BBGM + plantillas NBA Real 2026-27

Fase autorizada ejecutada sin instalar dependencias, sin eliminar archivos y sin operaciones de Git. No se ha iniciado la Fase 2.

## 1. Alcance entregado

### Boxscore integrado en el flujo real

La pantalla de partido (`src/screens/GameDetail.tsx`) se reescribió y se conecta a los partidos simulados de liga y de exhibición:

- Marcador principal con identificadores de equipo, abreviatura, ciudad/nombre, puntos, ganador/perdedor, estado, fecha, jornada, temporada, competición y récord de cada equipo (cuando la liga lo permite).
- Tabla de períodos Q1–Q4 + todas las prórrogas + total, generada desde `boxScore.home.quarters` / `.away.quarters`. Nunca inventa períodos.
- Un único cuadro compacto de equipo, debajo del marcador y antes de las tablas de jugadores, con dos secciones dentro del mismo contenedor: parciales por cuarto (1-4, OT solo si existe y F) y estadísticas avanzadas comparadas (eFG%, TOV%, ORB%, FT/FGA). Cada equipo ocupa una fila. Se muestra «—» si el denominador no existe; no se usan tarjetas por métrica.
- Una sola página de boxscore, sin pestañas, con el formato del ejemplo BBGM: cabecera de equipos, cuadro compacto de parciales y avanzadas, y una tabla por equipo.
- Tabla individual completa para ambos equipos: Name, Pos, MP, FG, 3P, FT, ORB, TRB, AST, TOV, STL, BLK, BA, PF, PTS, +/- y GmSc (Game Score de Hollinger). Incluye a todos los jugadores del acta que participaron, no solo a los titulares.
- DNP dentro de la misma tabla como `DNP - Coach's decision`, después de los participantes. Se distingue un jugador del acta con 0 minutos de un jugador que no entró en el acta. No se inventan lesiones, suspensiones ni motivos.
- Fila `Total` con minutos, tiros, rebotes, asistencias, robos, tapones, pérdidas, faltas y puntos, seguida de `Percentages` con FG%, 3P% y FT% más el desglose ORB/DRB/TRB/AST/TOV/PF. Se valida que las filas sumen los totales del equipo y que estos cuadren con el marcador final.
- `GmSc` se calcula con la fórmula estándar de Hollinger a partir del boxscore. `+/-` se muestra como «—» porque el motor no registra datos on/off y no se inventa. `BA` (bloqueos recibidos) tampoco lo registra el motor y se muestra como «—».
- Play-by-play con filtro por equipo. Ya estaba generado por el mismo motor; se ha integrado en la nueva presentación.
- Partidos pendientes: ficha con «Simular este partido». Resultados sin boxscore: mensaje de diagnóstico explícito, sin rellenar datos.
- Deduplicación defensiva por `playerId`, columnas numéricas tabulares, tablas con desplazamiento horizontal y primera columna fija en Android, cabecera/bottom safe-area y sin overflow de página.

### Plantillas NBA Real 2026-27

- Nueva base `src/data/realRosters2026.ts`, separada de la histórica `src/data/realRosters.ts`.
- Corte declarado: **28/10/2026**.
- Fuente principal de pertenencia: **30 páginas oficiales de plantilla de NBA.com** (`/team/{TeamID}/roster`, SEASON 2026), consultadas el **28/10/2026**. Se extrajo el objeto `roster` con dorsal, posición G/F/C, altura, peso, edad, experiencia, universidad y `HOW_ACQUIRED`.
- Estado two-way: **SUPPLEMENTAL_STATUS=1 en NBA.com**, contrastado con **Hoops Rumors, 2026/27 NBA Two-Way Contract Tracker, actualizado 24/10/2026**. La base oficial incluye a Enrique Freeman (MIN) además de los 88 del tracker.
- Contraste de movimientos: transacciones ESPN/Spotrac del 19–28/10/2026. La base oficial no incluye a **Blake Hinson** (waived) ni a Otega Oweh en OKC, y sí a Kobe Bufkin (UTA), Michael Ajayi (CHA) y Ernest Udeh Jr. (CLE), además de Khalifa Diop y Naeqwan Tomlin en CLE.
- Comparación exacta final: **30 equipos / 522 jugadores / 0 discrepancias** entre NBA.com y la base generada para nombre, equipo, altura, peso, edad, dorsal y two-way.
- No se añadieron agentes libres ni jugadores sin equipo. No se duplicó ningún jugador.

#### Recuento exacto por franquicia

Total: **522 jugadores** = **433 estándar + 89 two-way**. Rango: **16–18 fichas por equipo**. 521 tienen dorsal; 1 queda pendiente. 265 tienen nacionalidad pendiente; 1 no tiene universidad y 3 no tienen peso en la fuente oficial. Estos campos se marcan pendientes y no se inventan.

| Franquicia | Total | Estándar | Two-way | Dorsal pendiente | Nacionalidad pendiente |
|---|---:|---:|---:|---:|---:|
| Atlanta Hawks | 18 | 15 | 3 | 0 | 10 |
| Brooklyn Nets | 18 | 15 | 3 | 0 | 9 |
| Boston Celtics | 17 | 14 | 3 | 0 | 5 |
| Charlotte Hornets | 18 | 15 | 3 | 0 | 8 |
| Chicago Bulls | 17 | 14 | 3 | 0 | 9 |
| Cleveland Cavaliers | 17 | 14 | 3 | 0 | 9 |
| Dallas Mavericks | 18 | 15 | 3 | 0 | 8 |
| Denver Nuggets | 17 | 14 | 3 | 0 | 10 |
| Detroit Pistons | 18 | 15 | 3 | 0 | 9 |
| Golden State Warriors | 18 | 15 | 3 | 0 | 12 |
| Houston Rockets | 17 | 14 | 3 | 0 | 7 |
| Indiana Pacers | 17 | 14 | 3 | 0 | 7 |
| LA Clippers | 18 | 15 | 3 | 0 | 10 |
| Los Angeles Lakers | 18 | 15 | 3 | 0 | 13 |
| Memphis Grizzlies | 18 | 15 | 3 | 0 | 9 |
| Miami Heat | 17 | 14 | 3 | 0 | 9 |
| Milwaukee Bucks | 18 | 15 | 3 | 0 | 9 |
| Minnesota Timberwolves | 17 | 14 | 3 | 0 | 8 |
| New Orleans Pelicans | 18 | 15 | 3 | 0 | 9 |
| New York Knicks | 17 | 14 | 3 | 0 | 8 |
| Oklahoma City Thunder | 17 | 14 | 3 | 0 | 10 |
| Orlando Magic | 17 | 14 | 3 | 0 | 7 |
| Philadelphia 76ers | 17 | 14 | 3 | 0 | 10 |
| Phoenix Suns | 17 | 14 | 3 | 0 | 9 |
| Portland Trail Blazers | 17 | 14 | 3 | 0 | 7 |
| Sacramento Kings | 17 | 14 | 3 | 1 | 12 |
| San Antonio Spurs | 17 | 14 | 3 | 0 | 8 |
| Toronto Raptors | 16 | 14 | 2 | 0 | 9 |
| Utah Jazz | 18 | 15 | 3 | 0 | 8 |
| Washington Wizards | 18 | 15 | 3 | 0 | 7 |

Nacionalidad no incluida en el JSON oficial de plantillas; se conserva la que ya estaba verificada y el resto se marca pendiente. No se inventa.

**Toronto** es el caso más corto: 16 fichas y 14 contratos estándar. Se conserva exactamente lo que publica NBA.com; no se añadieron rellenos.

### Separación Real / Ficticia

- IDs de liga con prefijo `real-` / `fictional-`; IDs de equipo y jugador incluyen la liga.
- 0 colisiones de ID y 0 nombres ficticios copiados de la base real (522 nombres reales únicos; 360 ficticios únicos).
- Nuevas ligas reales usan 522 fichas; las ficticias siguen con 360 (12 por equipo).
- **Migración segura:** las ligas reales ya guardadas conservan su snapshot anterior (270 fichas). No se modifican, no se borran y no se mezclan con los resultados nuevos. La app lo avisa en Resumen, Ajustes y Datos. Para usar el corte nuevo hay que crear una liga real nueva.

## 2. Fuentes consultadas

| Fuente | Uso | Fecha/estado |
|---|---|---|
| `nba.com/news/nba-rosters-set-for-2026-27-regular-season` | Confirmación de apertura 2026-27 (20/10/2026), contexto | Publicado 20/10/2026 |
| `nba-schedule.net/nba-rosters` | Listado secundario de contraste | Actualizado 27/10/2026 16:35 EDT |
| Páginas oficiales de plantilla de NBA.com (30) | Pertenencia, dorsal, posición, físico, edad, experiencia, universidad | Consulta 28/10/2026, SEASON 2026 |
| `hoopsrumors.com/2026/07/2026-27-nba-two-way-contract-tracker.html` | Contraste two-way: 88 en tracker + Enrique Freeman confirmado en NBA.com = 89 | Actualizado 24/10/2026 |
| `espn.com/nba/transactions` y Spotrac (transacciones) | Comprobación de cortes/fichajes 19–24/10/2026 | Consulta 28/10/2026 |
| Basketball Reference / NBA Stats / fichas universitarias | Físico y formación de Ajayi, Udeh y Bufkin | Consulta 28/10/2026 |
| `nba.com/teams` | Directorio de franquicias | Referencia |

**Verificación oficial completada.** Se descargaron las 30 páginas de plantilla de NBA.com (`/team/{TeamID}/roster`) el 28/10/2026 y se extrajo el objeto `roster` con `SEASON: "2026"`. Coinciden 30/30 franquicias, 522 jugadores, 89 two-way y 433 estándar. El listado secundario y el tracker two-way se usaron únicamente como contraste; la base final se genera desde NBA.com.

## 3. Datos pendientes y límites de identidad

- 265 fichas con nacionalidad pendiente (no incluida en el JSON oficial de plantillas). 1 ficha sin universidad en la fuente.
- 1 dorsal pendiente.
- La posición de la fuente es G/F/C. La posición específica PG/SG/SF/PF/C se conserva de la base propia cuando el jugador ya existía y se deriva de G/F/C + altura cuando es nuevo. La ficha muestra ambas.
- «Estándar» se infiere de la pertenencia al listado y de la regla 15+3. No se verifican términos, años ni salarios; no se muestran.
- No se modelan lesiones, suspensiones ni inactivos. Un jugador de la plantilla sin minutos se presenta como **DNP - Coach's decision**, nunca como lesionado. Un jugador del acta con 0 minutos se distingue del DNP.
- No hay estado «en curso»: el simulador es por turnos. Se muestran «Programado» y «Final».
- `+/-` no está registrado por el motor (sin datos on/off). Se muestra «—» con explicación. Sí se muestra **GmSc (Game Score de Hollinger)**, calculado únicamente con las estadísticas del boxscore, con su fórmula documentada en la interfaz. `BA` tampoco está registrado y se muestra como «—».
- El motor sigue usando 10 participantes por equipo. El boxscore muestra esos 10 y calcula los DNP con la plantilla completa. No hay sustituciones en vivo (Fase 2).

## 4. Archivos

**Creados**
- `src/data/realRosters2026.ts`
- `docs/BOXSCORE_ROSTERS_2026.md`

**Modificados**
- `src/screens/GameDetail.tsx` (reescritura del visor)
- `src/screens/LeagueApp.tsx`, `src/screens/Exhibition.tsx` (traspaso de plantillas, récords, temporada y competición)
- `src/screens/LeagueSystem.tsx`, `src/screens/LeaguePages.tsx`, `src/screens/CreateLeague.tsx`, `src/screens/Hub.tsx`, `src/components/details.tsx`
- `src/types.ts`, `src/game/generate.ts`, `src/game/audit.ts`
- `src/data/franchises.ts`, `src/index.css`
- `scripts/phase1-audit.ts`, `scripts/render-check.tsx`
- `ROADMAP.md`, `docs/PHASE1.md`

**No eliminados:** `src/data/realRosters.ts` se conserva como base histórica y para no romper ligas guardadas.

## 4-bis. Corrección de presentación y desbordamiento horizontal

La tabla del boxscore se regeneró a partir de una **única definición de columnas** (`BOX_COLUMNS` en `src/screens/GameDetail.tsx`). Cabecera, filas de jugador, titulares/suplentes, DNP, `Total`, `Percentages` y los `colSpan` consumen la misma lista, eliminando el riesgo de que un encabezado quede sobre otra estadística.

Orden definitivo: **Name | Pos | MP | FG | 3P | FT | ORB | TRB | AST | TOV | STL | BLK | BA | PF | PTS | +/- | GmSc**.

La página del visor se aisló con `overflow-x: hidden` y el único desplazamiento horizontal quedó en `.bb-scroll` (`width/max-width: 100%`, `overflow-x: auto`, `overflow-y: hidden`). La tabla usa `table-layout: fixed`, un ancho mínimo de 760 px en móvil y 860 px desde 640 px, y una primera columna fija. No se oculta ninguna estadística: en Android se consulta la tabla dentro de su panel sin mover el resto de la interfaz.

Limitación: el entorno de ejecución no dispone de navegador/Chromium, por lo que no se pudo capturar un screenshot real a 360 px. Se validaron el HTML renderizado, el mapeo de cada columna y las reglas CSS que impiden el scroll de página; falta la comprobación visual final en un dispositivo físico.

## 5. Pruebas ejecutadas

| Comprobación | Resultado |
|---|---|
| `npx tsc --noEmit` | **PASS** (exit 0) |
| `npm run build` | **PASS** · `dist/index.html` 676,36 kB / 170,63 kB gzip |
| Auditoría `scripts/phase1-audit.ts` | **PASS** |
| Comparación exacta NBA.com vs base generada: 30 equipos, 522 jugadores, 0 discrepancias de nombre/equipo/altura/peso/edad/dorsal/two-way | PASS |
| Real: 30 equipos / 522 fichas (16–18) | PASS |
| 89 two-way / 433 estándar / límites 15+3 | PASS |
| Nombres reales únicos y sin colisión con ficción | PASS |
| Boxscore real: columnas suman totales de equipo | PASS |
| 10 participantes con minutos; DNP 8+8 sin duplicar | PASS |
| Play-by-play termina en el marcador final | PASS |
| Payload serializado (proxy de persistencia): 522 fichas, 89 two-way, 521 dorsales, DNP recalculables | PASS |
| Ficción sigue con 30 equipos / 360 jugadores / calendario 435 | PASS |
| Render smoke `scripts/render-check.tsx` | **PASS** · 23/23 comprobaciones |
| Presentación del boxscore `scripts/boxscore-presentation-check.tsx` | **PASS** · 30/30 comprobaciones de orden, mapeo, totales, porcentajes, DNP, separación por equipos y contención CSS |
| Cuadro compacto `scripts/team-comparison-check.tsx` | **PASS** · 20/20 comprobaciones de parciales, OT condicional, F, fórmulas avanzadas, valores no disponibles, orden de bloques y ancho móvil |
| Boxscore BBGM de una página: dos equipos, participantes, períodos, récord, avanzadas, columnas, totales, porcentajes, DNP y GmSc | PASS |
| Avanzadas eFG/TOV/ORB/FT-FGA en la misma página | PASS |
| Play-by-play y partido pendiente | PASS |
| Resultado sin boxscore con diagnóstico | PASS |
| Boxscore real: 20 participantes, 8 DNP, two-way | PASS |

**No ejecutado:** prueba End-to-End en navegador real ni recarga de IndexedDB. No se ejecutaron pruebas con lector de pantalla ni en un dispositivo Android físico. El entorno de ejecución no dispone de IndexedDB ni de Chromium/Playwright. Se validó la serialización del payload completo (equivalente lógico), no el ciclo real de recarga del navegador.

## 6. Limitaciones que no se declaran resueltas

1. Verificación oficial NBA.com de pertenencia: completada 30/30.
2. 265 fichas con nacionalidad pendiente; 1 sin universidad, 1 sin dorsal y 3 sin peso en la fuente oficial.
3. Varias franquicias tienen 14 contratos estándar y no se rellenan plazas sin jugador verificado.
4. Fase 2 pendiente: sustituciones, faltas eliminatorias y posesiones avanzadas.
5. No hay lesiones/suspensiones, +/- ni datos on/off, estado en directo, salarios ni migración de ligas antiguas. GmSc sí está implementado; BA no se registra.
6. No se ha probado la persistencia real tras cerrar y abrir el navegador.

## 7. Próximo paso

No iniciar la Fase 2 automáticamente. La pertenencia 2026-27 está verificada en NBA.com. Quedan como datos pendientes la nacionalidad, un dorsal y los términos salariales. Después, con autorización separada, abordar el motor de sustituciones y faltas de la Fase 2.
