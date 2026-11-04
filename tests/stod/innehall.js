// Läser content/ på samma sätt som vite.config.js, så att testerna vet vad sajten
// borde visa utan att några antal skrivs in för hand. Växer arkivet, växer testerna med.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const ROT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CONTENT = path.join(ROT, "content");
const md = (dir) => {
  const p = path.join(CONTENT, dir);
  return fs.existsSync(p) ? fs.readdirSync(p).filter((f) => f.endsWith(".md")).sort() : [];
};

// Samma fält och standardvärden som i vite.config.js.
export const ALLA_VERK = md("verk").map((f) => {
  const { data } = matter(fs.readFileSync(path.join(CONTENT, "verk", f), "utf8"));
  const datum = data.datum ? String(data.datum) : null;
  let ar = null;
  const m = datum && datum.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
  if (m) ar = +m[1] + ((+(m[2] || 7) - 1) + (+(m[3] || 1) - 1) / 31) / 12;
  return {
    id: f.replace(/\.md$/, ""),
    titel: data.titel,
    datum,
    ar,
    gissat: !!data.datum_gissat,
    typ: data.typ || "foto",
    bild: data.bild ? "media/" + data.bild : null,
    video: data.video ? "media/" + data.video : null,
    youtube: data.youtube || null,
    kanal: data.kanal || null,
    epok: data.epok || "",
    avdelning: data.avdelning || "Övrigt",
    vikt: data.vikt || "frö",
    synlig: data.synlig !== false,
  };
});
export const VERK = ALLA_VERK.filter((v) => v.synlig);
export const byId = Object.fromEntries(VERK.map((v) => [v.id, v]));

// Ärenden. Utkast (uppdrag 4) finns bara i dev och testas därför inte mot bygget.
export const ARENDEN = md("arenden").map((f) => {
  const { data, content } = matter(fs.readFileSync(path.join(CONTENT, "arenden", f), "utf8"));
  const verkrader = [...content.matchAll(/^::verk\s+(.+)$/gm)].map((r) => r[1].trim().split(/\s+/));
  return { id: f.replace(/\.md$/, ""), ...data, verkrader };
}).filter((a) => a.utkast !== true);

export const VERKET = matter(fs.readFileSync(path.join(CONTENT, "verket.md"), "utf8")).data;
export const ANSOKAN = JSON.parse(fs.readFileSync(path.join(CONTENT, "ansokan.json"), "utf8"));

// Samma text som metaRad() i src/data.js. Används bara för att skilja verk med samma titel åt.
export function metaRad(v) {
  const nar = v.kanal === "Absurdimo" && !v.datum ? "år ej fastställt" : !v.datum ? "Odaterad" : v.datum.slice(0, 4) + (v.gissat ? " (uppskattat)" : "");
  return /\d{4}/.test(v.epok) && !v.gissat ? v.epok : `${v.epok} · ${nar}`;
}

// Hittar verket bakom en bilaga utifrån det som syns på sidan: titeln, och vid behov raden under.
export function hittaVerk(titel, meta) {
  let kand = VERK.filter((v) => v.titel === titel?.trim());
  if (kand.length > 1 && meta) kand = kand.filter((v) => metaRad(v) === meta.trim());
  if (kand.length !== 1) throw new Error(`Kan inte avgöra vilket verk som visas: "${titel}" (${kand.length} träffar i content/verk).`);
  return kand[0];
}

// Samma sökning som i Registret (src/vyer/registret.js).
export function sokRegistret(q, filter = () => true) {
  const s = q.trim().toLowerCase();
  return VERK.filter((v) => filter(v) && (!s || (v.titel + " " + v.epok + " " + (v.kanal || "") + " " + (v.datum || "")).toLowerCase().includes(s)));
}

// ---------- den engelska sidan (uppdrag 9) ----------
// content/en/ läses på samma sätt som scripts/sprak.mjs gör, så att testerna vet vad den engelska sidan borde visa.
const EN_MAPP = path.join(CONTENT, "en");
const lasEn = (p, tolk) => {
  const f = path.join(EN_MAPP, p);
  if (!fs.existsSync(f)) return null;
  const t = fs.readFileSync(f, "utf8");
  return tolk === "json" ? JSON.parse(t) : tolk === "yaml" ? matter.engines.yaml.parse(t) || {} : matter(t);
};
const ENVERK = lasEn("verk.yml", "yaml") || {};
const ORD = lasEn("gransnitt.json", "json") || {};
const ENANS = lasEn("ansokan.json", "json") || {};
export const EN = {
  verket: { ...VERKET, ...(lasEn("verket.md")?.data || {}) },
  /** Gränssnittets text på engelska, som t() på sajten. */
  t: (sv, v) => { const s = ORD[sv] || sv; return v ? s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)) : s; },
  /** Verkets titel på engelska. */
  titel: (v) => ENVERK.verk?.[v.id]?.titel || v.titel,
  avdelning: (a) => ENVERK.avdelningar?.[a] || a,
  epok: (e) => ENVERK.epoker?.[e] || e,
  beslut: Object.fromEntries(Object.entries(ANSOKAN.beslut).map(([k, b]) => [k, { ...b, ...(ENANS.beslut?.[k] || {}) }])),
  underskrift: ENANS.underskrift?.rubrik || ANSOKAN.underskrift.rubrik,
  arende: (id) => lasEn(`arenden/${id}.md`)?.data || null,
};

// Samma text som metaRad() på den engelska sidan.
export function metaRadEn(v) {
  const nar = v.kanal === "Absurdimo" && !v.datum ? EN.t("år ej fastställt") : !v.datum ? EN.t("Odaterad") : v.datum.slice(0, 4) + (v.gissat ? " " + EN.t("(uppskattat)") : "");
  return /\d{4}/.test(v.epok) && !v.gissat ? EN.epok(v.epok) : `${EN.epok(v.epok)} · ${nar}`;
}
// Hittar verket bakom en bilaga på den engelska sidan.
export function hittaVerkEn(titel, meta) {
  let kand = VERK.filter((v) => EN.titel(v) === titel?.trim());
  if (kand.length > 1 && meta) kand = kand.filter((v) => metaRadEn(v) === meta.trim());
  if (kand.length !== 1) throw new Error(`Kan inte avgöra vilket verk som visas på den engelska sidan: "${titel}" (${kand.length} träffar).`);
  return kand[0];
}
