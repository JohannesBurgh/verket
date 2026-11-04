// Bildstorlekar: gemensamt för intaget och för befintliga bilder.
//
// Varje bild finns i upp till tre storlekar (längsta sidan 480, 960 och 1600 pixlar)
// i AVIF och WebP, med JPEG som reserv. Sajten väljer själv rätt fil med srcset.
//
//   public/media/bilder/057.jpg                  huvudbilden (högst 960 px), används som reserv och i Arkivrummet
//   public/media/bilder/storlek/057-480.avif     storlekarna, namngivna efter bredden i pixlar
//   content/bilder.json                          förteckning över vilka storlekar som finns
//
// Bilder som är mindre än 1600 pixlar förstoras aldrig. Då blir största storleken
// bildens egen bredd.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

export const MEDIA = path.resolve("public/media");
export const STORLEK = path.join(MEDIA, "bilder", "storlek");
export const REGISTER = path.resolve("content/bilder.json");
export const STEG = [480, 960, 1600];
export const HUVUD = 960;
const KVALITET = { avif: { quality: 52, effort: 5 }, webp: { quality: 78, effort: 5 }, jpg: { quality: 80, mozjpeg: true, progressive: true } };

sharp.cache(false);

// Vilka storlekar (längsta sida) en bild med längsta sidan `lang` ska ha.
export function stegFor(lang) {
  const s = STEG.filter((x) => x <= lang);
  if (lang < STEG.at(-1) && (!s.length || lang > s.at(-1) * 1.15)) s.push(lang);
  return s;
}
const matt = (w, h, lang) => {
  const k = Math.min(1, lang / Math.max(w, h));
  return [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))];
};

export function lasRegister() {
  try { return JSON.parse(fs.readFileSync(REGISTER, "utf8")); } catch { return {}; }
}
export function sparaRegister(reg) {
  // En rad per bild, så att ändringar syns tydligt i git.
  const rader = [`"_om": ${JSON.stringify("Skapas av npm run intag och npm run bildstorlekar. Ändra inte för hand.")}`,
    ...Object.keys(reg).filter((k) => !k.startsWith("_")).sort().map((k) => `${JSON.stringify(k)}: ${JSON.stringify(reg[k])}`)];
  fs.writeFileSync(REGISTER, "{\n  " + rader.join(",\n  ") + "\n}\n");
}

// Filnamnet för en storlek. bildfil är "bilder/057.jpg".
export const variant = (bildfil, bredd, ext) => `bilder/storlek/${path.parse(bildfil).name}-${bredd}.${ext}`;

/**
 * Skapar huvudbild och alla storlekar ur en källfil.
 *   kalla     sökväg till originalet (eller till en befintlig huvudbild)
 *   bildfil   "bilder/057.jpg", relativt public/media
 *   huvud     true = skriv även om huvudbilden (vid intag och när ett original ersätter en liten bild)
 * Returnerar posten till registret: { b: [[bredd, höjd], …], j: huvudbildens bredd }.
 */
export async function skapaStorlekar(kalla, bildfil, { huvud = true } = {}) {
  fs.mkdirSync(STORLEK, { recursive: true });
  const indata = fs.readFileSync(kalla); // läses först, så att källan får vara samma fil som skrivs över
  const bas = sharp(indata, { failOn: "none" }).rotate();
  const meta = await sharp(indata).metadata();
  const vriden = (meta.orientation || 1) >= 5;
  const W = vriden ? meta.height : meta.width, H = vriden ? meta.width : meta.height;
  const lang = Math.max(W, H);

  // Gamla storlekar av samma bild tas bort, så att inget ligger kvar om storleken ändrats.
  const namn = path.parse(bildfil).name;
  for (const f of fs.readdirSync(STORLEK)) if (f.startsWith(namn + "-") && /^\d+\.(avif|webp|jpg)$/.test(f.slice(namn.length + 1))) fs.unlinkSync(path.join(STORLEK, f));

  const [jw, jh] = matt(W, H, Math.min(HUVUD, lang));
  if (huvud) {
    await bas.clone().resize(jw, jh).jpeg(KVALITET.jpg).toFile(path.join(MEDIA, bildfil));
  }
  const b = [];
  for (const s of stegFor(lang)) {
    const [w, h] = matt(W, H, s), r = bas.clone().resize(w, h);
    await r.clone().avif(KVALITET.avif).toFile(path.join(MEDIA, variant(bildfil, w, "avif")));
    await r.clone().webp(KVALITET.webp).toFile(path.join(MEDIA, variant(bildfil, w, "webp")));
    if (w !== jw) await r.clone().jpeg(KVALITET.jpg).toFile(path.join(MEDIA, variant(bildfil, w, "jpg")));
    b.push([w, h]);
  }
  return { b, j: jw };
}

// Sökväg till den största JPEG som finns för en bild (för delningsbilder och liknande).
export function storstaJpeg(bildfil, post) {
  if (!post) return path.join(MEDIA, bildfil);
  const [w] = post.b.at(-1);
  return w === post.j ? path.join(MEDIA, bildfil) : path.join(MEDIA, variant(bildfil, w, "jpg"));
}

// Finns alla filer som registret säger?
export function komplett(bildfil, post) {
  if (!post || !fs.existsSync(path.join(MEDIA, bildfil))) return false;
  return post.b.every(([w]) => ["avif", "webp", ...(w === post.j ? [] : ["jpg"])].every((e) => fs.existsSync(path.join(MEDIA, variant(bildfil, w, e)))));
}
