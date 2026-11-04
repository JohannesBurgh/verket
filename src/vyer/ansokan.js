// Ansökan: fem frågor, handläggning och beslut med bilagor.
// Frågorna och poängen ligger i content/ansokan.json.
import { A, S, VERK, DIMS, el, papper, huvud, tumnagel, metaRad, kontaktRuta, idag, reduce } from "../data.js";
import { oppna } from "../visare.js";
import { stampel, prassel, klick } from "../ljud.js";

const Q = A.ansokan.fragor, CIRKEL = A.ansokan.cirkel, MOTIV = A.ansokan.motiveringar;
let app = null;
let st = ny();
function ny() { return { steg: 0, svar: [], cirkel: null, visade: new Set(), overklag: 0, dnr: null }; }
const nyttDnr = () => `${S.diarieprefix} ${new Date().getFullYear()}/${String(10000 + Math.floor(Math.random() * 89999))}`;
// Bara verk som får visas i beslut: synliga och inte "damm".
const KANDIDATER = VERK.filter((v) => v.vikt !== "damm");

function visa(node) {
  const gammal = app.firstElementChild;
  if (gammal && !reduce) {
    gammal.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateX(-40px) rotate(-1deg)" }], { duration: 220, easing: "ease-in", fill: "forwards" })
      .onfinish = () => { app.replaceChildren(node); };
  } else app.replaceChildren(node);
  prassel(.8);
  window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
}

// ---------- start ----------
function start() {
  st = ny();
  const p = papper();
  p.append(huvud(S.blankett, "Ansökan om kreativ insats"),
    el("p", { class: "lead" }, S.inledning),
    el("p", { class: "small" }, "Uppgifterna sparas inte. Cirkeln diarieförs endast i sökandes webbläsare."),
    el("div", { class: "actions" },
      el("button", { type: "button", class: "btn", onclick: () => { st.dnr = nyttDnr(); fraga(); } }, "Påbörja ansökan"),
      el("button", { type: "button", class: "btn ghost", onclick: forenklat }, "Förenklat förfarande (jag har bråttom)")),
    el("p", { class: "small", style: "margin-top:28px" }, el("span", { class: "prov" }, "Provisorisk föreskrift"),
      "Den som vill se allt på en gång hänvisas till ", el("a", { href: "#registret" }, "Registret"), " eller ", el("a", { href: "#arkivrummet" }, "Arkivrummet"), "."));
  visa(p);
}

// ---------- frågor ----------
function fraga() {
  const i = st.steg, q = Q[i], p = papper();
  p.append(huvud(`${S.blankett.split("·")[0].trim()} · ${st.dnr}`, "Ansökan om kreativ insats"));
  p.append(el("div", { class: "qmeta" }, el("span", {}, `Fråga ${i + 1} av ${Q.length}`),
    el("button", { type: "button", class: "link", onclick: forenklat }, "Hoppa till förenklat förfarande")));
  const pr = el("div", { class: "progress", "aria-hidden": "true" });
  Q.forEach((_, k) => pr.append(el("i", { class: k <= i ? "on" : "" })));
  p.append(pr);
  const fs = el("fieldset", {}, el("legend", {}, q.fraga));
  if (q.rita) fs.append(ritruta());
  else {
    const opts = el("div", { class: "opts" });
    q.svar.forEach((o, k) => opts.append(el("button", { type: "button", class: "opt", "aria-pressed": st.svar[i] === k ? "true" : "false", onclick: () => valj(k) },
      el("span", { class: "box" }), el("span", {}, o.text), el("kbd", {}, String(k + 1)))));
    fs.append(opts);
  }
  p.append(fs);
  const nav = el("div", { class: "qnav" },
    i > 0 ? el("button", { type: "button", class: "link", onclick: () => { st.steg--; fraga(); } }, "← Föregående fråga") : el("span"));
  if (q.rita) nav.append(el("div", { class: "actions", style: "margin:0" },
    el("button", { type: "button", class: "btn ghost", onclick: () => { st.cirkel = null; lamnaIn(); } }, "Avstår från att rita"),
    el("button", { type: "button", class: "btn", onclick: lamnaIn }, "Lämna in ansökan")));
  p.append(nav);
  visa(p);
}
function valj(k) {
  st.svar[st.steg] = k; klick();
  app.querySelectorAll(".opt").forEach((b, j) => b.setAttribute("aria-pressed", j === k ? "true" : "false"));
  setTimeout(() => { st.steg++; fraga(); }, reduce ? 0 : 340);
}
function ritruta() {
  const wrap = el("div", { class: "rita" }), c = el("canvas", { "aria-label": "Rityta. Rita en cirkel med mus eller finger." }), hint = el("span", { class: "hint" }, "Rita med musen eller fingret");
  wrap.append(c, hint);
  const pts = []; let ner = false, ctx;
  const storlek = () => { const r = wrap.getBoundingClientRect(), d = Math.min(devicePixelRatio, 2); c.width = r.width * d; c.height = r.height * d; ctx = c.getContext("2d"); ctx.scale(d, d); ctx.lineWidth = 2.6; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#14181a"; };
  requestAnimationFrame(storlek);
  const pos = (e) => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top, r.width, r.height]; };
  c.addEventListener("pointerdown", (e) => { ner = true; c.setPointerCapture(e.pointerId); pts.length = 0; const r = c.getBoundingClientRect(); ctx.clearRect(0, 0, r.width, r.height); const [x, y] = pos(e); pts.push([x, y]); ctx.beginPath(); ctx.moveTo(x, y); hint.hidden = true; });
  c.addEventListener("pointermove", (e) => { if (!ner) return; const [x, y, w, h] = pos(e); pts.push([x, y]); ctx.lineTo(x, y); ctx.stroke(); st.cirkel = { pts: pts.slice(), w, h }; });
  c.addEventListener("pointerup", () => (ner = false));
  return wrap;
}
function bedomCirkel() {
  const c = st.cirkel; if (!c || c.pts.length < 12) return null;
  const n = c.pts.length, cx = c.pts.reduce((a, p) => a + p[0], 0) / n, cy = c.pts.reduce((a, p) => a + p[1], 0) / n;
  const r = c.pts.map((p) => Math.hypot(p[0] - cx, p[1] - cy)), m = r.reduce((a, b) => a + b, 0) / n;
  const cv = Math.sqrt(r.reduce((a, b) => a + (b - m) ** 2, 0) / n) / Math.max(1, m);
  const gap = Math.hypot(c.pts[0][0] - c.pts[n - 1][0], c.pts[0][1] - c.pts[n - 1][1]) / Math.max(1, m);
  return cv < .12 && gap < .6 ? CIRKEL.noggrann : cv < .3 ? CIRKEL.fri : CIRKEL.potatis;
}

// ---------- poäng och urval ----------
function profil() {
  const P = Object.fromEntries(DIMS.map((d) => [d, 0]));
  Q.forEach((q, i) => { if (q.rita || st.svar[i] == null) return; for (const [d, v] of Object.entries(q.svar[st.svar[i]].poang)) P[d] += v; });
  const c = bedomCirkel(); if (c) for (const [d, v] of Object.entries(c.poang)) P[d] += v;
  return { P, c };
}
function valjUt(P) {
  const rankad = KANDIDATER.filter((v) => !st.visade.has(v.id)).map((v) => {
    let s = 0; for (const d of DIMS) s += P[d] * (v.ton[d] || 0);
    s += v.vikt === "hjälte" ? 1.6 : 0; s += Math.random() * 2.2; return { v, s };
  }).sort((a, b) => b.s - a.s);
  const ut = [], grp = new Set();
  for (const { v } of rankad) { if (ut.length === 3) break; if (grp.has(v.epok)) continue; ut.push(v); grp.add(v.epok); }
  const rorlig = (v) => v.typ !== "foto";
  const fixa = (behov, test) => { if (!behov || ut.some(test)) return; const alt = rankad.find((x) => test(x.v) && !ut.includes(x.v) && !grp.has(x.v.epok)); if (alt) ut[2] = alt.v; };
  fixa(P.rorligt >= P.stilla * .6, rorlig); fixa(P.stilla >= P.rorligt * .6, (v) => !rorlig(v));
  ut.forEach((v) => st.visade.add(v.id));
  return { ut, vind: vindfro(ut) };
}
function vindfro(ut) {
  const pool = VERK.filter((v) => !ut.includes(v) && !st.visade.has(v.id) && v.vikt !== "hjälte" && !ut.some((u) => u.epok === v.epok));
  const damm = pool.filter((v) => v.vikt === "damm"), kalla = Math.random() < .45 && damm.length ? damm : pool;
  const v = kalla[Math.floor(Math.random() * kalla.length)]; if (v) st.visade.add(v.id); return v;
}

// ---------- handläggning ----------
function lamnaIn() {
  const p = papper(), steg = ["Ärendet registreras", "Ärendet fördelas på handläggare", "Ärendet bereds", "Beslut fattas"];
  const ol = el("ol", {}, steg.map((s) => el("li", {}, s)));
  p.append(huvud(`${S.blankett.split("·")[0].trim()} · ${st.dnr}`, "Ärendet handläggs"), el("div", { class: "processing" }, ol));
  visa(p);
  if (reduce) { besluta(); return; }
  let i = 0;
  const tick = () => { ol.children[i]?.classList.add("on"); klick(); i++; if (i < steg.length) setTimeout(tick, 480); else setTimeout(besluta, 600); };
  setTimeout(tick, 380);
}
function forenklat() {
  st.dnr = st.dnr || nyttDnr();
  const hj = VERK.filter((v) => v.vikt === "hjälte" && !st.visade.has(v.id)).map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  const ut = [], ta = (t) => { const v = hj.find((x) => t(x) && !ut.includes(x) && !ut.some((u) => u.epok === x.epok)); if (v) ut.push(v); return v; };
  ta((v) => v.typ === "foto"); ta((v) => v.typ !== "foto" && v.kanal !== "Absurdimo"); ta((v) => v.kanal === "Absurdimo" || v.avdelning === "Skruven");
  while (ut.length < 3 && ta(() => true));
  ut.forEach((v) => st.visade.add(v.id));
  beslut({ ut, vind: vindfro(ut) }, null, null, true);
}
function besluta() { const { P, c } = profil(); beslut(valjUt(P), P, c, false); }

// ---------- beslut ----------
function beslut({ ut, vind }, P, cirkel, snabb) {
  const p = papper(); p.classList.add("beslut");
  p.append(huvud(`Beslut · ${st.dnr}`, st.overklag ? "Beslut efter överklagande" : "Beslut"));
  p.append(el("div", { class: "fields" },
    el("div", {}, el("span", {}, "Diarienummer"), el("b", {}, st.dnr)),
    el("div", {}, el("span", {}, "Datum"), el("b", {}, idag())),
    el("div", {}, el("span", {}, "Handläggare"), el("b", {}, S.handlaggare))));
  const stamp = el("div", { class: "stamp", "aria-label": st.overklag ? "Stämpel: omprövat" : "Stämpel: bifalles" }, st.overklag ? "OMPRÖVAT" : "BIFALLES", el("small", {}, idag()));
  const tx = el("div", { class: "beslut-text" }, stamp);
  p.append(tx);
  if (snabb) {
    tx.append(el("p", {}, "Sökanden har begärt förenklat förfarande. Verket har inte prövat ansökan i sak."),
      el("p", {}, "Verket bifogar i stället ett urval ur myndighetens viktigaste handlingar."));
  } else {
    const topp = DIMS.filter((d) => P[d] > 0).sort((a, b) => P[b] - P[a]).slice(0, 2);
    const artQ = Q.findIndex((q) => q.art), art = artQ >= 0 && st.svar[artQ] != null ? Q[artQ].svar[st.svar[artQ]].text : null;
    tx.append(el("p", {}, "Verket har prövat ansökan och funnit att sökanden uppvisar " +
      (topp.length === 2 ? `${MOTIV[topp[0]]} samt ${MOTIV[topp[1]]}` : topp.length ? MOTIV[topp[0]] : "inga särskilda behov alls, vilket i sig är anmärkningsvärt") + "."));
    if (art) tx.append(el("p", {}, art === "Art okänd" ? "Sökandes art har inte kunnat fastställas. Verket bifaller ansökan ändå." : `Sökanden har uppgett sig vara: ${art.toLowerCase()}.`));
    if (st.overklag) tx.append(el("p", {}, `Beslutet har omprövats efter överklagande (${st.overklag}). Tidigare bilagor har återkallats.`));
    if (cirkel) tx.append(el("p", {}, cirkel.text));
    tx.append(el("p", {}, "Ansökan bifalles. Följande handlingar bifogas."));
    if (cirkel && st.cirkel) {
      const c = st.cirkel, ns = "http://www.w3.org/2000/svg", svg = document.createElementNS(ns, "svg"), path = document.createElementNS(ns, "path");
      svg.setAttribute("viewBox", `0 0 ${c.w} ${c.h}`); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", "Sökandes cirkel");
      path.setAttribute("d", "M" + c.pts.map((q) => q[0].toFixed(1) + " " + q[1].toFixed(1)).join(" L"));
      Object.entries({ fill: "none", stroke: "#14181a", "stroke-width": "3", "stroke-linecap": "round" }).forEach(([k, v]) => path.setAttribute(k, v));
      svg.append(path); tx.append(el("div", { class: "sig" }, svg, el("span", {}, "Sökandes cirkel, diarieförd")));
    }
  }
  p.append(el("h2", {}, "Bilagor"));
  const lista = [...ut, vind].filter(Boolean), grid = el("div", { class: "bilagor" });
  ut.forEach((v, k) => grid.append(el("button", { type: "button", class: "bilaga", onclick: () => oppna(lista, k) },
    el("span", { class: "clip", "aria-hidden": "true" }), el("span", { class: "lbl" }, `Bilaga ${k + 1}`), el("div", { class: "m" }, tumnagel(v)), el("b", {}, v.titel), el("span", { class: "meta" }, metaRad(v)))));
  p.append(grid);
  if (vind) p.append(el("button", { type: "button", class: "vind", onclick: () => oppna(lista, lista.length - 1) },
    el("div", { class: "m" }, tumnagel(vind)),
    el("div", {}, el("span", { class: "mono small" }, `Bilaga ${lista.length} · Vindfrö`), el("p", { style: "margin:4px 0 2px;font-weight:700" }, vind.titel),
      el("span", { class: "small" }, "Tilldelat slumpmässigt enligt Verkets föreskrift om oväntade lösningar."))));
  const kontakt = kontaktRuta(st.dnr); kontakt.hidden = true;
  p.append(el("div", { class: "actions" },
    el("button", { type: "button", class: "btn", onclick: () => { kontakt.hidden = !kontakt.hidden; if (!kontakt.hidden) kontakt.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" }); } }, "Begär handläggning"),
    el("button", { type: "button", class: "btn ghost", onclick: () => { st.overklag++; snabb ? forenklat() : besluta(); } }, "Överklaga beslutet"),
    el("button", { type: "button", class: "btn ghost", onclick: start }, "Ny ansökan"),
    el("a", { href: "#registret", class: "link" }, "Se hela registret")), kontakt);
  visa(p);
  setTimeout(() => { stamp.classList.add("go"); setTimeout(() => { stampel(); p.classList.add("shake"); }, reduce ? 0 : 230); }, reduce ? 0 : 520);
}

export function render(root) {
  app = root;
  if (st.steg === 0 && !st.dnr) start(); else start();
}
export function tangent(e) {
  const q = app && app.querySelector(".opts");
  if (q && /^[1-9]$/.test(e.key)) { const b = q.querySelectorAll(".opt")[+e.key - 1]; if (b) b.click(); }
}
