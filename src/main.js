// Verket för oväntade lösningar. Startpunkt och vägvisare.
import "./style.css";
import "./stil/meny.css";
import "./stil/granskning.css";
import { S, reduce } from "./data.js";
import * as ansokan from "./vyer/ansokan.js";
import * as registret from "./vyer/registret.js";
import * as arenden from "./vyer/arenden.js";
import { stang, oppen } from "./visare.js";
import { arPa, satt, klick } from "./ljud.js";

const app = document.getElementById("app");
document.getElementById("brand-namn").textContent = S.namn;
document.getElementById("brand-under").textContent = S.undertitel;
const fot = document.getElementById("fotnot"); fot.textContent = S.fotnot;

// Arkivrummet (3D) laddas först när någon går dit, så att resten av sajten är snabb.
let rummet = null;
const laddaRummet = () => (rummet ||= import("./vyer/arkivrummet.js"));

const VYER = new Set(["ansokan", "registret", "verk", "arenden", "arende", "bestallare", "arkivrummet", "foredragning", "beslut"]);
let sistaVy = null;
async function route() {
  let h = "ansokan";
  try { h = decodeURIComponent(location.hash.slice(1)) || "ansokan"; } catch (e) { /* trasig adress: ansökan */ }
  let [vy, ...rest] = h.split("-"), arg = rest.join("-");
  // En okänd adress visar ansökan, och adressen rättas så att menyn och sifferknapparna stämmer.
  if (!VYER.has(vy)) { vy = "ansokan"; arg = ""; history.replaceState(null, "", "#ansokan"); }
  if (oppen() && vy !== "verk") stang();
  const namn = vy === "verk" ? "registret" : vy === "arende" ? "arenden" : vy === "beslut" ? "ansokan" : vy;
  document.querySelectorAll(".nav a").forEach((a) => (a.dataset.r === namn ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  if (sistaVy === "arkivrummet" && vy !== "arkivrummet" && rummet) (await rummet).stoppa();
  app.classList.toggle("full", vy === "arkivrummet");
  fot.hidden = vy === "arkivrummet";
  // Registret visas redan: öppna verket i visaren utan att rita om sidan.
  if (vy === "verk" && sistaVy === "registret" && app.querySelector(".grid")) { registret.visaVerk(arg); return; }
  sistaVy = vy === "verk" ? "registret" : vy;
  let egen = null; // en vy kan ge sidan en egen titel, till exempel ärendets namn
  switch (vy) {
    case "registret": registret.render(app); break;
    case "verk": registret.render(app, arg); break;
    case "arenden": arenden.lista(app); break;
    case "arende": egen = arenden.arende(app, arg); break;
    case "bestallare": arenden.bestallare(app); break;
    case "arkivrummet": (await laddaRummet()).render(app); break;
    case "foredragning": (await import("./vyer/foredragning.js")).render(app, arg); break;
    case "beslut": egen = ansokan.delat(app, arg); break;
    default: ansokan.render(app);
  }
  document.title = egen ? `${egen} · ${S.namn}` : vy === "ansokan" ? S.namn : `${{ registret: "Registret", verk: "Registret", arenden: "Ärenden", arende: "Ärende", bestallare: "För beställare", arkivrummet: "Arkivrummet", foredragning: "Föredragningen", beslut: "Beslut" }[vy] || ""} · ${S.namn}`;
  if (vy !== "verk") window.scrollTo({ top: 0, behavior: "auto" });
}
addEventListener("hashchange", route);
// Hopplänken förbi menyn. Adressen rörs inte, eftersom den styr vilken vy som visas.
document.getElementById("hoppa").addEventListener("click", (e) => {
  e.preventDefault();
  const mal = app.querySelector("h1:not(.dold)") || app.querySelector("button:not([disabled]), a[href], input, [tabindex='0']") || app;
  if (mal.matches("h1") && !mal.hasAttribute("tabindex")) mal.tabIndex = -1;
  mal.focus();
});
route();

addEventListener("keydown", (e) => {
  if (oppen() || /input|textarea/i.test(document.activeElement?.tagName || "")) return;
  if (!location.hash || location.hash === "#ansokan") ansokan.tangent(e);
});

// Höjden på menyraden, så att Arkivrummet fyller resten av skärmen.
const bar = document.querySelector(".bar");
new ResizeObserver(() => document.documentElement.style.setProperty("--barh", bar.offsetHeight + "px")).observe(bar);

// Ljud av/på
const lb = document.getElementById("ljud");
const ritaLjud = () => { lb.setAttribute("aria-pressed", arPa() ? "true" : "false"); lb.textContent = arPa() ? "Ljud på" : "Ljud av"; };
lb.addEventListener("click", () => { satt(!arPa()); ritaLjud(); klick(); });
ritaLjud();

// Lampan följer handen, långsamt.
if (!reduce) {
  let tx = 50, ty = 20, x = 50, y = 20, igang = false;
  const r = document.documentElement.style;
  const loop = () => { x += (tx - x) * .06; y += (ty - y) * .06; r.setProperty("--lx", x + "%"); r.setProperty("--ly", y + "%"); if (Math.abs(tx - x) + Math.abs(ty - y) > .1) requestAnimationFrame(loop); else igang = false; };
  addEventListener("pointermove", (e) => { tx = (e.clientX / innerWidth) * 100; ty = (e.clientY / innerHeight) * 100; if (!igang) { igang = true; requestAnimationFrame(loop); } }, { passive: true });
}
