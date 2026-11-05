// Den engelska versionen: "The Office for Unexpected Solutions".
//
// Texterna ligger i content/en/:
//   verket.md        namn, inledning, fotnot och texten "For clients"
//   gransnitt.json   gränssnittets texter: svensk text → engelsk text
//   ansokan.json     ansökans texter. Samma ordning som content/ansokan.json. Poängen tas från den svenska filen.
//   verk.yml         verkens titlar och texter, avdelningar och epoker. Verkfilerna i content/verk/ delas.
//   arenden/<id>.md  ett ärende på engelska. Samma filnamn som det svenska. Saknas filen visas det svenska.
//
// Sajten byggs en gång. Den engelska sidan, dist/en/index.html, skapas ur den svenska
// när bygget är klart, med lang="en", engelska delningstaggar och sökvägar ett steg upp.
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const yaml = (s) => matter.engines.yaml.parse(s) || {};

// Fält som styr logiken. De tas alltid från den svenska filen, även om de råkar finnas i den engelska,
// så att de två språken aldrig kan fatta olika beslut.
export const LOGIK = new Set(["poang", "utslag", "typ", "art", "arkivsok", "vikt", "till", "start", "visa", "urval", "grans", "antal"]);
const arObjekt = (x) => x && typeof x === "object" && !Array.isArray(x);

/** Lägger de engelska texterna över den svenska strukturen. Listor med objekt följs åt plats för plats. */
export function slaSamman(sv, en, nyckel = "") {
  if (en === undefined || LOGIK.has(nyckel)) return sv;
  if (arObjekt(sv) && arObjekt(en)) {
    const ut = {};
    for (const k of Object.keys(sv)) ut[k] = slaSamman(sv[k], en[k], k);
    return ut;
  }
  if (Array.isArray(sv) && Array.isArray(en)) {
    if (sv.some(arObjekt)) return sv.map((x, i) => slaSamman(x, en[i], ""));
    return en.length ? en : sv; // en lista med ord eller meningar byts i sin helhet
  }
  if (arObjekt(sv) || Array.isArray(sv)) return sv; // fel form i den engelska filen: behåll svenskan
  return en == null || en === "" ? sv : en;
}

export function lasFil(fil, tolk) {
  if (!fs.existsSync(fil)) return null;
  const text = fs.readFileSync(fil, "utf8");
  return tolk === "json" ? JSON.parse(text) : tolk === "yaml" ? yaml(text) : matter(text);
}

/**
 * Läser content/en/ och lägger det ovanpå det svenska innehållet.
 * renderBody och parseInline skickas in från vite.config.js, så att markdown blir likadan på båda språken.
 */
export function lasEngelska(CONTENT, { verket, ansokan, arenden, renderBody, parseInline }) {
  const EN = path.join(CONTENT, "en"), fil = (p) => path.join(EN, p);
  const v = lasFil(fil("verket.md"));
  const ord = lasFil(fil("verk.yml"), "yaml") || {};
  const verk = {};
  for (const [id, x] of Object.entries(ord.verk || {})) {
    if (!x) continue;
    verk[id] = { titel: x.titel ? String(x.titel) : null, text: x.text ? parseInline(String(x.text).trim()) : null };
  }
  const arendenEn = {};
  for (const a of arenden) {
    const m = lasFil(fil(`arenden/${a.id}.md`));
    if (!m) continue;
    const { utkast, diarienummer, omslag, ...falt } = m.data; // diarienummer, omslag och utkast följer det svenska ärendet
    arendenEn[a.id] = { ...falt, html: renderBody(m.content) };
  }
  return {
    verket: v ? { ...v.data, bestallare: v.content.trim() ? renderBody(v.content) : null } : {},
    gransnitt: Object.fromEntries(Object.entries(lasFil(fil("gransnitt.json"), "json") || {}).filter(([k]) => !k.startsWith("_"))),
    ansokan: slaSamman(ansokan, lasFil(fil("ansokan.json"), "json") || {}),
    verk,
    verkord: { avdelningar: ord.avdelningar || {}, epoker: ord.epoker || {} },
    arenden: arendenEn,
  };
}

// ---------- den engelska sidan ----------
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ENGELSKA_VAGAR = { ansokan: "application", arenden: "cases", registret: "register", arkivrummet: "archive", foredragning: "presentation", bestallare: "clients" };

function engelskaTexter(CONTENT) {
  const fil = (p) => path.join(CONTENT, p);
  const sv = matter(fs.readFileSync(fil("verket.md"), "utf8")).data;
  const en = lasFil(fil("en/verket.md"))?.data || {};
  const ord = lasFil(fil("en/gransnitt.json"), "json") || {};
  return { namn: en.namn || sv.namn, beskrivning: en.beskrivning || "", bildtext: en.delningsbild_text || "", ord };
}

// Byter värdet i en meta- eller link-tagg som känns igen på `vem` (till exempel property="og:title").
function sattTagg(html, vem, attr, varde) {
  const re = new RegExp(`(<(?:meta|link)[^>]*${vem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^>]*\\s${attr}=")[^"]*(")`);
  return html.replace(re, `$1${esc(varde)}$2`);
}

/**
 * Gör om den svenska sidan till den engelska. `upp` = sökvägarna ska gå ett steg upp (bygget),
 * annars är de redan absoluta (utvecklingsservern).
 */
export function tillEngelska(html, { CONTENT, adress = "", upp = true }) {
  const T = engelskaTexter(CONTENT), t = (s) => T.ord[s] || s;
  let h = html.replace(/<html lang="sv">/, '<html lang="en">');
  h = h.replace(/<title>[^<]*<\/title>/, `<title>${esc(T.namn)}</title>`);
  h = sattTagg(h, 'name="description"', "content", T.beskrivning);
  h = sattTagg(h, 'property="og:locale"', "content", "en_GB");
  h = h.replace(/(<meta property="og:locale"[^>]*>)/, '$1\n<meta property="og:locale:alternate" content="sv_SE">');
  for (const k of ['property="og:site_name"', 'property="og:title"', 'name="twitter:title"']) h = sattTagg(h, k, "content", T.namn);
  for (const k of ['property="og:description"', 'name="twitter:description"']) h = sattTagg(h, k, "content", T.beskrivning);
  for (const k of ['property="og:image:alt"', 'name="twitter:image:alt"']) h = sattTagg(h, k, "content", T.bildtext);
  if (adress) {
    h = sattTagg(h, 'rel="canonical"', "href", adress + "en/");
    h = sattTagg(h, 'property="og:url"', "content", adress + "en/");
    for (const k of ['property="og:image"', 'name="twitter:image"']) h = sattTagg(h, k, "content", adress + "en/dela/verket.jpg");
  }
  // Menyn: engelska namn och adresser. main.js gör samma sak, det här är för den som läser sidan utan JavaScript.
  h = h.replace(/<a href="#(\w+)" data-r="(\w+)">([^<]+)<\/a>/g, (_, __, r, namn) => `<a href="#${ENGELSKA_VAGAR[r] || r}" data-r="${r}">${esc(t(namn))}</a>`);
  h = h.replace(/(<a class="brand" href=")#ansokan"/, '$1#application"');
  h = h.replace(/aria-label="Huvudmeny"/, `aria-label="${esc(t("Huvudmeny"))}"`);
  h = h.replace(/(id="visare"[^>]*aria-label=")Handling"/, `$1${esc(t("Handling"))}"`);
  h = h.replace(/>Ljud på</, `>${esc(t("Ljud på"))}<`);
  h = h.replace(/<a class="sprakval" href="[^"]*" hreflang="en" lang="en">.*?<\/a>/, '<a class="sprakval" href="../" hreflang="sv" lang="sv"><span class="hel">Svenska</span><span class="kort" aria-hidden="true">SV</span></a>');
  // Sökvägar: sidan ligger en mapp ned.
  if (upp) {
    h = h.replace(/(\s(?:href|src)=")\.\/(?!\/)/g, "$1../");
    h = h.replace(/url\((?!["']?(?:https?:|data:|\/|\.\.\/))(["']?)/g, "url($1../");
  }
  return h;
}

/** Länkar mellan språken för sökmotorerna, i båda sidornas huvud. */
function alternativ(adress) {
  if (!adress) return "";
  return `<link rel="alternate" hreflang="sv" href="${esc(adress)}">\n<link rel="alternate" hreflang="en" href="${esc(adress)}en/">\n<link rel="alternate" hreflang="x-default" href="${esc(adress)}">\n`;
}
const lasAdress = (CONTENT) => {
  let a = String(process.env.VERKET_ADRESS || matter(fs.readFileSync(path.join(CONTENT, "verket.md"), "utf8")).data.adress || "").trim();
  if (a && !a.endsWith("/")) a += "/";
  return a;
};

// ---------- Vite ----------
export default function sprak({ CONTENT }) {
  let ut = "dist", bygge = false;
  return {
    name: "verket-sprak",
    configResolved(c) { ut = path.resolve(c.root, c.build.outDir); bygge = c.command === "build"; },
    transformIndexHtml: {
      order: "post",
      handler(html) { return html.replace(/(<link rel="canonical"[^>]*>\n?)/, `$1${alternativ(lasAdress(CONTENT))}`); },
    },
    // npm run dev: /en/ visar den engelska sidan.
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, "http://x");
        if (url.pathname === "/en") { res.statusCode = 302; res.setHeader("Location", "/en/" + url.search); res.end(); return; }
        if (url.pathname !== "/en/" && url.pathname !== "/en/index.html") return next();
        try {
          const html = await server.transformIndexHtml("/en/", fs.readFileSync(path.resolve(server.config.root, "index.html"), "utf8"));
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(tillEngelska(html, { CONTENT, adress: lasAdress(CONTENT), upp: false }));
        } catch (e) { next(e); }
      });
    },
    // npm run build: dist/en/index.html
    closeBundle: {
      order: "pre",
      handler() {
        if (!bygge) return;
        const sv = path.join(ut, "index.html");
        if (!fs.existsSync(sv)) return;
        fs.mkdirSync(path.join(ut, "en"), { recursive: true });
        fs.writeFileSync(path.join(ut, "en", "index.html"), tillEngelska(fs.readFileSync(sv, "utf8"), { CONTENT, adress: lasAdress(CONTENT) }));
        console.log("[språk] dist/en/index.html");
      },
    },
  };
}
