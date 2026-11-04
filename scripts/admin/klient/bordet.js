// Redigeringsbordet. Startpunkt: hämtar verken, kopplar ihop rutnätet med arbetsytan
// och lyssnar efter ändringar på disken. Sidan finns bara när npm run dev körs.
import { T, api, pa, sand, meddela, lage, LAGEN } from "./gemensamt.js";
import { initRutnat, fokuseraSok, visaKort } from "./rutnat.js";
import { initHandling, oppna, stang, steg, spara, arSmutsig, oppetId } from "./handling.js";
import { initArende, vaxla } from "./arende.js";
import { initInkorg } from "./inkorg.js";
import { initKontroll } from "./kontroll.js";

const smal = matchMedia("(max-width: 900px)");
const FLIKAR = ["handling", "arende", "inkorg", "kontroll"];

async function hamta() {
  const d = await api("allt");
  T.verk = d.verk; T.arenden = d.arenden; T.inkorg = d.inkorg;
  T.byId = Object.fromEntries(d.verk.map((v) => [v.id, v]));
  sand("data");
}

// Ett verk har sparats av bordet självt. Uppdatera direkt, utan att vänta på disken.
pa("verk", (v) => {
  const i = T.verk.findIndex((x) => x.id === v.id);
  if (i >= 0) T.verk[i] = v; else T.verk.push(v);
  T.byId[v.id] = v;
  sand("data");
});
pa("hamta", (klar) => hamta().catch(() => {}).finally(() => klar?.()));

// ---------- flikar ----------
function visaFlik(f, { fokus } = {}) {
  if (!FLIKAR.includes(f)) f = "handling";
  T.flik = f;
  FLIKAR.forEach((x) => {
    const tab = document.getElementById("rb-tab-" + x), yta = document.getElementById("rb-flik-" + x);
    tab.setAttribute("aria-selected", String(x === f)); tab.tabIndex = x === f ? 0 : -1;
    yta.hidden = x !== f;
  });
  document.querySelectorAll(".rb-docka [data-flik]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.flik === f && document.body.classList.contains("rb-panel-oppen"))));
  history.replaceState(null, "", f === "handling" ? (oppetId() ? "#verk-" + oppetId() : location.pathname) : "#" + f);
  sand("urval");
  if (fokus) document.getElementById("rb-tab-" + f).focus();
}
pa("flik", (f) => { visaFlik(f); oppnaPanel(); });

const oppnaPanel = () => { if (smal.matches) { document.body.classList.add("rb-panel-oppen"); visaFlik(T.flik); } };
const stangPanel = () => { document.body.classList.remove("rb-panel-oppen"); visaFlik(T.flik); };

const tablist = document.querySelector(".rb-flikar");
tablist.addEventListener("click", (e) => { const b = e.target.closest("[data-flik]"); if (b) visaFlik(b.dataset.flik); });
tablist.addEventListener("keydown", (e) => {
  const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
  if (!d || !e.target.matches("[role=tab]")) return;
  e.preventDefault();
  visaFlik(FLIKAR[(FLIKAR.indexOf(T.flik) + d + FLIKAR.length) % FLIKAR.length], { fokus: true });
});
document.querySelectorAll(".rb-docka [data-flik]").forEach((b) => b.addEventListener("click", () => {
  if (document.body.classList.contains("rb-panel-oppen") && T.flik === b.dataset.flik) stangPanel();
  else { visaFlik(b.dataset.flik); oppnaPanel(); }
}));
document.getElementById("rb-stang-panel").addEventListener("click", stangPanel);

// ---------- rutnätet ----------
async function redigera(id) {
  if (T.flik !== "handling") visaFlik("handling");
  if (await oppna(id)) {
    oppnaPanel();
    if (!smal.matches) document.getElementById("rb-panel").scrollTop = 0;
  }
}
pa("klick", (id) => (T.flik === "arende" ? vaxla(id) : redigera(id)));
pa("redigera", (id) => { redigera(id); visaKort(id); });
pa("visa", (id) => visaKort(id));

const LAGENAMN = Object.fromEntries(LAGEN);
pa("lage", async (id, nytt) => {
  const v = T.byId[id];
  if (!v || lage(v) === nytt) return;
  const fore = { vikt: v.vikt, synlig: v.synlig };
  const andringar = nytt === "dold" ? { synlig: false } : { vikt: nytt, synlig: true };
  const skicka = async (a) => sand("verk", (await api("verk/" + encodeURIComponent(id), { metod: "PUT", data: { andringar: a } })).verk);
  try {
    await skicka(andringar);
    const iArende = T.arenden.filter((a) => a.omslag === id || a.rader.some((r) => r.includes(id)));
    const obs = nytt === "dold" && iArende.length ? ` Obs: verket ingår i ${iArende.map((a) => a.titel).join(", ")} och försvinner därifrån.` : "";
    meddela(`${v.titel}: ${LAGENAMN[nytt].toLowerCase()}.${obs}`, { angra: () => skicka(fore).catch((e) => meddela(e.message, { typ: "fel" })) });
  } catch (e) { meddela("Kunde inte ändra vikten. " + e.message, { typ: "fel" }); }
});

// ---------- tangenter ----------
const iFalt = (e) => /^(input|textarea|select)$/i.test(e.target.tagName) || e.target.isContentEditable;
addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    if (oppetId()) spara();
    return;
  }
  if (e.key === "Escape") {
    if (iFalt(e)) { e.target.blur(); return; }
    if (smal.matches && document.body.classList.contains("rb-panel-oppen")) { stangPanel(); return; }
    if (T.flik !== "handling") { visaFlik("handling"); return; }
    if (oppetId()) stang();
    return;
  }
  if (iFalt(e) || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === "/") { e.preventDefault(); fokuseraSok(); return; }
  if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && oppetId() && T.flik === "handling" && !e.target.closest("[role=radiogroup],[role=tablist]")) {
    e.preventDefault(); steg(e.key === "ArrowLeft" ? -1 : 1);
  }
});
addEventListener("beforeunload", (e) => { if (arSmutsig()) { e.preventDefault(); e.returnValue = ""; } });

// ---------- ändringar på disken ----------
const avbrott = document.getElementById("rb-avbrott");
function lyssna() {
  const es = new EventSource("/__bordet/handelser");
  let brutet = false;
  es.addEventListener("andrat", () => { hamta().then(() => sand("andrat")).catch(() => {}); });
  es.onopen = () => { if (brutet) { brutet = false; hamta().then(() => sand("andrat")).catch(() => {}); } avbrott.hidden = true; };
  es.onerror = () => { brutet = true; avbrott.hidden = false; };
}

// Menyradens höjd, så att arbetsytan kan stå kvar när rutnätet rullar.
const bar = document.querySelector(".rb-bar");
new ResizeObserver(() => document.documentElement.style.setProperty("--barh", bar.offsetHeight + "px")).observe(bar);

// ---------- start ----------
initRutnat(); initHandling(); initArende(); initInkorg(); initKontroll();
try {
  await hamta();
} catch (e) {
  avbrott.hidden = false;
  avbrott.textContent = "Bordet kunde inte läsa verken: " + e.message;
}
lyssna();
const h = decodeURIComponent(location.hash.slice(1));
if (h.startsWith("verk-") && T.byId[h.slice(5)]) { await oppna(h.slice(5), { tyst: true }); visaFlik("handling"); visaKort(h.slice(5)); }
else visaFlik(FLIKAR.includes(h) ? h : "handling");
