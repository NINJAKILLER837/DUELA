> **Actualización posterior:** el boxscore BBGM y las plantillas NBA Real 2026-27 se documentan en [`docs/BOXSCORE_ROSTERS_2026.md`](BOXSCORE_ROSTERS_2026.md). Los recuentos reales de 270 fichas / 9 por equipo de este informe describen la base histórica y han sido sustituidos para ligas nuevas por 522 fichas (corte 28/10/2026, plantillas oficiales NBA.com).

# DUELA — Informe de implementación · Fase 1

Fecha de cierre de esta revisión: 2026. Alcance ejecutado: exclusivamente la Fase 1 autorizada.

## 1. Alcance implementado

- **Dos modos de liga independientes:** NBA Real y NBA Ficticia, con IDs de liga, equipo y jugador separados.
- **Modo Manager y Modo Espectador**, activables y desactivables por liga desde *Ajustes de liga*. El cambio se guarda sin borrar progreso.
- **30 franquicias NBA** en ambos modos, agrupadas en Este/Oeste y con división, fundación, arena, palmarés e historia.
- **NBA Ficticia:** semilla reproducible, 12 jugadores por club, **360 jugadores** con nombres y biografías propios. Ningún nombre generado puede coincidir con una ficha real del simulador.
- **NBA Real:** 30 clubes con **270 fichas reales de referencia** (9 por club) procedentes de una base de continuidad 2025-26. **No se declara ninguna plantilla completa ni verificada para 2026-27**.
- **Atributos individuales (0–100):** fuerza, velocidad, salto, resistencia, juego interior, finalización, tiros libres, media distancia, triple, IQ ofensivo, IQ defensivo, manejo, pase, rebote, defensa exterior y defensa interior.
- **OVR ponderado por posición** y **POT estimado**. La escala es exigente; el POT no se presenta como predicción estadística avanzada.
- **Calendario regular abreviado:** 29 jornadas, 435 partidos, 29 partidos por equipo, una sola vuelta todos contra todos.
- **Motor inicial de partidos:** 100 posesiones por equipo, resolución con atributos del tirador, defensor, reboteadores y creadores. Produce marcador, cuartos, minutos, PTS, REB, AST, ROB, TAP, pérdidas, faltas, TC/3P/TL y play-by-play desde la misma resolución.
- **Editor de rotación** (Manager): orden, minutos y filosofía de tiro. En Espectador la rotación la mantiene la IA.
- **Exhibición antes de crear liga:** real vs real (p. ej. NYK vs LAL), ficticio vs ficticio, ficticio vs real y uso de equipos de ligas guardadas como fuente. No modifica ninguna liga.
- **IndexedDB:** creación, apertura, guardado y carga; partidos y resultados se escriben de forma transaccional. Migraciones aditivas y sin borrado automático.
- **Interfaz monocroma ajustable:** Tinta, Grafito, Papel y Contraste. El tema se guarda por liga y como preferencia general.
- **Auditoría local integrada** en *Datos y fuentes*, más una auditoría CLI.

## 2. Estructura

```text
src/
  types.ts                 Modelos de liga, equipo, jugador, partido, box score
  data/franchises.ts       Las 30 franquicias + procedencia documentada
  data/realRosters.ts      Base real parcial (270 fichas)
  data/names.ts            Culturas, nombres, ciudades y trayectorias ficticias
  game/random.ts           PRNG con semilla reproducible
  game/ratings.ts          Atributos, OVR ponderado y POT
  game/generate.ts         Generación y validación de ligas
  game/schedule.ts         Round-robin de 29 jornadas / 435 partidos
  game/simulate.ts         Motor único de partidos y play-by-play
  game/selectors.ts        Clasificación, récords y agregados
  game/audit.ts            Validaciones de aceptación
  persistence/db.ts        IndexedDB v1 y migraciones aditivas
  components/              UI, fichas, tablas adaptables y modal de resultado
  screens/                 Hub, creación, exhibición y espacio de liga
scripts/                   Auditoría y smoke de render
ROADMAP.md                 Fases 2–7 (no implementadas)
```

## 3. Estructura de las dos ligas

| Dato | NBA Real | NBA Ficticia |
| --- | --- | --- |
| Franquicias | 30 (15 Este / 15 Oeste) | 30 (15 Este / 15 Oeste) |
| Jugadores por equipo | 9 fichas base | 12 |
| Total de jugadores | 270 | 360 |
| Nombres | Jugadores reales de referencia | Generados, únicos y sin copiar nombres reales |
| Historia de club | Real | Real como base + historia deportiva alternativa |
| Semilla | `nba-real-base-2025-26` | Editable por el usuario |
| Estado del dato | Parcial y documentado | Generado/verificado internamente |

## 4. Estado de los rosters reales

- Equipos cargados: **30/30**.
- Fichas reales cargadas: **270** (9 por equipo).
- Plantillas completas y verificadas para 2026-27: **0/30**.
- Motivo: la fecha objetivo es 2026-27 y no se ha completado una verificación oficial de los 15 jugadores por franquicia, los movimientos del verano de 2026, los contratos garantizados/no garantizados, los acuerdos de dos vías, los dorsales y las edades exactas.
- No se rellenan huecos con jugadores inventados, contratos ficticios, estadísticas inventadas ni datos personales.
- Además, la aplicación no muestra dorsales, contratos ni estadísticas iniciales reales cuando no están verificados. Los campos pendientes también aparecen en *Datos y fuentes*.

Fuentes usadas y enlazadas en la aplicación: NBA.com (rosters 2025-26 y directorio de equipos), NBA Communications (nacionalidades 2025-26), Basketball Reference (consulta de plantillas) y ESPN (contexto de offseason). La verificación oficial NBA.com de pertenencia 2026-27 se completó después y se documenta en `docs/BOXSCORE_ROSTERS_2026.md`.

## 4-bis. Visor de boxscore y navegación Android (corrección posterior)

Se sustituyó el antiguo resultado en modal por una **pantalla de partido completa** para evitar problemas de acceso en Android:

- El boxscore es la **pestaña predeterminada** y muestra a los dos equipos a la vez, con selector «Ambos / visitante / local».
- Cada jugador muestra MIN, PTS, REB, AST, ROB, TAP, PER, FC, TC, 3P y TL sin scroll horizontal en móvil.
- Se conservan las pestañas Cuartos y Jugadas, además de una barra inferior fija con «Volver a partidos».
- Se puede abrir desde el resumen, el calendario, la lista de partidos, la rotación de resultados y la exhibición.
- «Ver boxscore» es ahora un **botón/etiqueta visible** en cada resultado; no depende de tocar una tarjeta sin pistas.
- Los partidos pendientes también se abren: su ficha ofrece «Simular este partido» y, al terminar, muestra el boxscore.
- Si un resultado final no tuviera boxscore, se muestra un **estado de diagnóstico explícito** en lugar de una pantalla vacía.
- Navegación móvil reorganizada al estilo BBGM: barra inferior con Inicio, Equipos, Calendario, Partidos y Más; el menú «Más» agrupa plantilla, jugadores, clasificación, estadísticas, guardado, ajustes y datos.
- El visor bloquea el scroll del fondo, respeta la zona segura de Android y cierra con Escape.
- En modo Espectador, las listas de calendario y resultados muestran por defecto toda la liga.

## 5. Persistencia y compatibilidad

- Base `duela_gm_phase1`, versión de esquema de app `1`.
- Almacenes: `leagues`, `teams`, `players`, `games`, `settings`.
- Índices por `leagueId` y `teamId`.
- Una liga futura con esquema superior se rechaza con un error y **no se modifica**.
- No existe migración destructiva ni borrado automático. Tampoco hay botón de borrado en Fase 1.
- Los partidos simulados se guardan en una transacción; si falla la escritura, se muestra el error.

## 6. Pruebas ejecutadas

Comandos ejecutados (sin añadir dependencias):

```bash
npx tsc --noEmit
npm run build
npx esbuild scripts/phase1-audit.ts --bundle --platform=node --outfile=/tmp/phase1-audit.mjs --alias:@=./src --log-level=warning && node /tmp/phase1-audit.mjs
npx esbuild scripts/render-check.tsx --bundle --platform=node --jsx=automatic --outfile=/tmp/render-check.cjs --alias:@=./src --external:react --external:react-dom --external:react/jsx-runtime --log-level=warning && NODE_PATH=./node_modules node /tmp/render-check.cjs
```

Resultados reales:

- **TypeScript:** sin errores.
- **Build:** `vite build` correcto; `dist/index.html` generado (aprox. 536 kB, 148 kB gzip) e imagen de portada copiada a `dist/images/arena.jpg`.
- **Auditoría de datos/motor:** PASS final.
  - NBA Real: 30 equipos, 270 jugadores, 435 partidos, 10 simulaciones. Sin fallos, 1 advertencia: plantillas reales 2026-27 no verificadas.
  - NBA Ficticia: 30 equipos, 360 jugadores (12 por equipo), 435 partidos y 29 jornadas. Todos los checks PASS.
  - Reproducibilidad con la misma semilla: PASS (360 nombres).
  - Nombres ficticios copiados de la base real: 0.
  - Exhibición real vs ficticia: PASS (122–80 en la muestra final).
  - Rango de 40 marcadores ficticios (80 equipos): 71–132, media 106.5.
  - Coherencia: marcador = suma de cuartos = suma de puntos de jugadores, en 10 partidos por liga.
- **Smoke de render (SSR):** 21/21 comprobaciones renderizadas sin excepción, incluidas las nuevas:
  - pantalla de boxscore por defecto con ambos equipos y todos sus jugadores, sobre un partido serializado y deserializado como en IndexedDB;
  - pestaña Cuartos y pestaña Jugadas;
  - partido pendiente con acción de simular;
  - resultado final sin boxscore con estado de diagnóstico explícito.
  - El resto cubre Hub, creación, exhibición, shell de liga, resumen, equipos, plantilla, jugadores, calendario, clasificación, partidos, estadísticas, guardado, ajustes, datos y fichas de jugador/equipo.
- **Integridad del boxscore:** una jornada completa genera 15/15 boxscores con 10 jugadores por equipo, se conserva tras serialización JSON (equivalente a IndexedDB) y un partido ya jugado no vuelve a simularse al abrir su ficha.

No se ha ejecutado una prueba End-to-End en un navegador real ni una validación en un dispositivo Android físico. La persistencia IndexedDB está implementada y tipada, pero no se declara probada en navegador desde este entorno.

## 7. Errores y limitaciones conocidas

- **Rosters reales incompletos:** 9 de 15 plazas por club; la temporada 2026-27 no está verificada. Es la principal advertencia de la Fase 1.
- Algunas edades y envergaduras reales son estimadas y se marcan como tal. Las biografías reales ampliadas y las estadísticas iniciales no se muestran.
- El calendario es una liga regular abreviada (29 jornadas), no los 82 partidos.
- No se simulan playoffs, premios, lesiones, desarrollo, traspasos, contratos, draft, scouting, entrenadores, química ni envejecimiento.
- El motor usa posesiones simplificadas; no modela faltas eliminatorias, sustituciones en vivo ni todas las reglas NBA.
- La exhibición no se guarda como partido de una liga; está diseñada para no contaminar datos.
- No existe eliminación de ligas ni exportación/importación de partidas.
- La UI no se ha validado en navegador real desde este entorno; solo con comprobación de tipos, build y render SSR.

## 8. Próxima fase recomendada

Antes de la Fase 2, completar la verificación del universo real 2026-27 (o fijar explícitamente una fecha de corte y llamarlo base histórica). Después, iniciar la **Fase 2** autorizada por separado: motor de posesiones completo, play-by-play detallado, faltas y sustituciones realistas. No avanzar a Fase 3 automáticamente.
