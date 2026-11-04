// Redigeringsbordet: alla verk som rutnät, med verktygsrad och vikterna under varje verk.
import { T, el, LAGEN, lage, miniatyr, ar, pa, sand } from "./gemensamt.js";

const NYCKEL = "bordet-filter";
const F = Object.assign({ sok: "", lage: "alla", typ: "alla", avd: "", epok: "", ordning: "nummer" },
  (() => { try { return JSON.parse(sessionStorage.getItem(NYCKEL)) || {}; } catch (e) { return {}; } })());
const minns = () => { try { sessionStorage.setItem(NYCKEL, JSON.stringify(F)); } catch (e) { /* privat läge */ } };

let rutnat, verktyg, raknare, sammanfattning, sokfalt, epokval, avdval, lageknappar;

export function synligLista() {
  const q = F.sok.trim().toLowerCase();
  const l = T.verk.filter((v) =>
    (F.lage === "alla" || lage(v) === F.lage)
    && (F.typ === "alla" || (F.typ === "foto" && v.typ === "foto") || (F.typ === "rorligt" && v.typ !== "foto" && v.kanal !== "Absurdimo") || (F.typ === "absurdimo" && v.kanal === "Absurdimo"))
    && (!F.avd || v.avdelning === F.avd)
    && (!F.epok || v.epok === F.epok)
    && (!q || [v.titel, v.id, v.epok, v.avdelning, v.kanal, v.datum, v.text, v.original].join(" ").toLowerCase().includes(q)));
  const sv = (a, b) => String(a).localeCompare(String(b), "sv");
  const sortering = {
    nummer: (a, b) => sv(a.id, b.id),
    ar: (a, b) => (a.datum || "9999").localeCompare(b.datum || "9999") || sv(a.id, b.id),
    titel: (a, b) => sv(a.titel, b.titel),
    andrad: (a, b) => b.andrad - a.andrad,
  }[F.ordning];
  return l.sort(sortering);
}

const valjare = (etikett, alternativ, nu, satt) => {
  const s = el("select", { "aria-label": etikett, onchange: () => { satt(s.value); minns(); rita(); } });
  return fyll(s, alternativ, nu);
};
function fyll(s, alternativ, nu) {
  s.replaceChildren(...alternativ.map(([v, t]) => el("option", { value: v }, t)));
  s.value = nu;
  if (s.value !== nu) s.value = alternativ[0][0];
  return s;
}
const raknad = (falt) => {
  const n = {};
  T.verk.forEach((v) => v[falt] && (n[v[falt]] = (n[v[falt]] || 0) + 1));
  return Object.entries(n).sort((a, b) => a[0].localeCompare(b[0], "sv"));
};

export function initRutnat() {
  verktyg = document.getElementById("rb-verktyg");
  rutnat = document.getElementById("rb-rutnat");
  sokfalt = el("input", { type: "search", id: "rb-sok", placeholder: "Sök titel, epok, fil …", value: F.sok, "aria-label": "Sök bland verken", autocomplete: "off" });
  sokfalt.addEventListener("input", () => { F.sok = sokfalt.value; minns(); rita(); });
  lageknappar = el("div", { class: "rb-chips", role: "group", "aria-label": "Visa vikt" },
    [["alla", "Alla"], ...LAGEN].map(([k, t]) => el("button", { type: "button", "data-lage": k, "aria-pressed": String(F.lage === k), onclick: () => {
      F.lage = k; minns();
      lageknappar.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lage === k)));
      rita();
    } }, t, el("span", { class: "rb-n", "data-n": k }))));
  avdval = el("select", { "aria-label": "Avdelning", onchange: () => { F.avd = avdval.value; minns(); rita(); } });
  epokval = el("select", { "aria-label": "Epok", onchange: () => { F.epok = epokval.value; minns(); rita(); } });
  raknare = el("span", { class: "rb-antal", "aria-live": "polite" });
  sammanfattning = el("p", { class: "rb-summa" });
  verktyg.append(
    el("div", { class: "rb-verktyg" },
      el("label", { class: "rb-sok" }, el("span", { class: "rb-dold-text" }, "Sök"), sokfalt, el("kbd", { title: "Tryck / för att söka" }, "/")),
      lageknappar),
    el("div", { class: "rb-verktyg" },
      valjare("Typ", [["alla", "Alla typer"], ["foto", "Fotografier"], ["rorligt", "Rörligt"], ["absurdimo", "Absurdimo"]], F.typ, (v) => (F.typ = v)),
      avdval, epokval,
      valjare("Ordning", [["nummer", "Ordning: filnamn"], ["ar", "Ordning: år"], ["titel", "Ordning: titel"], ["andrad", "Ordning: senast ändrad"]], F.ordning, (v) => (F.ordning = v)),
      el("button", { type: "button", class: "rb-rensa", onclick: rensa }, "Rensa filter"),
      raknare),
    sammanfattning);

  // Tangenter på ett verk: 1 till 4 sätter vikten.
  rutnat.addEventListener("keydown", (e) => {
    const kort = e.target.closest?.(".rb-kort");
    if (!kort || e.metaKey || e.ctrlKey || e.altKey) return;
    const i = ["1", "2", "3", "4"].indexOf(e.key);
    if (i >= 0) { e.preventDefault(); sand("lage", kort.dataset.id, LAGEN[i][0]); }
  });
  pa("data", rita);
  pa("valt", markera);
  pa("urval", markera);
}

function rensa() {
  Object.assign(F, { sok: "", lage: "alla", typ: "alla", avd: "", epok: "" });
  sokfalt.value = "";
  verktyg.querySelectorAll("select")[0].value = "alla";
  lageknappar.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lage === "alla")));
  minns(); rita();
}

export const fokuseraSok = () => { sokfalt.focus(); sokfalt.select(); };

function kort(v) {
  const l = lage(v);
  const bild = el("button", { type: "button", class: "rb-bild", "aria-label": `${v.titel}. ${T.flik === "arende" ? "Lägg i ärendet" : "Redigera"}`,
    title: "Klicka för att redigera. Tangenterna 1 till 4 sätter vikten.", onclick: () => sand("klick", v.id) }, miniatyr(v));
  if (v.vikt === "hjälte" && v.synlig) bild.append(el("span", { class: "rb-stjarna", title: "Hjälte" }, "★"));
  if (v.typ !== "foto") bild.append(el("span", { class: "rb-typ" }, v.typ === "youtube" ? "YouTube" : "Film"));
  if (!v.synlig) bild.append(el("span", { class: "rb-stampel", "aria-hidden": "true" }, "Dold"));
  if (T.nya.has(v.id)) bild.append(el("span", { class: "rb-ny" }, "Ny"));
  if (v.trasig) bild.append(el("span", { class: "rb-stampel" }, "Trasig"));
  bild.append(el("span", { class: "rb-valnr", "aria-hidden": "true" }));
  const vikt = el("div", { class: "rb-vikt", role: "group", "aria-label": `Vikt för ${v.titel}` },
    LAGEN.map(([k, t], i) => el("button", { type: "button", "data-lage": k, "aria-pressed": String(l === k), title: `${t} (${i + 1})`,
      onclick: () => sand("lage", v.id, k) }, t)));
  return el("article", { class: "rb-kort", "data-id": v.id, "data-lage": l },
    bild,
    el("div", { class: "rb-info" }, el("b", {}, v.titel), el("small", {}, [v.epok, ar(v) && !String(v.epok).includes(ar(v)) ? ar(v) : null].filter(Boolean).join(" · ") || v.id)),
    vikt);
}

export function rita() {
  if (!rutnat) return;
  // Avdelningar och epoker följer innehållet.
  fyll(avdval, [["", "Alla avdelningar"], ...raknad("avdelning").map(([k, n]) => [k, `${k} (${n})`])], F.avd);
  fyll(epokval, [["", "Alla epoker"], ...raknad("epok").map(([k, n]) => [k, `${k} (${n})`])], F.epok);
  const n = { alla: T.verk.length }; T.verk.forEach((v) => (n[lage(v)] = (n[lage(v)] || 0) + 1));
  lageknappar.querySelectorAll("[data-n]").forEach((s) => (s.textContent = n[s.dataset.n] || 0));
  sammanfattning.textContent = `${T.verk.length} verk i content/verk/. ${n["hjälte"] || 0} hjältar, ${n["frö"] || 0} frön, ${n.damm || 0} damm och ${n.dold || 0} dolda.`;

  const fokus = document.activeElement?.closest?.(".rb-kort");
  const fokusId = fokus?.dataset.id, fokusLage = document.activeElement?.dataset?.lage;
  const l = synligLista();
  rutnat.replaceChildren(...l.map(kort));
  if (!l.length) rutnat.append(el("p", { class: "rb-tom" }, "Inga verk matchar filtret. ", el("button", { type: "button", class: "rb-lank", onclick: rensa }, "Rensa filtret")));
  raknare.textContent = l.length === T.verk.length ? `${l.length} verk` : `${l.length} av ${T.verk.length}`;
  markera();
  if (fokusId) {
    const k = rutnat.querySelector(`.rb-kort[data-id="${fokusId}"]`);
    (k?.querySelector(fokusLage ? `.rb-vikt [data-lage="${fokusLage}"]` : ".rb-bild") || k?.querySelector(".rb-bild"))?.focus({ preventScroll: true });
  }
}

function markera() {
  if (!rutnat) return;
  document.body.classList.toggle("rb-arendelage", T.flik === "arende");
  rutnat.querySelectorAll(".rb-kort").forEach((k) => {
    const id = k.dataset.id, i = T.urval.indexOf(id);
    k.classList.toggle("vald", id === T.valt && T.flik !== "arende");
    k.classList.toggle("i-urval", i >= 0);
    k.querySelector(".rb-valnr").textContent = i >= 0 ? i + 1 : "";
    const b = k.querySelector(".rb-bild");
    const v = T.byId[id];
    if (v) b.setAttribute("aria-label", `${v.titel}. ${T.flik === "arende" ? (i >= 0 ? `Bilaga ${i + 1}, klicka för att ta bort ur ärendet` : "Lägg i ärendet") : "Redigera"}`);
    if (T.flik === "arende") b.setAttribute("aria-pressed", String(i >= 0)); else b.removeAttribute("aria-pressed");
  });
}

export function visaKort(id) {
  const k = rutnat?.querySelector(`.rb-kort[data-id="${id}"]`);
  if (k) k.scrollIntoView({ block: "nearest", behavior: "smooth" });
  return k;
}
