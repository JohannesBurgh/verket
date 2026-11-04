// Redigeringsbordet: ett verk i taget. Titel, datum, epok, avdelning, vikt, ton och text.
// Bara de fält som ändrats skickas till servern, tillsammans med vad de var innan.
import { T, el, api, DIMS, DIMNAMN, LAGEN, lage, miniatyr, meddela, anmarkningar, klocka, pa, sand } from "./gemensamt.js";
import { synligLista } from "./rutnat.js";

const FALT = ["titel", "datum", "datum_gissat", "epok", "avdelning", "kanal", "vikt", "synlig", "ton", "text"];
const NAMN = { titel: "titel", datum: "datum", datum_gissat: "uppskattat datum", epok: "epok", avdelning: "avdelning", kanal: "kanal", vikt: "vikt", synlig: "synlighet", ton: "ton", text: "text" };

let yta, id = null, bas = null, utkast = null, ref = {}, sparar = false, senastSparat = null;

const fran = (v) => ({
  titel: v.titel || "", datum: v.datum || "", datum_gissat: !!v.datum_gissat, epok: v.epok || "", avdelning: v.avdelning || "",
  kanal: v.kanal || "", vikt: v.vikt || "frö", synlig: v.synlig !== false, ton: { ...(v.ton || {}) }, text: v.text || "",
});
const tonNyckel = (t) => JSON.stringify(Object.entries(t || {}).filter(([, x]) => Number(x) > 0).map(([k, x]) => [k, Math.round(Number(x) * 100) / 100]).sort());
const lika = (k, a, b) => {
  if (k === "ton") return tonNyckel(a) === tonNyckel(b);
  if (typeof a === "boolean" || typeof b === "boolean") return !!a === !!b;
  return String(a ?? "").replace(/\r\n/g, "\n").trim() === String(b ?? "").replace(/\r\n/g, "\n").trim();
};
const smutsiga = () => (bas ? FALT.filter((k) => !lika(k, utkast[k], bas[k])) : []);
export const arSmutsig = () => smutsiga().length > 0;
export const oppetId = () => id;

export function initHandling() {
  yta = document.getElementById("rb-flik-handling");
  tom();
  pa("data", franServern);
}

function tom() {
  id = null; bas = utkast = null; ref = {};
  yta.replaceChildren(el("div", { class: "rb-tomt" },
    el("div", { class: "rb-huvud" }, el("div", { class: "org" }, "Verket för oväntade lösningar"), el("div", { class: "form" }, "Handling"), el("h2", {}, "Ingen handling vald")),
    el("p", {}, "Klicka på ett verk i rutnätet för att redigera titel, epok, avdelning, ton och text. Vikten ändras direkt med knapparna under varje verk."),
    el("p", {}, "Ändringarna skrivs till filen i content/verk/. Bara de rader som ändrats skrivs om. Resten av filen lämnas som den är."),
    el("dl", { class: "rb-tangenter" },
      el("dt", {}, "/"), el("dd", {}, "Sök bland verken"),
      el("dt", {}, "1 2 3 4"), el("dd", {}, "Hjälte, frö, damm, dold (på ett markerat verk)"),
      el("dt", {}, "← →"), el("dd", {}, "Föregående och nästa verk"),
      el("dt", {}, "Ctrl S"), el("dd", {}, "Spara"),
      el("dt", {}, "Esc"), el("dd", {}, "Stäng handlingen"))));
}

export function stang() {
  if (arSmutsig() && !confirm("Det finns osparade ändringar. Stäng ändå och släng dem?")) return false;
  tom(); T.valt = null; sand("valt", null);
  history.replaceState(null, "", location.pathname);
  return true;
}

export async function oppna(nyttId, { tyst } = {}) {
  if (nyttId === id) return true;
  if (arSmutsig()) {
    const v = T.byId[id];
    if (!confirm(`Ändringarna i ”${v?.titel || id}” är inte sparade. Spara dem innan du går vidare?`)) return false;
    if (!(await spara())) return false;
  }
  const v = T.byId[nyttId];
  if (!v) return false;
  id = nyttId; bas = fran(v); utkast = fran(v); senastSparat = null;
  T.valt = id; sand("valt", id);
  bygg(v);
  if (!tyst) history.replaceState(null, "", "#verk-" + id);
  return true;
}

export function steg(d) {
  const l = synligLista();
  if (!l.length) return;
  const i = l.findIndex((v) => v.id === id);
  const n = l[(i < 0 ? 0 : i + d + l.length) % l.length];
  oppna(n.id).then((ok) => ok && sand("visa", n.id));
}

// ---------- formuläret ----------
const datalista = (dlid, falt) => el("datalist", { id: dlid },
  [...new Set(T.verk.map((v) => v[falt]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "sv")).map((x) => el("option", { value: x })));

function falt(k, etikett, attrs = {}, hjalp) {
  const i = el("input", { id: "rb-f-" + k, name: k, value: utkast[k], autocomplete: "off", spellcheck: k === "titel" ? "true" : "false", ...attrs });
  i.addEventListener("input", () => { utkast[k] = i.value; andrat(); });
  ref[k] = i;
  return el("div", { class: "rb-falt" }, el("label", { for: i.id }, etikett), i, hjalp ? el("small", {}, hjalp) : null);
}

function bygg(v) {
  ref = {};
  const l = synligLista(), plats = l.findIndex((x) => x.id === v.id);
  const iArenden = T.arenden.filter((a) => a.omslag === v.id || a.rader.some((r) => r.includes(v.id)));

  const rubrik = el("h2", { id: "rb-handling-titel" }, v.titel);
  ref.rubrik = rubrik;
  const figur = el("figure", { class: "rb-stor" + (v.bild ? "" : " yt") }, miniatyr(v, true));
  if (v.video) {
    const film = el("video", { src: v.video, controls: true, preload: "none", poster: v.bild || undefined, playsinline: true });
    figur.replaceChildren(film);
  }

  const fakta = el("dl", { class: "rb-fakta" },
    el("dt", {}, "Fil"), el("dd", {}, `content/verk/${v.fil}`),
    el("dt", {}, "Typ"), el("dd", {}, v.typ + (v.youtube ? ` · ${v.youtube}` : "") + (v.format ? ` · format ${v.format}` : "")),
    v.bild ? [el("dt", {}, "Bild"), el("dd", {}, v.bild.replace(/^\/media\//, ""))] : null,
    v.original ? [el("dt", {}, "Original"), el("dd", {}, v.original)] : null,
    v.dom ? [el("dt", {}, "Domen"), el("dd", {}, `${v.dom} (sorteringsbordet, oktober 2026)`)] : null,
    el("dt", {}, "Ärenden"), el("dd", {}, iArenden.length ? iArenden.map((a) => a.titel + (a.omslag === v.id ? " (omslag)" : "")).join(", ") : "Ingår inte i något ärende"));

  // Vikten: fyra lägen, som under rutnätet. Här ingår den i formuläret och sparas med resten.
  const viktgrupp = el("div", { class: "rb-segment", role: "radiogroup", "aria-labelledby": "rb-vikt-etikett" },
    LAGEN.map(([k, t]) => {
      const b = el("button", { type: "button", role: "radio", "data-lage": k, onclick: () => {
        if (k === "dold") utkast.synlig = false; else { utkast.vikt = k; utkast.synlig = true; }
        andrat();
      } }, t);
      return b;
    }));
  viktgrupp.addEventListener("keydown", (e) => {
    const knappar = [...viktgrupp.children], i = knappar.indexOf(document.activeElement);
    const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (i < 0 || !d) return;
    e.preventDefault(); e.stopPropagation();
    const n = knappar[(i + d + knappar.length) % knappar.length]; n.click(); n.focus();
  });
  ref.vikt = viktgrupp;

  const reglage = el("div", { class: "rb-ton" }, DIMS.map((d) => {
    const ut = el("output", { for: "rb-ton-" + d });
    const r = el("input", { type: "range", id: "rb-ton-" + d, min: 0, max: 1, step: 0.1, value: utkast.ton[d] || 0 });
    const visa = () => { const x = Number(r.value); ut.textContent = x ? x.toFixed(1) : "–"; r.style.setProperty("--v", x * 100 + "%"); };
    r.addEventListener("input", () => { const x = Math.round(Number(r.value) * 10) / 10; if (x) utkast.ton[d] = x; else delete utkast.ton[d]; visa(); andrat(); });
    visa();
    ref["ton-" + d] = { r, visa };
    return el("div", { class: "rb-reglage" }, el("label", { for: r.id }, DIMNAMN[d]), r, ut);
  }));
  const okandaToner = Object.keys(utkast.ton).filter((k) => !DIMS.includes(k));

  const text = el("textarea", { id: "rb-f-text", name: "text", rows: 5, value: utkast.text, spellcheck: "true" });
  text.addEventListener("input", () => { utkast.text = text.value; andrat(); });
  ref.text = text;
  const gissat = el("input", { type: "checkbox", id: "rb-f-gissat", checked: utkast.datum_gissat });
  gissat.addEventListener("change", () => { utkast.datum_gissat = gissat.checked; andrat(); });
  ref.datum_gissat = gissat;

  const anm = el("ul", { class: "rb-anm", "aria-live": "polite" });
  const krock = el("p", { class: "rb-krock", role: "alert", hidden: true });
  const status = el("span", { class: "rb-status", "aria-live": "polite" });
  const sparaKnapp = el("button", { type: "submit", class: "rb-btn" }, "Spara");
  const angraKnapp = el("button", { type: "button", class: "rb-btn ghost", onclick: angra }, "Ångra ändringar");
  Object.assign(ref, { anm, krock, status, sparaKnapp, angraKnapp });

  const form = el("form", { class: "rb-form", novalidate: true, onsubmit: (e) => { e.preventDefault(); spara(); } },
    falt("titel", "Titel", { required: true }),
    el("div", { class: "rb-par" },
      falt("datum", "Datum", { placeholder: "ÅÅÅÅ-MM-DD", inputmode: "numeric", pattern: "\\d{4}(-\\d{2}){0,2}" }, "ÅÅÅÅ, ÅÅÅÅ-MM eller ÅÅÅÅ-MM-DD"),
      el("label", { class: "rb-kryss", for: "rb-f-gissat" }, gissat, " Uppskattat")),
    el("div", { class: "rb-par" },
      falt("epok", "Epok", { list: "rb-epoker" }, "Beslutet bifogar aldrig två ur samma epok."),
      falt("avdelning", "Avdelning", { list: "rb-avdelningar" })),
    v.typ === "youtube" ? falt("kanal", "Kanal", { list: "rb-kanaler" }) : null,
    el("div", { class: "rb-falt" }, el("span", { class: "rb-etikett", id: "rb-vikt-etikett" }, "Vikt"), viktgrupp,
      el("small", {}, "Hjälte lyfts fram. Damm bifogas aldrig i beslut. Dold finns kvar i filen men visas inte.")),
    el("fieldset", { class: "rb-falt" }, el("legend", { class: "rb-etikett" }, "Ton"), reglage,
      okandaToner.length ? el("small", {}, `Okända tondimensioner behålls som de är: ${okandaToner.join(", ")}.`) : el("small", {}, "Styr vilka svar i ansökan som leder till verket. Noll betyder att dimensionen inte anges.")),
    el("div", { class: "rb-falt" }, el("label", { for: "rb-f-text" }, "Text"), text,
      el("small", {}, "Visas under verket. Torr registerprosa. Det som inte syns i bilden skrivs inte.")),
    anm, krock,
    el("div", { class: "rb-sparrad" }, status, angraKnapp, sparaKnapp),
    datalista("rb-epoker", "epok"), datalista("rb-avdelningar", "avdelning"), datalista("rb-kanaler", "kanal"));

  yta.replaceChildren(el("article", { class: "rb-handling" },
    el("div", { class: "rb-huvud" },
      el("div", { class: "org" }, "Handling"),
      el("div", { class: "form" }, plats >= 0 ? `${plats + 1} av ${l.length}` : "Utanför filtret"),
      rubrik),
    el("div", { class: "rb-stegrad" },
      el("button", { type: "button", class: "rb-lank", onclick: () => steg(-1) }, "← Föregående"),
      v.synlig ? el("a", { class: "rb-lank", href: "/#verk-" + v.id, target: "_blank", rel: "noopener" }, "Visa på sajten ↗") : el("span", { class: "rb-mork" }, "Dold på sajten"),
      el("button", { type: "button", class: "rb-lank", onclick: () => steg(1) }, "Nästa →")),
    figur, fakta, form));
  andrat();
}

// Visar vad som ändrats, anmärkningar och knapparnas läge.
function andrat() {
  if (!ref.status) return;
  const s = smutsiga();
  ref.rubrik.textContent = utkast.titel || "(utan titel)";
  ref.vikt.querySelectorAll("[data-lage]").forEach((b) => {
    const pa_ = b.dataset.lage === (utkast.synlig ? utkast.vikt : "dold");
    b.setAttribute("aria-checked", String(pa_)); b.tabIndex = pa_ ? 0 : -1;
  });
  for (const k of ["titel", "datum", "epok", "avdelning", "kanal", "text"]) ref[k]?.classList.toggle("andrad", s.includes(k));
  ref.vikt.classList.toggle("andrad", s.includes("vikt") || s.includes("synlig"));
  DIMS.forEach((d) => ref["ton-" + d]?.r.parentElement.classList.toggle("andrad", Number(utkast.ton[d] || 0) !== Number(bas.ton[d] || 0)));
  const a = [...new Set([...anmarkningar(utkast.titel).map((x) => "Titeln: " + x), ...anmarkningar(utkast.text).map((x) => "Texten: " + x)])];
  if (utkast.datum && !/^\d{4}(-\d{2}){0,2}$/.test(utkast.datum.trim())) a.unshift("Datum skrivs ÅÅÅÅ, ÅÅÅÅ-MM eller ÅÅÅÅ-MM-DD.");
  if (!utkast.titel.trim()) a.unshift("Titeln får inte vara tom.");
  ref.anm.replaceChildren(...a.map((x) => el("li", {}, x)));
  ref.status.textContent = sparar ? "Sparar …" : s.length ? `Ändrat: ${s.filter((k) => k !== "synlig" || !s.includes("vikt")).map((k) => NAMN[k]).join(", ")}` : senastSparat ? `Sparat ${senastSparat}` : "Inga ändringar";
  ref.status.classList.toggle("smutsig", s.length > 0);
  ref.sparaKnapp.disabled = sparar || !s.length;
  ref.angraKnapp.disabled = sparar || !s.length;
  document.body.classList.toggle("rb-osparat", s.length > 0);
}

function angra() {
  utkast = { ...bas, ton: { ...bas.ton } };
  ref.krock.hidden = true;
  satt();
  andrat();
}

// Skriver utkastet till fälten (används efter ångra och när filen ändrats på disken).
function satt(bara) {
  for (const k of ["titel", "datum", "epok", "avdelning", "kanal", "text"]) if (ref[k] && (!bara || bara.includes(k))) ref[k].value = utkast[k];
  if (ref.datum_gissat && (!bara || bara.includes("datum_gissat"))) ref.datum_gissat.checked = utkast.datum_gissat;
  if (!bara || bara.includes("ton")) DIMS.forEach((d) => { const x = ref["ton-" + d]; if (x) { x.r.value = utkast.ton[d] || 0; x.visa(); } });
}

export async function spara() {
  if (!id || sparar) return false;
  const s = smutsiga();
  if (!s.length) return true;
  if (!utkast.titel.trim()) { meddela("Titeln får inte vara tom.", { typ: "fel" }); ref.titel?.focus(); return false; }
  if (utkast.datum && !/^\d{4}(-\d{2}){0,2}$/.test(utkast.datum.trim())) { meddela("Datum skrivs ÅÅÅÅ, ÅÅÅÅ-MM eller ÅÅÅÅ-MM-DD.", { typ: "fel" }); ref.datum?.focus(); return false; }
  const andringar = {}, fore = {};
  s.forEach((k) => { andringar[k] = utkast[k]; fore[k] = bas[k]; });
  const sparatId = id;
  sparar = true; andrat();
  try {
    const r = await api("verk/" + encodeURIComponent(sparatId), { metod: "PUT", data: { andringar, bas: fore } });
    sand("verk", r.verk);
    if (id === sparatId) { bas = fran(r.verk); senastSparat = klocka(); ref.krock.hidden = true; }
    meddela(r.andrade.length ? `Sparat: ${r.verk.titel}. ${r.andrade.length === 1 ? "Ett fält" : r.andrade.length + " fält"} skrevs om.` : `Inget behövde skrivas om i ${r.verk.titel}.`);
    return true;
  } catch (e) {
    if (e.status === 409 && e.svar?.verk) {
      sand("verk", e.svar.verk);
      visaKrock(e.svar.krock || []);
    } else meddela("Kunde inte spara. " + e.message, { typ: "fel" });
    return false;
  } finally {
    sparar = false; andrat();
  }
}

function visaKrock(falt) {
  if (!ref.krock) return;
  ref.krock.hidden = false;
  ref.krock.textContent = `Filen har ändrats utanför bordet medan du redigerade (${falt.map((k) => NAMN[k] || k).join(", ")}). Dina ändringar finns kvar här. Spara igen för att skriva över, eller ångra för att ta filens version.`;
}

// Nya uppgifter från servern. Fält som Johan inte rört följer med filen, de han ändrat behålls.
function franServern() {
  if (!id) return;
  const v = T.byId[id];
  if (!v) { tom(); meddela("Verket som var öppet finns inte längre i content/verk/.", { typ: "fel" }); return; }
  const ny = fran(v), andrade = [], krockar = [];
  for (const k of FALT) {
    if (lika(k, ny[k], bas[k])) continue;
    if (lika(k, utkast[k], bas[k])) { utkast[k] = k === "ton" ? { ...ny.ton } : ny[k]; andrade.push(k); }
    else if (!lika(k, utkast[k], ny[k])) krockar.push(k);
  }
  bas = ny;
  if (andrade.length) satt(andrade);
  if (krockar.length) visaKrock(krockar);
  andrat();
}
