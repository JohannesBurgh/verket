// Redigeringsbordet: resultatet av npm run kontroll, direkt. Körs om när något i content/ ändras.
import { T, el, api, klocka, pa, sand } from "./gemensamt.js";

let yta, knapp, pagar = false, igen = false, tid = null;

export function initKontroll() {
  yta = document.getElementById("rb-flik-kontroll");
  knapp = document.getElementById("rb-kontrollknapp");
  knapp.addEventListener("click", () => sand("flik", "kontroll"));
  pa("andrat", () => { clearTimeout(tid); tid = setTimeout(kor, 350); });
  rita();
  kor();
}

export async function kor() {
  if (pagar) { igen = true; return; }
  pagar = true; ritaKnapp();
  try {
    const r = await api("kontroll");
    const rader = r.utdata.split("\n").map((x) => x.trim()).filter(Boolean);
    const fel = rader.filter((x) => x.startsWith("FEL:")).map((x) => x.slice(4).trim());
    const varn = rader.filter((x) => x.startsWith("varning:")).map((x) => x.slice(8).trim());
    T.kontroll = { kod: r.kod, fel, varn, summa: rader.filter((x) => !/^(FEL|varning):/.test(x)).pop() || "", utdata: r.utdata, nar: klocka() };
  } catch (e) {
    T.kontroll = { kod: -1, fel: ["Kontrollen kunde inte köras: " + e.message], varn: [], summa: "", utdata: "", nar: klocka() };
  } finally {
    pagar = false; rita();
    if (igen) { igen = false; kor(); }
  }
}

function ritaKnapp() {
  const k = T.kontroll;
  const status = pagar && !k ? "vantar" : !k ? "vantar" : k.fel.length ? "fel" : k.varn.length ? "varning" : "ok";
  knapp.dataset.status = status;
  const text = !k ? "pågår" : k.fel.length ? `${k.fel.length} fel` : k.varn.length ? `${k.varn.length} ${k.varn.length === 1 ? "varning" : "varningar"}` : "godkänd";
  knapp.replaceChildren(el("span", { class: "rb-pre" }, "Kontroll: "), text);
  knapp.setAttribute("aria-label", `Kontroll: ${text}. Visa kontrollen.`);
  knapp.classList.toggle("pagar", pagar);
}

// "057-rattan.md: saknar titel" blir en länk till verket.
function rad(text, klass) {
  const m = text.match(/^([\w-]+)\.md:\s*(.*)$/);
  const li = el("li", { class: klass });
  if (m && T.byId[m[1]]) li.append(el("button", { type: "button", class: "rb-lank", onclick: () => sand("redigera", m[1]) }, m[1] + ".md"), ": " + m[2]);
  else li.append(text);
  return li;
}

function rita() {
  ritaKnapp();
  if (!yta) return;
  const k = T.kontroll;
  const godkand = k && !k.fel.length;
  yta.replaceChildren(el("div", { class: "rb-kontroll" },
    el("div", { class: "rb-huvud" }, el("div", { class: "org" }, "Kontroll"), el("div", { class: "form" }, "npm run kontroll"), el("h2", {}, "Granskning av innehållet")),
    k ? el("div", { class: "rb-stampelrad" },
      el("span", { class: "rb-stor-stampel" + (godkand ? "" : " fel") }, godkand ? "Godkänd" : "Anmärkning", el("small", {}, k.nar)),
      el("p", {}, k.summa || (godkand ? "Inga fel." : `${k.fel.length} fel.`))) : el("p", { class: "rb-mork" }, "Kontrollen körs …"),
    k?.fel.length ? [el("h3", {}, "Fel"), el("ul", { class: "rb-kontrollista" }, k.fel.map((x) => rad(x, "fel")))] : null,
    k?.varn.length ? [el("h3", {}, "Varningar"), el("ul", { class: "rb-kontrollista" }, k.varn.map((x) => rad(x, "varn")))] : null,
    el("p", { class: "rb-mork" }, "Kontrollen körs om av sig själv när något i content/ ändras. Fel stoppar inte bordet, men bör rättas innan sajten publiceras."),
    k?.utdata ? el("details", { class: "rb-logg" }, el("summary", {}, "Hela utskriften"), el("pre", {}, k.utdata)) : null,
    el("div", { class: "rb-sparrad" }, el("button", { type: "button", class: "rb-btn ghost", disabled: pagar, onclick: kor }, pagar ? "Kör …" : "Kör kontrollen igen"))));
}
