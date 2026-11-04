// Ikoner ur emblemet (cirkeln med den lime handen), i alla storlekar som webbläsare och telefoner frågar efter.
// Skriver till public/: favicon.ico (16, 32, 48), ikon.svg, apple-touch-icon.png (180), ikon-192.png, ikon-512.png
// och site.webmanifest. Behöver bara köras om emblemet ändras: npm run ikoner
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import matter from "gray-matter";

const UT = path.resolve("public");
const RUM = "#0f1315", PAPPER = "#e8ecec", HAND = "#d4ff3f";
const verket = matter(fs.readFileSync("content/verket.md", "utf8")).data;

// Emblemet som i menyraden: två ringar och tre streck. I små storlekar blir strecken grövre och den inre ringen faller bort.
const emblem = (liten) => `
  <circle cx="20" cy="20" r="${liten ? 16.2 : 18.5}" fill="none" stroke="${PAPPER}" stroke-width="${liten ? 2.6 : 1.5}"/>
  ${liten ? "" : `<circle cx="20" cy="20" r="14" fill="none" stroke="${PAPPER}" stroke-width=".8"/>`}
  <g stroke="${HAND}" stroke-width="${liten ? 3.6 : 2.4}" stroke-linecap="round"><path d="M20 ${liten ? 10.5 : 12}v${liten ? 19 : 16}"/><path d="M${liten ? 11.8 : 13.1} ${liten ? 15.25 : 16}l${liten ? 16.4 : 13.8} ${liten ? 9.5 : 8}"/><path d="M${liten ? 11.8 : 13.1} ${liten ? 24.75 : 24}l${liten ? 16.4 : 13.8}-${liten ? 9.5 : 8}"/></g>`;

// Rund ikon på mörk botten (flikar och bokmärken).
const rund = (liten) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="${RUM}"/>${emblem(liten)}</svg>`;
// Fyrkantig ikon med luft runt (hemskärm; telefonen rundar själv hörnen och kan beskära till en cirkel).
const fyrkant = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="${RUM}"/><g transform="translate(20 20) scale(.66) translate(-20 -20)">${emblem(false)}</g></svg>`;

const png = (svg, s) => sharp(Buffer.from(svg), { density: Math.max(72, (s / 40) * 72 * 2) }).resize(s, s).png({ compressionLevel: 9 }).toBuffer();

// .ico med PNG-bilder inuti (stöds av alla webbläsare sedan länge).
function ico(bilder) {
  const huvud = Buffer.alloc(6 + 16 * bilder.length);
  huvud.writeUInt16LE(0, 0); huvud.writeUInt16LE(1, 2); huvud.writeUInt16LE(bilder.length, 4);
  let pos = huvud.length;
  bilder.forEach(({ s, data }, i) => {
    const o = 6 + 16 * i;
    huvud.writeUInt8(s >= 256 ? 0 : s, o); huvud.writeUInt8(s >= 256 ? 0 : s, o + 1);
    huvud.writeUInt16LE(1, o + 4); huvud.writeUInt16LE(32, o + 6);
    huvud.writeUInt32LE(data.length, o + 8); huvud.writeUInt32LE(pos, o + 12);
    pos += data.length;
  });
  return Buffer.concat([huvud, ...bilder.map((b) => b.data)]);
}

fs.writeFileSync(path.join(UT, "ikon.svg"), rund(true).replace(/\n\s*/g, "") + "\n");
fs.writeFileSync(path.join(UT, "favicon.ico"), ico(await Promise.all([16, 32, 48].map(async (s) => ({ s, data: await png(rund(true), s) })))));
fs.writeFileSync(path.join(UT, "apple-touch-icon.png"), await png(fyrkant, 180));
for (const s of [192, 512]) fs.writeFileSync(path.join(UT, `ikon-${s}.png`), await png(fyrkant, s));
fs.writeFileSync(path.join(UT, "site.webmanifest"), JSON.stringify({
  name: verket.namn, short_name: "Verket", description: verket.undertitel, lang: "sv",
  start_url: "./", scope: "./", display: "browser", background_color: RUM, theme_color: RUM,
  icons: [
    { src: "ikon-192.png", sizes: "192x192", type: "image/png" },
    { src: "ikon-512.png", sizes: "512x512", type: "image/png" },
    { src: "ikon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    { src: "ikon.svg", sizes: "any", type: "image/svg+xml" },
  ],
}, null, 2) + "\n");
console.log("Ikoner skrivna till public/: favicon.ico, ikon.svg, apple-touch-icon.png, ikon-192.png, ikon-512.png, site.webmanifest");
