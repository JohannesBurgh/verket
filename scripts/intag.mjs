// Intaget: gör om allt i inkorg/ till verk på sajten.
//   Bilder (jpg, png, tif, webp) → tre storlekar i AVIF, WebP och JPEG (se scripts/bilder.mjs) + en textfil per verk.
//   En bild som heter som originalet till ett befintligt verk (fältet original:), eller som verket självt
//   (till exempel 057-rattan.jpg), ersätter verkets bild i stället för att bli ett nytt verk.
//   Filmer (mp4, mov, webm)      → kopieras till public/media/film/.
//   youtube.txt                  → en rad per film: länk | titel | kanal | år
//   En textfil med samma namn som bilden (bild.txt) blir titel (första raden) och text (resten).
// Kör: npm run intag
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import exifr from "exifr";
import matter from "gray-matter";
import { lasRegister, sparaRegister, skapaStorlekar } from "./bilder.mjs";

const IN = path.resolve("inkorg"), KLART = path.join(IN, "klart");
const VERK = path.resolve("content/verk"), BILDER = path.resolve("public/media/bilder"), FILM = path.resolve("public/media/film");
[KLART, VERK, BILDER, FILM].forEach((d) => fs.mkdirSync(d, { recursive: true }));

const slug = (t) => t.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "verk";
const q = (s) => JSON.stringify(s);
const nastaNummer = () => {
  const n = fs.readdirSync(VERK).map((f) => parseInt(f, 10)).filter((x) => !isNaN(x));
  return (n.length ? Math.max(...n) : 0) + 1;
};
function skriv(fil, rader, text = "") {
  const ut = path.join(VERK, fil);
  if (fs.existsSync(ut)) { console.log(`  hoppar över, finns redan: ${fil}`); return false; }
  fs.writeFileSync(ut, ["---", ...rader, "---", text].join("\n").trimEnd() + "\n");
  return true;
}
function sidotext(bas) {
  const t = path.join(IN, bas + ".txt");
  if (!fs.existsSync(t)) return null;
  const [titel, ...rest] = fs.readFileSync(t, "utf8").split(/\r?\n/);
  fs.renameSync(t, path.join(KLART, bas + ".txt"));
  return { titel: titel.trim(), text: rest.join("\n").trim() };
}

let antal = 0, ersatta = 0;
const filer = fs.readdirSync(IN).filter((f) => fs.statSync(path.join(IN, f)).isFile());
const reg = lasRegister();

// Befintliga verk, för att känna igen original som ska ersätta en mindre bild.
const nyckel = (f) => path.parse(String(f)).name.toLowerCase().normalize("NFC");
const befintliga = new Map();
for (const f of fs.readdirSync(VERK).filter((f) => f.endsWith(".md"))) {
  const d = matter(fs.readFileSync(path.join(VERK, f), "utf8")).data;
  if (!d.bild) continue;
  const post = { fil: f, bild: d.bild, format: Number(d.format) || null };
  befintliga.set(nyckel(f), { ...post, sakert: true });
  if (d.original && !befintliga.has(nyckel(d.original))) befintliga.set(nyckel(d.original), post);
}
const formatAv = async (src) => {
  const m = await sharp(src).metadata(), v = (m.orientation || 1) >= 5;
  return v ? m.height / m.width : m.width / m.height;
};

for (const f of filer.filter((f) => /\.(jpe?g|png|tiff?|webp)$/i.test(f))) {
  const src = path.join(IN, f), bas = path.parse(f).name;
  let finns = befintliga.get(nyckel(f));
  // Samma filnamn som ett gammalt original räcker inte: bilden måste också ha samma form (kameror upprepar filnamn).
  if (finns && !finns.sakert && finns.format && Math.abs((await formatAv(src)) - finns.format) / finns.format > 0.03) {
    console.log(`  ! ${f} heter som originalet till ${finns.fil.slice(0, -3)} men har en annan form. Blir ett nytt verk.`);
    finns = null;
  }
  if (finns) {
    // Ersätt bilden i ett befintligt verk. Texten i verkfilen rörs inte, utom format om bilden har en annan form.
    reg[finns.bild] = await skapaStorlekar(src, finns.bild);
    const [w, h] = reg[finns.bild].b.at(-1), format = +(w / h).toFixed(3);
    if (finns.format && Math.abs(format - finns.format) / finns.format > 0.02) {
      const md = path.join(VERK, finns.fil);
      fs.writeFileSync(md, fs.readFileSync(md, "utf8").replace(/^format:.*$/m, `format: ${format}`));
    }
    ersatta++;
    console.log(`  ~ ${finns.fil.slice(0, -3)}  ny bild, största storlek ${w}×${h}`);
    fs.renameSync(src, path.join(KLART, f));
    continue;
  }
  const sid = sidotext(bas);
  const nr = String(nastaNummer()).padStart(3, "0"), titel = sid?.titel || bas.replace(/[_-]+/g, " ").trim();
  const id = `${nr}-${slug(titel)}`, bildfil = `${id}.jpg`;
  let datum = null;
  try { const e = await exifr.parse(src, ["DateTimeOriginal", "CreateDate"]); const d = e?.DateTimeOriginal || e?.CreateDate; if (d) datum = new Date(d).toISOString().slice(0, 10); } catch (e) {}
  const meta = await sharp(src).metadata();
  const orient = (meta.orientation || 1) >= 5;
  const w = orient ? meta.height : meta.width, h = orient ? meta.width : meta.height;
  reg["bilder/" + bildfil] = await skapaStorlekar(src, "bilder/" + bildfil);
  const { dominant } = await sharp(src).rotate().resize(40, 40, { fit: "inside" }).stats();
  const [r, g, b] = [dominant.r / 255, dominant.g / 255, dominant.b / 255], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let nyans = 0; if (mx !== mn) { nyans = mx === r ? ((g - b) / (mx - mn)) % 6 : mx === g ? (b - r) / (mx - mn) + 2 : (r - g) / (mx - mn) + 4; nyans = Math.round((nyans * 60 + 360) % 360); }
  const ljushet = +(0.299 * r + 0.587 * g + 0.114 * b).toFixed(2), mattnad = +(mx ? (mx - mn) / mx : 0).toFixed(2);
  if (skriv(`${id}.md`, [
    `titel: ${q(titel)}`, `datum: ${datum ? q(datum) : "null"}`, "typ: foto", `bild: ${q("bilder/" + bildfil)}`,
    `format: ${(w / h).toFixed(3)}`, `epok: ""`, `avdelning: "Övrigt"`, `vikt: "frö"`, "synlig: true",
    `farg: {nyans: ${nyans}, mattnad: ${mattnad}, ljushet: ${ljushet}}`, "ton: {stilla: 1}", `original: ${q(f)}`,
  ], sid?.text || "")) { antal++; console.log(`  + ${id}  (${datum || "utan datum"}, största storlek ${reg["bilder/" + bildfil].b.at(-1).join("×")})`); }
  befintliga.set(nyckel(f), { fil: `${id}.md`, bild: "bilder/" + bildfil, format: +(w / h).toFixed(3) });
  fs.renameSync(src, path.join(KLART, f));
}
sparaRegister(reg);

for (const f of filer.filter((f) => /\.(mp4|mov|webm|m4v)$/i.test(f))) {
  const bas = path.parse(f).name, sid = sidotext(bas), titel = sid?.titel || bas.replace(/[_-]+/g, " ").trim();
  const id = `v${String(nastaNummer()).padStart(3, "0")}-${slug(titel)}`, ext = path.extname(f).toLowerCase();
  fs.copyFileSync(path.join(IN, f), path.join(FILM, id + ext));
  if (skriv(`${id}.md`, [`titel: ${q(titel)}`, "datum: null", "typ: video", `video: ${q("film/" + id + ext)}`, "format: 1.778",
    `epok: ""`, `avdelning: "Övrigt"`, `vikt: "frö"`, "synlig: true", "ton: {rorligt: 1}"], sid?.text || "")) { antal++; console.log(`  + ${id}  (film, lägg gärna en stillbild som bild:)`); }
  fs.renameSync(path.join(IN, f), path.join(KLART, f));
}

const yt = path.join(IN, "youtube.txt");
if (fs.existsSync(yt)) {
  for (const rad of fs.readFileSync(yt, "utf8").split(/\r?\n/).map((r) => r.trim()).filter((r) => r && !r.startsWith("#"))) {
    const [url, titel = "", kanal = "", ar = ""] = rad.split("|").map((x) => x.trim());
    const m = url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/); if (!m) { console.log(`  kunde inte läsa: ${rad}`); continue; }
    const t = titel || m[1], id = `film-${slug(t)}`;
    if (skriv(`${id}.md`, [`titel: ${q(t)}`, `datum: ${ar ? q(ar) : "null"}`, "typ: youtube", `youtube: ${q(m[1])}`, `kanal: ${q(kanal || "YouTube")}`,
      "format: 1.778", `epok: ${q(kanal || "")}`, `avdelning: "Övrigt"`, `vikt: "frö"`, "synlig: true", "ton: {rorligt: 1}"])) { antal++; console.log(`  + ${id}`); }
  }
  fs.renameSync(yt, path.join(KLART, `youtube-${Date.now()}.txt`));
}

if (ersatta) console.log(`\n${ersatta} befintliga verk fick bild i full upplösning.`);
console.log(antal ? `\nKlart. ${antal} nya verk. Justera titel, avdelning och vikt i content/verk/ vid behov.` : ersatta ? "" : "\nInkorgen var tom.");
