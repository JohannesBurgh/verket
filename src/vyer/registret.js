// Registret: samtliga handlingar på papper, ordnade efter år.
import { VERK, el, papper, huvud, tumnagel, arRunt, byId, when } from "../data.js";
import { oppna, oppen, stang } from "../visare.js";

const AVD = ["Alla avdelningar", ...[...new Set(VERK.map((v) => v.avdelning))].sort((a, b) => a.localeCompare(b, "sv"))];
const LAGE = [["alla", "Allt"], ["stilla", "Stilla"], ["rorligt", "Rörligt"], ["absurdimo", "Absurdimo"]];
let avd = "Alla avdelningar", lage = "alla", sok = "";

function urval() {
  const q = sok.trim().toLowerCase();
  return VERK.filter((v) => (avd === "Alla avdelningar" || v.avdelning === avd)
    && (lage === "alla" || (lage === "stilla" && v.typ === "foto") || (lage === "rorligt" && v.typ !== "foto") || (lage === "absurdimo" && v.kanal === "Absurdimo"))
    && (!q || (v.titel + " " + v.epok + " " + (v.kanal || "") + " " + (v.datum || "")).toLowerCase().includes(q)))
    .sort((a, b) => ordning(a) - ordning(b) || a.id.localeCompare(b.id));
}
// Odaterat först, Absurdimo sist, så att varje rubrik bara förekommer en gång.
const ordning = (v) => v.ar ?? (v.kanal === "Absurdimo" && !v.datum ? 3001 : 3000);
const rubrik = (v) => (v.kanal === "Absurdimo" && !v.datum ? "Absurdimo" : arRunt(v) ?? "Odaterat");

export function render(app, oppnaId) {
  const p = papper(true);
  const nFoto = VERK.filter((v) => v.typ === "foto").length;
  p.append(huvud("Registret · Samtliga handlingar", "Registret"),
    el("p", { class: "lead" }, `${VERK.length} handlingar, varav ${nFoto} fotografier och ${VERK.length - nFoto} filmer. Ordnade efter år. Klicka för att öppna, bläddra med pilarna.`));
  const grid = el("div", { class: "grid" }), antal = el("span", { class: "small mono", role: "status" });
  const rita = () => {
    const l = urval(); grid.replaceChildren(); let senast = null;
    l.forEach((v, k) => {
      const r = rubrik(v);
      if (r !== senast) { grid.append(el("div", { class: "ar-grupp" }, String(r))); senast = r; }
      const b = el("button", { type: "button", "aria-label": `${v.titel}, ${when(v).toLowerCase()}${v.vikt === "hjälte" ? ", hjälte" : ""}${v.typ !== "foto" ? ", film" : ""}`, onclick: () => oppnaVerk(l, k) }, tumnagel(v));
      if (v.vikt === "hjälte") b.append(el("span", { class: "w", title: "Hjälte" }, "★"));
      if (v.typ !== "foto") b.append(el("span", { class: "k" }, "▶"));
      grid.append(b);
    });
    if (!l.length) grid.append(el("p", { class: "tom" }, "Inga handlingar matchar sökningen."));
    antal.textContent = `${l.length} st`;
  };
  const knappar = (namn, lista, nu, satt) => {
    const g = el("div", { class: "filters", role: "group", "aria-label": namn });
    lista.forEach(([k, t]) => g.append(el("button", { type: "button", "aria-pressed": k === nu() ? "true" : "false", onclick: (e) => {
      satt(k); g.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b === e.currentTarget ? "true" : "false")); rita(); } }, t)));
    return g;
  };
  const sokfalt = el("input", { type: "search", id: "reg-sok", placeholder: "Sök titel, år, kanal …", value: sok, "aria-label": "Sök i registret" });
  sokfalt.addEventListener("input", () => { sok = sokfalt.value; rita(); });
  p.append(el("div", { class: "verktyg" },
    knappar("Slag", LAGE, () => lage, (k) => (lage = k)),
    knappar("Avdelning", AVD.map((a) => [a, a]), () => avd, (k) => (avd = k)),
    el("label", { class: "sok" }, sokfalt, antal)), grid);
  app.replaceChildren(p);
  rita();
  if (oppnaId) visaVerk(oppnaId);
}
// Öppnar ett verk i visaren, i Registrets ordning. Används också när en adress #verk-… klistras in
// medan Registret redan visas. Står verket utanför filtret bläddrar visaren i hela registret.
export function visaVerk(id) {
  const v = byId[id];
  // Ett okänt eller dolt verk: stäng visaren och stå kvar i Registret.
  if (!v) { if (oppen()) stang(); history.replaceState(null, "", "#registret"); return false; }
  const l = urval(), lista = l.includes(v) ? l : VERK.slice().sort((a, b) => ordning(a) - ordning(b) || a.id.localeCompare(b.id));
  oppnaVerk(lista, lista.indexOf(v));
  return true;
}
function oppnaVerk(lista, i) {
  oppna(lista, i, { onStep: (v) => history.replaceState(null, "", "#verk-" + v.id) });
}
