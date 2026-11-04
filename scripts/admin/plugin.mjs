// Redigeringsbordet. Ett Vite-plugin som bara finns när Johan kör `npm run dev`.
// Det serverar admin.html och ett litet API som läser och skriver filerna i content/verk/,
// tar emot bilder till inkorg/, kör intaget och kontrollen.
// Pluginet har apply: "serve" och följer därför aldrig med i `npm run build`.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import matter from "gray-matter";
import { andra, dela, norm, DIMS } from "./frontmatter.mjs";

const ROT = process.cwd();
const VERK = path.join(ROT, "content", "verk");
const ARENDEN = path.join(ROT, "content", "arenden");
const INKORG = path.join(ROT, "inkorg");
const HTML = path.join(ROT, "admin.html");
const API = "/__bordet/";
const TILLATET_IN = /\.(jpe?g|png|tiff?|webp|mp4|mov|webm|m4v|txt)$/i;
const MAX_FIL = 1024 * 1024 * 1024; // 1 GB per fil räcker för en film

// ---------- läsa ----------
function lasVerk(fil) {
  const full = path.join(VERK, fil);
  const kalla = fs.readFileSync(full, "utf8");
  const id = fil.replace(/\.md$/, "");
  try {
    const { data } = matter(kalla, {});
    const { kropp } = dela(kalla);
    const d = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, norm(v)]));
    return {
      id, fil, andrad: fs.statSync(full).mtimeMs,
      titel: d.titel ?? "", datum: d.datum == null ? "" : String(d.datum), datum_gissat: !!d.datum_gissat,
      typ: d.typ || "foto", bild: d.bild ? "/media/" + d.bild : null, video: d.video ? "/media/" + d.video : null,
      youtube: d.youtube || null, kanal: d.kanal || null, format: Number(d.format) || 1.5,
      epok: d.epok ?? "", avdelning: d.avdelning ?? "", vikt: d.vikt || "frö", synlig: d.synlig !== false,
      dom: d.dom || null, original: d.original || null, ton: d.ton && typeof d.ton === "object" ? d.ton : {},
      text: kropp.trim(),
    };
  } catch (e) {
    return { id, fil, andrad: fs.statSync(full).mtimeMs, trasig: e.message.split("\n")[0], titel: id, ton: {}, text: "" };
  }
}
const allaVerk = () => fs.readdirSync(VERK).filter((f) => f.endsWith(".md")).sort().map(lasVerk);

function allaArenden() {
  if (!fs.existsSync(ARENDEN)) return [];
  return fs.readdirSync(ARENDEN).filter((f) => f.endsWith(".md")).sort().map((f) => {
    const { data, content } = matter(fs.readFileSync(path.join(ARENDEN, f), "utf8"), {});
    const rader = [...content.matchAll(/^::verk\s+(.+)$/gm)].map((m) => m[1].trim().split(/\s+/));
    return { id: f.replace(/\.md$/, ""), titel: data.titel || f, diarienummer: data.diarienummer || "", omslag: data.omslag || null, rader };
  });
}

function inkorgen() {
  if (!fs.existsSync(INKORG)) return [];
  return fs.readdirSync(INKORG).filter((f) => f !== "LASMIG.txt" && !f.startsWith(".") && fs.statSync(path.join(INKORG, f)).isFile())
    .map((f) => ({ namn: f, storlek: fs.statSync(path.join(INKORG, f)).size }));
}

// ---------- skriva ----------
const giltigtId = (id) => /^[\w-]+$/.test(id) && fs.existsSync(path.join(VERK, id + ".md"));

function skrivSakert(fil, text) {
  const tmp = fil + ".bordet-" + process.pid + ".tmp";
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, fil);
}

// Bara de fält bordet får ändra. Allt annat (typ, bild, farg, original …) lämnas orört.
function tvatta(in_) {
  const ut = {};
  for (const k of ["titel", "epok", "avdelning", "datum", "kanal"]) if (k in in_) ut[k] = String(in_[k] ?? "").trim();
  if ("datum" in ut && ut.datum && !/^\d{4}(-\d{2}){0,2}$/.test(ut.datum)) throw new Error("Datum skrivs ÅÅÅÅ, ÅÅÅÅ-MM eller ÅÅÅÅ-MM-DD.");
  if ("titel" in ut && !ut.titel) throw new Error("Titeln får inte vara tom.");
  if ("datum_gissat" in in_) ut.datum_gissat = !!in_.datum_gissat;
  if ("vikt" in in_) {
    if (!["hjälte", "frö", "damm"].includes(in_.vikt)) throw new Error("Vikt måste vara hjälte, frö eller damm.");
    ut.vikt = in_.vikt;
  }
  if ("synlig" in in_) ut.synlig = !!in_.synlig;
  if ("ton" in in_) {
    ut.ton = {};
    for (const [k, v] of Object.entries(in_.ton || {})) {
      const n = Math.round(Math.min(1, Math.max(0, Number(v) || 0)) * 10) / 10;
      if (n > 0 && /^\w+$/.test(k)) ut.ton[k] = n;
    }
  }
  if ("text" in in_) ut.text = String(in_.text ?? "");
  return ut;
}

const tonNyckel = (t) => JSON.stringify(Object.entries(t || {}).filter(([, v]) => Number(v) > 0).map(([k, v]) => [k, Number(v)]).sort());
function sammaVarde(k, a, b) {
  if (k === "ton") return tonNyckel(a) === tonNyckel(b);
  if (typeof a === "boolean" || typeof b === "boolean") return !!a === !!b;
  return String(a ?? "").trim() === String(b ?? "").trim();
}

// ---------- köra skript ----------
function kor(skript) {
  return new Promise((ok) => {
    const p = spawn(process.execPath, [path.join(ROT, "scripts", skript)], { cwd: ROT, env: { ...process.env, FORCE_COLOR: "0" } });
    let ut = "";
    p.stdout.on("data", (d) => (ut += d));
    p.stderr.on("data", (d) => (ut += d));
    p.on("close", (kod) => ok({ kod, utdata: ut.trim() }));
    p.on("error", (e) => ok({ kod: -1, utdata: e.message }));
  });
}
let intagPagar = null;

// ---------- http ----------
const svara = (res, kod, data) => {
  res.statusCode = kod;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
};
const lasKropp = (req, max = 2e6) => new Promise((ok, fel) => {
  const delar = []; let n = 0;
  req.on("data", (d) => { n += d.length; if (n > max) { fel(new Error("För stor fil.")); req.destroy(); } else delar.push(d); });
  req.on("end", () => ok(Buffer.concat(delar)));
  req.on("error", fel);
});

// Bordet svarar bara på den egna datorn, och bara på förfrågningar från bordet självt.
const LOKAL = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
function behorig(req) {
  if (!LOKAL.has(req.socket.remoteAddress)) return false;
  const vard = String(req.headers.host || "").replace(/:\d+$/, "").replace(/^\[|\]$/g, "");
  if (!["localhost", "127.0.0.1", "::1"].includes(vard)) return false;
  if (req.method !== "GET" && req.headers["x-bordet"] !== "1") return false;
  return true;
}

export default function redigeringsbordet() {
  return {
    name: "verket-redigeringsbordet",
    apply: "serve",
    configureServer(server) {
      // Händelser till öppna bord: något i content/ eller inkorg/ har ändrats.
      const lyssnare = new Set();
      let vantar = null, andrade = new Set();
      const sand = () => {
        const data = `event: andrat\ndata: ${JSON.stringify([...andrade])}\n\n`;
        andrade = new Set();
        for (const res of lyssnare) res.write(data);
      };
      server.watcher.add([INKORG]);
      server.watcher.on("all", (_, fil) => {
        if (!fil.startsWith(path.join(ROT, "content")) && !fil.startsWith(INKORG)) return;
        if (fil.endsWith(".tmp")) return;
        andrade.add(path.relative(ROT, fil));
        clearTimeout(vantar); vantar = setTimeout(sand, 150);
      });

      // Skriv ut adressen till bordet efter Vites egna adresser.
      const skrivAdresser = server.printUrls?.bind(server);
      if (skrivAdresser) server.printUrls = () => {
        skrivAdresser();
        const lokal = server.resolvedUrls?.local?.[0];
        if (lokal) server.config.logger.info(`  \x1b[32m➜\x1b[0m  Redigeringsbordet: ${lokal.replace(/\/$/, "")}/admin.html`);
      };

      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, "http://x");
        const sida = url.pathname === "/admin.html" || url.pathname === "/admin";
        if (!sida && !url.pathname.startsWith(API)) return next();
        if (!behorig(req)) return svara(res, 403, { fel: "Redigeringsbordet nås bara från den egna datorn, via localhost." });

        // Sidan serveras som den är, utan Vites omladdning, så att ett sparande inte laddar om bordet.
        if (sida) {
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.setHeader("Cache-Control", "no-store");
          return res.end(fs.readFileSync(HTML, "utf8"));
        }

        const vag = url.pathname.slice(API.length);
        try {
          if (req.method === "GET" && vag === "handelser") {
            res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" });
            res.write("retry: 2000\n\n");
            lyssnare.add(res);
            const puls = setInterval(() => res.write(": puls\n\n"), 25000);
            req.on("close", () => { clearInterval(puls); lyssnare.delete(res); });
            return;
          }
          if (req.method === "GET" && vag === "allt") {
            return svara(res, 200, { verk: allaVerk(), arenden: allaArenden(), inkorg: inkorgen(), dims: DIMS });
          }
          if (req.method === "GET" && vag === "kontroll") {
            return svara(res, 200, await kor("kontroll.mjs"));
          }
          let m;
          if (req.method === "PUT" && (m = vag.match(/^verk\/([\w-]+)$/))) {
            const id = m[1];
            if (!giltigtId(id)) return svara(res, 404, { fel: `Verket ${id} finns inte.` });
            const { andringar, bas } = JSON.parse((await lasKropp(req)).toString("utf8"));
            const fil = path.join(VERK, id + ".md");
            // Bordet skickar bara de fält som ändrats, och vad de var när redigeringen började.
            // Har någon annan ändrat samma fält under tiden sparas ingenting.
            const nu = lasVerk(id + ".md");
            const krock = Object.keys(bas || {}).filter((k) => !sammaVarde(k, nu[k], bas[k]));
            if (krock.length) return svara(res, 409, { fel: "Samma fält har ändrats i filen under tiden.", krock, verk: nu });
            const kalla = fs.readFileSync(fil, "utf8");
            const r = andra(kalla, tvatta(andringar || {}));
            if (r.andrade.length) skrivSakert(fil, r.kalla);
            return svara(res, 200, { andrade: r.andrade, verk: lasVerk(id + ".md") });
          }
          if (req.method === "POST" && vag === "inkorg") {
            const namn = path.basename(String(url.searchParams.get("namn") || "")).normalize("NFC").replace(/[\/\\:\0]/g, "_");
            if (!namn || namn.startsWith(".") || !TILLATET_IN.test(namn)) return svara(res, 400, { fel: `Filtypen tas inte emot: ${namn || "(namnlös)"}` });
            if (namn.toLowerCase() === "lasmig.txt") return svara(res, 400, { fel: "LASMIG.txt är reserverad." });
            const data = await lasKropp(req, MAX_FIL);
            fs.mkdirSync(INKORG, { recursive: true });
            // Skriv aldrig över något som redan ligger i inkorgen eller redan tagits in.
            const { name, ext } = path.parse(namn);
            let mal = namn, n = 2;
            const upptaget = (f) => fs.existsSync(path.join(INKORG, f)) || fs.existsSync(path.join(INKORG, "klart", f));
            while (upptaget(mal)) mal = `${name}-${n++}${ext}`;
            fs.writeFileSync(path.join(INKORG, mal), data);
            return svara(res, 200, { namn: mal, storlek: data.length });
          }
          if (req.method === "POST" && vag === "youtube") {
            const { url: lank, titel, kanal, ar } = JSON.parse((await lasKropp(req)).toString("utf8"));
            if (!/(?:v=|youtu\.be\/|embed\/|shorts\/)[\w-]{11}/.test(lank || "")) return svara(res, 400, { fel: "Det ser inte ut som en YouTube-länk." });
            const rent = (s) => String(s || "").replace(/[|\r\n]/g, " ").trim();
            const rad = [rent(lank).replace("/shorts/", "/watch?v="), rent(titel), rent(kanal), rent(ar)].join(" | ");
            fs.mkdirSync(INKORG, { recursive: true });
            fs.appendFileSync(path.join(INKORG, "youtube.txt"), rad + "\n");
            return svara(res, 200, { rad });
          }
          if (req.method === "POST" && vag === "intag") {
            if (intagPagar) return svara(res, 409, { fel: "Intaget pågår redan." });
            const fore = new Set(fs.readdirSync(VERK));
            intagPagar = kor("intag.mjs");
            const r = await intagPagar.finally(() => (intagPagar = null));
            const nya = fs.readdirSync(VERK).filter((f) => f.endsWith(".md") && !fore.has(f)).map((f) => f.replace(/\.md$/, ""));
            return svara(res, 200, { ...r, nya });
          }
          return svara(res, 404, { fel: "Okänd väg." });
        } catch (e) {
          return svara(res, 400, { fel: e.message });
        }
      });
    },
  };
}
