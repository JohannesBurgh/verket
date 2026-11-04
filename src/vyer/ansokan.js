// Ansökan: en frågebank, fem frågor per besök styrda av ett frö, en cirkel som underskrift,
// handläggning och ett av fyra slags beslut. Beslutet kan delas (#beslut-<kod>) och skrivas ut.
// Frågor, tolkningar och beslutstexter ligger i content/ansokan.json.
import "../stil/ansokan.css";
import { A, S, VERK, DIMS, el, papper, huvud, tumnagel, metaRad, kontaktRuta, reduce } from "../data.js";
import { oppna } from "../visare.js";
import { stampel, prassel, klick } from "../ljud.js";
import { t, tDelar, vag, arVy } from "../sprak.js";

// SV är den svenska ansökan, som avgör logiken. Ord ur båda språkens nyckelordsregister tolkas
// på båda sidorna, så att samma svar alltid ger samma beslut, oavsett språk.
const SV = A.sv_ansokan || A.ansokan;
const AN = A.ansokan, BANK = AN.fragor, CIRKEL = AN.cirkel, MOTIV = AN.motiveringar, BES = AN.beslut;
const TYPER = ["val", "reglage", "bild", "ord"];
const UTGANG = ["bifall", "delvis", "avslag", "absurdimo"];
const CIRKELBED = ["noggrann", "fri", "potatis"];
// Bara verk som får visas i beslut: synliga och inte "damm".
const KANDIDATER = VERK.filter((v) => v.vikt !== "damm");
const BILDPOOL = KANDIDATER.filter((v) => v.typ === "foto" && v.bild);

let app = null, st = null, tangentbord = false, visaNr = 0;
addEventListener("keydown", () => (tangentbord = true), true);
addEventListener("pointerdown", () => (tangentbord = false), true);

// ---------- frö, datum och diarienummer ----------
function slump(fro) {
  let a = fro >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const blanda = (a, r) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const nyttFro = () => { try { return crypto.getRandomValues(new Uint32Array(1))[0]; } catch (e) { return Math.floor(Math.random() * 2 ** 32); } };
// Verken pekas ut med en kort kontrollsumma av filnamnet, så att ett delat beslut tål att arkivet växer.
function hash24(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0) & 0xffffff; }
const HASH = new Map();
VERK.forEach((v) => { const h = hash24(v.id); if (!HASH.has(h)) HASH.set(h, v); });
const nyckel = (v) => hash24(v.id);

const DAG0 = Date.UTC(2024, 0, 1);
const dagNu = () => Math.floor((Date.now() - DAG0) / 864e5);
const datum = (d) => new Date(DAG0 + d * 864e5).toISOString().slice(0, 10);
const dnr = (a) => `${S.diarieprefix} ${datum(a.dag).slice(0, 4)}/${10000 + (a.fro % 90000)}`;
const blankett = () => S.blankett.split("·")[0].trim();
const citat = (s) => t("”{s}”", { s });
const fyll = (t, v) => (t || "").replace(/\{(\w+)\}/g, (_, k) => (k === "n" ? v[k] : v[k] != null ? citat(v[k]) : ""));

// ---------- beslutets kod ----------
// Allt som behövs för att återskapa beslutet packas i bitar och skrivs med 64 tecken.
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const kontrolltecken = (s) => B64[[...s].reduce((a, c, i) => (a + B64.indexOf(c) * ((i % 7) + 1)) % 64, 0)];
function skrivare() {
  const b = [];
  return {
    u(v, n) { for (let i = n - 1; i >= 0; i--) b.push(Math.floor(v / 2 ** i) % 2); },
    kod() { while (b.length % 6) b.push(0); let s = ""; for (let i = 0; i < b.length; i += 6) { let v = 0; for (let k = 0; k < 6; k++) v = v * 2 + b[i + k]; s += B64[v]; } return s; },
  };
}
function lasare(s) {
  const b = [];
  for (const c of s) { const v = B64.indexOf(c); if (v < 0) throw new Error("tecken"); for (let k = 5; k >= 0; k--) b.push((v >> k) & 1); }
  let p = 0;
  return { u(n) { if (p + n > b.length) throw new Error("slut"); let v = 0; for (let k = 0; k < n; k++) v = v * 2 + b[p++]; return v; } };
}
const ENC = new TextEncoder(), DEC = new TextDecoder();
export function koda(a) {
  const w = skrivare();
  w.u(1, 4); w.u(a.fro >>> 0, 32); w.u(a.dag, 16); w.u(a.snabb ? 1 : 0, 1); w.u(Math.min(a.overklag, 15), 4); w.u(a.utgang, 2);
  w.u(a.fragor.length, 3);
  for (const f of a.fragor) {
    w.u(f.i, 5); w.u(f.t, 2);
    if (f.t === 0) w.u(f.v == null ? 15 : f.v, 4);
    else if (f.t === 1) w.u(f.v == null ? 127 : f.v, 7);
    else if (f.t === 2) { w.u(f.v == null ? 0 : 1, 1); if (f.v != null) w.u(f.v, 24); }
    else { const by = f.v == null ? null : ENC.encode(f.v); w.u(by ? by.length : 63, 6); if (by) by.forEach((x) => w.u(x, 8)); }
  }
  w.u(a.bilagor.length, 3); a.bilagor.forEach((h) => w.u(h, 24));
  w.u(a.vind == null ? 0 : 1, 1); if (a.vind != null) w.u(a.vind, 24);
  w.u(a.cirkel ? 1 : 0, 1);
  if (a.cirkel) { w.u(a.cirkel.bed, 2); w.u(a.cirkel.pts.length, 5); a.cirkel.pts.forEach(([x, y]) => { w.u(x, 6); w.u(y, 6); }); }
  const s = w.kod();
  return s + kontrolltecken(s);
}
export function dekoda(kod) {
  try {
    const s = String(kod || "").slice(0, -1);
    if (!s || kontrolltecken(s) !== kod.slice(-1)) return null;
    const r = lasare(s);
    if (r.u(4) !== 1) return null;
    const a = { fro: r.u(32), dag: r.u(16), snabb: !!r.u(1), overklag: r.u(4), utgang: r.u(2), fragor: [] };
    const n = r.u(3);
    for (let k = 0; k < n; k++) {
      const i = r.u(5), t = r.u(2);
      let v;
      if (t === 0) { v = r.u(4); if (v === 15) v = null; }
      else if (t === 1) { v = r.u(7); if (v > 100) v = null; }
      else if (t === 2) v = r.u(1) ? r.u(24) : null;
      else { const len = r.u(6); if (len === 63) v = null; else { const by = new Uint8Array(len); for (let j = 0; j < len; j++) by[j] = r.u(8); v = DEC.decode(by); } }
      if (!BANK[i] || TYPER.indexOf(BANK[i].typ) !== t) return null;
      a.fragor.push({ i, t, v });
    }
    const nb = r.u(3); a.bilagor = []; for (let k = 0; k < nb; k++) a.bilagor.push(r.u(24));
    a.vind = r.u(1) ? r.u(24) : null;
    a.cirkel = null;
    if (r.u(1)) { const bed = Math.min(r.u(2), 2), np = r.u(5), pts = []; for (let k = 0; k < np; k++) pts.push([r.u(6), r.u(6)]); a.cirkel = { bed, pts }; }
    return a;
  } catch (e) { return null; }
}

// ---------- frågorna ----------
function draFragor(fro) {
  const r = slump(fro ^ 0x5eed5eed), per = {};
  BANK.slice(0, 32).forEach((q, i) => (per[q.typ] ||= []).push(i));
  const urval = AN.urval || { val: 5 }, antal = Math.min(7, Object.values(urval).reduce((x, y) => x + y, 0));
  let ut = [];
  for (const [typ, n] of Object.entries(urval)) ut.push(...blanda((per[typ] || []).slice(), r).slice(0, n));
  const rest = blanda(Object.values(per).flat().filter((i) => !ut.includes(i)), r);
  while (ut.length < antal && rest.length) ut.push(rest.shift());
  ut = blanda(ut, r).slice(0, antal);
  // Ansökan börjar alltid med en vanlig flervalsfråga.
  const f = ut.findIndex((i) => BANK[i].typ === "val");
  if (f > 0) [ut[0], ut[f]] = [ut[f], ut[0]];
  return ut.map((i) => ({ i, t: TYPER.indexOf(BANK[i].typ), v: null }));
}
// Tre bilder ur arkivet, helst ur olika avdelningar och epoker.
function bildval(fro, i) {
  const r = slump(fro ^ Math.imul(i + 1, 0x85ebca6b)), pool = blanda(BILDPOOL.slice(), r), ut = [], av = new Set(), ep = new Set();
  for (const v of pool) { if (ut.length === 3) break; if (av.has(v.avdelning) || ep.has(v.epok)) continue; ut.push(v); av.add(v.avdelning); ep.add(v.epok); }
  for (const v of pool) { if (ut.length === 3) break; if (!ut.includes(v) && !ep.has(v.epok)) { ut.push(v); ep.add(v.epok); } }
  for (const v of pool) { if (ut.length === 3) break; if (!ut.includes(v)) ut.push(v); }
  return ut;
}
const zon = (q, v) => q.zoner.find((z) => v <= z.till) || q.zoner[q.zoner.length - 1];

// ---------- det fria ordet ----------
const norm = (s) => String(s || "").toLowerCase().normalize("NFC").replace(/[^\p{L}\p{N}]/gu, "");
function rensa(s) {
  let t = String(s || "").replace(/[^\p{L}\p{N}\- ]/gu, "").replace(/\s+/g, " ").trim().slice(0, 20).trim();
  while (ENC.encode(t).length > 62) t = t.slice(0, -1);
  return t;
}
const forstaOrd = (s) => { const d = String(s || "").trim().split(/\s+/).filter(Boolean); return { ord: d[0] || "", flera: d.length > 1 }; };
function lev(a, b) {
  if (Math.abs(a.length - b.length) > 1) return 2;
  let f = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const n = [i];
    for (let j = 1; j <= b.length; j++) n[j] = Math.min(f[j] + 1, n[j - 1] + 1, f[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    f = n;
  }
  return f[b.length];
}
// Exakt träff först, sedan ordets början (dansa, dansband), sedan ett stavfel.
const ORDLISTA = (AN.tolkning || []).map((r, i) => [...new Set([...(SV.tolkning?.[i]?.ord || []), ...(A.en_ord?.[i] || []), ...r.ord].map(norm))]);
function tolka(ord) {
  const w = norm(ord), R = AN.tolkning || [];
  if (!w) return null;
  const hitta = (test) => { const i = ORDLISTA.findIndex((l) => l.some(test)); return i < 0 ? null : R[i]; };
  return hitta((k) => k === w)
    || hitta((k) => k.length >= 4 && w.startsWith(k))
    || hitta((k) => k.length >= 5 && w.length >= 5 && lev(w, k) <= 1)
    || null;
}
const STOPP = new Set(["och", "med", "vid", "den", "det", "ett", "som", "för", "till", "från", "under", "över", "mot", "utan", "efter", "del", "the", "and", "på", "av", "är", "i", "en",
  "with", "from", "into", "under", "over", "behind", "through", "for", "part", "two", "three", "four"]);
// Verk vars titel innehåller ordet, i någon böjning (råtta, råttan; fisk, fisken).
function arkivtraffar(ord) {
  const w = norm(ord);
  if (w.length < 3) return [];
  // Titeln på båda språken, så att "rat" och "råtta" hittar samma verk.
  return KANDIDATER.filter((v) => `${v.titel} ${v.sv}`.toLowerCase().split(/[^\p{L}\p{N}]+/u).some((t) => {
    if (t.length < 3 || STOPP.has(t)) return false;
    let cp = 0;
    while (cp < t.length && cp < w.length && t[cp] === w[cp]) cp++;
    return cp >= 3 && cp >= Math.min(t.length, w.length) - 2;
  }));
}

// ---------- cirkeln ----------
const NP = 18;
function forenkla(r) {
  if (!r || r.pts.length < 12) return null;
  const { pts, w, h } = r, L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const tot = L[L.length - 1];
  if (tot < 30) return null;
  const ut = [], q = (v) => Math.max(0, Math.min(63, Math.round(v * 63)));
  let j = 0;
  for (let k = 0; k < NP; k++) {
    const s = (tot * k) / (NP - 1);
    while (j < pts.length - 2 && L[j + 1] < s) j++;
    const t = Math.min(1, Math.max(0, (s - L[j]) / Math.max(1e-6, L[j + 1] - L[j])));
    ut.push([q((pts[j][0] + (pts[j + 1][0] - pts[j][0]) * t) / w), q((pts[j][1] + (pts[j + 1][1] - pts[j][1]) * t) / h)]);
  }
  return { bed: bedom(ut), pts: ut };
}
// Punkterna ligger i ett rutnät 0–63 över en yta i formatet 4:3.
function bedom(pts) {
  const P = pts.map(([x, y]) => [(x * 4) / 3, y]), n = P.length;
  const cx = P.reduce((a, p) => a + p[0], 0) / n, cy = P.reduce((a, p) => a + p[1], 0) / n;
  const r = P.map((p) => Math.hypot(p[0] - cx, p[1] - cy)), m = r.reduce((a, b) => a + b, 0) / n;
  const cv = Math.sqrt(r.reduce((a, b) => a + (b - m) ** 2, 0) / n) / Math.max(1, m);
  const gap = Math.hypot(P[0][0] - P[n - 1][0], P[0][1] - P[n - 1][1]) / Math.max(1, m);
  return cv < 0.12 && gap < 0.6 ? 0 : cv < 0.3 ? 1 : 2;
}
function cirkelSvg(c) {
  const ns = "http://www.w3.org/2000/svg", svg = document.createElementNS(ns, "svg"), path = document.createElementNS(ns, "path");
  const P = c.pts.map(([x, y]) => [(x * 4) / 3, y]), f = (p) => p[0].toFixed(1) + " " + p[1].toFixed(1);
  let d = "M" + f(P[0]);
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || p2;
    d += ` C${f([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6])} ${f([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6])} ${f(p2)}`;
  }
  svg.setAttribute("viewBox", "-3 -3 90 69"); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", t("Sökandes cirkel"));
  path.setAttribute("d", d);
  Object.entries({ fill: "none", stroke: "currentColor", "stroke-width": "2.6", "stroke-linecap": "round", "stroke-linejoin": "round", "vector-effect": "non-scaling-stroke" }).forEach(([k, v]) => path.setAttribute(k, v));
  svg.append(path);
  return svg;
}

// ---------- prövning ----------
function profil(a) {
  const P = Object.fromEntries(DIMS.map((d) => [d, 0])), ut = { absurdimo: 0, avslag: 0, delvis: 0 }, skal = { absurdimo: [], avslag: [], delvis: [] };
  const lagg = (p) => { for (const [d, v] of Object.entries(p || {})) if (d in P) P[d] += v; };
  const slag = (o) => { for (const [k, v] of Object.entries(o.utslag || {})) if (k in ut) { ut[k] += v; if (o.skal) skal[k].push(o.skal); } };
  const noter = [], exkl = new Set();
  let art = null, sok = null;
  for (const f of a.fragor) {
    const q = BANK[f.i];
    if (!q || f.v == null) continue;
    if (q.typ === "val") {
      const s = q.svar[f.v]; if (!s) continue;
      lagg(s.poang); slag(s);
      if (q.art) art = { ...s, okand: SV.fragor[f.i]?.svar?.[f.v]?.text === "Art okänd" };
    } else if (q.typ === "reglage") {
      const z = zon(q, f.v); lagg(z.poang); slag(z);
    } else if (q.typ === "bild") {
      const v = HASH.get(f.v); if (!v) continue;
      exkl.add(v.id);
      for (const d of DIMS) P[d] += (v.ton[d] || 0) * (q.vikt || 2);
      noter.push({ text: [fyll(q.notering, { titel: v.titel })] });
    } else if (q.typ === "ord") {
      if (!f.v) { noter.push({ text: [AN.avstar_ord] }); continue; }
      const { ord, flera } = forstaOrd(f.v), t = [fyll(q.notering, { ord })], r = tolka(ord);
      if (flera) t.push(AN.flera_ord);
      if (r) { lagg(r.poang); slag(r); t.push(r.notering); }
      else if (!q.arkivsok) { lagg(AN.otolkat.poang); t.push(AN.otolkat.notering); }
      if (q.arkivsok && !sok) sok = ord;
      noter.push({ text: t, sok: q.arkivsok ? ord : null });
    }
  }
  if (a.cirkel) lagg(CIRKEL[CIRKELBED[a.cirkel.bed]].poang);
  const sk = AN.skruv;
  if (sk && P.skruv >= sk.grans && DIMS.every((d) => P[d] <= P.skruv)) slag(sk);
  return { P, ut, skal, noter, art, sok, exkl };
}
const grundUtgang = (u) => (u.absurdimo >= 2 ? 3 : u.avslag >= 2 ? 2 : u.delvis >= 1 ? 1 : 0);
// Ett överklagande flyttar avslag mot bifall. Absurdimo lämnar inte tillbaka ärenden.
const efterOverklag = (u, n) => (u === 3 ? 3 : Math.max(0, u - n));

// Fattar beslutet: utgång, bilagor och vindfrö. Samma frö och samma svar ger samma beslut.
function fatta(a, visade) {
  const r = slump(a.fro ^ Math.imul(a.overklag + 1, 0x9e3779b1)), ut = [], grp = new Set();
  const ta = (v, antal) => { if (v && !ut.includes(v) && !grp.has(v.epok) && ut.length < antal) { ut.push(v); grp.add(v.epok); return true; } return false; };
  let exkl = new Set();
  if (a.snabb) {
    a.utgang = 0;
    const hj = blanda(VERK.filter((v) => v.vikt === "hjälte" && !visade.has(v.id)), r), n = BES.bifall.antal;
    const tag = (t) => ta(hj.find((x) => t(x) && !ut.includes(x) && !grp.has(x.epok)), n);
    tag((v) => v.typ === "foto"); tag((v) => v.typ !== "foto" && v.kanal !== "Absurdimo"); tag((v) => v.kanal === "Absurdimo" || v.avdelning === "Skruven");
    hj.forEach((v) => ta(v, n));
  } else {
    const prof = profil(a), u = efterOverklag(grundUtgang(prof.ut), a.overklag), antal = BES[UTGANG[u]].antal, P = prof.P;
    a.utgang = u; exkl = prof.exkl;
    const traff = prof.sok ? arkivtraffar(prof.sok).filter((v) => !visade.has(v.id) && !exkl.has(v.id)) : [];
    const forced = traff.length ? traff[Math.floor(r() * traff.length)] : null;
    const rankad = KANDIDATER.filter((v) => !visade.has(v.id) && !exkl.has(v.id)).map((v) => {
      let s = 0;
      for (const d of DIMS) s += P[d] * (v.ton[d] || 0);
      s += v.vikt === "hjälte" ? 1.6 : 0;
      if (u === 3) s += (v.ton.skruv || 0) * 4;
      return { v, s: s + r() * 2.2 };
    }).sort((x, y) => y.s - x.s).map((x) => x.v);
    const skyddad = new Set();
    if (u === 3) {
      const abs = forced && forced.kanal === "Absurdimo" ? forced : rankad.find((v) => v.kanal === "Absurdimo");
      if (ta(abs, antal)) skyddad.add(abs);
    }
    if (ta(forced, antal)) skyddad.add(forced);
    for (const v of rankad) { if (ut.length >= antal) break; if (u === 3 && v.kanal === "Absurdimo") continue; ta(v, antal); }
    // Minst ett rörligt verk om sökanden vill ha rörelse, och tvärtom.
    const rorlig = (v) => v.typ !== "foto";
    const fixa = (behov, test) => {
      if (!behov || ut.some(test)) return;
      const k = ut.findLastIndex((v) => !skyddad.has(v)); if (k < 0) return;
      grp.delete(ut[k].epok);
      const alt = rankad.find((x) => test(x) && !ut.includes(x) && !grp.has(x.epok) && !(u === 3 && x.kanal === "Absurdimo"));
      if (alt) ut[k] = alt;
      grp.add(ut[k].epok);
    };
    fixa(P.rorligt >= P.stilla * 0.6, rorlig);
    fixa(P.stilla >= P.rorligt * 0.6, (v) => !rorlig(v));
  }
  // Vindfröet är också en bilaga: aldrig ur samma epok som de andra.
  const pool = VERK.filter((v) => !ut.includes(v) && !grp.has(v.epok) && !visade.has(v.id) && !exkl.has(v.id) && v.vikt !== "hjälte");
  const damm = pool.filter((v) => v.vikt === "damm"), kalla = r() < 0.45 && damm.length ? damm : pool;
  const vind = kalla.length ? kalla[Math.floor(r() * kalla.length)] : null;
  a.bilagor = ut.map(nyckel);
  a.vind = vind ? nyckel(vind) : null;
  return a;
}
const minnas = (a) => { if (!st || st.fro !== a.fro) return; a.bilagor.forEach((h) => { const v = HASH.get(h); if (v) st.visade.add(v.id); }); const v = HASH.get(a.vind); if (v) st.visade.add(v.id); };

// ---------- vyerna ----------
function visa(node, efter) {
  const nr = ++visaNr, gammal = app.firstElementChild;
  const klar = () => { if (nr !== visaNr) return; app.replaceChildren(node); VISADE.add(node); if (efter) efter(node); };
  if (gammal && !reduce) {
    gammal.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateX(-40px) rotate(-1deg)" }], { duration: 220, easing: "ease-in", fill: "forwards" }).onfinish = klar;
  } else klar();
  prassel(0.8);
  window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
}
// Kör fn när arket p har kommit på plats. Det gamla arket glider ut först, och på en upptagen
// enhet kan det dröja. Har besökaren hunnit vidare till en annan vy körs ingenting.
const VISADE = new WeakSet();
function nar(p, fn, ms = 0) {
  const nr = visaNr;
  const prova = () => {
    if (nr !== visaNr) return;
    if (!p.isConnected) { if (!VISADE.has(p)) setTimeout(prova, 60); return; } // på väg in, eller redan lämnat
    fn();
  };
  setTimeout(prova, ms);
}
const satt = (hash) => { if (location.hash !== hash) history.replaceState(null, "", hash); };

function nyAnsokan() {
  st = { fro: nyttFro(), dag: dagNu(), snabb: false, overklag: 0, fragor: [], cirkel: null, steg: 0, ritning: null, visade: new Set() };
  st.fragor = draFragor(st.fro);
  return st;
}

function start() {
  st = null;
  satt(arVy("beslut") ? vag("ansokan") : location.hash);
  const p = papper();
  p.append(huvud(S.blankett, t("Ansökan om kreativ insats")),
    el("p", { class: "lead" }, S.inledning),
    el("p", { class: "small" }, t("Frågorna dras ur Verkets frågebank, som omfattar {n} frågor. Ansökan undertecknas med en cirkel.", { n: BANK.length })),
    el("p", { class: "small" }, t("Uppgifterna sparas inte. Cirkeln diarieförs endast i beslutets adress.")),
    el("div", { class: "actions" },
      el("button", { type: "button", class: "btn", onclick: () => { nyAnsokan(); fraga(); } }, t("Påbörja ansökan")),
      el("button", { type: "button", class: "btn ghost", onclick: () => { nyAnsokan(); forenklat(); } }, t("Förenklat förfarande (jag har bråttom)"))),
    el("p", { class: "small", style: "margin-top:28px" }, el("span", { class: "prov" }, t("Provisorisk föreskrift")),
      ...tDelar("Den som vill se allt på en gång hänvisas till {registret} eller {arkivrummet}.", {
        registret: el("a", { href: vag("registret") }, t("Registret")), arkivrummet: el("a", { href: vag("arkivrummet") }, t("Arkivrummet")) })));
  visa(p, (n) => { if (tangentbord) n.querySelector(".btn")?.focus({ preventScroll: true }); });
}

function fraga() {
  const i = st.steg, n = st.fragor.length, under = i >= n, f = st.fragor[i], q = under ? null : BANK[f.i], p = papper();
  p.classList.add("ansokan");
  p.append(huvud(`${blankett()} · ${dnr(st)}`, t("Ansökan om kreativ insats")));
  p.append(el("div", { class: "qmeta" }, el("span", {}, under ? AN.underskrift.rubrik : t("Fråga {i} av {n}", { i: i + 1, n })),
    el("button", { type: "button", class: "link", onclick: forenklat }, t("Hoppa till förenklat förfarande"))));
  const pr = el("div", { class: "progress", "aria-hidden": "true" });
  for (let k = 0; k <= n; k++) pr.append(el("i", { class: (k <= i ? "on" : "") + (k === n ? " underskrift" : "") }));
  p.append(pr);
  const fs = el("fieldset", { class: "q-" + (under ? "underskrift" : q.typ) }, el("legend", {}, under ? AN.underskrift.fraga : q.fraga));
  const nav = el("div", { class: "qnav" },
    i > 0 ? el("button", { type: "button", class: "link", onclick: () => { st.steg--; fraga(); } }, t("← Föregående fråga")) : el("span"));
  let fokus = null;
  if (under) {
    fs.append(ritruta());
    nav.append(el("div", { class: "actions", style: "margin:0" },
      el("button", { type: "button", class: "btn ghost", onclick: () => lamnaIn(true) }, t("Avstår från att rita")),
      el("button", { type: "button", class: "btn", onclick: () => lamnaIn(false) }, t("Lämna in ansökan"))));
  } else if (q.typ === "val") {
    const opts = el("div", { class: "opts" });
    q.svar.forEach((o, k) => opts.append(el("button", { type: "button", class: "opt", "aria-pressed": f.v === k ? "true" : "false", onclick: () => valj(k) },
      el("span", { class: "box" }), el("span", {}, o.text), el("kbd", {}, String(k + 1)))));
    fs.append(opts);
    fokus = () => tangentbord && (opts.querySelector('[aria-pressed="true"]') || opts.firstChild).focus({ preventScroll: true });
  } else if (q.typ === "bild") {
    const g = el("div", { class: "bildval" }), val = bildval(st.fro, f.i);
    val.forEach((v, k) => g.append(el("button", { type: "button", class: "bv", "aria-pressed": f.v === nyckel(v) ? "true" : "false", "aria-label": t("Handling {k}: {titel}", { k: k + 1, titel: v.titel }), onclick: () => valj(nyckel(v), k) },
      el("span", { class: "nr" }, t("Handling {k}", { k: k + 1 }), el("kbd", {}, String(k + 1))), el("span", { class: "m" }, tumnagel(v)), el("b", {}, v.titel))));
    fs.append(g);
    fokus = () => tangentbord && (g.querySelector('[aria-pressed="true"]') || g.firstChild).focus({ preventScroll: true });
  } else if (q.typ === "reglage") {
    const { form, inp } = reglage(q, f);
    fs.append(form);
    fokus = () => tangentbord && inp.focus({ preventScroll: true });
  } else {
    const { form, inp } = ordfalt(q, f);
    fs.append(form);
    fokus = () => (tangentbord || matchMedia("(pointer:fine)").matches) && inp.focus({ preventScroll: true });
  }
  p.append(fs, nav);
  visa(p, () => fokus && fokus());
}
function nasta() { st.steg++; fraga(); }
function valj(v, k) {
  st.fragor[st.steg].v = v; klick();
  app.querySelectorAll(".opt, .bv").forEach((b, j) => b.setAttribute("aria-pressed", j === (k ?? v) ? "true" : "false"));
  const steg = st.steg;
  setTimeout(() => { if (st && st.steg === steg) nasta(); }, reduce ? 0 : 340);
}
function reglage(q, f) {
  const sista = st.steg === st.fragor.length - 1;
  const lage = el("output", { class: "lage", "aria-hidden": "true" }), varde = el("span", { class: "varde" });
  const inp = el("input", { type: "range", min: "0", max: "100", step: "1", value: String(f.v ?? q.start ?? 50), "aria-label": q.fraga });
  const spar = el("div", { class: "spar" });
  q.zoner.slice(0, -1).forEach((z) => spar.append(el("i", { style: `--x:${Math.min(1, (z.till + 0.5) / 100)}`, "aria-hidden": "true" })));
  spar.append(inp);
  let nu = null;
  const upd = (ljud) => {
    const v = +inp.value, z = zon(q, v), pro = q.visa === "procent";
    lage.textContent = z.etikett;
    varde.textContent = pro ? t("{v} procent", { v }) : "";
    inp.setAttribute("aria-valuetext", pro ? t("{v} procent, {zon}", { v, zon: z.etikett }) : z.etikett);
    inp.style.setProperty("--p", v + "%");
    if (ljud && nu && z !== nu) klick();
    nu = z;
  };
  inp.addEventListener("input", () => upd(true));
  upd(false);
  const form = el("form", { class: "reglage", onsubmit: (e) => { e.preventDefault(); st.fragor[st.steg].v = +inp.value; klick(); nasta(); } },
    lage, varde, spar,
    el("div", { class: "skala", "aria-hidden": "true" }, el("span", {}, q.skala[0]), el("span", {}, q.skala[1])),
    el("div", { class: "actions" }, el("button", { type: "submit", class: "btn" }, sista ? t("Till underskrift") : t("Nästa fråga"))));
  return { form, inp };
}
function ordfalt(q, f) {
  const sista = st.steg === st.fragor.length - 1, id = "ord-" + f.i;
  const inp = el("input", { id, type: "text", maxlength: "20", value: f.v || "", placeholder: q.platshallare || t("Ett ord"), autocomplete: "off", autocapitalize: "none", spellcheck: "false", enterkeyhint: "done", "aria-label": q.fraga, "aria-describedby": id + "-h" });
  const rakna = el("span", { class: "rakna", "aria-hidden": "true" }), hint = el("p", { class: "small hint", id: id + "-h" }, t("Ett ord. Ordet tolkas mot Verkets nyckelordsregister."));
  const upd = () => (rakna.textContent = `${inp.value.length} / 20`);
  inp.addEventListener("input", upd); upd();
  const form = el("form", { class: "ord", onsubmit: (e) => {
    e.preventDefault();
    const v = rensa(inp.value);
    if (!v) { hint.textContent = t("Ange ett ord, eller avstå."); hint.classList.add("fel"); inp.focus(); return; }
    st.fragor[st.steg].v = v; klick(); nasta();
  } },
    el("div", { class: "falt" }, inp, rakna), hint,
    el("div", { class: "actions" },
      el("button", { type: "submit", class: "btn" }, t("Diarieför ordet")),
      el("button", { type: "button", class: "btn ghost", onclick: () => { st.fragor[st.steg].v = ""; nasta(); } }, sista ? t("Avstår och går till underskrift") : t("Avstår"))));
  return { form, inp };
}
function ritruta() {
  const wrap = el("div", { class: "rita" }), c = el("canvas", { "aria-label": t("Rityta. Rita en cirkel med mus eller finger.") }), hint = el("span", { class: "hint" }, t("Rita med musen eller fingret"));
  wrap.append(c, hint);
  const pts = []; let ner = false, ctx;
  const storlek = () => { const r = wrap.getBoundingClientRect(), d = Math.min(devicePixelRatio, 2); c.width = r.width * d; c.height = r.height * d; ctx = c.getContext("2d"); ctx.scale(d, d); ctx.lineWidth = 2.6; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#14181a"; };
  // Ytan mäts när den syns. Arket glider in först, så storleken är inte känd när rutan skapas.
  // Ändras storleken (telefonen vrids) ritas strecket om.
  const ritaOm = () => { if (pts.length < 2) return; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); pts.forEach(([x, y]) => ctx.lineTo(x, y)); ctx.stroke(); };
  new ResizeObserver(() => { if (wrap.isConnected) { storlek(); ritaOm(); } }).observe(wrap);
  const pos = (e) => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top, r.width, r.height]; };
  c.addEventListener("pointerdown", (e) => { if (!ctx || !c.width) storlek(); ner = true; c.setPointerCapture(e.pointerId); pts.length = 0; const r = c.getBoundingClientRect(); ctx.clearRect(0, 0, r.width, r.height); const [x, y] = pos(e); pts.push([x, y]); ctx.beginPath(); ctx.moveTo(x, y); hint.hidden = true; });
  c.addEventListener("pointermove", (e) => { if (!ner) return; const [x, y, w, h] = pos(e); pts.push([x, y]); ctx.lineTo(x, y); ctx.stroke(); st.ritning = { pts: pts.slice(), w, h }; });
  c.addEventListener("pointerup", () => (ner = false));
  st.ritning = null;
  return wrap;
}

// ---------- handläggning ----------
function handlagg(a, steg, sedan) {
  const p = papper(), ol = el("ol", {}, steg.map((s) => el("li", {}, s)));
  p.append(huvud(`${blankett()} · ${dnr(a)}`, a.overklag ? t("Överklagandet handläggs") : t("Ärendet handläggs")), el("div", { class: "processing", role: "status" }, ol));
  visa(p);
  if (reduce) { sedan(); return; }
  let i = 0;
  const tick = () => {
    ol.children[i]?.classList.add("on"); klick(); i++;
    if (i < steg.length) nar(p, tick, 480); else nar(p, sedan, 600);
  };
  nar(p, tick, 380);
}
function lamnaIn(utan) {
  st.cirkel = utan ? null : forenkla(st.ritning);
  const a = fatta({ fro: st.fro, dag: dagNu(), snabb: false, overklag: 0, fragor: st.fragor.map((f) => ({ ...f })), cirkel: st.cirkel }, st.visade);
  const H = AN.handlaggning, ord = a.fragor.find((f) => f.t === 3 && f.v);
  const steg = [...H.gemensamt, ord ? fyll(H.ord, { ord: forstaOrd(ord.v).ord }) : null, a.cirkel ? H.cirkel : null, ...H[UTGANG[a.utgang]]].filter(Boolean);
  const kod = koda(a);
  minnas(a);
  handlagg(a, steg, () => visaKod(kod));
}
function forenklat() {
  if (!st) nyAnsokan();
  const a = fatta({ fro: st.fro, dag: dagNu(), snabb: true, overklag: 0, fragor: [], cirkel: null }, st.visade);
  minnas(a);
  visaKod(koda(a));
}
function overklaga(a, status) {
  if (a.overklag >= 15) { status.textContent = t("Överklagandet avvisas. Beslutet har redan omprövats det högsta tillåtna antalet gånger."); return; }
  if (!st || st.fro !== a.fro) { st = { fro: a.fro, dag: a.dag, snabb: a.snabb, overklag: a.overklag, fragor: a.fragor, cirkel: a.cirkel, steg: a.fragor.length, visade: new Set() }; minnas(a); }
  const b = fatta({ ...a, dag: dagNu(), overklag: a.overklag + 1, fragor: a.fragor.map((f) => ({ ...f })) }, st.visade);
  minnas(b);
  const kod = koda(b);
  handlagg(b, [t("Överklagandet registreras"), t("Beslutet omprövas")], () => visaKod(kod));
}

// ---------- beslut ----------
function visaKod(kod) {
  const a = dekoda(kod);
  if (!a) { skadad(); return; }
  satt(vag("beslut", kod));
  beslut(a, kod);
}
function skadad() {
  const p = papper();
  p.append(huvud(S.blankett, t("Beslutet kunde inte återfinnas")), el("p", { class: "lead" }, AN.skadad),
    el("div", { class: "actions" }, el("button", { type: "button", class: "btn", onclick: start }, t("Ny ansökan")), el("a", { href: vag("registret"), class: "link" }, t("Se hela registret"))));
  visa(p);
}
function beslut(a, kod) {
  const typ = UTGANG[a.utgang], B = BES[typ], prof = a.snabb ? null : profil(a), nr = dnr(a), dag = datum(a.dag);
  const adress = location.href.split("#")[0] + vag("beslut", kod);
  const p = papper(); p.classList.add("beslut", "utgang-" + typ);
  p.append(huvud(t("Beslut · {nr}", { nr }), a.overklag ? t("Beslut efter överklagande") : t("Beslut")));
  p.append(el("div", { class: "fields" },
    el("div", {}, el("span", {}, t("Diarienummer")), el("b", {}, nr)),
    el("div", {}, el("span", {}, t("Datum")), el("b", {}, dag)),
    el("div", {}, el("span", {}, t("Handläggare")), el("b", {}, B.handlaggare || S.handlaggare)),
    el("div", {}, el("span", {}, t("Utgång")), el("b", {}, B.utgang))));
  const stamp = el("div", { class: "stamp" + (B.stampel.length > 11 ? " lang" : ""), role: "img", "aria-label": t("Stämpel: {s}", { s: B.stampel.toLowerCase() }) }, B.stampel, el("small", {}, dag));
  const stamp2 = a.overklag ? el("div", { class: "stamp tva", role: "img", "aria-label": t("Stämpel: {s}", { s: AN.omprovat.stampel.toLowerCase() }) }, AN.omprovat.stampel, el("small", {}, `${a.overklag}`)) : null;
  const tx = el("div", { class: "beslut-text" }, stamp, stamp2), sagt = new Set();
  const stycke = (t) => { if (!t || sagt.has(t)) return; sagt.add(t); tx.append(el("p", {}, t)); };
  p.append(tx);
  const lista = a.bilagor.map((h) => HASH.get(h) || null), vind = a.vind != null ? HASH.get(a.vind) || null : null;
  if (a.snabb) AN.forenklat.forEach(stycke);
  else {
    const topp = DIMS.filter((d) => prof.P[d] > 0).sort((x, y) => prof.P[y] - prof.P[x]).slice(0, 2);
    stycke(t("Verket har prövat ansökan och funnit att sökanden uppvisar {behov}.", { behov:
      topp.length === 2 ? t("{a} samt {b}", { a: MOTIV[topp[0]], b: MOTIV[topp[1]] }) : topp.length ? MOTIV[topp[0]] : t("inga särskilda behov alls, vilket i sig är anmärkningsvärt") }));
    if (prof.art) {
      const okand = prof.art.okand;
      stycke(okand ? prof.art.skal + (typ === "bifall" ? " " + AN.art_okand_bifall : "") : t("Sökanden har uppgett sig vara: {art}.", { art: prof.art.text.toLowerCase() }));
      if (okand) sagt.add(prof.art.skal);
    }
    prof.noter.forEach((n) => {
      const t = n.text.slice();
      if (n.sok) { const traff = new Set(arkivtraffar(n.sok)); t.push(lista.some((v) => v && traff.has(v)) ? AN.arkivet.funnet : AN.arkivet.ej_funnet); }
      stycke(t.join(" "));
    });
    if (typ !== "bifall") {
      const g = [...new Set(prof.skal[typ] || [])].filter((s) => !sagt.has(s));
      stycke(g.length ? g.join(" ") : (prof.skal[typ] || []).length ? null : B.allmant);
      if (a.overklag && B.overklagat) stycke(B.overklagat);
    }
    if (a.overklag) stycke(fyll(AN.omprovat.text, { n: a.overklag }));
    stycke(a.cirkel ? CIRKEL[CIRKELBED[a.cirkel.bed]].text : CIRKEL.avstod);
    stycke(B.slut);
  }
  if (a.cirkel) tx.append(el("div", { class: "sig" }, cirkelSvg(a.cirkel), el("span", {}, t("Sökandes cirkel, diarieförd"))));
  tx.append(el("p", { class: "lagrum" }, (a.snabb ? BES.bifall : B).lagrum));

  p.append(el("h2", {}, (!a.snabb && B.rubrik_bilagor) || t("Bilagor")));
  const visbar = [...lista, vind].filter(Boolean), grid = el("div", { class: "bilagor n" + lista.length });
  const etikett = (k) => (a.snabb ? "" : k === 0 && B.etikett_forsta ? B.etikett_forsta : B.etikett || "");
  lista.forEach((v, k) => {
    const lbl = el("span", { class: "lbl" }, t("Bilaga {k}", { k: k + 1 }), etikett(k) ? ` · ${etikett(k)}` : "");
    if (!v) { grid.append(el("div", { class: "bilaga aterkallad" }, el("span", { class: "clip", "aria-hidden": "true" }), lbl, el("div", { class: "m" }), el("b", {}, AN.aterkallad))); return; }
    const m = el("div", { class: "m" }, tumnagel(v));
    m.querySelectorAll("img").forEach((i) => (i.loading = "eager"));
    grid.append(el("button", { type: "button", class: "bilaga" + (typ === "absurdimo" && k === 0 && !a.snabb && v.kanal === "Absurdimo" ? " fran-absurdimo" : ""), onclick: () => oppna(visbar, visbar.indexOf(v)) },
      el("span", { class: "clip", "aria-hidden": "true" }), lbl, m, el("b", {}, v.titel), el("span", { class: "meta" }, metaRad(v))));
  });
  p.append(grid);
  if (vind) {
    const m = el("div", { class: "m" }, tumnagel(vind));
    m.querySelectorAll("img").forEach((i) => (i.loading = "eager"));
    p.append(el("button", { type: "button", class: "vind", onclick: () => oppna(visbar, visbar.length - 1) }, m,
      el("div", {}, el("span", { class: "mono small" }, t("Bilaga {k} · Vindfrö", { k: lista.length + 1 })), el("p", { style: "margin:4px 0 2px;font-weight:700" }, vind.titel),
        el("span", { class: "small" }, t("Tilldelat slumpmässigt enligt Verkets föreskrift om oväntade lösningar.")))));
  }
  const [forsta, ...resten] = AN.overklagande.split(/(?<=\.)\s/);
  p.append(el("p", { class: "hanvisning" }, el("b", {}, forsta), " ", resten.join(" ")));
  p.append(el("p", { class: "utskrift" }, ...tDelar("Beslutet finns i diariet under adressen {adress}", { adress: el("span", { class: "mono" }, adress) })));

  const kontakt = kontaktRuta(nr); kontakt.hidden = true;
  const status = el("p", { class: "delstatus", role: "status", "aria-live": "polite" });
  p.append(
    el("div", { class: "actions" },
      el("button", { type: "button", class: "btn", "aria-expanded": "false", onclick: (e) => { kontakt.hidden = !kontakt.hidden; e.currentTarget.setAttribute("aria-expanded", String(!kontakt.hidden)); if (!kontakt.hidden) kontakt.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" }); } }, t("Begär handläggning")),
      el("button", { type: "button", class: "btn ghost", onclick: () => overklaga(a, status) }, t("Överklaga beslutet"))),
    el("div", { class: "actions sekundar" },
      el("button", { type: "button", class: "btn ghost liten", onclick: () => kopiera(adress, status) }, t("Kopiera beslutets adress")),
      el("button", { type: "button", class: "btn ghost liten", onclick: () => window.print() }, t("Skriv ut beslutet")),
      el("button", { type: "button", class: "link", onclick: start }, t("Ny ansökan")),
      el("a", { href: vag("registret"), class: "link" }, t("Se hela registret"))),
    status, kontakt);
  visa(p);
  nar(p, () => {
    stamp.classList.add("go");
    setTimeout(() => { stampel(); p.classList.add("shake"); }, reduce ? 0 : 230);
    if (stamp2) nar(p, () => { stamp2.classList.add("go"); setTimeout(stampel, reduce ? 0 : 230); }, reduce ? 0 : 620);
  }, reduce ? 0 : 520);
}
async function kopiera(adress, status) {
  try {
    await navigator.clipboard.writeText(adress);
    status.replaceChildren(t("Adressen har kopierats. Den som öppnar adressen tar del av samma beslut."));
    klick();
  } catch (e) {
    const f = el("input", { class: "adressfalt", type: "text", readonly: true, value: adress, "aria-label": t("Beslutets adress"), onfocus: (ev) => ev.target.select() });
    status.replaceChildren(t("Adressen kunde inte kopieras automatiskt. Markera och kopiera den nedan."), f);
    f.focus(); f.select();
  }
}

export function render(root) {
  app = root;
  start();
}
// Ett delat beslut: #beslut-<kod>
export function delat(root, kod) {
  app = root;
  visaKod(kod);
}
export function tangent(e) {
  if (!app || e.ctrlKey || e.metaKey || e.altKey) return;
  if (!/^[1-9]$/.test(e.key)) return;
  const b = app.querySelectorAll(".opts .opt, .bildval .bv")[+e.key - 1];
  if (b) b.click();
}
