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
