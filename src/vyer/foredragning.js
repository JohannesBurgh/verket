// Föredragningen. Verket föredrar sitt eget arkiv i en självspelande sekvens på 90 till 120 sekunder.
// Urvalet styrs av ett frö i adressen, #foredragning-<frö>, så att en viss föredragning kan delas.
//
// Sekvensen är en tidslinje av avsnitt, mätt i slag (80 slag i minuten). Allt som rör sig är
// Web Animations som går att pausa och spola, och ljudet syntetiseras med WebAudio mot samma klocka.
// Med prefers-reduced-motion blir det ett lugnt bildspel: samma urval, bara toningar.
//
// Samma föredragning kan också spelas inne i Arkivrummet (#arkivrummet-foredragning-<frö>).
// Då står spelaren för klockan, ljudet, texterna och kontrollerna, och rummet för bilderna
// (se src/rum/foredragning.js). Ett frö ger samma föredragning på båda ställena.
import "../stil/foredragning.css";
import { VERK, S, el, kanalFarg, metaRad, ytBild, PREVIEW, idag } from "../data.js";
import { oppna, oppen as visareOppen } from "../visare.js";
import { arPa } from "../ljud.js";
import { t, vag, las, arVy } from "../sprak.js";

export const BPM = 80, SLAG = 60 / BPM, MS = SLAG * 1000;
const POOL = VERK.filter((v) => v.vikt !== "damm");
const PEKSKARM = matchMedia("(hover: none)").matches;
const EASE = "cubic-bezier(.2,.8,.2,1)";

// ---------- frö ----------
const TECKEN = "abcdefghjkmnpqrstuvwxyz23456789";
export const nyttFro = () => Array.from({ length: 5 }, () => TECKEN[Math.floor(Math.random() * TECKEN.length)]).join("");
export const tvatta = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16);
function slump(fro) {
  let h = 2166136261;
  for (const c of fro) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); }
  let a = h >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------- urval ----------
// Hjältar dras tre gånger så ofta. Två verk ur samma epok följer aldrig direkt på varandra,
// och en epok som redan visats får lägre vikt, så att föredragningen sprids över arkivet.
const ARTER = {
  foto: (v) => v.typ === "foto" && v.bild,
  film: (v) => v.typ !== "foto" && v.kanal !== "Absurdimo",
  absurd: (v) => v.kanal === "Absurdimo",
  hjaltefoto: (v) => v.vikt === "hjälte" && v.typ === "foto" && v.bild,
  hjalte: (v) => v.vikt === "hjälte" && v.kanal !== "Absurdimo",
};
function urval(rnd) {
  const tagna = new Set(), epoker = new Map();
  let forra = null;
  return (...arter) => {
    for (const art of arter) {
      const kand = POOL.filter((v) => ARTER[art](v) && !tagna.has(v.id) && v.epok !== forra);
      if (!kand.length) continue;
      const vikt = kand.map((v) => (v.vikt === "hjälte" ? 3 : 1) * 0.45 ** (epoker.get(v.epok) || 0));
      let r = rnd() * vikt.reduce((a, b) => a + b, 0), k = 0;
      while (k < kand.length - 1 && (r -= vikt[k]) > 0) k++;
      const v = kand[k];
      tagna.add(v.id); epoker.set(v.epok, (epoker.get(v.epok) || 0) + 1); forra = v.epok;
      return v;
    }
    return null;
  };
}

// ---------- manus ----------
const TYSTA = new Set(["avbrott", "blixt", "slut"]); // avsnitt där pulsen tystnar
export function manus(froIn, lugn = false) {
  const fro = tvatta(froIn) || "verket";
  const rnd = slump(fro), ta = urval(rnd), seg = [];
  const L = (typ, slag, d = {}) => seg.push({ typ, slag, ...d });
  const kamera = () => {
    const inzoom = rnd() < 0.62, a = 1 + rnd() * 0.02, b = 1.07 + rnd() * 0.05, r = () => (rnd() - 0.5);
    return { s0: inzoom ? a : b, s1: inzoom ? b : a, x0: r() * 3, x1: r() * 3, y0: r() * 2, y1: r() * 2, r0: r() * 0.8, r1: r() * 0.8 };
  };
  const V = (typ, slag, ...arter) => {
    const v = ta(...arter);
    if (!v) return null;
    if (typ === "film" && v.typ === "foto") typ = "foto";
    L(typ, slag, { v, kb: kamera(), rot: -4 - rnd() * 9, tc: Math.floor(rnd() * 50) * 60 + Math.floor(rnd() * 60) });
    return v;
  };

  L("oppning", 16);
  L("rubrik", 4, { nr: "§ 1", titel: t("Fotografi"), under: t("Stillbild. Ur arkivet, i den ordning fröet anger.") });
  for (let k = 0; k < 3; k++) V("foto", 6, "foto");
  L("rubrik", 4, { nr: "§ 2", titel: t("Rörlig bild"), under: t("Film. Återges som stillbild i kanalens färg.") });
  for (let k = 0; k < 2; k++) V("film", 5, "film", "foto");
  L("uppgift", 6);
  for (let k = 0; k < 4; k++) V("snabb", lugn ? 5 : 2, "foto");
  const avbrott = V("avbrott", 8, "absurd");
  L("rubrik", 4, { nr: "§ 3", titel: t("Återupptagen föredragning"), under: avbrott ? t("Föredragningen återupptas där den avbröts.") : t("Föredragningen fortsätter.") });
  for (let k = 0; k < 2; k++) V("foto", 6, "foto");
  V("film", 5, "film", "foto");
  V("blixt", 3, "absurd");
  L("rubrik", 4, { nr: "§ 4", titel: t("Handling av särskild vikt"), under: t("Verket fäster särskild vikt vid följande handling.") });
  V("hjalte", 10, "hjaltefoto", "hjalte", "foto");
  L("kontakt", 12);
  L("slut", 8);

  let tid = 0, nr = 0;
  const verk = [];
  seg.forEach((s, i) => {
    s.i = i; s.start = tid; s.dur = s.slag * SLAG; tid += s.dur; s.slut = tid; s.tyst = TYSTA.has(s.typ);
    if (s.v) { s.nr = ++nr; verk.push(s.v); }
  });
  const plan = { fro, lugn, seg, verk, total: tid, dnr: `${S.diarieprefix || "VOL"} F/${fro.toUpperCase()}` };
  plan.ljud = ljudspar(plan);
  return plan;
}

// Ljudhändelser per avsnitt, i slag från avsnittets början.
const SPAR = {
  oppning: (s, p) => [...[...p.dnr].map((_, k) => [0.4 + k * 0.16, "klick", 0.7]), [3, "papper"], [4, "slag"], [5, "slag"], [6, "slag"],
    [8, "klick"], [8.5, "klick"], [9, "klick"], [9.5, "klick"], [12, "stampel"], [s.slag - 0.6, "papper", 0.6]],
  rubrik: (s) => [[0, "papper"], [1, "slag"], [s.slag - 0.55, "papper", 0.5]],
  foto: () => [[0.75, "papper", 0.45]],
  film: () => [[0, "projektor"], [0.75, "papper", 0.4]],
  uppgift: () => [[0, "slag"], [1.25, "slag"], [2, "slag"], [3, "slag"], [4.25, "klick"]],
  snabb: (s, p) => (p.lugn ? [[0.75, "papper", 0.45]] : [[1, "stampel", 0.8]]),
  avbrott: () => [[0, "absurd", 1], [1.5, "absurd", 2], [5.75, "klick"], [6.75, "absurd", 3]],
  blixt: () => [[0, "absurd", 2], [1.25, "klick"]],
  hjalte: () => [[0.75, "papper", 0.45], [7, "stampel"]],
  kontakt: (s) => [[0, "papper"], [1, "slag"], [1.75, "slag"], [3, "klick"], [3.75, "klick"], [4.5, "klick"], [5.25, "klick"], [s.slag - 0.55, "papper", 0.5]],
  slut: () => [[0.5, "slutton"]],
};
function ljudspar(plan) {
  const ut = [];
  for (const s of plan.seg) {
    if (!s.tyst) for (let k = 0; k < s.slag; k++) ut.push({ t: s.start + k * SLAG, typ: "puls", arg: k % 4 === 0 });
    for (const [b, typ, arg] of SPAR[s.typ](s, plan)) ut.push({ t: s.start + b * SLAG, typ, arg });
  }
  return ut.sort((a, b) => a.t - b.t);
}

// ---------- hjälpare ----------
const langd = (sek) => { const m = Math.floor(sek / 60), r = Math.round(sek % 60); return m ? t("{m} min {s} s", { m, s: r }) : t("{s} s", { s: r }); };
const klocka = (sek) => { const s = Math.max(0, Math.floor(sek)); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255); };
const hal = () => [el("span", { class: "hal a", "aria-hidden": "true" }), el("span", { class: "hal b", "aria-hidden": "true" })];
const stillbild = (v) => v.bild || (!PREVIEW && v.youtube ? ytBild(v) : null);
const arsSpann = (() => { const a = VERK.map((v) => v.ar).filter((x) => x != null).map(Math.floor); return a.length ? [Math.min(...a), Math.max(...a)] : null; })();
// Hårda steg i en animation: värdena byts rakt av, utan mellanlägen.
const steg = (prop, varden) => varden.flatMap((v, k, a) => [{ [prop]: v, offset: k / a.length }, { [prop]: v, offset: k === a.length - 1 ? 1 : (k + 1) / a.length - 0.0001 }]);

// Verktyg för ett avsnitt. Alla tider anges i slag från avsnittets början.
function verktyg(plan) {
  const lugn = plan.lugn, ticks = [];
  const anim = (n, kf, slag0, slagD, opt = {}) => { n.animate(kf, { delay: slag0 * MS, duration: Math.max(1, slagD * MS), fill: "both", easing: EASE, ...opt }); return n; };
  const KF = {
    upp: [{ opacity: 0, transform: "translateY(.6em)" }, { opacity: 1, transform: "none" }],
    mask: [{ transform: "translateY(108%)" }, { transform: "none" }],
    tona: [{ opacity: 0 }, { opacity: 1 }],
    lapp: [{ opacity: 0, transform: "translate(-24px, 10px) rotate(-4deg)" }, { opacity: 1, transform: "none" }],
    pop: [{ opacity: 0, transform: "scale(.6) rotate(-14deg)" }, { opacity: 1, transform: "scale(1.06) rotate(1deg)", offset: 0.7 }, { opacity: 1, transform: "none" }],
  };
  const k = {
    plan, lugn, ticks, anim,
    inn: (n, slag0, satt = "upp", d = 0.8) => (lugn ? anim(n, KF.tona, slag0, Math.max(1, d), { easing: "ease" }) : anim(n, KF[satt], slag0, d)),
    ut: (n, slag0, d = 0.5) => anim(n, [{ opacity: 1 }, { opacity: 0 }], slag0, d, { fill: "forwards", easing: "ease-in" }),
    // Pappret läggs på bordet och dras bort åt vänster.
    ark: (n, slag0) => (lugn ? anim(n, KF.tona, slag0, 1, { easing: "ease" })
      : anim(n, [{ transform: "translateY(85vh) rotate(5deg)" }, { transform: "none" }], slag0, 1, { easing: "cubic-bezier(.16,1,.3,1)" })),
    arkUt: (n, slag0) => (lugn ? anim(n, [{ opacity: 1 }, { opacity: 0 }], slag0, 0.5, { fill: "forwards", easing: "ease" })
      : anim(n, [{ transform: "none" }, { transform: "translate(-115vw, -3vh) rotate(-7deg)" }], slag0, 0.55, { fill: "forwards", easing: "cubic-bezier(.55,0,.8,.2)" })),
    // Stämpeln faller och slår i exakt på slaget.
    stampa: (n, slag0, rot = -9) => {
      n.style.rotate = rot + "deg";
      return lugn ? anim(n, [{ opacity: 0 }, { opacity: 0.92 }], slag0, 1, { easing: "ease" })
        : anim(n, [{ opacity: 0, transform: "scale(2.3) rotate(-6deg)" }, { opacity: 0.92, transform: "none" }], slag0 - 0.4, 0.4, { easing: "cubic-bezier(.55,0,.9,.4)" });
    },
    skak: (n, slag0) => { if (!lugn) anim(n, [{ translate: "0 0" }, { translate: "0 4px" }, { translate: "0 -1px" }, { translate: "0 0" }], slag0, 0.35, { fill: "none", easing: "ease-out" }); return n; },
    linje: (n, slag0) => (lugn ? anim(n, KF.tona, slag0, 1) : anim(n, [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], slag0, 1.2, { easing: "cubic-bezier(.6,0,.2,1)" })),
    // Text som skrivs ut tecken för tecken, styrt av klockan.
    skriv: (n, text, slag0, per = 0.16) => {
      n.textContent = ""; let senast = -1;
      ticks.push((lok) => {
        const b = lok / SLAG - slag0, c = lugn ? (b >= 0 ? text.length : 0) : Math.max(0, Math.min(text.length, Math.floor(b / per) + 1));
        if (c !== senast) { senast = c; n.textContent = text.slice(0, c); n.classList.toggle("skriver", c > 0 && c < text.length); }
      });
      return n;
    },
    rakna: (n, till, slag0, slagD = 1.5) => {
      let senast = -1;
      ticks.push((lok) => {
        const p = lugn ? 1 : Math.max(0, Math.min(1, (lok / SLAG - slag0) / slagD)), v = Math.round(till * (1 - (1 - p) ** 3));
        if (v !== senast) { senast = v; n.textContent = String(v); }
      });
      return n;
    },
  };
  return k;
}

// Kamerarörelse över ett foto eller en stillbild: långsam, åt ett håll, styrd av fröet.
function kameraAnim(k, n, bak, s, skala = 1) {
  if (k.lugn) return;
  const kb = s.kb, f = skala;
  k.anim(n, [{ transform: `translate(${kb.x0 * f}%, ${kb.y0 * f}%) scale(${1 + (kb.s0 - 1) * f}) rotate(${kb.r0 * f}deg)` },
    { transform: `translate(${kb.x1 * f}%, ${kb.y1 * f}%) scale(${1 + (kb.s1 - 1) * f}) rotate(${kb.r1 * f}deg)` }], 0, s.slag, { easing: "cubic-bezier(.35,.1,.65,.9)" });
  if (bak) k.anim(bak, [{ transform: `scale(1.18) translate(${-kb.x0}%, ${-kb.y0}%)` }, { transform: `scale(1.26) translate(${-kb.x1}%, ${-kb.y1}%)` }], 0, s.slag, { easing: "linear" });
}
// Rummets ljus bakom fotot: bilden förminskad till några få pixlar och uppskalad igen.
// Det ger samma mjuka sken som ett suddfilter men kostar nästan ingenting att flytta.
function bakgrund(src) {
  const c = el("canvas", { class: "fd-bak", width: "48", height: "32", "aria-hidden": "true" }), im = new Image();
  im.onload = () => {
    const g = c.getContext("2d"); if (!g) return;
    c.height = Math.max(8, Math.round(48 / (im.naturalWidth / im.naturalHeight || 1.5)));
    if ("filter" in g) g.filter = "blur(2px) saturate(1.15) brightness(.42)";
    g.drawImage(im, -4, -4, c.width + 8, c.height + 8);
    if (!("filter" in g) || g.filter === "none") { g.fillStyle = "rgba(0,0,0,.58)"; g.fillRect(0, 0, c.width, c.height); }
  };
  im.src = src;
  return c;
}
export function lapp(k, s, rad, extra, slag0 = 0.75) {
  const l = el("div", { class: "fd-lapp" }, el("span", { class: "mono" }, t("Bilaga {nr} av {n}", { nr: s.nr, n: k.plan.verk.length })), el("b", {}, s.v.titel), el("span", { class: "mono" }, rad), extra || null);
  return k.inn(l, slag0, "lapp", 0.7);
}
export function stampel(text, liten) {
  return el("div", { class: "fd-stampel", "aria-hidden": "true" }, text, liten ? el("small", {}, liten) : null);
}
// En film som stillbild, tonad i kanalens färger. Cyan markerar rörlig bild.
function filmram(k, s, farger) {
  const v = s.v, [a, b] = farger || kanalFarg(v.kanal), [mork, ljus] = lum(a) < lum(b) ? [a, b] : [b, a], src = stillbild(v);
  const duo = el("div", { class: "fd-duo", style: `--mork:${mork};--ljus:${ljus}` },
    el("strong", { class: "fd-filmtitel" }, v.titel),
    src ? el("img", { src, alt: "", decoding: "async", onload: (e) => e.currentTarget.parentNode?.classList.add("har-bild"), onerror: (e) => e.currentTarget.remove() }) : null);
  const tc = el("span", { class: "fd-tc mono", "aria-hidden": "true" });
  k.ticks.push((lok) => {
    const f = Math.floor((s.tc + lok) * 25), ss = Math.floor(f / 25);
    tc.textContent = [Math.floor(ss / 3600), Math.floor(ss / 60) % 60, ss % 60, f % 25].map((x) => String(x).padStart(2, "0")).join(":");
  });
  if (!k.lugn) k.anim(duo, [{ opacity: 1 }, { opacity: 0.9 }, { opacity: 1 }, { opacity: 0.95 }, { opacity: 1 }], 0, 1.3, { iterations: Infinity, fill: "none", easing: "linear" });
  return el("div", { class: "fd-ram" }, duo, ...["a", "b", "c", "d"].map((h) => el("i", { class: "fd-horn " + h, "aria-hidden": "true" })),
    el("span", { class: "fd-rec mono" }, v.kanal === "Absurdimo" ? "▶ Absurdimo" : "▶ " + t("Rörlig bild")), tc);
}

// ---------- avsnitten ----------
const BYGG = {
  oppning(s, k) {
    const p = k.plan;
    const dnr = k.skriv(el("div", { class: "fd-dnr mono" }), p.dnr, 0.4);
    k.ut(dnr, 3, 0.6);
    // Tre rader som slår ned en i taget. | delar raderna.
    const rader = t("Verket|föredrar|sitt arkiv.").split("|").map((rad, j) => el("span", { class: "fd-rad" }, k.inn(el("span", {}, rad), 4 + j, "mask", 0.7)));
    const falt = el("div", { class: "fields fd-falt" }, ...[[t("Diarienummer"), p.dnr], [t("Datum"), idag()], [t("Föredragande"), S.handlaggare],
      [t("Omfattning"), t("{n} handlingar, {langd}", { n: p.verk.length, langd: langd(p.total) })]].map(([a, b], j) => k.inn(el("div", {}, el("span", {}, a), el("b", {}, b)), 8 + j * 0.5, "upp", 0.6)));
    const hint = k.inn(el("p", { class: "fd-hint mono" }, PEKSKARM ? t("Tryck för att pausa. Svep för att bläddra.") : t("Mellanslag pausar. Pilarna bläddrar. Escape avslutar.")), 10, "tona", 1);
    const st = k.stampa(stampel(t("Föredras"), idag()), 12, -8);
    const ark = el("section", { class: "paper fd-ark fd-oppning" }, ...hal(),
      el("div", { class: "head" }, el("div", { class: "org" }, S.namn), el("div", { class: "form" }, t("Föredragning · {dnr}", { dnr: p.dnr }))),
      el("div", { class: "fd-stor" }, rader), falt, hint, st);
    k.ark(ark, 3); k.skak(ark, 12); k.arkUt(ark, s.slag - 0.6);
    return el("div", { class: "fd-seg" }, dnr, ark);
  },

  rubrik(s, k) {
    const ark = el("section", { class: "paper fd-ark fd-flik" },
      el("span", { class: "fd-fliknr mono" }, s.nr),
      el("div", { class: "org" }, S.namn),
      el("div", { class: "fd-rubrik" + (s.titel.length > 14 ? " lang" : "") }, el("span", { class: "fd-rad" }, k.inn(el("span", {}, s.titel + "."), 1, "mask", 0.7))),
      k.linje(el("i", { class: "fd-linje" }), 1.4),
      k.inn(el("p", { class: "mono fd-under" }, s.under), 2, "tona", 0.8));
    k.ark(ark, 0); k.arkUt(ark, s.slag - 0.55);
    return el("div", { class: "fd-seg" }, ark);
  },

  foto(s, k, opt = {}) {
    const v = s.v;
    const bak = bakgrund(v.bild);
    const tryck = el("figure", { class: "fd-tryck", style: `--ar:${v.format}` }, el("img", { src: v.bild, alt: v.titel, decoding: "async" }));
    const kam = el("div", { class: "fd-kamera" }, tryck);
    kameraAnim(k, kam, bak, s, opt.stor ? 0.8 : 1);
    k.anim(bak, [{ opacity: 0 }, { opacity: 1 }], 0, 1.2, { easing: "ease" });
    k.inn(tryck, 0, "tona", k.lugn ? 1 : 0.3);
    if (opt.stampel) { tryck.append(k.stampa(stampel(opt.stampel[0]), opt.stampel[1], s.rot)); k.skak(kam, opt.stampel[1]); }
    return el("div", { class: "fd-seg fd-foto" + (opt.stor ? " fd-storbild" : "") }, bak, kam, opt.utanLapp ? null : lapp(k, s, metaRad(v)));
  },

  snabb(s, k) {
    if (k.lugn) return BYGG.foto(s, k);
    const v = s.v;
    const tryck = el("figure", { class: "fd-tryck", style: `--ar:${v.format}` }, el("img", { src: v.bild, alt: v.titel, decoding: "async" }));
    tryck.append(k.stampa(stampel(t("Bilaga {nr}", { nr: s.nr })), 1, s.rot));
    const kam = el("div", { class: "fd-kamera" }, tryck);
    k.anim(kam, [{ transform: "scale(1.0)" }, { transform: "scale(1.035)" }], 0, s.slag, { easing: "linear" });
    k.skak(kam, 1);
    return el("div", { class: "fd-seg fd-foto fd-snabb" }, kam,
      el("p", { class: "fd-snabbrad mono" }, `${v.titel} · ${metaRad(v)}`));
  },

  film(s, k, opt = {}) {
    const v = s.v, ram = filmram(k, s), kam = el("div", { class: "fd-kamera" }, ram);
    kameraAnim(k, kam, null, s, 0.45);
    k.inn(ram, 0, "tona", k.lugn ? 1 : 0.35);
    if (opt.stampel) { ram.append(k.stampa(stampel(opt.stampel[0]), opt.stampel[1], s.rot)); k.skak(kam, opt.stampel[1]); }
    return el("div", { class: "fd-seg fd-film" }, kam, lapp(k, s, [v.kanal, metaRad(v)].filter(Boolean).join(" · ")));
  },

  uppgift(s, k) {
    const p = k.plan, rad = (etikett, varde, slag0, rakna) => {
      const b = el("b", {}, String(varde));
      if (rakna) k.rakna(b, varde, slag0, 1.4);
      return k.inn(el("div", { class: "r" }, el("span", {}, etikett), b), slag0, "upp", 0.6);
    };
    const lista = el("div", { class: "fd-liggare" },
      rad(t("Handlingar i arkivet"), VERK.length, 0, true),
      arsSpann ? rad(t("Äldsta handlingen"), arsSpann[0], 1.25) : null,
      arsSpann ? rad(t("Senaste handlingen"), arsSpann[1], 2) : null,
      rad(t("Föredras i dag"), p.verk.length, 3, true),
      k.inn(el("p", { class: "mono fd-not" }, t("Övriga handlingar finns i Registret.")), 4.25, "tona", 0.8));
    k.ut(lista, s.slag - 0.5, 0.5);
    return el("div", { class: "fd-seg fd-uppgift" }, lista);
  },

  avbrott(s, k) {
    const v = s.v, yta = el("div", { class: "fd-magenta" });
    if (!k.lugn) k.anim(yta, steg("opacity", [1, 0, 0.85, 0, 0.55, 0, 0.3, 0]), 0, 0.9, { easing: "linear" });
    else k.anim(yta, [{ opacity: 0 }, { opacity: 0.18 }], 0, 1, { easing: "ease" });
    const svep = el("div", { class: "fd-svep", "aria-hidden": "true" }, "Avbrott");
    if (!k.lugn) k.anim(svep, [{ transform: "translateX(40%)", opacity: 0 }, { opacity: 0.9, offset: 0.12 }, { opacity: 0.5, offset: 0.75 }, { transform: "translateX(-75%)", opacity: 0 }], 0, 4, { easing: "cubic-bezier(.3,.6,.2,1)" });
    const text = k.inn(el("p", { class: "fd-avbrottstext mono" }, t("Föredragningen har avbrutits av Absurdimo.")), 0.5, "tona", 0.5);
    const ram = filmram(k, s);
    ram.append(el("div", { class: "fd-absetikett" }, el("span", { class: "mono" }, t("Bilaga {nr}. Inkom oanmäld.", { nr: s.nr })), el("b", {}, v.titel)));
    const hall = el("div", { class: "fd-kamera fd-absram" }, ram);
    k.inn(hall, 1.5, "pop", 0.6);
    if (!k.lugn) {
      k.anim(ram, [{ rotate: "-3deg" }, { rotate: "2deg" }, { rotate: "-3deg" }], 2.1, 1, { iterations: 4, fill: "none", easing: "ease-in-out" });
      k.anim(hall, [{ transform: "none" }, { transform: "translateY(110vh) rotate(24deg)" }], 6.75, 0.9, { fill: "forwards", easing: "cubic-bezier(.5,0,.9,.3)" });
    } else k.ut(hall, 6.75, 1);
    const beklagar = k.inn(el("p", { class: "fd-beklagar mono" }, t("Verket beklagar avbrottet.")), 5.75, "tona", 0.6);
    return el("div", { class: "fd-seg fd-avbrott" }, yta, svep, text, hall, beklagar);
  },

  blixt(s, k) {
    const v = s.v;
    const yta = el("div", { class: "fd-blixtyta" }, el("span", { class: "mono" }, "Absurdimo"), el("strong", {}, v.titel), el("span", { class: "mono" }, t("Bilaga {nr}. Inkom oanmäld.", { nr: s.nr })));
    if (k.lugn) { k.anim(yta, [{ opacity: 0 }, { opacity: 1 }], 0, 0.6, { easing: "ease" }); k.ut(yta, 1.25, 0.6); }
    else {
      k.anim(yta, steg("opacity", [1, 1, 1, 1, 0]), 0, 1.5, { easing: "linear" });
      k.anim(yta.querySelector("strong"), steg("transform", ["rotate(-4deg)", "rotate(3deg) scale(1.08)", "rotate(-2deg)", "rotate(5deg) scale(.96)", "rotate(-4deg)"]), 0, 1.25, { easing: "linear" });
    }
    const notis = el("p", { class: "fd-notis mono" }, t("Avbrottet har noterats."));
    k.anim(notis, k.lugn ? [{ opacity: 0 }, { opacity: 1 }] : steg("opacity", [0, 1]), k.lugn ? 1.4 : 0.6, k.lugn ? 0.8 : 1.3, { easing: "linear" });
    return el("div", { class: "fd-seg fd-blixt" }, notis, yta);
  },

  hjalte(s, k) {
    return s.v.typ === "foto" && s.v.bild ? BYGG.foto(s, k, { stor: true, stampel: [t("Arkiveras"), 7] }) : BYGG.film(s, k, { stampel: [t("Arkiveras"), 7] });
  },

  kontakt(s, k) {
    const p = k.plan, saknas = el("span", { class: "mono" }, t("Uppgiften kompletteras."));
    const rad = (a, varde, href) => el("div", { class: "row" }, el("span", {}, a), varde ? (href ? el("a", { href }, varde) : el("span", { class: "mono" }, varde)) : saknas.cloneNode(true));
    const rader = [
      rad(t("E-post"), S.epost, S.epost ? `mailto:${S.epost}?subject=${encodeURIComponent(t("Föredragning {dnr}", { dnr: p.dnr }))}` : null),
      rad(t("Telefon"), S.telefon, S.telefon ? "tel:" + S.telefon.replace(/\s/g, "") : null),
      S.instagram ? rad("Instagram", S.instagram, "https://instagram.com/" + S.instagram.replace(/^@/, "")) : null,
      rad(t("Ange"), p.dnr),
    ].filter(Boolean).map((r, j) => k.inn(r, 3 + j * 0.75, "upp", 0.5));
    const ark = el("section", { class: "paper fd-ark fd-kontakt" }, ...hal(),
      el("div", { class: "head" }, el("div", { class: "org" }, S.namn), el("div", { class: "form" }, t("Föredragning · {dnr}", { dnr: p.dnr }))),
      el("div", { class: "fd-stor fd-mellan" }, t("Frågor om|föredragningen.").split("|").map((rad, j) => el("span", { class: "fd-rad" }, k.inn(el("span", {}, rad), 1 + j * 0.75, "mask", 0.7)))),
      k.inn(el("p", {}, t("Handläggning begärs per e-post eller telefon. Ange föredragningens diarienummer.")), 2.4, "tona", 0.8),
      el("div", { class: "kontakt" }, ...rader),
      k.inn(el("p", { class: "small" }, t("Handläggare: {namn}.", { namn: S.handlaggare })), 7.5, "tona", 1));
    k.ark(ark, 0); k.arkUt(ark, s.slag - 0.55);
    return el("div", { class: "fd-seg" }, ark);
  },

  slut(s, k) {
    const p = k.plan, knapp = (text, fn, primar) => el("button", { type: "button", class: "fd-knapp" + (primar ? " primar" : ""), onclick: fn }, text);
    const knappar = el("div", { class: "fd-slutknappar" },
      knapp(t("Föredra igen"), () => k.styr.omstart(), true),
      knapp(t("Ny föredragning"), () => { location.hash = k.styr.adress(nyttFro()); }),
      knapp(k.styr.iRummet ? t("Föredra utan rummet") : t("Föredra i Arkivrummet"), () => k.styr.byt()),
      knapp(t("Kopiera adressen"), (e) => k.styr.kopiera(e.currentTarget)),
      k.styr.iRummet ? el("a", { class: "fd-knapp", href: vag("arkivrummet") }, t("Stanna i rummet")) : el("a", { class: "fd-knapp", href: vag("registret") }, t("Till Registret")));
    k.inn(knappar, 4, "upp", 0.8);
    k.ticks.push((lok) => { const av = lok < 4 * SLAG; if (knappar.inert !== av) knappar.inert = av; });
    const kontakt = [S.epost && el("a", { href: "mailto:" + S.epost }, S.epost), S.telefon && el("a", { href: "tel:" + S.telefon.replace(/\s/g, "") }, S.telefon)].filter(Boolean);
    return el("div", { class: "fd-seg fd-slutseg" },
      el("h2", { class: "fd-slut" }, el("span", { class: "fd-rad" }, k.inn(el("span", {}, t("Föredragningen är avslutad.")), 0.5, "mask", 0.9))),
      k.inn(el("p", { class: "mono fd-slutmeta" }, t("{dnr} · {n} handlingar · {langd}", { dnr: p.dnr, n: p.verk.length, langd: langd(p.total) })), 2, "tona", 1),
      kontakt.length ? k.inn(el("p", { class: "mono fd-slutmeta" }, ...kontakt.flatMap((a, j) => (j ? [" · ", a] : [a]))), 2.6, "tona", 1) : null,
      knappar);
  },
};
// Var en föredragning stannar när man bläddrar i pausat läge: när avsnittet har lagt sig.
const VILA = { oppning: 13, rubrik: 2.9, foto: 3, film: 3, uppgift: 5, snabb: 1.5, avbrott: 4.5, blixt: 0.9, hjalte: 8, kontakt: 8.5, slut: 7.9 };
const beskriv = (s, p) => {
  if (s.v) return `${t("Bilaga {nr} av {n}", { nr: s.nr, n: p.verk.length })}. ${s.v.titel}. ${[s.v.kanal, metaRad(s.v)].filter(Boolean).join(", ")}.`;
  return { oppning: t("Föredragning {dnr}. {n} handlingar.", { dnr: p.dnr, n: p.verk.length }), rubrik: `${s.nr} ${s.titel}.`, uppgift: t("Arkivet omfattar {n} handlingar.", { n: VERK.length }),
    kontakt: t("Frågor om|föredragningen.").replace("|", " "), slut: t("Föredragningen är avslutad.") }[s.typ] || "";
};

// ---------- ljud ----------
let ctx = null, master = null, brusbuf = null, gest = false;
addEventListener("pointerdown", () => (gest = true), { capture: true });
addEventListener("keydown", () => (gest = true), { capture: true });
const aktiverad = () => (navigator.userActivation ? navigator.userActivation.hasBeenActive : gest);
function ljudet() {
  if (!arPa()) return null;
  if (!ctx) {
    if (!aktiverad()) return null;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const komp = ctx.createDynamicsCompressor();
      master = ctx.createGain(); master.gain.value = 0;
      master.connect(komp).connect(ctx.destination);
      brusbuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = brusbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ctx = null; return null; }
  }
  if (ctx.state !== "running") { ctx.resume().catch(() => {}); return null; }
  return ctx;
}
function kuvert(g, t, topp, a, r) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(topp, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + r); }
function brus(c, t, sek, filter, fq, q, topp, a, r) {
  const n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  n.buffer = brusbuf; f.type = filter; f.frequency.setValueAtTime(fq, t); f.Q.value = q;
  kuvert(g, t, topp, a, r); n.connect(f).connect(g).connect(master);
  n.start(t, Math.random() * 1.5, sek); return f;
}
function ton(c, t, typ, f0, f1, glid, topp, a, r) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = typ; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + glid);
  kuvert(g, t, topp, a, r); o.connect(g).connect(master); o.start(t); o.stop(t + a + r + 0.05); return o;
}
const LJUD = {
  // En sparsmakad puls: dov på ettan, svagare däremellan, med ett torrt tick.
  puls(c, t, stark) {
    ton(c, t, "sine", stark ? 96 : 80, 42, 0.14, stark ? 0.38 : 0.17, 0.004, stark ? 0.34 : 0.2);
    if (!stark) brus(c, t, 0.04, "highpass", 6500, 0.7, 0.02, 0.001, 0.03);
  },
  klick(c, t, s = 1) { brus(c, t, 0.04, "bandpass", 3200, 0.9, 0.11 * s, 0.001, 0.028); },
  slag(c, t) { ton(c, t, "sine", 170, 70, 0.08, 0.16, 0.003, 0.12); brus(c, t, 0.06, "lowpass", 2400, 0.7, 0.12, 0.001, 0.05); },
  papper(c, t, s = 1) {
    const f = brus(c, t, 0.55, "bandpass", 1500, 0.8, 0.085 * s, 0.07, 0.4);
    f.frequency.exponentialRampToValueAtTime(4200, t + 0.45);
  },
  stampel(c, t, s = 1) {
    ton(c, t, "sine", 150, 46, 0.2, 0.55 * s, 0.003, 0.24);
    brus(c, t, 0.08, "lowpass", 1700, 0.7, 0.36 * s, 0.002, 0.07);
    brus(c, t, 0.05, "bandpass", 900, 4, 0.22 * s, 0.001, 0.04);
  },
  // Projektorn som drar igång: ett tätt, avtagande knatter.
  projektor(c, t) { for (let i = 0; i < 14; i++) brus(c, t + i / 18, 0.02, "bandpass", 1900 + (i % 2) * 500, 1.5, 0.05 * (1 - i / 16), 0.001, 0.014); },
  absurd(c, t, v = 1) {
    if (v === 1) { // tuta
      for (const f of [233, 277]) { const o = ton(c, t, "square", f, f * 0.72, 0.42, 0.045, 0.02, 0.42); const lfo = c.createOscillator(), d = c.createGain(); lfo.frequency.value = 13; d.gain.value = 14; lfo.connect(d).connect(o.frequency); lfo.start(t); lfo.stop(t + 0.5); }
    } else if (v === 2) { // fjäder
      const o = ton(c, t, "sine", 180, 900, 0.28, 0.16, 0.01, 0.5); const lfo = c.createOscillator(), d = c.createGain();
      lfo.frequency.value = 11; d.gain.value = 60; lfo.connect(d).connect(o.frequency); lfo.start(t); lfo.stop(t + 0.6);
    } else { // visselpipa nedåt
      const o = ton(c, t, "sine", 1400, 420, 0.6, 0.07, 0.02, 0.62); o.frequency.setValueAtTime(1400, t);
    }
  },
  slutton(c, t) {
    for (const [f, g] of [[110, 0.11], [165, 0.06], [220, 0.035]]) ton(c, t, "sine", f, 0, 0, g, 0.03, 3.4);
    brus(c, t, 0.08, "lowpass", 1500, 0.7, 0.2, 0.002, 0.06);
  },
};

// ---------- spelaren ----------
let aktivt = null;
// Byter man mellan föredragningen och Arkivrummet fortsätter den där den var.
let fortsatt = null;
const adressFor = (iRummet, fro) => (iRummet ? vag("arkivrummet", "foredragning-" + fro) : vag("foredragning", fro));

export function render(app, arg) {
  // Adressen kan ha hunnit ändras medan modulen laddades. Det är den som gäller.
  const nu = las();
  if (nu.vy !== "foredragning") return;
  arg = nu.arg || arg;
  let fro = tvatta(arg);
  if (fro && aktivt && aktivt.plan.fro === fro && aktivt.rot.isConnected) return;
  stoppa();
  if (!fro) { fro = nyttFro(); history.replaceState(null, "", vag("foredragning", fro)); }
  aktivt = spelare(app, fro);
}
export function stoppa() { if (aktivt) { aktivt.stoppa(); aktivt = null; } }
addEventListener("hashchange", () => { if (aktivt && !arVy("foredragning")) stoppa(); });

// Föredragningen inne i Arkivrummet. vard: { rot, bygg, forbered }.
//  rot       elementet som spelaren läggs i (rummet)
//  bygg      egna byggare för avsnittstyper (verken visas som kort i rummet, inte som bilder)
//  forbered  ett löfte som uppfylls när rummets handlingar är hämtade
export function iRummet(fro, vard) { return spelare(null, tvatta(fro) || nyttFro(), vard); }

function spelare(app, fro, vard = null) {
  const lugn = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const plan = manus(fro, lugn), N = plan.seg.length;
  const adress = (f) => adressFor(!!vard, f);

  // ---- DOM ----
  const scen = el("div", { class: "fd-scen" });
  const laddar = el("div", { class: "fd-laddar mono" }, t("Föredragningen förbereds"));
  const live = el("p", { class: "fd-sr", "aria-live": "polite" });
  const ljudtips = el("p", { class: "fd-ljudtips mono", hidden: true }, PEKSKARM ? t("Ljudet startar vid första tryck") : t("Ljudet startar vid första klick"));
  const fyll = el("i", { class: "fd-fyll" });
  const spar = el("div", { class: "fd-spar", role: "slider", tabindex: "0", "aria-label": t("Föredragningens förlopp"), "aria-valuemin": "0", "aria-valuemax": String(Math.round(plan.total)), "aria-valuenow": "0" },
    fyll, ...plan.seg.slice(1).map((s) => el("i", { class: "fd-mark" + (s.v ? "" : " text"), style: `left:${(s.start / plan.total) * 100}%` })));
  const knapp = (cls, text, kort, fn, extra = {}) => el("button", { type: "button", class: cls, "aria-label": text, title: text, onclick: (e) => { fn(e); if (e.detail) e.currentTarget.blur(); visaUi(); }, ...extra },
    el("span", { "aria-hidden": "true" }, kort), el("span", { class: "lang", "aria-hidden": "true" }, text));
  const bakat = knapp("fd-k", t("Föregående"), "‹", () => hoppa(-1));
  const paus = knapp("fd-k fd-paus", t("Paus"), "Ⅱ", () => vaxla(), { "aria-pressed": "false" });
  const fram = knapp("fd-k", t("Nästa"), "›", () => hoppa(1));
  const tid = el("span", { class: "fd-tid mono", "aria-hidden": "true" });
  const visaKnapp = knapp("fd-k fd-valfri", t("Visa handlingen"), "◻", () => visaHandling());
  const kopiKnapp = knapp("fd-k fd-valfri", t("Kopiera adressen"), "⧉", (e) => kopiera(e.currentTarget));
  const bytKnapp = knapp("fd-k fd-byt", vard ? t("Utan rummet") : t("I Arkivrummet"), vard ? "▭" : "◫", () => byt());
  const avsluta = knapp("fd-k", t("Avsluta"), "✕", () => avsluta_());
  const kontroll = el("div", { class: "fd-kontroll" }, spar,
    el("div", { class: "fd-knappar" }, bakat, paus, fram, tid, el("span", { class: "fd-fro mono fd-valfri" }, t("Frö {fro}", { fro: plan.fro })), visaKnapp, kopiKnapp, bytKnapp, avsluta));
  const rot = el("section", { class: "fd" + (lugn ? " fd-lugn" : "") + (vard ? " fd-rum" : ""), "aria-label": vard ? t("Föredragningen i Arkivrummet") : t("Föredragningen"), "aria-roledescription": t("föredragning"), tabindex: "-1" },
    el("h1", { class: "dold" }, (vard ? t("Föredragningen i Arkivrummet") : t("Föredragningen")) + " " + plan.dnr), scen, el("div", { class: "fd-korn", "aria-hidden": "true" }), el("div", { class: "fd-vinjett", "aria-hidden": "true" }), laddar, ljudtips, live, kontroll);
  if (vard) vard.rot.append(rot);
  else { document.documentElement.classList.add("fd-aktiv"); app.replaceChildren(rot); }
  rot.focus({ preventScroll: true });

  // ---- klocka och avsnitt ----
  let spelar = false, bas = 0, t0 = 0, aktiv = -1, ticks = [], pekare = 0, raf = 0, slut = false, igang = false, levande = true, startTid = 0, malVolym = -1;
  const nu = () => (spelar ? Math.min(plan.total, bas + (performance.now() - t0) / 1000) : bas);
  const segVid = (t) => { let i = 0; while (i < N - 1 && t >= plan.seg[i + 1].start) i++; return i; };
  const animationer = () => scen.getAnimations({ subtree: true });
  const styr = { omstart: () => { soka(0); spela(); }, kopiera: (b) => kopiera(b), adress, iRummet: !!vard, byt: () => byt() };

  function bygg(i, lok, overgang) {
    const s = plan.seg[i], k = verktyg(plan);
    k.styr = styr;
    const node = (vard?.bygg?.[s.typ] || BYGG[s.typ])(s, k);
    node.dataset.typ = s.typ;
    const gamla = [...scen.children];
    if (overgang && lugn && gamla.length) {
      node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: MS, fill: "both", easing: "ease" }).finished.then(() => gamla.forEach((g) => g.remove())).catch(() => {});
      gamla.forEach((g) => g.classList.add("fd-gammal"));
    } else gamla.forEach((g) => g.remove());
    scen.append(node);
    for (const a of node.getAnimations({ subtree: true })) { a.currentTime = lok * 1000; if (!spelar) a.pause(); }
    ticks = k.ticks; aktiv = i;
    ticks.forEach((f) => f(lok));
    live.textContent = beskriv(s, plan);
    visaKnapp.disabled = !s.v;
    rot.dataset.avsnitt = s.typ;
  }
  function soka(t) {
    t = Math.max(0, Math.min(plan.total, t));
    bas = t; t0 = performance.now(); slut = t >= plan.total;
    pekare = plan.ljud.findIndex((h) => h.t >= t - 0.01); if (pekare < 0) pekare = plan.ljud.length;
    const i = segVid(t);
    bygg(i, t - plan.seg[i].start, false);
    rita(t);
  }
  function spela() {
    if (!igang) return;
    if (slut) soka(0);
    t0 = performance.now(); spelar = true;
    for (const a of animationer()) { const end = a.effect.getComputedTiming().endTime; if (a.currentTime < end) a.play(); }
    rot.classList.remove("paus"); uppdateraPaus(); visaUi();
  }
  function pausa() {
    bas = nu(); spelar = false;
    for (const a of animationer()) a.pause();
    rot.classList.add("paus"); uppdateraPaus(); visaUi();
  }
  const vaxla = () => (spelar ? pausa() : spela());
  function uppdateraPaus() {
    const text = slut ? t("Föredra igen") : spelar ? t("Paus") : t("Fortsätt");
    paus.setAttribute("aria-label", text); paus.title = text; paus.setAttribute("aria-pressed", spelar ? "false" : "true");
    paus.firstChild.textContent = slut ? "↺" : spelar ? "Ⅱ" : "▶"; paus.lastChild.textContent = text;
  }
  function hoppa(d) {
    if (!igang) return;
    const t = nu(), i = segVid(t), s = plan.seg[i];
    let j = d < 0 && t - s.start > 1.2 && !slut ? i : i + d;
    if (slut && d < 0) j = N - 2;
    j = Math.max(0, Math.min(N - 1, j));
    if (j === i && d > 0) return;
    const m = plan.seg[j];
    soka(m.start + (spelar ? 0 : Math.min(m.dur - 0.05, (VILA[m.typ] ?? m.slag * 0.6) * SLAG)));
  }
  function avsluta_() {
    if (!igang) return;
    if (aktiv === N - 1) { location.hash = vard ? vag("arkivrummet") : vag("ansokan"); return; }
    soka(plan.seg[N - 1].start); spela();
  }
  // Till Arkivrummet eller tillbaka, på samma ställe i föredragningen.
  function byt() {
    fortsatt = { fro: plan.fro, t: nu(), spelar: spelar || !igang };
    location.hash = adressFor(!vard, plan.fro);
  }
  function visaHandling() {
    const s = plan.seg[aktiv]; if (!s?.v) return;
    pausa();
    oppna(plan.verk, plan.verk.indexOf(s.v));
  }
  async function kopiera(b) {
    const url = location.href.split("#")[0] + adress(plan.fro);
    let ok = false;
    try { await navigator.clipboard.writeText(url); ok = true; } catch (e) {
      const f = el("input", { value: url, "aria-hidden": "true", style: "position:fixed;opacity:0" }); document.body.append(f); f.select();
      try { ok = document.execCommand("copy"); } catch (e2) {} f.remove();
    }
    if (!b) return;
    const sp = b.querySelector(".lang") || b, gammal = sp.textContent;
    sp.textContent = ok ? t("Adressen kopierad") : url;
    setTimeout(() => { sp.textContent = gammal; }, 2200);
  }
  function rita(tt) {
    fyll.style.transform = `scaleX(${tt / plan.total})`;
    const text = `${klocka(tt)} / ${klocka(plan.total)}`;
    if (tid.textContent !== text) { tid.textContent = text; spar.setAttribute("aria-valuenow", String(Math.round(tt))); spar.setAttribute("aria-valuetext", t("{a} av {b}", { a: klocka(tt), b: klocka(plan.total) })); }
  }
  function ljud(t) {
    const c = ljudet();
    if (c && master) {
      const mal = spelar && arPa() ? 0.9 : 0;
      if (mal !== malVolym) { malVolym = mal; master.gain.setTargetAtTime(mal, c.currentTime, 0.03); }
    }
    ljudtips.hidden = !(arPa() && spelar && !c && performance.now() - startTid > 1200);
    if (!spelar) return;
    while (pekare < plan.ljud.length && plan.ljud[pekare].t < t + 0.12) {
      const h = plan.ljud[pekare++];
      if (!c || h.t < t - 0.06) continue;
      try { LJUD[h.typ](c, c.currentTime + Math.max(0, h.t - t), h.arg); } catch (e) { /* ett ljud som inte går att spela hoppas över */ }
    }
  }
  function loop() {
    if (!levande) return;
    raf = requestAnimationFrame(loop);
    if (!igang) return;
    let t = nu();
    if (spelar && t >= plan.total) { t = plan.total; bas = t; spelar = false; slut = true; rot.classList.add("paus"); uppdateraPaus(); visaUi(); }
    const i = segVid(t);
    if (i !== aktiv) bygg(i, t - plan.seg[i].start, true);
    const lok = t - plan.seg[aktiv].start;
    for (const f of ticks) f(lok);
    rita(t);
    ljud(t);
  }

  // ---- kontroller ----
  let uiTimer = 0;
  function visaUi() {
    rot.classList.remove("vila-ui");
    clearTimeout(uiTimer);
    uiTimer = setTimeout(() => { if (spelar && !kontroll.contains(document.activeElement) && !kontroll.matches(":hover")) rot.classList.add("vila-ui"); }, 2600);
  }
  const tangent = (e) => {
    if (visareOppen() || e.altKey || e.ctrlKey || e.metaKey) return;
    const mal = e.target instanceof Element ? e.target : null;
    if (e.key === " " || e.key === "Spacebar") {
      if (mal && mal.closest("button, input, textarea, select")) return;
      e.preventDefault(); vaxla();
    } else if (e.key === "ArrowRight") { e.preventDefault(); hoppa(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); hoppa(-1); }
    else if (e.key === "Escape") { e.preventDefault(); avsluta_(); }
    else if (e.key === "Home" && mal === spar) { e.preventDefault(); soka(0); }
    else return;
    visaUi();
  };
  const synlighet = () => { if (document.hidden && spelar) pausa(); };
  const vackLjud = () => ljudet();
  addEventListener("keydown", tangent);
  addEventListener("click", vackLjud);
  addEventListener("keyup", vackLjud);
  document.addEventListener("visibilitychange", synlighet);
  rot.addEventListener("pointermove", visaUi, { passive: true });

  // Tryck på bilden pausar, svep bläddrar. Första trycket på en pekskärm väcker bara ljudet.
  let sx = null, sy = 0;
  scen.addEventListener("pointerdown", (e) => { if (e.target.closest("a, button")) return; sx = e.clientX; sy = e.clientY; });
  scen.addEventListener("pointerup", (e) => {
    if (sx == null) return;
    const dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { hoppa(dx < 0 ? 1 : -1); visaUi(); return; }
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      const vantar = arPa() && (!ctx || ctx.state !== "running");
      ljudet();
      if (vantar && spelar && e.pointerType !== "mouse") { visaUi(); return; }
      vaxla();
    }
  });
  // Förloppet går att dra i.
  let drar = false;
  const dra = (e) => { const r = spar.getBoundingClientRect(); soka(((e.clientX - r.left) / r.width) * plan.total); visaUi(); };
  spar.addEventListener("pointerdown", (e) => { if (!igang) return; drar = true; spar.setPointerCapture(e.pointerId); dra(e); });
  spar.addEventListener("pointermove", (e) => { if (drar) dra(e); });
  spar.addEventListener("pointerup", () => (drar = false));
  spar.addEventListener("pointercancel", () => (drar = false));

  // ---- förberedelse: bilderna hämtas innan föredragningen börjar ----
  const kallor = vard ? [] : [...new Set(plan.verk.map(stillbild).filter(Boolean))];
  let klara = 0;
  const visaLaddning = () => { laddar.textContent = t("Föredragningen förbereds · {a} av {b} handlingar", { a: klara, b: kallor.length }); };
  visaLaddning();
  const hamta = (src) => new Promise((res) => {
    const im = new Image(); im.decoding = "async";
    const klar = () => { klara++; visaLaddning(); res(); };
    im.onload = () => (im.decode ? im.decode().catch(() => {}).then(klar) : klar()); im.onerror = klar; im.src = src;
  });
  // I rummet är det rummet som hämtar bilderna. Där räcker det att vänta på det.
  const forberedd = vard ? vard.forbered : Promise.all(kallor.map(hamta));
  if (vard) laddar.textContent = "Föredragningen förbereds";
  Promise.race([forberedd, new Promise((r) => setTimeout(r, 6000))]).then(() => {
    if (!levande) return;
    laddar.classList.add("klar");
    igang = true; startTid = performance.now();
    const f = fortsatt && fortsatt.fro === plan.fro ? fortsatt : null; fortsatt = null;
    soka(f ? f.t : 0);
    if (!f || f.spelar) spela(); else { rot.classList.add("paus"); uppdateraPaus(); }
  });
  raf = requestAnimationFrame(loop);

  return {
    plan, rot, lugn,
    // läget just nu, för rummet: tiden, avsnittet och om föredragningen spelar
    get tid() { return nu(); },
    get avsnitt() { return aktiv; },
    get spelar() { return spelar; },
    get igang() { return igang; },
    stoppa() {
      levande = false; spelar = false; cancelAnimationFrame(raf); clearTimeout(uiTimer);
      for (const a of animationer()) a.cancel();
      removeEventListener("keydown", tangent);
      removeEventListener("click", vackLjud);
      removeEventListener("keyup", vackLjud);
      document.removeEventListener("visibilitychange", synlighet);
      if (!vard) document.documentElement.classList.remove("fd-aktiv");
      if (ctx && master) { malVolym = -1; master.gain.setTargetAtTime(0, ctx.currentTime, 0.02); }
      rot.remove();
    },
  };
}
