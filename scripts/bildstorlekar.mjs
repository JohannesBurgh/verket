// Tar fram storlekar (AVIF, WebP, JPEG) för bilder som redan finns på sajten.
// Intaget gör detta själv för nytt material, så skriptet behövs bara när något saknas.
//
//   npm run bildstorlekar             skapar det som saknas
//   npm run bildstorlekar -- --alla   gör om allt
//   npm run bildstorlekar -- --lista  listar bilder som saknar full upplösning, och vilken originalfil som behövs
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { MEDIA, STEG, lasRegister, sparaRegister, skapaStorlekar, komplett } from "./bilder.mjs";

const VERK = path.resolve("content/verk");
const alla = process.argv.includes("--alla"), lista = process.argv.includes("--lista");

const verk = fs.readdirSync(VERK).filter((f) => f.endsWith(".md")).sort().map((f) => ({ id: f.slice(0, -3), ...matter(fs.readFileSync(path.join(VERK, f), "utf8")).data }));
const reg = lasRegister();

if (lista) {
  const smal = verk.filter((v) => v.bild && v.synlig !== false && reg[v.bild] && Math.max(...reg[v.bild].b.at(-1)) < STEG.at(-1));
  console.log(`${smal.length} synliga bilder är mindre än ${STEG.at(-1)} pixlar. Lägg originalen i inkorg/ och kör npm run intag.\n`);
  console.log("| Verk | Titel | Originalfil | Nu |\n|---|---|---|---|");
  for (const v of smal) console.log(`| ${v.id} | ${v.titel} | ${v.original || "[okänd]"} | ${reg[v.bild].b.at(-1).join("×")} |`);
  process.exit(0);
}

const bilder = [...new Set(verk.map((v) => v.bild).filter(Boolean))];
let gjorda = 0, saknas = 0;
for (const b of bilder) {
  if (!fs.existsSync(path.join(MEDIA, b))) { console.log(`  saknas: public/media/${b}`); saknas++; continue; }
  if (!alla && komplett(b, reg[b])) continue;
  reg[b] = await skapaStorlekar(path.join(MEDIA, b), b, { huvud: false });
  gjorda++;
  process.stdout.write(`  ${b}  ${reg[b].b.map((x) => x[0]).join(", ")}\n`);
}
// Poster för bilder som inte längre används tas bort ur registret.
for (const k of Object.keys(reg)) if (!k.startsWith("_") && !bilder.includes(k)) delete reg[k];
sparaRegister(reg);
console.log(gjorda ? `\nKlart. ${gjorda} bilder fick nya storlekar.` : "\nAlla bilder har redan sina storlekar.");
if (saknas) process.exitCode = 1;
