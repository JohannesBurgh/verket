// Kontrollerar innehållet: saknade bilder, okända verk i ärenden, stavfel i fält.
// Kör: npm run kontroll
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const fel = [], varn = [];
const VERK = path.resolve("content/verk"), MEDIA = path.resolve("public/media");
const ids = new Set(), dolda = new Set();
const VIKT = ["hjälte", "frö", "damm"], TYP = ["foto", "video", "youtube"];
const DIMS = ["allvar", "lek", "stilla", "rorligt", "scen", "manniska", "ljus", "skruv", "uppdrag", "konst"];
for (const f of fs.readdirSync(VERK).filter((f) => f.endsWith(".md"))) {
  const id = f.slice(0, -3); ids.add(id);
  let d; try { d = matter(fs.readFileSync(path.join(VERK, f), "utf8")).data; } catch (e) { fel.push(`${f}: kan inte läsas (${e.message.split("\n")[0]})`); continue; }
  if (d.synlig === false) dolda.add(id);
  if (!d.titel) fel.push(`${f}: saknar titel`);
  if (!TYP.includes(d.typ)) fel.push(`${f}: typ måste vara ${TYP.join(", ")}`);
  if (d.vikt && !VIKT.includes(d.vikt)) fel.push(`${f}: vikt måste vara ${VIKT.join(", ")}`);
  for (const k of ["bild", "video"]) if (d[k] && !fs.existsSync(path.join(MEDIA, d[k]))) fel.push(`${f}: hittar inte public/media/${d[k]}`);
  if (d.typ === "youtube" && !/^[\w-]{11}$/.test(d.youtube || "")) fel.push(`${f}: ogiltigt youtube-id`);
  for (const k of Object.keys(d.ton || {})) if (!DIMS.includes(k)) varn.push(`${f}: okänd ton "${k}"`);
  if (d.datum && !/^\d{4}(-\d{2}){0,2}$/.test(String(d.datum))) varn.push(`${f}: datum bör skrivas ÅÅÅÅ-MM-DD`);
}
const AR = path.resolve("content/arenden");
let antalArenden = 0, antalUtkast = 0;
for (const f of fs.existsSync(AR) ? fs.readdirSync(AR).filter((f) => f.endsWith(".md")) : []) {
  const { data, content } = matter(fs.readFileSync(path.join(AR, f), "utf8"));
  antalArenden++;
  // utkast: true visas bara i npm run dev. Allt utom false räknas som utkast (se vite.config.js).
  const utkast = data.utkast != null && data.utkast !== false;
  if (utkast) antalUtkast++;
  if (data.utkast != null && typeof data.utkast !== "boolean") varn.push(`arenden/${f}: utkast bör vara true eller false (räknas nu som utkast)`);
  if (!data.titel) fel.push(`arenden/${f}: saknar titel`);
  if (!data.diarienummer) varn.push(`arenden/${f}: saknar diarienummer`);
  // Obesvarade frågor i ett ärende som publiceras. Kommentarer <!-- --> visas inte och räknas inte.
  if (!utkast) {
    const synligt = [data.titel, data.period, data.ingress, content.replace(/<!--[\s\S]*?-->/g, "")].join("\n");
    const n = synligt.match(/\[JOHAN:/g)?.length || 0;
    if (n) varn.push(`arenden/${f}: ${n} obesvarad${n === 1 ? "" : "e"} [JOHAN: …] i ett ärende som publiceras`);
  }
  if (data.omslag && !ids.has(data.omslag)) fel.push(`arenden/${f}: omslag "${data.omslag}" finns inte`);
  for (const m of content.matchAll(/^::verk\s+(.+)$/gm)) for (const id of m[1].trim().split(/\s+/)) if (!ids.has(id)) fel.push(`arenden/${f}: verket "${id}" finns inte`); else if (dolda.has(id)) varn.push(`arenden/${f}: verket "${id}" har synlig: false och visas inte`);
}
// Bildstorlekar (uppdrag 6): varje bild ska ha sina storlekar, annars visas bara huvudbilden.
{ const { lasRegister, komplett } = await import("./bilder.mjs"), reg = lasRegister(); let n = 0;
  for (const f of fs.readdirSync(VERK).filter((f) => f.endsWith(".md"))) { const b = matter(fs.readFileSync(path.join(VERK, f), "utf8")).data.bild; if (b && fs.existsSync(path.join(MEDIA, b)) && !komplett(b, reg[b])) n++; }
  if (n) varn.push(`${n} bilder saknar storlekar (AVIF, WebP). Kör npm run bildstorlekar.`); }
try { JSON.parse(fs.readFileSync("content/ansokan.json", "utf8")); } catch (e) { fel.push("content/ansokan.json: felaktig JSON (" + e.message + ")"); }
varn.forEach((v) => console.log("varning: " + v));
fel.forEach((v) => console.log("FEL: " + v));
const arendeRad = `${antalArenden} ärenden` + (antalUtkast ? `, varav ${antalUtkast} utkast som inte publiceras` : "");
console.log(fel.length ? `\n${fel.length} fel.` : `\nAllt i ordning. ${ids.size} verk. ${arendeRad}.`);
process.exit(fel.length ? 1 : 0);
