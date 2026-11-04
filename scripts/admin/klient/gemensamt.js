// Redigeringsbordet: det som alla delar av bordet använder.

export const DIMS = ["allvar", "lek", "stilla", "rorligt", "scen", "manniska", "ljus", "skruv", "uppdrag", "konst"];
export const DIMNAMN = { allvar: "Allvar", lek: "Lek", stilla: "Stilla", rorligt: "Rörligt", scen: "Scen", manniska: "Människa", ljus: "Ljus", skruv: "Skruv", uppdrag: "Uppdrag", konst: "Konst" };
// Bordets fyra lägen. "dold" är inte en vikt i filen utan synlig: false.
export const LAGEN = [["hjälte", "Hjälte"], ["frö", "Frö"], ["damm", "Damm"], ["dold", "Dold"]];
export const lage = (v) => (v.synlig === false ? "dold" : v.vikt || "frö");
export const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Tillståndet. En enda plats, så att alla delar ser samma sak.
export const T = {
  verk: [], arenden: [], inkorg: [], byId: {},
  valt: null,          // id för verket som redigeras
  flik: "handling",    // handling | arende | inkorg | kontroll
  urval: [],           // ärendeurvalet, i ordning
  kontroll: null,      // senaste resultatet
  nya: new Set(),      // verk som just kom in via intaget
};

const lyss = {};
export const pa = (namn, fn) => (lyss[namn] ||= []).push(fn);
export const sand = (namn, ...a) => (lyss[namn] || []).forEach((fn) => fn(...a));

export function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k === "html") e.innerHTML = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k === "value") e.value = v;
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}

// Alla anrop till servern. Rubriken x-bordet gör att andra webbplatser inte kan skriva via bordet.
export async function api(vag, { metod = "GET", data, ra } = {}) {
  const r = await fetch("/__bordet/" + vag, {
    method: metod,
    headers: metod === "GET" ? {} : { "x-bordet": "1", ...(ra ? { "Content-Type": "application/octet-stream" } : { "Content-Type": "application/json" }) },
    body: ra || (data !== undefined ? JSON.stringify(data) : undefined),
  });
  let svar = {};
  try { svar = await r.json(); } catch (e) { /* tomt svar */ }
  if (!r.ok) { const fel = new Error(svar.fel || `Servern svarade ${r.status}.`); fel.status = r.status; fel.svar = svar; throw fel; }
  return svar;
}

export const ar = (v) => (v.datum ? String(v.datum).slice(0, 4) : "");
export const ytBild = (v) => `https://i.ytimg.com/vi/${v.youtube}/mqdefault.jpg`;

const KANAL = {
  Riksteatern: ["#7a1712", "#f6d9cf"], "Riksteatern Crea": ["#5c2414", "#f3d5c2"], "Clio Sverige": ["#12355c", "#d4e4f5"],
  TV4: ["#3a0f1c", "#f5d6df"], Cullberg: ["#241638", "#e3d6f2"], "NTF Säker Trafik": ["#173b24", "#d3eedb"],
  "Deejay Spider": ["#2b2610", "#f1e7b8"], "Kungliga Operan": ["#2e1d0c", "#f5e3c8"], Absurdimo: ["#ef3fe6", "#1a0619"],
};
export const kanalFarg = (k) => KANAL[k] || ["#1f2a2f", "#e8ecec"];

// Miniatyr: fotot, videons stillbild eller ett kort i kanalens färg (med YouTubes bild när nätet finns).
export function miniatyr(v, stor) {
  if (v.bild) return el("img", { src: v.bild, alt: "", loading: stor ? "eager" : "lazy", decoding: "async" });
  const [bg, fg] = kanalFarg(v.kanal);
  const d = el("div", { class: "rb-yt", style: `background:${bg};color:${fg}` }, el("small", {}, "▶ " + (v.kanal || v.typ)), el("strong", {}, v.titel));
  if (v.youtube) {
    const i = el("img", { src: ytBild(v), alt: "", loading: "lazy" });
    i.onerror = () => i.remove();
    d.prepend(i);
  }
  return d;
}

// Små meddelanden längst ned. Med en ångra-knapp när det går att ångra.
let toastRuta;
export function meddela(text, { angra, typ = "ok", tid = 5200 } = {}) {
  toastRuta ||= document.getElementById("rb-meddelanden");
  const m = el("div", { class: "rb-toast " + typ, role: typ === "fel" ? "alert" : "status" }, el("span", {}, text));
  if (angra) m.append(el("button", { type: "button", onclick: () => { angra(); m.remove(); } }, "Ångra"));
  m.append(el("button", { type: "button", class: "x", "aria-label": "Stäng meddelandet", onclick: () => m.remove() }, "×"));
  toastRuta.append(m);
  while (toastRuta.children.length > 3) toastRuta.firstElementChild.remove();
  setTimeout(() => m.remove(), angra ? tid + 3000 : tid);
}

// Anmärkningar enligt Verkets skrivregler: inga tankstreck och inga utropstecken i det som publiceras.
export function anmarkningar(text) {
  const a = [];
  if (/—/.test(text)) a.push("Tankstreck (—) används inte i Verkets texter.");
  if (/!/.test(text)) a.push("Utropstecken används inte i Verkets texter.");
  if (/\[JOHAN:/.test(text)) a.push("Innehåller en fråga till Johan, [JOHAN: …].");
  return a;
}

export const klocka = (d = new Date()) => d.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
