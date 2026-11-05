// Ärenden: projektresor. En markdownfil per ärende i content/arenden/.
// Ärenden med "utkast: true" finns bara med när sajten körs med npm run dev
// (se vite.config.js). Här får de en egen avdelning, en stämpel och ett
// föreläggande som samlar alla [JOHAN: …]-frågor.
import "../stil/arenden.css";
import { A, S, el, papper, huvud, tumnagel, metaRad, byId, kontaktRuta, kanalFarg, PREVIEW, ytBild, reduce, bild } from "../data.js";
import { oppna } from "../visare.js";
import { EN, t, vag } from "../sprak.js";

const efterDnr = (a, b) => String(a.diarienummer).localeCompare(String(b.diarienummer), "sv", { numeric: true });
// På den engelska sidan läggs content/en/arenden/<id>.md ovanpå det svenska ärendet.
// Ett ärende som inte har översatts visas på svenska, med en upplysning (sv = true).
const ARENDEN = A.arenden.map((a) => {
  const e = EN && A.en.arenden[a.id];
  return EN ? (e ? { ...a, ...e, statusSv: a.status } : { ...a, statusSv: a.status, sv: true }) : { ...a, statusSv: a.status };
}).sort((a, b) => efterDnr(b, a));
const PUBLICERADE = ARENDEN.filter((a) => !a.utkast);
const UTKAST = ARENDEN.filter((a) => a.utkast).sort(efterDnr);
const statusKlass = (a) => (a.utkast ? "utkast" : /avgjor/i.test(a.statusSv || "") ? "avgjord" : "oppen");
// Ett svenskt ärende på den engelska sidan får sin status översatt, om den är en av de vanliga.
const STATUS = { "Avgjort": t("Avgjort"), "Under handläggning": t("Under handläggning") };
const statusText = (a) => (a.utkast ? t("Utkast") : (a.sv ? STATUS[a.status] : null) || a.status || t("Under handläggning"));
// Ett ärende som visas på svenska på den engelska sidan.
const svensk = (a) => (a.sv ? { lang: "sv" } : {});
const svenskNot = () => el("p", { class: "sprak-not", lang: "en" }, t("Ärendet har ännu inte översatts. Det återges på svenska."));

// [JOHAN: fråga] i texten. Frågorna får inte själva innehålla hakparenteser.
const FRAGA = /\[JOHAN:\s*([^\]]+?)\s*\]/g;
const antalFragor = (a) => [a.period, a.ingress, a.html].join(" ").match(FRAGA)?.length || 0;
const utanFragor = (s) => String(s || "").replace(FRAGA, "…").replace(/\s+/g, " ").trim();
const ental = (n, en, fler) => `${n} ${n === 1 ? en : fler}`;

export function lista(app) {
  const p = papper();
  p.append(huvud(t("Ärendeförteckning"), t("Ärenden")),
    el("p", { class: "lead" }, t("Utvalda projekt, från första idé via skisser och material till färdigt verk. Ärenden under handläggning fylls på efter hand.")));
  // Rubriken behövs för rubrikordningen (h1, h2, h3) men syns inte: listan talar för sig själv.
  p.append(el("h2", { class: "dold" }, t("Förteckning")), el("ul", { class: "arendelista" }, PUBLICERADE.map(rad)));
  if (UTKAST.length) {
    const fragor = UTKAST.reduce((s, a) => s + antalFragor(a), 0);
    // Utkasten är Johans egna arbetspapper och syns bara i npm run dev. De står på svenska även på den engelska sidan.
    p.append(el("section", { class: "utkastdel", "aria-labelledby": "utkast-rubrik", lang: "sv" },
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
  return el("li", { class: a.utkast ? "ar-utkast" : null }, el("a", { href: vag("arende", a.id) },
    el("div", { class: "om" }, om ? tumnagel(om) : el("div", { class: "ytthumb", style: "background:var(--field);color:var(--muted)" }, el("small", {}, a.diarienummer), el("strong", {}, t("Handlingar inkommer")))),
    el("div", {},
      el("h3", svensk(a), a.titel),
      el("p", {}, `${a.diarienummer} · ${utanFragor(a.period)}`, a.sv && !a.utkast ? ` · ${t("på svenska")}` : ""),
      a.ingress ? el("p", svensk(a), utanFragor(a.ingress)) : null,
      n ? el("p", { class: "fragantal", lang: "sv" }, ental(n, "fråga till Johan", "frågor till Johan")) : null),
    el("span", { class: "status " + statusKlass(a) }, statusText(a))));
}

export function arende(app, id) {
  const a = ARENDEN.find((x) => x.id === id);
  // Ett okänt ärende: förteckningen visas, och adressen säger det.
  if (!a) { history.replaceState(null, "", "#arenden"); lista(app); return "Ärenden"; }
  const fragor = [];
  const p = papper(); p.classList.add("arende");
  if (a.utkast) p.classList.add("ar-utkast");
  p.append(huvud(t("Ärende · {dnr}", { dnr: a.diarienummer }), a.titel));
  if (a.sv) p.querySelector("h1").setAttribute("lang", "sv");
  if (a.utkast) {
    p.append(el("div", { class: "utkaststampel", "aria-hidden": "true" }, t("Utkast"), el("small", {}, "publiceras ej")),
      el("p", { class: "utkastnot", lang: "sv" }, el("span", { class: "prov" }, "Utkast"),
        "Ärendet syns bara på den här datorn, när sajten körs med npm run dev. Det tas inte med när sajten byggs."));
  }
  const om = byId[a.omslag];
  if (om) p.append(omslag(om));
  if (a.sv && !a.utkast) p.append(svenskNot());
  p.append(el("div", { class: "fields" },
    el("div", {}, el("span", {}, t("Diarienummer")), el("b", {}, a.diarienummer)),
    el("div", {}, el("span", {}, t("Period")), el("b", {}, medFragor(a.period || "–", fragor))),
    el("div", {}, el("span", {}, t("Status")), el("b", {}, statusText(a)))));
  if (a.ingress) p.append(el("p", { class: "lead", ...svensk(a) }, medFragor(a.ingress, fragor)));
  const kropp = el("div", { class: "kropp", html: a.html, ...svensk(a) });
  markeraFragor(kropp, fragor);
  // Fyll i bilageraderna (::verk i markdown).
  kropp.querySelectorAll(".bilagerad").forEach((rad) => {
    const verk = rad.dataset.verk.split(" ").map((x) => byId[x]).filter(Boolean);
    verk.forEach((v) => rad.append(el("button", { type: "button", class: "bilaga", onclick: () => oppna(alla(kropp), alla(kropp).indexOf(v)) },
      el("div", { class: "m" }, tumnagel(v)), el("b", {}, v.titel), el("span", { class: "meta" }, metaRad(v)))));
  });
  p.append(kropp);
  if (fragor.length) p.append(forelaggande(a, fragor));
  p.append(el("div", { class: "actions" }, el("a", { href: vag("arenden"), class: "btn ghost" }, t("← Alla ärenden")), el("a", { href: vag("ansokan"), class: "btn" }, t("Ansök om kreativ insats"))));
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
  return el("section", { class: "forelaggande", "aria-labelledby": "forelaggande-rubrik", lang: "sv" },
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
  p.append(huvud(t("Upplysningar · Utgåva 2026:1"), t("För beställare")), el("div", { html: S.bestallare }));
  p.append(kontaktRuta(null));
  app.replaceChildren(p);
}
