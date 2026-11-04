// Redigeringsbordet: sätt ihop bilagorna till ett ärende. Klicka på verk i rutnätet,
// ordna dem och kopiera färdiga ::verk-rader till en fil i content/arenden/.
import { T, el, miniatyr, meddela, pa, sand } from "./gemensamt.js";

const NYCKEL = "bordet-arende";
let yta, perRad = 3;
try { const s = JSON.parse(sessionStorage.getItem(NYCKEL)); if (s) { T.urval = s.urval || []; perRad = s.perRad || 3; } } catch (e) { /* inget sparat */ }
const minns = () => { try { sessionStorage.setItem(NYCKEL, JSON.stringify({ urval: T.urval, perRad })); } catch (e) { /* privat läge */ } };

export function initArende() {
  yta = document.getElementById("rb-flik-arende");
  pa("data", () => { T.urval = T.urval.filter((id) => T.byId[id]); rita(); });
  pa("urval", rita);
  rita();
}

export function vaxla(id) {
  const i = T.urval.indexOf(id);
  if (i >= 0) T.urval.splice(i, 1); else T.urval.push(id);
  minns(); sand("urval");
}

function flytta(i, d) {
  const j = i + d;
  if (j < 0 || j >= T.urval.length) return;
  [T.urval[i], T.urval[j]] = [T.urval[j], T.urval[i]];
  minns(); sand("urval");
  requestAnimationFrame(() => yta.querySelector(`[data-steg="${j}:${d}"]`)?.focus());
}

export const rader = () => {
  const ut = [];
  for (let i = 0; i < T.urval.length; i += perRad) ut.push(T.urval.slice(i, i + perRad));
  return ut;
};
const text = () => rader().map((r) => "::verk " + r.join(" ")).join("\n\n");

async function kopiera(t, vad) {
  try { await navigator.clipboard.writeText(t); meddela(`${vad} kopierade. Klistra in i en fil i content/arenden/.`); }
  catch (e) {
    const f = yta.querySelector(".rb-utdata"); f?.focus(); f?.select();
    meddela("Webbläsaren tillät inte kopiering. Raderna är markerade, tryck Ctrl C.", { typ: "fel" });
  }
}

function rita() {
  if (!yta) return;
  document.querySelectorAll('[data-rakna="arende"], #rb-rakna-arende').forEach((s) => (s.textContent = T.urval.length || ""));
  const utdata = el("textarea", { class: "rb-utdata", readonly: true, rows: Math.max(2, rader().length * 2 - 1), wrap: "off", "aria-label": "Färdiga ::verk-rader", value: text(),
    onfocus: (e) => e.target.select() });
  const valjArende = el("select", { "aria-label": "Utgå från ett befintligt ärende", onchange: () => {
    const a = T.arenden.find((x) => x.id === valjArende.value);
    if (!a) return;
    T.urval = [...new Set(a.rader.flat())].filter((x) => T.byId[x]);
    const langd = a.rader.map((r) => r.length);
    if (langd.length && langd.every((n) => n === langd[0])) perRad = Math.min(6, langd[0]);
    minns(); sand("urval");
    meddela(`Urvalet från ${a.titel} är hämtat. ${T.urval.length} verk.`);
  } }, el("option", { value: "" }, "Hämta från ett ärende …"), T.arenden.map((a) => el("option", { value: a.id }, `${a.titel} (${a.diarienummer || a.id})`)));
  const perRadVal = el("select", { id: "rb-per-rad", onchange: () => { perRad = Number(perRadVal.value); minns(); rita(); } },
    [1, 2, 3, 4, 5, 6].map((n) => el("option", { value: n }, n === 1 ? "1 verk per rad" : `${n} verk per rad`)));
  perRadVal.value = String(perRad);

  const dolda = T.urval.filter((x) => T.byId[x] && !T.byId[x].synlig);
  const lista = el("ol", { class: "rb-urval" }, T.urval.map((x, i) => {
    const v = T.byId[x];
    if (!v) return null;
    return el("li", { class: v.synlig ? "" : "dold" },
      el("span", { class: "m" }, miniatyr(v)),
      el("span", { class: "t" }, el("b", {}, v.titel), el("small", {}, `${v.id}${v.synlig ? "" : " · dold, visas inte"}`)),
      el("span", { class: "k" },
        el("button", { type: "button", "aria-label": `Flytta ${v.titel} uppåt`, "data-steg": `${i}:-1`, disabled: i === 0, onclick: () => flytta(i, -1) }, "↑"),
        el("button", { type: "button", "aria-label": `Flytta ${v.titel} nedåt`, "data-steg": `${i}:1`, disabled: i === T.urval.length - 1, onclick: () => flytta(i, 1) }, "↓"),
        el("button", { type: "button", "aria-label": `Ta bort ${v.titel} ur ärendet`, onclick: () => vaxla(x) }, "×")));
  }));

  yta.replaceChildren(el("div", { class: "rb-arende" },
    el("div", { class: "rb-huvud" }, el("div", { class: "org" }, "Ärende"), el("div", { class: "form" }, "Bilagor"), el("h2", {}, "Sätt ihop ett ärende")),
    el("p", {}, "Så länge den här fliken är öppen väljer ett klick i rutnätet verket i stället för att öppna det. Ordningen blir bilagornas ordning."),
    el("div", { class: "rb-par" }, valjArende, perRadVal),
    T.urval.length ? lista : el("p", { class: "rb-mork" }, "Inga verk valda ännu. Klicka på verk i rutnätet."),
    dolda.length ? el("p", { class: "rb-anm-rad" }, `${dolda.length === 1 ? "Ett valt verk är dolt" : dolda.length + " valda verk är dolda"} och visas inte i ärendet förrän vikten ändras.`) : null,
    T.urval.length ? [
      el("label", { class: "rb-etikett", for: "rb-utdata" }, "Rader att klistra in"),
      Object.assign(utdata, { id: "rb-utdata" }),
      el("p", { class: "rb-mork" }, `Förslag på omslag: det första verket, omslag: "${T.urval[0]}". Strukturen följer nordisk-saga.md: Inkom, Beredning, Material, Beslut.`),
      el("div", { class: "rb-sparrad" },
        el("button", { type: "button", class: "rb-btn ghost", onclick: () => { T.urval = []; minns(); sand("urval"); } }, "Töm"),
        el("button", { type: "button", class: "rb-btn ghost", onclick: () => kopiera(`omslag: "${T.urval[0]}"`, "Omslagsraden") }, "Kopiera omslag"),
        el("button", { type: "button", class: "rb-btn", onclick: () => kopiera(text(), rader().length === 1 ? "Raden" : `${rader().length} rader`) }, "Kopiera raderna")),
    ] : null));
}
