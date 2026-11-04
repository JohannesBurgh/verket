// Intaget: gör om allt i inkorg/ till verk på sajten.
//   Bilder (jpg, png, tif, webp) → nedskalade kopior + en textfil per verk.
//   Filmer (mp4, mov, webm)      → kopieras till public/media/film/.
//   youtube.txt                  → en rad per film: länk | titel | kanal | år
//   En textfil med samma namn som bilden (bild.txt) blir titel (första raden) och text (resten).
// Kör: npm run intag
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import exifr from "exifr";

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

let antal = 0;
const filer = fs.readdirSync(IN).filter((f) => fs.statSync(path.join(IN, f)).isFile());

for (const f of filer.filter((f) => /\.(jpe?g|png|tiff?|webp)$/i.test(f))) {
  const src = path.join(IN, f), bas = path.parse(f).name, sid = sidotext(bas);
  const nr = String(nastaNummer()).padStart(3, "0"), titel = sid?.titel || bas.replace(/[_-]+/g, " ").trim();
  const id = `${nr}-${slug(titel)}`, bildfil = `${id}.jpg`;
  let datum = null;
  try { const e = await exifr.parse(src, ["DateTimeOriginal", "CreateDate"]); const d = e?.DateTimeOriginal || e?.CreateDate; if (d) datum = new Date(d).toISOString().slice(0, 10); } catch (e) {}
  const bild = sharp(src).rotate();
  const meta = await bild.metadata();
  const orient = (meta.orientation || 1) >= 5;
  const w = orient ? meta.height : meta.width, h = orient ? meta.width : meta.height;
  await bild.clone().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(BILDER, bildfil));
  const { dominant } = await sharp(src).rotate().resize(40, 40, { fit: "inside" }).stats();
  const [r, g, b] = [dominant.r / 255, dominant.g / 255, dominant.b / 255], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let nyans = 0; if (mx !== mn) { nyans = mx === r ? ((g - b) / (mx - mn)) % 6 : mx === g ? (b - r) / (mx - mn) + 2 : (r - g) / (mx - mn) + 4; nyans = Math.round((nyans * 60 + 360) % 360); }
  const ljushet = +(0.299 * r + 0.587 * g + 0.114 * b).toFixed(2), mattnad = +(mx ? (mx - mn) / mx : 0).toFixed(2);
  if (skriv(`${id}.md`, [
    `titel: ${q(titel)}`, `datum: ${datum ? q(datum) : "null"}`, "typ: foto", `bild: ${q("bilder/" + bildfil)}`,
    `format: ${(w / h).toFixed(3)}`, `epok: ""`, `avdelning: "Övrigt"`, `vikt: "frö"`, "synlig: true",
    `farg: {nyans: ${nyans}, mattnad: ${mattnad}, ljushet: ${ljushet}}`, "ton: {stilla: 1}", `original: ${q(f)}`,
  ], sid?.text || "")) { antal++; console.log(`  + ${id}  (${datum || "utan datum"})`); }
  fs.renameSync(src, path.join(KLART, f));
}

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

console.log(antal ? `\nKlart. ${antal} nya verk. Justera titel, avdelning och vikt i content/verk/ vid behov.` : "\nInkorgen var tom.");
