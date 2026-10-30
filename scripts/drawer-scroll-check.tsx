import fs from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createLeagueBundle } from "../src/game/generate";
import { PlayerDrawer, TeamDrawer } from "../src/components/details";

const bundle = createLeagueBundle({ name: "Scroll", mode: "fictional", playMode: "manager", theme: "tinta", userTeamId: "nyk", seed: "DRAWER-SCROLL" });
const team = bundle.teams.find((item) => item.id === bundle.league.userTeamId)!;
const player = bundle.players.find((item) => item.teamId === team.id)!;
const html = renderToStaticMarkup(<PlayerDrawer player={player} team={team} onClose={() => undefined} />);
const teamHtml = renderToStaticMarkup(<TeamDrawer team={team} players={bundle.players.filter((item) => item.teamId === team.id)} onClose={() => undefined} onSelectPlayer={() => undefined} record="0–0" />);
const css = fs.readFileSync("src/index.css", "utf8");

let failures = 0;
function check(label: string, condition: boolean, detail = ""): void {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}${detail ? ` · ${detail}` : ""}`);
  if (!condition) failures++;
}
function rule(selector: string): string {
  const match = new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`, "s").exec(css);
  return match?.[1] ?? "";
}

const drawerScroll = rule(".drawer-scroll");
const drawer = rule(".drawer");
const backdrop = rule(".drawer-backdrop");
const modal = rule(".modal");

check("El perfil de jugador renderiza el contenedor de scroll", html.includes('class="drawer-scroll" data-scroll-container="drawer"'));
check("La ficha de equipo también es desplazable", teamHtml.includes('class="drawer-scroll" data-scroll-container="drawer"'));
check("Todo el contenido de atributos está dentro del contenedor scrollable", /class="drawer-scroll"[^>]*>[\s\S]*Atributos individuales[\s\S]*Biografía[\s\S]*<\/div><\/aside>/.test(html));
check("El cajón tiene altura dinámica Android", /height:\s*100dvh/.test(drawer) && /max-height:\s*100dvh/.test(drawer) && /overflow:\s*hidden/.test(drawer));
check("El scroll vertical vive en .drawer-scroll", /flex:\s*1 1 0%/.test(drawerScroll) && /min-height:\s*0/.test(drawerScroll) && /overflow-y:\s*auto/.test(drawerScroll) && /overflow-x:\s*hidden/.test(drawerScroll));
check("Gestos táctiles verticales permitidos", /touch-action:\s*pan-y/.test(drawerScroll) && /-webkit-overflow-scrolling:\s*touch/.test(drawerScroll) && /overscroll-behavior-y:\s*contain/.test(drawerScroll));
check("El backdrop no bloquea el gesto dentro del cajón", !/touch-action:\s*none/.test(backdrop));
check("El modal mantiene su propio scroll táctil", /overflow-y:\s*auto/.test(modal) && /touch-action:\s*pan-y/.test(modal) && /100dvh/.test(modal));
check("El cajón no usa el antiguo overflow-y directo", !/^\.drawer\s*\{[^}]*overflow-y:\s*auto/s.test(css));
check("Safe area inferior respetada", /env\(safe-area-inset-bottom\)/.test(drawerScroll));
check("No hay contenedores intermedios con overflow oculto sobre la ficha", !/\.drawer-scroll[^}]*overflow:\s*hidden/.test(drawerScroll));

const source = fs.readFileSync("src/components/ui.tsx", "utf8");
check("El hook de overlay usa un contador y no desbloquea al abrir fichas anidadas", /overlayLocks/.test(source) && /overlayLocks === 0/.test(source));
check("El bloqueo solo afecta a overflow, no a touch-action global", !/touchAction\s*=\s*["']none/.test(source) && !/body\.style\.touchAction/.test(source));
check("Los overlays se montan en un portal fuera de contenedores animados", /createPortal/.test(source) && /createPortal\(children, document\.body\)/.test(source));
check("El encabezado del perfil no usa backdrop-filter", !/backdrop-blur/.test(html) && /\.drawer-header\s*\{[^}]*background:\s*var\(--bg\)/s.test(css));
check("Cada ficha se abre con el scroll arriba", /scrollRef/.test(source) && /scrollTo\(\{ top: 0 \}\)/.test(source));

console.log(`\nDRAWER SCROLL: ${failures === 0 ? "PASS" : `${failures} FALLOS`}`);
console.log("Nota: verificación de DOM y CSS; el entorno no dispone de navegador para emular un gesto táctil Android real.");
process.exitCode = failures === 0 ? 0 : 1;
