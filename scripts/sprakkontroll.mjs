// Kontrollerar den engelska versionen (content/en/). Anropas av npm run kontroll.
// Saknade översättningar är varningar: sajten visar då den svenska texten.
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { LOGIK } from "./sprak.mjs";
import { sprakord } from "./sprakord.mjs";

const lista = (a, max = 6) => a.slice(0, max).join(", ") + (a.length > max ? ` och ${a.length - max} till` : "");

export function kontrolleraEngelska(rot = process.cwd()) {
  const fel = [], varn = [], c = (p) => path.join(rot, "content", p), EN = c("en");
  if (!fs.existsSync(EN)) return { fel, varn: ["content/en/ saknas. Den engelska sidan visar svenska texter."], rad: "" };
  const las = (p, tolk) => {
    const f = path.join(EN, p);
    if (!fs.existsSync(f)) { varn.push(`content/en/${p} saknas`); return null; }
    try {
      const t = fs.readFileSync(f, "utf8");
      return tolk === "json" ? JSON.parse(t) : tolk === "yaml" ? matter.engines.yaml.parse(t) || {} : matter(t);
    } catch (e) { fel.push(`content/en/${p}: kan inte läsas (${e.message.split("\n")[0]})`); return null; }
  };
  const tankstreck = (fil, text) => { if (/—/.test(text)) varn.push(`content/en/${fil}: innehåller tankstreck (—). Skriv om meningen.`); };

  // ---- gränssnittet ----
  const ord = las("gransnitt.json", "json");
  if (ord) {
    const behov = sprakord(rot), finns = new Set(Object.keys(ord).filter((k) => !k.startsWith("_")));
    const saknas = [...behov.keys()].filter((k) => !finns.has(k) || !String(ord[k]).trim());
    if (saknas.length) varn.push(`content/en/gransnitt.json: ${saknas.length} text${saknas.length === 1 ? "" : "er"} i koden saknar översättning (visas på svenska): ${lista(saknas.map((s) => `"${s}"`), 4)}`);
    const over = [...finns].filter((k) => !behov.has(k));
    if (over.length) varn.push(`content/en/gransnitt.json: ${over.length} text${over.length === 1 ? "" : "er"} används inte längre i koden: ${lista(over.map((s) => `"${s}"`), 4)}`);
    for (const k of finns) {
      const platser = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join(" ");
      if (platser(k) !== platser(ord[k])) fel.push(`content/en/gransnitt.json: "${k}" ska ha samma {platshållare} i översättningen`);
      if ((k.match(/\|/g) || []).length !== (String(ord[k]).match(/\|/g) || []).length) varn.push(`content/en/gransnitt.json: "${k}" ska ha lika många | som originalet`);
    }
    tankstreck("gransnitt.json", Object.values(ord).join(" "));
  }

  // ---- ansökan: samma form som den svenska ----
  const en = las("ansokan.json", "json");
  let sv = null; try { sv = JSON.parse(fs.readFileSync(c("ansokan.json"), "utf8")); } catch (e) {}
  if (en && sv) {
    const jamfor = (a, b, var_) => {
      if (b === undefined) return;
      if (Array.isArray(a) && Array.isArray(b) && a.some((x) => x && typeof x === "object")) {
        if (a.length !== b.length) fel.push(`content/en/ansokan.json: ${var_} har ${b.length} poster, den svenska har ${a.length}. Ordningen måste vara densamma.`);
        a.forEach((x, i) => jamfor(x, b[i], `${var_}[${i + 1}]`));
      } else if (a && typeof a === "object" && !Array.isArray(a) && b && typeof b === "object") {
        for (const k of Object.keys(b)) {
          if (k.startsWith("_")) continue;
          if (LOGIK.has(k)) varn.push(`content/en/ansokan.json: ${var_}.${k} används inte. Poäng och utslag hämtas från den svenska filen.`);
          else if (!(k in a)) varn.push(`content/en/ansokan.json: ${var_}.${k} finns inte i den svenska filen och används inte`);
          else jamfor(a[k], b[k], `${var_}.${k}`);
        }
      }
    };
    jamfor(sv, en, "ansökan");
    const fragor = sv.fragor || [], enf = en.fragor || [];
    const utan = fragor.map((q, i) => (!enf[i]?.fraga ? i + 1 : null)).filter(Boolean);
    if (utan.length) varn.push(`content/en/ansokan.json: fråga ${lista(utan)} saknar engelsk text`);
    tankstreck("ansokan.json", JSON.stringify(en));
  }

  // ---- verken ----
  const vy = las("verk.yml", "yaml");
  const VERK = c("verk"), verk = {};
  for (const f of fs.readdirSync(VERK).filter((f) => f.endsWith(".md"))) { try { verk[f.slice(0, -3)] = matter(fs.readFileSync(path.join(VERK, f), "utf8")); } catch (e) {} }
  let utanTitel = [];
  if (vy) {
    const ev = vy.verk || {};
    const okanda = Object.keys(ev).filter((id) => !verk[id]);
    if (okanda.length) varn.push(`content/en/verk.yml: ${lista(okanda)} finns inte i content/verk/`);
    const synliga = Object.entries(verk).filter(([, m]) => m.data.synlig !== false);
    utanTitel = synliga.filter(([id]) => !ev[id]?.titel).map(([id]) => id);
    const utanText = synliga.filter(([id, m]) => m.content.trim() && !ev[id]?.text).map(([id]) => id);
    if (utanTitel.length) varn.push(`content/en/verk.yml: ${utanTitel.length} verk saknar engelsk titel (visas med svensk titel): ${lista(utanTitel)}`);
    if (utanText.length) varn.push(`content/en/verk.yml: ${utanText.length} verk saknar engelsk text (texten visas på svenska): ${lista(utanText)}`);
    for (const [falt, namn] of [["avdelning", "avdelningar"], ["epok", "epoker"]]) {
      const anv = [...new Set(synliga.map(([, m]) => m.data[falt]).filter(Boolean))];
      const s = anv.filter((x) => !(vy[namn] || {})[x]);
      if (s.length) varn.push(`content/en/verk.yml: ${namn} saknar engelskt namn för ${lista(s.map((x) => `"${x}"`))}`);
    }
    tankstreck("verk.yml", JSON.stringify(vy));
  }

  // ---- ärendena ----
  const AR = c("arenden"), EAR = path.join(EN, "arenden");
  const svAr = fs.existsSync(AR) ? fs.readdirSync(AR).filter((f) => f.endsWith(".md")) : [];
  const enAr = fs.existsSync(EAR) ? fs.readdirSync(EAR).filter((f) => f.endsWith(".md")) : [];
  for (const f of enAr) {
    if (!svAr.includes(f)) { varn.push(`content/en/arenden/${f}: det finns inget svenskt ärende med samma filnamn, så det visas inte`); continue; }
    const { data, content } = matter(fs.readFileSync(path.join(EAR, f), "utf8"));
    if (!data.titel) varn.push(`content/en/arenden/${f}: saknar titel`);
    for (const m of content.matchAll(/^::verk\s+(.+)$/gm)) for (const id of m[1].trim().split(/\s+/)) if (!verk[id]) fel.push(`content/en/arenden/${f}: verket "${id}" finns inte`);
    const synligt = [data.titel, data.period, data.ingress, content.replace(/<!--[\s\S]*?-->/g, "")].join("\n");
    const n = synligt.match(/\[JOHAN:/g)?.length || 0;
    const sverige = matter(fs.readFileSync(path.join(AR, f), "utf8")).data;
    const utkast = sverige.utkast != null && sverige.utkast !== false;
    if (n && !utkast) varn.push(`content/en/arenden/${f}: ${n} obesvarad${n === 1 ? "" : "e"} [JOHAN: …] i ett ärende som publiceras`);
    tankstreck(`arenden/${f}`, synligt);
  }
  const publicerade = svAr.filter((f) => { const d = matter(fs.readFileSync(path.join(AR, f), "utf8")).data; return !(d.utkast != null && d.utkast !== false); });
  const oversatta = publicerade.filter((f) => enAr.includes(f));
  const ejOversatta = publicerade.filter((f) => !enAr.includes(f));
  if (ejOversatta.length) varn.push(`content/en/arenden/: ${lista(ejOversatta.map((f) => f.slice(0, -3)))} har ingen engelsk version och visas på svenska på den engelska sidan`);

  const v = las("verket.md");
  if (v) {
    for (const k of ["namn", "inledning", "fotnot"]) if (!v.data[k]) varn.push(`content/en/verket.md: ${k} saknas (visas på svenska)`);
    for (const k of ["epost", "telefon", "instagram", "adress"]) if (k in v.data) varn.push(`content/en/verket.md: ${k} används inte här. Kontaktuppgifterna hämtas från content/verket.md.`);
    tankstreck("verket.md", v.content);
  }
  const antalSynliga = Object.values(verk).filter((m) => m.data.synlig !== false).length;
  const rad = `Engelska: ${antalSynliga - utanTitel.length} av ${antalSynliga} verk och ${oversatta.length} av ${publicerade.length} publicerade ärenden översatta.`;
  return { fel, varn, rad };
}
