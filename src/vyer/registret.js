// Registret: samtliga handlingar på papper, ordnade efter år.
import { VERK, el, papper, huvud, tumnagel, arRunt, byId, when } from "../data.js";
import { oppna, oppen, stang } from "../visare.js";
import { EN, t, vag, avdelningNamn, epokNamn, jamfor } from "../sprak.js";

const ALLA = "Alla avdelningar";
const AVD = [ALLA, ...[...new Set(VERK.map((v) => v.avdelning))].sort((a, b) => jamfor(avdelningNamn(a), avdelningNamn(b)))];
const LAGE = [["alla", t("Allt")], ["stilla", t("Stilla")], ["rorligt", t("Rörligt")], ["absurdimo", "Absurdimo"]];
let avd = ALLA, lage = "alla", sok = "";

function urval() {
  const q = sok.trim().toLowerCase();
  return VERK.filter((v) => (avd === ALLA || v.avdelning === avd)
    && (lage === "alla" || (lage === "stilla" && v.typ === "foto") || (lage === "rorligt" && v.typ !== "foto") || (lage === "absurdimo" && v.kanal === "Absurdimo"))
    && (!q || sokbart(v).includes(q)))
    .sort((a, b) => ordning(a) - ordning(b) || a.id.localeCompare(b.id));
}
// Odaterat först, Absurdimo sist, så att varje rubrik bara förekommer en gång.
const ordning = (v) => v.ar ?? (v.kanal === "Absurdimo" && !v.datum ? 3001 : 3000);
const rubrik = (v) => (v.kanal === "Absurdimo" && !v.datum ? "Absurdimo" : arRunt(v) ?? t("Odaterat"));
// Sökningen träffar titeln, epoken, kanalen och datumet. På den engelska sidan också den svenska titeln och epoken.
const sokbart = (v) => (v.titel + " " + v.epok + " " + (v.kanal || "") + " " + (v.datum || "") + (EN ? ` ${v.sv} ${epokNamn(v.epok)}` : "")).toLowerCase();

export function render(app, oppnaId) {
  const p = papper(true);
  const nFoto = VERK.filter((v) => v.typ === "foto").length;
  p.append(huvud(t("Registret · Samtliga handlingar"), t("Registret")),
    el("p", { class: "lead" }, t("{n} handlingar, varav {foto} fotografier och {film} filmer. Ordnade efter år. Klicka för att öppna, bläddra med pilarna.", { n: VERK.length, foto: nFoto, film: VERK.length - nFoto })));
  const grid = el("div", { class: "grid" }), antal = el("span", { class: "small mono", role: "status" });
  const rita = () => {
    const l = urval(); grid.replaceChildren(); let senast = null;
    l.forEach((v, k) => {
      const r = rubrik(v);
      if (r !== senast) { grid.append(el("div", { class: "ar-grupp" }, String(r))); senast = r; }
      const b = el("button", { type: "button", "aria-label": `${v.titel}, ${when(v).toLowerCase()}${v.vikt === "hjälte" ? ", " + t("hjälte") : ""}${v.typ !== "foto" ? ", " + t("film") : ""}`, onclick: () => oppnaVerk(l, k) }, tumnagel(v));
      if (v.vikt === "hjälte") b.append(el("span", { class: "w", title: t("Hjälte") }, "★"));
      if (v.typ !== "foto") b.append(el("span", { class: "k" }, "▶"));
      grid.append(b);
    });
    if (!l.length) grid.append(el("p", { class: "tom" }, t("Inga handlingar matchar sökningen.")));
    antal.textContent = t("{n} st", { n: l.length });
  };
  const knappar = (namn, lista, nu, satt) => {
    const g = el("div", { class: "filters", role: "group", "aria-label": namn });
    lista.forEach(([k, t]) => g.append(el("button", { type: "button", "aria-pressed": k === nu() ? "true" : "false", onclick: (e) => {
      satt(k); g.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b === e.currentTarget ? "true" : "false")); rita(); } }, t)));
    return g;
  };
  const sokfalt = el("input", { type: "search", id: "reg-sok", placeholder: t("Sök titel, år, kanal …"), value: sok, "aria-label": t("Sök i registret") });
  sokfalt.addEventListener("input", () => { sok = sokfalt.value; rita(); });
  p.append(el("div", { class: "verktyg" },
    knappar(t("Slag"), LAGE, () => lage, (k) => (lage = k)),
    knappar(t("Avdelning"), AVD.map((a) => [a, a === ALLA ? t("Alla avdelningar") : avdelningNamn(a)]), () => avd, (k) => (avd = k)),
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
  oppna(lista, i, { onStep: (v) => history.replaceState(null, "", vag("verk", v.id)) });
}
