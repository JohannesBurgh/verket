// Kontrollerar innehållet: saknade bilder, okända verk i ärenden, stavfel i fält.
// Kör: npm run kontroll
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const fel = [], varn = [];
const VERK = path.resolve("content/verk"), MEDIA = path.resolve("public/media");
const ids = new Set();
const VIKT = ["hjälte", "frö", "damm"], TYP = ["foto", "video", "youtube"];
const DIMS = ["allvar", "lek", "stilla", "rorligt", "scen", "manniska", "ljus", "skruv", "uppdrag", "konst"];
for (const f of fs.readdirSync(VERK).filter((f) => f.endsWith(".md"))) {
  const id = f.slice(0, -3); ids.add(id);
  let d; try { d = matter(fs.readFileSync(path.join(VERK, f), "utf8")).data; } catch (e) { fel.push(`${f}: kan inte läsas (${e.message.split("\n")[0]})`); continue; }
  if (!d.titel) fel.push(`${f}: saknar titel`);
  if (!TYP.includes(d.typ)) fel.push(`${f}: typ måste vara ${TYP.join(", ")}`);
  if (d.vikt && !VIKT.includes(d.vikt)) fel.push(`${f}: vikt måste vara ${VIKT.join(", ")}`);
  for (const k of ["bild", "video"]) if (d[k] && !fs.existsSync(path.join(MEDIA, d[k]))) fel.push(`${f}: hittar inte public/media/${d[k]}`);
  if (d.typ === "youtube" && !/^[\w-]{11}$/.test(d.youtube || "")) fel.push(`${f}: ogiltigt youtube-id`);
  for (const k of Object.keys(d.ton || {})) if (!DIMS.includes(k)) varn.push(`${f}: okänd ton "${k}"`);
  if (d.datum && !/^\d{4}(-\d{2}){0,2}$/.test(String(d.datum))) varn.push(`${f}: datum bör skrivas ÅÅÅÅ-MM-DD`);
}
const AR = path.resolve("content/arenden");
for (const f of fs.existsSync(AR) ? fs.readdirSync(AR).filter((f) => f.endsWith(".md")) : []) {
  const { data, content } = matter(fs.readFileSync(path.join(AR, f), "utf8"));
  if (data.omslag && !ids.has(data.omslag)) fel.push(`arenden/${f}: omslag "${data.omslag}" finns inte`);
  for (const m of content.matchAll(/^::verk\s+(.+)$/gm)) for (const id of m[1].trim().split(/\s+/)) if (!ids.has(id)) fel.push(`arenden/${f}: verket "${id}" finns inte`);
}
try { JSON.parse(fs.readFileSync("content/ansokan.json", "utf8")); } catch (e) { fel.push("content/ansokan.json: felaktig JSON (" + e.message + ")"); }
varn.forEach((v) => console.log("varning: " + v));
fel.forEach((v) => console.log("FEL: " + v));
console.log(fel.length ? `\n${fel.length} fel.` : `\nAllt i ordning. ${ids.size} verk.`);
process.exit(fel.length ? 1 : 0);
