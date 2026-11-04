// Delning: bilder och sidor som syns när någon delar en länk till Verket.
//
// När sajten byggs (npm run build) skapas i dist/:
//   dela/verket.jpg               delningsbilden för startsidan, 1200×630
//   dela/arende-<id>.jpg          en delningsbild per ärende
//   arende/<id>/index.html        en delningssida per ärende, med egna Open Graph-taggar.
//                                 Den som öppnar länken skickas vidare till ärendet (#arende-<id>).
//   sitemap.xml, robots.txt
//
// Adressen hämtas från adress: i content/verket.md. Bilden till startsidan är verket i
// delningsverk: (om fältet finns), annars det första hjälteverket. Ärenden använder sitt omslag.
//
// Bara bilderna, utan bygge: node scripts/delning.mjs [utmapp]   (standard: dist-delning/)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import matter from "gray-matter";
import { lasRegister, storstaJpeg } from "./bilder.mjs";

const HAR = path.dirname(fileURLToPath(import.meta.url));
const TYPSNITT = { sans: path.join(HAR, "typsnitt/PublicSans.ttf"), mono: path.join(HAR, "typsnitt/IBMPlexMono-Regular.ttf"), mono5: path.join(HAR, "typsnitt/IBMPlexMono-Medium.ttf") };
const F = { rum: "#0f1315", papper: "#f2f3ee", ink: "#14181a", muted: "#56626a", rule: "#c5ccc9", field: "#e1e7e3", stamp: "#bf2d25", clip: "#8f989b" };
const W = 1200, H = 630;

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const svg = (w, h, inner) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${inner}</svg>`);

// ---------- innehåll ----------
export function lasInnehall(rot = process.cwd()) {
  const c = (p) => path.join(rot, "content", p);
  const verket = matter(fs.readFileSync(c("verket.md"), "utf8")).data;
  const verk = Object.fromEntries(fs.readdirSync(c("verk")).filter((f) => f.endsWith(".md")).map((f) => [f.slice(0, -3), matter(fs.readFileSync(c("verk/" + f), "utf8")).data]));
  const arenden = (fs.existsSync(c("arenden")) ? fs.readdirSync(c("arenden")) : []).filter((f) => f.endsWith(".md")).sort()
    .map((f) => ({ id: f.slice(0, -3), ...matter(fs.readFileSync(c("arenden/" + f), "utf8")).data }))
    .filter((a) => !a.utkast);
  let adress = String(process.env.VERKET_ADRESS || verket.adress || "").trim();
  if (adress && !adress.endsWith("/")) adress += "/";
  return { verket, verk, arenden, adress };
}
const synligtFoto = (v) => v && v.bild && v.synlig !== false;
function startverk({ verket, verk }) {
  if (synligtFoto(verk[verket.delningsverk])) return verket.delningsverk;
  return Object.keys(verk).sort().find((id) => synligtFoto(verk[id]) && verk[id].vikt === "hjälte" && verk[id].typ === "foto") || Object.keys(verk).find((id) => synligtFoto(verk[id]));
}
const forstaMening = (t) => (String(t || "").match(/^.*?[.!?](\s|$)/) || [t])[0].trim();

// ---------- typografi ----------
async function text(str, { font = "sans", size, weight = 400, color = F.ink, width, tracking = 0, align = "left", radhojd, versaler = false }) {
  const fil = font === "mono" ? (weight >= 500 ? TYPSNITT.mono5 : TYPSNITT.mono) : TYPSNITT.sans;
  const familj = font === "mono" ? "IBM Plex Mono" : "Public Sans";
  const s = versaler ? String(str).toLocaleUpperCase("sv") : String(str);
  const markup = `<span font_family="${familj}" font_weight="${weight}" size="${Math.round(size * 1024)}" foreground="${color}" letter_spacing="${Math.round(tracking * 1024)}">${esc(s)}</span>`;
  const { data, info } = await sharp({ text: { text: markup, fontfile: fil, rgba: true, dpi: 72, width, align, wrap: "word", ...(radhojd ? { spacing: Math.max(0, Math.round(radhojd - size * 1.2)) } : {}) } })
    .png().toBuffer({ resolveWithObject: true });
  return { input: data, w: info.width, h: info.height, rader: Math.max(1, Math.round(info.height / Math.max(radhojd || 0, size * 1.2))) };
}
// Rubriken krymper tills den ryms på högst `max` rader.
async function rubrik(str, width, max = 3) {
  for (const size of [66, 60, 54, 48, 42, 38]) {
    const t = await text(str, { size, weight: 800, width, tracking: -size * 0.015, radhojd: Math.round(size * 1.06) });
    if (t.rader <= max) return t;
  }
  return text(str, { size: 34, weight: 800, width, radhojd: 36 });
}

// ---------- delar av bilden ----------
// Fotografiet som en bilaga: skugga, en lätt vridning och ett gem.
async function bilaga({ fil, platshallare, bw = 436, bh = 327, vrid = 2.2 }) {
  const pad = 46, cw = bw + pad * 2, ch = bh + pad * 2;
  let foto;
  if (fil && fs.existsSync(fil)) {
    foto = await sharp(fil).rotate().resize(bw, bh, { fit: "cover", position: sharp.strategy.attention }).modulate({ brightness: 0.98 }).toBuffer();
  } else {
    const t1 = await text("Handlingar inkommer", { font: "mono", size: 15, color: F.muted, versaler: true, tracking: 1.6 });
    const t2 = platshallare ? await text(platshallare, { font: "mono", size: 13, color: F.muted }) : null;
    foto = await sharp({ create: { width: bw, height: bh, channels: 4, background: F.field } })
      .composite([{ input: svg(bw, bh, `<rect x="18" y="18" width="${bw - 36}" height="${bh - 36}" fill="none" stroke="${F.rule}" stroke-width="1.5" stroke-dasharray="6 5"/>`) },
        { input: t1.input, left: Math.round((bw - t1.w) / 2), top: Math.round(bh / 2 - t1.h - (t2 ? 4 : -t1.h / 2)) },
        ...(t2 ? [{ input: t2.input, left: Math.round((bw - t2.w) / 2), top: Math.round(bh / 2 + 8) }] : [])]).png().toBuffer();
  }
  const skugga = await sharp(svg(cw, ch, `<rect x="${pad + 4}" y="${pad + 12}" width="${bw - 8}" height="${bh - 6}" fill="#000" fill-opacity=".42"/>`)).blur(11).png().toBuffer();
  const gem = svg(cw, ch, `<g transform="translate(${pad + 26} ${pad - 26}) rotate(-6)"><rect x="0" y="0" width="22" height="64" rx="11" fill="none" stroke="${F.clip}" stroke-width="3"/><path d="M6 14 v38 a5 5 0 0 0 10 0 v-30" fill="none" stroke="${F.clip}" stroke-width="3" stroke-linecap="round"/></g>`);
  const lager = await sharp({ create: { width: cw, height: ch, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: skugga }, { input: foto, left: pad, top: pad }, { input: gem }]).png().toBuffer();
  return sharp(lager).rotate(vrid, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer({ resolveWithObject: true });
}

// Stämpeln: dubbel ram, versaler, ett litet rad under och ojämn färg.
async function stampel(ord, under, { vrid = -8 } = {}) {
  let t;
  for (const size of [40, 34, 29, 25]) { t = await text(ord, { size, weight: 800, color: F.stamp, tracking: size * 0.18, versaler: true }); if (t.w <= 360) break; }
  const u = under ? await text(under, { font: "mono", size: 13, weight: 500, color: F.stamp, tracking: 1.3 }) : null;
  const iw = Math.max(t.w, u ? u.w : 0) + 44, ih = t.h + (u ? u.h + 6 : 0) + 26, m = 10, sw = iw + m * 2, sh = ih + m * 2;
  const ram = svg(sw, sh, `<rect x="${m + 2.5}" y="${m + 2.5}" width="${iw - 5}" height="${ih - 5}" fill="none" stroke="${F.stamp}" stroke-width="5"/><rect x="${m + 9}" y="${m + 9}" width="${iw - 18}" height="${ih - 18}" fill="none" stroke="${F.stamp}" stroke-width="2"/>`);
  const farg = await sharp({ create: { width: sw, height: sh, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: ram }, { input: t.input, left: Math.round((sw - t.w) / 2), top: m + 14 }, ...(u ? [{ input: u.input, left: Math.round((sw - u.w) / 2), top: m + 14 + t.h + 4 }] : [])])
    .png().toBuffer();
  // Bläcket tar inte överallt: samma brus som stämpeln på sajten.
  const brus = svg(sw, sh, `<filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".55" numOctaves="3" seed="7"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2 2.25"/></filter><rect width="${sw}" height="${sh}" filter="url(#n)"/>`);
  const maskad = await sharp(farg).composite([{ input: brus, blend: "dest-in" }]).png().toBuffer();
  return sharp(maskad).rotate(vrid, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer({ resolveWithObject: true });
}

// ---------- hela bilden ----------
export async function delningsbild({ org, form, titel, ingress, fot, ord, under, fil, platshallare }, ut) {
  const PW = 1100, PH = 560, L = 72, R = PW - 48, KOL = 500;
  const papperSvg = svg(PW, PH, `
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6f7f2"/><stop offset="1" stop-color="#e8ebe5"/></linearGradient>
      <filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .3  0 0 0 0 .3  0 0 0 0 .28  0 0 0 .07 0"/></filter>
    </defs>
    <rect width="${PW}" height="${PH}" fill="url(#g)"/>
    <rect width="${PW}" height="${PH}" filter="url(#n)"/>
    ${[150, PH - 150].map((y) => `<circle cx="34" cy="${y}" r="9.5" fill="${F.rum}"/><path d="M25 ${y + 3} a9.5 9.5 0 0 0 18 0" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="1"/>`).join("")}
    <rect x="${L}" y="78" width="${R - L}" height="2" fill="${F.ink}"/>`);

  const tOrg = await text(org, { size: 15, weight: 800, tracking: 1.1, versaler: true });
  const tForm = await text(form, { font: "mono", size: 14, color: F.muted });
  const tTitel = await rubrik(titel, KOL, 3);
  let tIngress = null;
  if (ingress) {
    tIngress = await text(ingress, { size: 22, color: F.muted, width: KOL - 20, radhojd: 31 });
    if (tIngress.rader > (tTitel.rader > 2 ? 2 : 4)) tIngress = await text(forstaMening(ingress), { size: 22, color: F.muted, width: KOL - 20, radhojd: 31 });
  }
  const tFot = await text(fot, { font: "mono", size: 14, color: F.muted });
  const b = await bilaga({ fil, platshallare });
  const s = await stampel(ord, under);

  const titelY = 112, ingressY = titelY + tTitel.h + 26;
  const bx = R - b.info.width + 40, by = 92;
  const papper = await sharp(papperSvg).composite([
    { input: tOrg.input, left: L, top: 42 },
    { input: tForm.input, left: R - tForm.w, top: 43 },
    { input: tTitel.input, left: L - 3, top: titelY },
    ...(tIngress ? [{ input: tIngress.input, left: L, top: ingressY }] : []),
    { input: tFot.input, left: L, top: PH - 40 - tFot.h },
    { input: b.data, left: Math.round(bx), top: by },
    { input: s.data, left: Math.round(Math.min(L + 210, bx + 40 - s.info.width * 0.75)), top: Math.round(PH - 78 - s.info.height * 0.82), blend: "multiply" },
  ]).png().toBuffer();
  const vriden = await sharp(papper).rotate(-1.1, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer({ resolveWithObject: true });
  const pw = vriden.info.width, ph = vriden.info.height, px = Math.round((W - pw) / 2), py = Math.round((H - ph) / 2) + 2;

  const bakgrund = svg(W, H, `
    <defs>
      <radialGradient id="lampa" cx=".28" cy=".12" r=".75"><stop offset="0" stop-color="#ffecc8" stop-opacity=".10"/><stop offset="1" stop-color="#ffecc8" stop-opacity="0"/></radialGradient>
      <radialGradient id="vinjett" cx=".5" cy=".45" r=".8"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="${F.rum}"/><rect width="${W}" height="${H}" fill="url(#lampa)"/><rect width="${W}" height="${H}" fill="url(#vinjett)"/>`);
  const skugga = await sharp(svg(W, H, `<rect x="${px + 26}" y="${py + 30}" width="${pw - 52}" height="${ph - 34}" fill="#000" fill-opacity=".7"/>`)).blur(22).png().toBuffer();

  fs.mkdirSync(path.dirname(ut), { recursive: true });
  await sharp(bakgrund).composite([{ input: skugga }, { input: vriden.data, left: px, top: py }]).flatten({ background: F.rum })
    .jpeg({ quality: 86, mozjpeg: true, chromaSubsampling: "4:4:4" }).toFile(ut);
}

// ---------- alla delningsbilder ----------
export async function skapaDelningsbilder(utmapp, inn = lasInnehall()) {
  const { verket, verk, arenden } = inn, reg = lasRegister();
  const jpeg = (id) => (synligtFoto(verk[id]) ? storstaJpeg(verk[id].bild, reg[verk[id].bild]) : null);
  const fot = verket.undertitel || "";
  const start = startverk(inn);
  const filer = [];
  await delningsbild({
    org: verket.namn, form: verket.blankett || "", titel: "Ansökan om kreativ insats", ingress: forstaMening(verket.inledning),
    fot, ord: "Bifalles", under: "förenklat förfarande", fil: jpeg(start),
  }, path.join(utmapp, "dela/verket.jpg"));
  filer.push("dela/verket.jpg");
  for (const a of arenden) {
    await delningsbild({
      org: verket.namn, form: `Ärende · ${a.diarienummer || ""}`, titel: a.titel || a.id, ingress: a.ingress, fot,
      ord: a.status || "Under handläggning", under: a.diarienummer || "", fil: jpeg(a.omslag), platshallare: a.diarienummer,
    }, path.join(utmapp, `dela/arende-${a.id}.jpg`));
    filer.push(`dela/arende-${a.id}.jpg`);
  }
  return filer;
}

// ---------- delningssidor, sitemap och robots ----------
function delningssida(a, { verket, adress }) {
  const titel = `${a.titel} · ${verket.namn}`, besk = a.ingress || verket.inledning || "", mal = `../../#arende-${a.id}`;
  const abs = (p) => (adress ? adress + p : `../../${p}`);
  const bild = abs(`dela/arende-${a.id}.jpg`);
  return `<!doctype html>
<html lang="sv">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titel)}</title>
<meta name="description" content="${esc(besk)}">
<meta name="robots" content="noindex,follow">
<meta name="theme-color" content="#0f1315">
<link rel="icon" href="../../favicon.ico" sizes="32x32">
<link rel="icon" href="../../ikon.svg" type="image/svg+xml">
<meta property="og:type" content="article">
<meta property="og:locale" content="sv_SE">
<meta property="og:site_name" content="${esc(verket.namn)}">
<meta property="og:title" content="${esc(a.titel)}">
<meta property="og:description" content="${esc(besk)}">
${adress ? `<meta property="og:url" content="${esc(adress)}arende/${esc(a.id)}/">\n` : ""}<meta property="og:image" content="${esc(bild)}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(`Ärende ${a.diarienummer || ""}, ${a.titel}. Ett papper från ${verket.namn} med en stämpel.`)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(a.titel)}">
<meta name="twitter:description" content="${esc(besk)}">
<meta name="twitter:image" content="${esc(bild)}">
<script>location.replace(${JSON.stringify(mal)})</script>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f1315;font:16px/1.5 system-ui,sans-serif}main{background:#f2f3ee;color:#14181a;max-width:560px;margin:24px;padding:32px 36px}small{font-family:ui-monospace,monospace;color:#56626a}a{color:#14181a}</style>
</head>
<body>
<main>
<small>${esc(verket.namn)} · Ärende ${esc(a.diarienummer || "")}</small>
<h1>${esc(a.titel)}</h1>
<p>${esc(besk)}</p>
<p><a href="${esc(mal)}">Öppna ärendet</a></p>
</main>
</body>
</html>
`;
}

export async function skrivDelning(utmapp, inn = lasInnehall()) {
  const filer = await skapaDelningsbilder(utmapp, inn);
  for (const a of inn.arenden) {
    const p = path.join(utmapp, "arende", a.id, "index.html");
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, delningssida(a, inn));
  }
  // Sajten är en enda sida (vyerna ligger efter #), så sitemap innehåller bara startsidan.
  // Delningssidorna leder vidare och ska inte indexeras för sig.
  if (inn.adress) {
    fs.writeFileSync(path.join(utmapp, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${esc(inn.adress)}</loc></url>\n</urlset>\n`);
  }
  fs.writeFileSync(path.join(utmapp, "robots.txt"), `User-agent: *\nAllow: /\n${inn.adress ? `\nSitemap: ${inn.adress}sitemap.xml\n` : ""}`);
  return filer.length;
}

// ---------- Vite ----------
// Ersätter %ADRESS% i index.html och skapar allt ovan när sajten byggs.
export default function delning() {
  let ut = "dist", bygge = false;
  return {
    name: "verket-delning",
    configResolved(c) { ut = path.resolve(c.root, c.build.outDir); bygge = c.command === "build"; },
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        const { adress } = lasInnehall();
        if (!adress) {
          if (bygge) console.warn("\n[delning] adress saknas i content/verket.md. Delningslänkar får relativa adresser och sitemap.xml skapas inte.\n");
          return html.replace(/^.*(rel="canonical"|property="og:url").*%ADRESS%.*\n/gm, "").replaceAll("%ADRESS%", "");
        }
        return html.replaceAll("%ADRESS%", adress);
      },
    },
    async closeBundle() {
      if (!bygge) return;
      const t = Date.now(), n = await skrivDelning(ut);
      console.log(`[delning] ${n} delningsbilder, ${n - 1} delningssidor, sitemap.xml och robots.txt (${((Date.now() - t) / 1000).toFixed(1)} s)`);
    },
  };
}

// Körs direkt: bara bilderna, för att titta på dem.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const ut = path.resolve(process.argv[2] || "dist-delning");
  const filer = await skapaDelningsbilder(ut);
  console.log(filer.map((f) => "  " + path.join(path.relative(process.cwd(), ut), f)).join("\n"));
}
