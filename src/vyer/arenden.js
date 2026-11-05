// Ärenden: projektresor. En markdownfil per ärende i content/arenden/.
// Ärenden med "utkast: true" finns bara med när sajten körs med npm run dev
// (se vite.config.js). Här får de en egen avdelning, en stämpel och ett
// föreläggande som samlar alla [JOHAN: …]-frågor.
import "../stil/arenden.css";
import { A, S, el, papper, huvud, tumnagel, metaRad, byId, kontaktRuta, kanalFarg, PREVIEW, ytBild, reduce, bild } from "../data.js";
import { oppna } from "../visare.js";

const efterDnr = (a, b) => String(a.diarienummer).localeCompare(String(b.diarienummer), "sv", { numeric: true });
const ARENDEN = A.arenden.slice().sort((a, b) => efterDnr(b, a));
const PUBLICERADE = ARENDEN.filter((a) => !a.utkast);
const UTKAST = ARENDEN.filter((a) => a.utkast).sort(efterDnr);
const statusKlass = (a) => (a.utkast ? "utkast" : /avgjor/i.test(a.status || "") ? "avgjord" : "oppen");
const statusText = (a) => (a.utkast ? "Utkast" : a.status || "Under handläggning");

// [JOHAN: fråga] i texten. Frågorna får inte själva innehålla hakparenteser.
const FRAGA = /\[JOHAN:\s*([^\]]+?)\s*\]/g;
const antalFragor = (a) => [a.period, a.ingress, a.html].join(" ").match(FRAGA)?.length || 0;
const utanFragor = (s) => String(s || "").replace(FRAGA, "…").replace(/\s+/g, " ").trim();
const ental = (n, en, fler) => `${n} ${n === 1 ? en : fler}`;

export function lista(app) {
  const p = papper();
  p.append(huvud("Ärendeförteckning", "Ärenden"),
    el("p", { class: "lead" }, "Utvalda projekt, från första idé via skisser och material till färdigt verk. Ärenden under handläggning fylls på efter hand."));
  // Rubriken behövs för rubrikordningen (h1, h2, h3) men syns inte: listan talar för sig själv.
  p.append(el("h2", { class: "dold" }, "Förteckning"), el("ul", { class: "arendelista" }, PUBLICERADE.map(rad)));
  if (UTKAST.length) {
    const fragor = UTKAST.reduce((s, a) => s + antalFragor(a), 0);
    p.append(el("section", { class: "utkastdel", "aria-labelledby": "utkast-rubrik" },
      el("h2", { id: "utkast-rubrik" }, "Utkast under beredning"),
      el("p", { class: "utkastnot" },
        el("span", { class: "prov" }, "Ej offentligt"),
        `${ental(UTKAST.length, "utkast", "utkast")} med sammanlagt ${ental(fragor, "obesvarad fråga", "obesvarade frågor")}. Utkasten syns bara när sajten körs med npm run dev och tas inte med när sajten byggs.`),
      el("ul", { class: "arendelista" }, UTKAST.map(rad))));
  }
  app.replaceChildren(p);
}

function rad(a) {
  const om = byId[a.omslag];
  const n = a.utkast ? antalFragor(a) : 0;
  return el("li", { class: a.utkast ? "ar-utkast" : null }, el("a", { href: "#arende-" + a.id },
    el("div", { class: "om" }, om ? tumnagel(om) : el("div", { class: "ytthumb", style: "background:var(--field);color:var(--muted)" }, el("small", {}, a.diarienummer), el("strong", {}, "Handlingar inkommer"))),
    el("div", {},
      el("h3", {}, a.titel),
      el("p", {}, `${a.diarienummer} · ${utanFragor(a.period)}`),
      a.ingress ? el("p", {}, utanFragor(a.ingress)) : null,
      n ? el("p", { class: "fragantal" }, ental(n, "fråga till Johan", "frågor till Johan")) : null),
    el("span", { class: "status " + statusKlass(a) }, statusText(a))));
}

export function arende(app, id) {
  const a = ARENDEN.find((x) => x.id === id);
  // Ett okänt ärende: förteckningen visas, och adressen säger det.
  if (!a) { history.replaceState(null, "", "#arenden"); lista(app); return "Ärenden"; }
  const fragor = [];
  const p = papper(); p.classList.add("arende");
  if (a.utkast) p.classList.add("ar-utkast");
  p.append(huvud(`Ärende · ${a.diarienummer}`, a.titel));
  if (a.utkast) {
    p.append(el("div", { class: "utkaststampel", "aria-hidden": "true" }, "Utkast", el("small", {}, "publiceras ej")),
      el("p", { class: "utkastnot" }, el("span", { class: "prov" }, "Utkast"),
        "Ärendet syns bara på den här datorn, när sajten körs med npm run dev. Det tas inte med när sajten byggs."));
  }
  const om = byId[a.omslag];
  if (om) p.append(omslag(om));
  p.append(el("div", { class: "fields" },
    el("div", {}, el("span", {}, "Diarienummer"), el("b", {}, a.diarienummer)),
    el("div", {}, el("span", {}, "Period"), el("b", {}, medFragor(a.period || "–", fragor))),
    el("div", {}, el("span", {}, "Status"), el("b", {}, statusText(a)))));
  if (a.ingress) p.append(el("p", { class: "lead" }, medFragor(a.ingress, fragor)));
  const kropp = el("div", { class: "kropp", html: a.html });
  markeraFragor(kropp, fragor);
  // Fyll i bilageraderna (::verk i markdown).
  kropp.querySelectorAll(".bilagerad").forEach((rad) => {
    const verk = rad.dataset.verk.split(" ").map((x) => byId[x]).filter(Boolean);
    verk.forEach((v) => rad.append(el("button", { type: "button", class: "bilaga", onclick: () => oppna(alla(kropp), alla(kropp).indexOf(v)) },
      el("div", { class: "m" }, tumnagel(v)), el("b", {}, v.titel), el("span", { class: "meta" }, metaRad(v)))));
  });
  p.append(kropp);
  if (fragor.length) p.append(forelaggande(a, fragor));
  p.append(el("div", { class: "actions" }, el("a", { href: "#arenden", class: "btn ghost" }, "← Alla ärenden"), el("a", { href: "#ansokan", class: "btn" }, "Ansök om kreativ insats")));
  app.replaceChildren(p);
  return a.titel;
}
function alla(kropp) {
  return [...kropp.querySelectorAll(".bilagerad")].flatMap((r) => r.dataset.verk.split(" ").map((x) => byId[x]).filter(Boolean));
}

// Omslaget: fotot, eller för film utan stillbild ett blad i kanalens färg.
function omslag(v) {
  if (v.bild) return el("div", { class: "omslag" }, bild(v, { ivrig: true, sizes: "(max-width: 760px) 100vw, 800px" }));
  if (!v.youtube) return null;
  const [bg, fg] = kanalFarg(v.kanal);
  const o = el("div", { class: "omslag yt", style: `background:${bg};color:${fg}` },
    el("div", { class: "yttext" }, el("small", {}, "▶ " + v.kanal), el("strong", {}, v.titel), el("span", {}, metaRad(v))));
  if (!PREVIEW) {
    const i = el("img", { src: ytBild(v), alt: "", loading: "lazy", decoding: "async" });
    const ruta = el("div", { class: "ytbild" }, i);
    i.onerror = () => { ruta.remove(); o.classList.add("utanbild"); };
    o.append(ruta);
  }
  return o;
}

// Byter [JOHAN: …] mot en numrerad markering och samlar frågan i listan.
function fragaMark(text, fragor) {
  fragor.push(text);
  const n = fragor.length;
  return el("mark", { class: "fraga", "data-n": n }, el("i", { class: "nr", "aria-label": `Fråga ${n} till Johan:` }, `F${n}`), text);
}
function medFragor(s, fragor) {
  const ut = [];
  let sist = 0;
  for (const m of String(s).matchAll(FRAGA)) {
    if (m.index > sist) ut.push(s.slice(sist, m.index));
    ut.push(fragaMark(m[1], fragor));
    sist = m.index + m[0].length;
  }
  if (sist < s.length) ut.push(s.slice(sist));
  return ut;
}
function markeraFragor(rot, fragor) {
  const gang = document.createTreeWalker(rot, NodeFilter.SHOW_TEXT);
  const noder = [];
  while (gang.nextNode()) if (gang.currentNode.nodeValue.includes("[JOHAN:")) noder.push(gang.currentNode);
  noder.forEach((t) => t.replaceWith(...medFragor(t.nodeValue, fragor)));
}

// Föreläggande om komplettering: alla frågor i ordning, redo för ett röstmemo.
function forelaggande(a, fragor) {
  const lista = el("ol", { class: "fragelista" }, fragor.map((f, k) =>
    el("li", {}, el("button", { type: "button", class: "tilltext", onclick: () => visaFraga(k + 1), "aria-label": `Visa fråga ${k + 1} i texten` }, `F${k + 1}`), el("span", {}, f))));
  const svar = el("span", { class: "kopierat", role: "status" });
  const kopiera = el("button", { type: "button", class: "btn ghost", onclick: async () => {
    const text = `${a.titel} (${a.diarienummer})\n\n` + fragor.map((f, k) => `F${k + 1}. ${f}`).join("\n");
    try { await navigator.clipboard.writeText(text); svar.textContent = "Frågorna är kopierade."; }
    catch { svar.textContent = "Kopieringen medgavs inte. Markera listan och kopiera för hand."; }
  } }, "Kopiera frågorna");
  return el("section", { class: "forelaggande", "aria-labelledby": "forelaggande-rubrik" },
    el("h2", { id: "forelaggande-rubrik" }, "Föreläggande om komplettering"),
    el("p", {}, `Handläggaren saknar uppgifter i ärendet. Johan föreläggs att besvara ${ental(fragor.length, "fråga", "frågor")}. Svaren kan lämnas muntligen.`),
    lista,
    el("div", { class: "sagors" },
      el("b", {}, "Så besvaras föreläggandet"),
      el("ol", {},
        el("li", {}, "Spela in ett röstmemo. Säg frågans nummer, till exempel \"F3\", och svara med egna ord. Det går bra att hoppa över frågor."),
        el("li", {}, "Lägg ljudfilen eller en utskrift i inkorg/ och be Claude föra in svaren i ärendet."),
        el("li", {}, `När ärendet är klart tas raden utkast: true bort ur content/arenden/${a.id}.md. Då publiceras det.`))),
    el("div", { class: "kopiera" }, kopiera, svar));
}
function visaFraga(n) {
  const m = document.querySelector(`.arende .fraga[data-n="${n}"]`);
  if (!m) return;
  m.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  m.classList.remove("blink"); void m.offsetWidth; m.classList.add("blink");
}

export function bestallare(app) {
  const p = papper(); p.classList.add("bestallare");
  p.append(huvud("Upplysningar · Utgåva 2026:1", "För beställare"), el("div", { html: S.bestallare }));
  p.append(kontaktRuta(null));
  app.replaceChildren(p);
}
