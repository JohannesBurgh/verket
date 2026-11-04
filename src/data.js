// Allt innehåll kommer från mappen content/ via vite.config.js.
import arkiv from "virtual:arkiv";
import STORLEKAR from "../content/bilder.json";
import "./stil/bilder.css";

import { EN, t, epokNamn } from "./sprak.js";

// På den engelska sidan (/en/) läggs texterna i content/en/ ovanpå de svenska.
// Kontaktuppgifter, adress och allt som styr logiken kommer alltid från den svenska filen.
const E = arkiv.en;
export const S = EN ? { ...arkiv.verket, ...E.verket, bestallare: E.verket.bestallare || arkiv.verket.bestallare } : arkiv.verket;
// sv_ansokan styr logiken på båda sidorna. en_ord är de engelska nyckelorden, som tolkas även på den svenska sidan.
export const A = { ...arkiv, verket: S, ansokan: EN ? E.ansokan : arkiv.ansokan, sv_ansokan: arkiv.ansokan, en_ord: (E.ansokan.tolkning || []).map((r) => r.ord || []) };
// Den engelska sidan ligger en mapp ned, så bilderna hämtas ett steg upp.
const ROT = EN ? "../" : "";
const medRot = (p) => (p ? ROT + p : p);
// Verkfilerna delas mellan språken. Titel och text tas från content/en/verk.yml när de finns.
// sv = den svenska titeln, som fortfarande går att söka på. textSprak = språket texten faktiskt är skriven på.
export const VERK = arkiv.verk.filter((v) => v.synlig).map((v) => {
  const x = { ...v, bild: medRot(v.bild), video: medRot(v.video), sv: v.titel, textSprak: "sv" };
  if (!EN) return x;
  const e = E.verk[v.id] || {};
  return { ...x, titel: e.titel || v.titel, text: e.text || v.text, textSprak: e.text || !v.text ? "en" : "sv" };
});
export const byId = Object.fromEntries(VERK.map((v) => [v.id, v]));
export const DIMS = ["allvar", "lek", "stilla", "rorligt", "scen", "manniska", "ljus", "skruv", "uppdrag", "konst"];
// I förhandsvisningen (Claude-artefakten) går det inte att bädda in YouTube eller hämta deras tumnaglar.
export const PREVIEW = import.meta.env.VITE_PREVIEW === "1";
export const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

const KANAL = {
  Riksteatern: ["#7a1712", "#f6d9cf"], "Riksteatern Crea": ["#5c2414", "#f3d5c2"], "Clio Sverige": ["#12355c", "#d4e4f5"],
  TV4: ["#3a0f1c", "#f5d6df"], Cullberg: ["#241638", "#e3d6f2"], "NTF Säker Trafik": ["#173b24", "#d3eedb"],
  "Deejay Spider": ["#2b2610", "#f1e7b8"], "Kungliga Operan": ["#2e1d0c", "#f5e3c8"], Absurdimo: ["#ef3fe6", "#1a0619"],
};
export const kanalFarg = (k) => KANAL[k] || ["#1f2a2f", "#e8ecec"];

export function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k === "html") e.innerHTML = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}

export const arRunt = (v) => (v.ar == null ? null : Math.floor(v.ar));
export function when(v) {
  if (v.kanal === "Absurdimo" && !v.datum) return t("år ej fastställt");
  if (!v.datum) return t("Odaterad");
  return v.datum.slice(0, 4) + (v.gissat ? " " + t("(uppskattat)") : "");
}
export function metaRad(v) {
  const e = epokNamn(v.epok);
  return /\d{4}/.test(v.epok) && !v.gissat ? e : `${e} · ${when(v)}`;
}
export function ytBild(v) {
  return `https://i.ytimg.com/vi/${v.youtube}/hqdefault.jpg`;
}

// Bildkällor: storlekarna som intaget tagit fram (content/bilder.json), i AVIF och WebP med JPEG som reserv.
function kallor(v) {
  const post = v.bild && STORLEKAR[v.bild.replace(/^(\.\.\/)?media\//, "")];
  if (!post) return null;
  const mapp = v.bild.replace(/[^/]+$/, "storlek/"), namn = v.bild.replace(/^.*\/|\.[^.]+$/g, "");
  const set = (ext) => post.b.map(([w]) => `${ext === "jpg" && w === post.j ? v.bild : `${mapp}${namn}-${w}.${ext}`} ${w}w`).join(", ");
  return { avif: set("avif"), webp: set("webp"), jpg: set("jpg"), max: post.b.at(-1)[0], b: post.b, mapp, namn, j: post.j };
}

// Adressen till en version av bilden som är minst `bredd` pixlar bred (WebP), till exempel för texturer.
export function bildUrl(v, bredd = 960) {
  const k = kallor(v);
  if (!k) return v.bild;
  const [w] = k.b.find(([w]) => w >= bredd) || k.b.at(-1);
  return `${k.mapp}${k.namn}-${w}.webp`;
}

// Ett fotografi som <picture>. sizes beskriver hur brett det visas. ivrig = laddas direkt (bilden högst upp).
export function bild(v, { sizes, ivrig = false, alt = v.titel } = {}) {
  const k = kallor(v);
  const img = el("img", { src: v.bild, alt, decoding: "async", loading: ivrig ? null : "lazy", fetchpriority: ivrig ? "high" : null });
  if (!k) return img;
  // "auto" låter webbläsaren räkna ut bredden själv för bilder som laddas lat; resten är reserv.
  const s = sizes || (ivrig ? "100vw" : "auto, (max-width: 760px) 50vw, 240px");
  img.setAttribute("srcset", k.jpg); img.setAttribute("sizes", s);
  return el("picture", {}, el("source", { type: "image/avif", srcset: k.avif, sizes: s }), el("source", { type: "image/webp", srcset: k.webp, sizes: s }), img);
}
// Största bredden som finns, för visaren som annars skulle förstora små bilder.
export const bildBredd = (v) => kallor(v)?.max || null;
// Ett verk i full storlek (visaren): aldrig bredare än skärmen, än den största filen eller än höjden tillåter.
export const storBild = (v) => bild(v, { ivrig: true, sizes: `min(100vw, ${bildBredd(v) || 720}px, ${Math.round((v.format || 1.5) * 100)}vh)` });

// En liten bild av verket: foto, videostill eller ett kort i kanalens färg.
export function tumnagel(v) {
  if (v.bild) return bild(v);
  const [bg, fg] = kanalFarg(v.kanal);
  const d = el("div", { class: "ytthumb", style: `background:${bg};color:${fg}` }, el("small", {}, "▶ " + v.kanal), el("strong", {}, v.titel));
  if (!PREVIEW && v.youtube) {
    const i = el("img", { src: ytBild(v), alt: "", loading: "lazy" });
    i.onerror = () => i.remove();
    d.style.position = "relative";
    d.prepend(i);
  }
  return d;
}

export function papper(wide) {
  const p = el("section", { class: "paper in" + (wide ? " wide" : "") });
  p.append(el("span", { class: "hal a", "aria-hidden": "true" }), el("span", { class: "hal b", "aria-hidden": "true" }));
  return p;
}
export function huvud(form, titel) {
  return el("div", { class: "head" }, el("div", { class: "org" }, S.namn), el("div", { class: "form" }, form), el("h1", {}, titel));
}
export function kontaktRuta(dnr) {
  const rad = (k, v, href) =>
    el("div", { class: "row" }, el("span", {}, k), v ? (href ? el("a", { href }, v) : el("span", { class: "mono" }, v)) : el("span", { class: "mono" }, t("[läggs in i content/verket.md]")));
  return el("div", { class: "kontakt" },
    el("p", { style: "margin:0 0 6px;font-weight:700" }, t("Handläggning begärs per e-post eller telefon.")),
    rad(t("E-post"), S.epost, S.epost ? "mailto:" + S.epost + (dnr ? "?subject=" + encodeURIComponent(t("Ärende {dnr}", { dnr })) : "") : null),
    rad(t("Telefon"), S.telefon, S.telefon ? "tel:" + S.telefon.replace(/\s/g, "") : null),
    S.instagram ? rad("Instagram", S.instagram, "https://instagram.com/" + S.instagram.replace(/^@/, "")) : null,
    dnr ? rad(t("Ange"), dnr) : null);
}
export const idag = () => new Date().toISOString().slice(0, 10);
