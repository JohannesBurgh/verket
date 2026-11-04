// Arkivrummet: samma handlingar som Registret, men i ett tredimensionellt rum.
// Fyra rum, en tidslinje som andas och en knapp som blåser omkull allt.
import * as THREE from "three";
import { VERK, el, kanalFarg, reduce } from "../data.js";
import { oppna, oppen as visareOppen } from "../visare.js";
import { klick, prassel } from "../ljud.js";

let byggd = null;

export function render(app) {
  if (!byggd) byggd = bygg();
  app.replaceChildren(byggd.rot);
  byggd.starta();
}
export function stoppa() { if (byggd) byggd.stoppa(); }

function bygg() {
  let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const FRO = VERK.map((v) => ({ v, abs: v.kanal === "Absurdimo" && !v.datum, undated: v.ar == null && !(v.kanal === "Absurdimo"), hue: v.farg?.nyans ?? 0, lum: v.farg?.ljushet ?? .4 }));
  const arMed = FRO.filter((s) => !s.abs && !s.undated).map((s) => s.v.ar);
  const Y0 = Math.floor(Math.min(...arMed)), Y1 = Math.floor(Math.max(...arMed));
  let visaAbs = true;

  // ---- tidslinje som andas: täta år breder ut sig, tomma krymper ----
  const antal = {}; for (let y = Y0; y <= Y1; y++) antal[y] = 0;
  FRO.forEach((s) => { if (!s.abs && !s.undated) antal[Math.floor(s.v.ar)]++; });
  const bredd = {}; let tot = 0; const borjan = {};
  for (let y = Y0; y <= Y1; y++) { borjan[y] = tot; bredd[y] = .35 + Math.sqrt(antal[y]); tot += bredd[y]; }
  const ZON_UD = 2.4, ZON_ABS = 3.2;
  const pos = (s) => {
    if (s.abs) return tot + ZON_UD + ZON_ABS / 2;
    if (s.undated) return tot + ZON_UD / 2;
    const y = Math.floor(s.v.ar); return borjan[y] + (s.v.ar - y) * bredd[y];
  };
  const posAr = (y) => (y >= Y1 + 2 ? tot + ZON_UD + ZON_ABS / 2 : y >= Y1 + 1 ? tot + ZON_UD / 2 : borjan[Math.floor(y)] + (y - Math.floor(y)) * bredd[Math.floor(y)]);
  const totalt = () => tot + ZON_UD + (visaAbs ? ZON_ABS : 0);
  const UD = Y1 + 1, ABS = Y1 + 2; // kodår för zonerna
  FRO.forEach((s) => { s.tY = s.abs ? ABS : s.undated ? UD : s.v.ar; s.u = pos(s); });

  // ---- DOM ----
  const canvas = el("canvas", { class: "gl", "aria-label": "Arkivrummet, ett tredimensionellt rum med alla handlingar" });
  const namn = el("b"), under = el("small");
  const tips = el("div", { class: "tips" }), laddar = el("div", { class: "laddar" }, "[ handlingarna hämtas ]"), svep = el("div", { class: "svep", "aria-hidden": "true" });
  const tl = el("canvas", { tabindex: "0", role: "slider", "aria-label": "Tidslinje. Klicka på ett år för att lyfta fram det.", "aria-valuemin": Y0, "aria-valuemax": Y1 });
  const absKnapp = el("button", { type: "button", class: "abs", "aria-pressed": "true" }, "Absurdimo");
  const arText = el("span", { class: "ar" });
  const ROOMNAMES = [["falt", "Fältet", "1"], ["rulle", "Rullen", "2"], ["moln", "Molnet", "3"], ["vagg", "Väggen", "4"]];
  const docka = el("nav", { class: "docka", "aria-label": "Rum" });
  ROOMNAMES.forEach(([k, t, n]) => docka.append(el("button", { type: "button", "data-rum": k, "aria-pressed": "false", title: `${t} (${n})` }, t)));
  const blasKnapp = el("button", { type: "button", class: "blas" }, "Blås"); docka.append(blasKnapp);
  const rot = el("section", { class: "rum" }, canvas, el("div", { class: "rumnamn" }, namn, under), laddar, svep, tips,
    el("div", { class: "hud" }, el("div", { class: "tidslinje" }, absKnapp, arText, tl), docka));

  // ---- scen ----
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0c1114); scene.fog = new THREE.Fog(0x0c1114, 11, 32);
  const camera = new THREE.PerspectiveCamera(50, 1, .1, 140);
  const world = new THREE.Group(); scene.add(world);
  { const g = new THREE.BufferGeometry(), n = 1100, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { p[i * 3] = (rnd() - .5) * 90; p[i * 3 + 1] = (rnd() - .5) * 44; p[i * 3 + 2] = (rnd() - .5) * 70 - 10; }
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x6f8d97, size: .045, transparent: true, opacity: .5 }))); }

  // Fältets golv och årtal
  const XS = 0.95, xOf = (u) => (u - (tot / 2)) * XS;
  const faltExtra = [];
  const grid = new THREE.GridHelper(120, 120, 0x2c4650, 0x152126); grid.rotation.x = Math.PI / 2; grid.position.z = -6;
  grid.material.transparent = true; world.add(grid); faltExtra.push(grid.material);
  function etikett(text, x, y, farg = "#d4ff3f", storlek = 34) {
    const cv = document.createElement("canvas"); cv.width = 320; cv.height = 64; const c = cv.getContext("2d");
    c.fillStyle = farg; c.font = `500 ${storlek}px 'IBM Plex Mono', monospace`; c.fillText(text, 6, 44);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, .4), m); mesh.position.set(x + .8, y, 0); world.add(mesh); faltExtra.push(m); return mesh;
  }
  const absEtikett = [];
  const ritaEtiketter = () => {
    let sista = -1e9;
    for (let y = Y0; y <= Y1; y++) { const x = xOf(borjan[y]); if (antal[y] > 0 && x - sista > 2.3) { etikett(String(y), x, -3.6); sista = x; } }
    etikett("utan datum", xOf(tot + .2), -3.6, "#8aa0a8", 30);
    absEtikett.push(etikett("Absurdimo", xOf(tot + ZON_UD + .3), -3.6, "#ef3fe6", 32));
  };

  // frön
  const loader = new THREE.TextureLoader(), plan = new THREE.PlaneGeometry(1, 1);
  function radbryt(c, text, max) { const ord = text.split(" "), r = []; let l = ""; ord.forEach((w) => { const t = l ? l + " " + w : w; if (c.measureText(t).width > max && l) { r.push(l); l = w; } else l = t; }); if (l) r.push(l); return r; }
  function kort(v) {
    const cv = document.createElement("canvas"); cv.width = 512; cv.height = 288; const c = cv.getContext("2d"), [bg, fg] = kanalFarg(v.kanal);
    c.fillStyle = bg; c.fillRect(0, 0, 512, 288);
    const g = c.createRadialGradient(400, 40, 10, 330, 140, 380); g.addColorStop(0, "rgba(255,255,255,.16)"); g.addColorStop(1, "rgba(0,0,0,.25)"); c.fillStyle = g; c.fillRect(0, 0, 512, 288);
    c.fillStyle = fg; c.font = "500 18px 'IBM Plex Mono', monospace"; c.fillText((v.kanal || "").toUpperCase(), 26, 40);
    c.font = "800 31px 'Public Sans', Arial"; const r = radbryt(c, v.titel.toUpperCase(), 450).slice(0, 3);
    r.forEach((l, i) => c.fillText(l, 26, 262 - (r.length - 1 - i) * 36));
    c.beginPath(); c.arc(462, 46, 24, 0, 7); c.strokeStyle = fg; c.lineWidth = 3; c.stroke();
    c.beginPath(); c.moveTo(455, 34); c.lineTo(474, 46); c.lineTo(455, 58); c.closePath(); c.fillStyle = fg; c.fill();
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  let klara = 0; const antalBilder = FRO.filter((s) => s.v.bild).length;
  const fontKlar = document.fonts ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]) : Promise.resolve();
  FRO.forEach((s, i) => {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0 });
    const m = new THREE.Mesh(plan, mat); m.userData.i = i;
    const H = s.v.vikt === "damm" ? .48 : s.v.vikt === "hjälte" ? .92 : .74, W = H * Math.min(1.8, Math.max(.5, s.v.format));
    s.bas = new THREE.Vector2(W, H); m.scale.set(W, H, 1);
    const ram = new THREE.MeshBasicMaterial({ color: s.abs ? 0xef3fe6 : s.v.typ !== "foto" ? 0x5ff3ff : 0xe9eff1, side: THREE.DoubleSide, transparent: true, opacity: 0 });
    const mount = new THREE.Mesh(plan, ram); mount.scale.set(1 + .07 / W, 1 + .07 / H, 1); mount.position.z = -.004; m.add(mount);
    s.mat = mat; s.ram = ram; s.op = 0;
    const klar = () => { s.klar = true; if (++klara >= antalBilder * .85) laddar.style.opacity = 0; };
    if (s.v.bild) loader.load(s.v.bild, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; mat.map = t; mat.needsUpdate = true; klar(); }, undefined, klar);
    else fontKlar.then(() => { mat.map = kort(s.v); mat.needsUpdate = true; s.klar = true; });
    m.position.set((rnd() - .5) * 40, (rnd() - .5) * 24, -25 - rnd() * 10);
    s.mesh = m; s.tp = new THREE.Vector3(); s.tq = new THREE.Quaternion(); s.start = 0; world.add(m);
  });
  fontKlar.then(ritaEtiketter);
  setTimeout(() => (laddar.style.opacity = 0), 7000);

  // ---- inramning ----
  const UI = { top: 70, bottom: 150 };
  const anvand = () => Math.max(.35, (rot.clientHeight - UI.top - UI.bottom) / Math.max(1, rot.clientHeight));
  const passaV = (halv, fov) => halv / (Math.tan(THREE.MathUtils.degToRad(fov / 2)) * anvand());

  // ---- rummen ----
  const dummy = new THREE.Object3D();
  const rikta = (s, p, mal, upp) => { dummy.position.copy(p); dummy.up.copy(upp || new THREE.Vector3(0, 1, 0)); dummy.lookAt(mal); s.tp.copy(p); s.tq.copy(dummy.quaternion); };
  const aktiva = () => FRO.filter((s) => !s.abs || visaAbs);
  const kronologisk = () => aktiva().sort((a, b) => a.u - b.u || a.v.id.localeCompare(b.v.id));
  const nyansRang = new Map(); FRO.slice().sort((a, b) => a.hue - b.hue || a.lum - b.lum).forEach((s, i, l) => nyansRang.set(s, i / l.length));
  const ljusRang = new Map(); FRO.filter((s) => !s.abs).sort((a, b) => a.lum - b.lum).forEach((s, i, l) => ljusRang.set(s, i / (l.length - 1)));
  const minU = 0, maxU = () => totalt();
  const ROOMS = {
    falt: { namn: "Fältet", under: "tiden åt sidan, ljuset upp och ner", pan: true, fov: 50, stil: "glid",
      fit() { return passaV(4.15, 50) * 1.06; }, tillPan: (u) => xOf(u), franPan: (p) => p / XS + tot / 2, panSpann: () => [xOf(minU), xOf(maxU())],
      layout() {
        const lagd = [];
        kronologisk().forEach((s) => {
          const zon = s.abs || s.undated;
          let x = xOf(s.u) + (rnd() - .5) * (zon ? 2.6 : .9), y = s.abs ? (rnd() - .5) * 5.4 : (ljusRang.get(s) - .5) * 6.2, z = s.v.vikt === "damm" ? -2.4 : s.v.vikt === "hjälte" ? .6 : 0;
          const W = s.bas.x, H = s.bas.y;
          for (let t = 0; t < 16; t++) {
            if (!lagd.some((p) => Math.abs(p.z - z) < .5 && Math.abs(p.x - x) < (p.w + W) / 2 + .06 && Math.abs(p.y - y) < (p.h + H) / 2 + .06)) break;
            if (t % 2 === 0) y += (rnd() - .5) * 1.3; else z -= .9;
            x += (rnd() - .5) * .3;
          }
          y = Math.max(-2.9, Math.min(2.9, y)); lagd.push({ x, y, z, w: W, h: H });
          rikta(s, new THREE.Vector3(x, y, z), new THREE.Vector3(x, y, z + 5));
        });
      } },
    rulle: { namn: "Rullen", under: "vidvinkel mot trumman. färgen runt, tiden längs", pan: true, fov: 74, stil: "trumma",
      fit() { return Math.max(7.2, passaV(4.5, 74) * .92); }, tillPan: (u) => (u - tot / 2) * .5, franPan: (p) => p / .5 + tot / 2, panSpann: () => [(minU - tot / 2) * .5, (maxU() - tot / 2) * .5],
      layout() {
        aktiva().forEach((s) => {
          const th = nyansRang.get(s) * Math.PI * 2 + (rnd() - .5) * .12, R = 3.5 + (rnd() - .5) * .8 + (s.v.vikt === "damm" ? -.6 : 0), x = (s.u - tot / 2) * .5;
          const p = new THREE.Vector3(x, R * Math.cos(th), R * Math.sin(th)), ut = new THREE.Vector3(0, Math.cos(th), Math.sin(th));
          rikta(s, p, p.clone().add(ut), new THREE.Vector3(0, Math.sin(th), -Math.cos(th)));
        });
      } },
    moln: { namn: "Molnet", under: "du står mitt i. tiden är höjd, färgen är väderstreck", inne: true, fov: 76, stil: "dimma",
      lat: (u) => (u / Math.max(1, totalt()) - .5) * .7 + .04,
      layout() {
        aktiva().forEach((s) => {
          const lat = this.lat(s.u) + (rnd() - .5) * .12, lon = nyansRang.get(s) * Math.PI * 2 + (rnd() - .5) * .15, R = 4.6 + rnd() * 4.4;
          rikta(s, new THREE.Vector3(Math.cos(lon) * Math.cos(lat) * R, Math.sin(lat) * R, Math.sin(lon) * Math.cos(lat) * R), new THREE.Vector3(0, 0, 0));
        });
      } },
    vagg: { namn: "Väggen", under: "du står i mitten, åren runt dig", inne: true, fov: 62, stil: "vagg",
      layout() {
        const l = kronologisk(), rader = 6, kol = Math.ceil(l.length / rader), R = 8.5;
        const gap = Math.min(1.0, (Math.tan(THREE.MathUtils.degToRad(31)) * anvand() * R * 1.9 - .9) / (rader - 1));
        const steg = Math.min(.16, (Math.PI * 2 - .4) / kol);
        l.forEach((s, k) => {
          const c = Math.floor(k / rader), r = k % rader, phi = (c - (kol - 1) / 2) * steg; s.phi = phi;
          const p = new THREE.Vector3(R * Math.sin(phi), ((rader - 1) / 2 - r) * gap, -R * Math.cos(phi));
          rikta(s, p, new THREE.Vector3(0, p.y, 0));
        });
      } },
  };
  let rum = "falt", klocka = 0, camZ = 10, camZMal = 10, zoom = 1;
  let rotX = 0, rotY = 0, velX = 0, velY = 0, panX = xOf(borjan[2010] ?? 0), panMal = panX, rotXMal = null, rotYMal = null;
  let fokusAr = null, hover = null, aktuell = null;
  const traff = (s, y) => (y >= ABS ? s.abs : y >= UD ? s.undated : !s.abs && !s.undated && Math.floor(s.v.ar) === Math.floor(y));
  const klampa = (p) => { const r = ROOMS[rum].panSpann(); return Math.max(r[0], Math.min(r[1], p)); };
  function fokus() {
    FRO.forEach((s) => { s.lyft = fokusAr != null && traff(s, fokusAr); s.tillbaka = fokusAr != null && !s.lyft; });
    const R = ROOMS[rum];
    if (fokusAr == null) return;
    if (R.pan) panMal = klampa(R.tillPan(posAr(fokusAr)));
    else if (rum === "moln") rotXMal = -R.lat(posAr(fokusAr));
    else if (rum === "vagg") { const h = FRO.filter((s) => s.lyft && s.phi != null); if (h.length) rotYMal = h.reduce((a, s) => a + s.phi, 0) / h.length; }
  }
  function nuvarandeU() { const R = ROOMS[rum]; return R.pan ? R.franPan(panX) : hover ? hover.u : null; }
  function bytRum(r, tyst) {
    const uNu = ROOMS[rum].pan ? ROOMS[rum].franPan(panX) : tot / 2;
    rum = r; const R = ROOMS[r]; R.layout();
    kronologisk().forEach((s, k) => { s.start = klocka + (reduce ? 0 : k * .005 + rnd() * .12); });
    zoom = 1; if (R.pan) { panX = klampa(R.tillPan(uNu)); panMal = klampa(R.tillPan(fokusAr != null ? posAr(fokusAr) : uNu)); }
    rotXMal = (r !== "rulle") ? 0 : null; rotYMal = r === "falt" ? 0 : null;
    fokus();
    docka.querySelectorAll("[data-rum]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.rum === r ? "true" : "false"));
    namn.textContent = R.namn; under.textContent = R.under;
    if (!tyst) { prassel(.6); if (!reduce) { svep.textContent = (R.namn + " ■ ").repeat(3); svep.classList.remove("go"); void svep.offsetWidth; svep.classList.add("go"); } }
  }
  function blas() {
    aktiva().forEach((s) => { const p = new THREE.Vector3((rnd() - .5) * 18, (rnd() - .5) * 11, (rnd() - .5) * 12); dummy.position.copy(p); dummy.rotation.set(rnd() * 6, rnd() * 6, rnd() * 6); s.tp.copy(p); s.tq.copy(dummy.quaternion); s.start = klocka + rnd() * .15; });
    velY += (rnd() - .5) * 3; velX += (rnd() - .5) * 2; prassel(1.4);
    const andra = Object.keys(ROOMS).filter((r) => r !== rum);
    setTimeout(() => bytRum(andra[Math.floor(rnd() * andra.length)]), reduce ? 0 : 1300);
  }

  // ---- tidslinjen ----
  const tc = tl.getContext("2d");
  const hudX = (u, w) => 8 + (u / totalt()) * (w - 16);
  const hudU = (x, w) => ((x - 8) / (w - 16)) * totalt();
  const uTillAr = (u) => { if (u >= tot + ZON_UD) return ABS; if (u >= tot) return UD; for (let y = Y1; y >= Y0; y--) if (u >= borjan[y]) return y + Math.min(.999, (u - borjan[y]) / bredd[y]); return Y0; };
  const jit = new Map(); FRO.forEach((s) => jit.set(s, rnd()));
  function ritaTL() {
    const r = tl.getBoundingClientRect(), dpr = Math.min(devicePixelRatio, 2);
    if (tl.width !== Math.round(r.width * dpr)) { tl.width = Math.round(r.width * dpr); tl.height = Math.round(r.height * dpr); }
    const w = r.width, h = r.height; tc.setTransform(dpr, 0, 0, dpr, 0, 0); tc.clearRect(0, 0, w, h);
    // år som band, varannat tonat
    for (let y = Y0; y <= Y1; y++) {
      const x0 = hudX(borjan[y], w), x1 = hudX(borjan[y] + bredd[y], w);
      if (fokusAr != null && Math.floor(fokusAr) === y && fokusAr < UD) { tc.fillStyle = "rgba(212,255,63,.16)"; tc.fillRect(x0, 0, x1 - x0, h); }
      else if (y % 2) { tc.fillStyle = "rgba(160,195,205,.04)"; tc.fillRect(x0, 0, x1 - x0, h); }
      tc.fillStyle = "rgba(160,195,205,.22)"; tc.fillRect(x0, h - 17, 1, 5);
      if (x1 - x0 > 30 || y % 5 === 0) { tc.fillStyle = "#8aa0a8"; tc.font = "500 10px 'IBM Plex Mono', monospace"; tc.fillText(x1 - x0 > 30 ? String(y) : "’" + String(y).slice(2), x0 + 3, h - 5); }
    }
    const ud0 = hudX(tot, w), ud1 = hudX(tot + ZON_UD, w);
    tc.fillStyle = fokusAr === UD ? "rgba(212,255,63,.16)" : "rgba(138,160,168,.08)"; tc.fillRect(ud0 + 2, 3, ud1 - ud0 - 4, h - 6);
    tc.fillStyle = "#8aa0a8"; tc.fillText("?", (ud0 + ud1) / 2 - 3, h - 5);
    if (visaAbs) { const a0 = ud1, a1 = hudX(tot + ZON_UD + ZON_ABS, w); tc.fillStyle = fokusAr === ABS ? "rgba(239,63,230,.28)" : "rgba(239,63,230,.10)"; tc.fillRect(a0 + 2, 3, a1 - a0 - 4, h - 6); tc.fillStyle = "#ef3fe6"; tc.fillText(w < 520 ? "Abs" : "Absurdimo", a0 + 6, h - 5); }
    FRO.forEach((s) => {
      if (s.abs && !visaAbs) return;
      const x = hudX(s.u, w) + (s.abs || s.undated ? (jit.get(s) - .5) * (hudX(ZON_UD, w) - hudX(0, w)) * .7 : (jit.get(s) - .5) * 2), y = 6 + jit.get(s) * (h - 30);
      tc.globalAlpha = s.tillbaka ? .3 : 1;
      tc.fillStyle = s.abs ? "#ef3fe6" : s.v.typ !== "foto" ? "#5ff3ff" : s.v.vikt === "hjälte" ? "#d4ff3f" : "rgba(231,238,240,.75)";
      const stor = s.v.vikt === "hjälte" || s.v.typ !== "foto"; tc.fillRect(x, y, stor ? 3 : 2, stor ? 6 : 4);
    });
    tc.globalAlpha = 1;
    const u = fokusAr != null ? posAr(fokusAr) : nuvarandeU();
    if (u != null) { const x = hudX(u, w); tc.fillStyle = "#d4ff3f"; tc.fillRect(x - 1, 2, 2, h - 4); tc.beginPath(); tc.moveTo(x - 6, 2); tc.lineTo(x + 6, 2); tc.lineTo(x, 9); tc.fill(); }
    const a = fokusAr ?? (u != null ? uTillAr(u) : null);
    arText.textContent = a == null ? "" : a >= ABS ? "Absurdimo" : a >= UD ? "Utan datum" : `${Math.floor(a)} · ${antal[Math.floor(a)]} handlingar` + (fokusAr != null ? " · klicka igen för att släppa" : "");
  }
  let drar = false, dragFlytt = 0, sistaX = 0;
  tl.addEventListener("pointerdown", (e) => { drar = true; dragFlytt = 0; sistaX = e.clientX; tl.setPointerCapture(e.pointerId); });
  tl.addEventListener("pointermove", (e) => {
    if (!drar) return; dragFlytt += Math.abs(e.clientX - sistaX); sistaX = e.clientX;
    if (dragFlytt > 4) { const r = tl.getBoundingClientRect(), a = uTillAr(hudU(e.clientX - r.left, r.width)); fokusAr = a >= UD ? a : Math.floor(a) + .5; fokus(); }
  });
  tl.addEventListener("pointerup", (e) => {
    if (!drar) return; drar = false; if (dragFlytt > 4) return;
    const r = tl.getBoundingClientRect(), a = uTillAr(hudU(e.clientX - r.left, r.width)), ny = a >= UD ? a : Math.floor(a) + .5;
    fokusAr = fokusAr != null && Math.floor(fokusAr) === Math.floor(ny) ? null : ny; klick(); fokus();
  });
  tl.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return; e.preventDefault();
    let y = fokusAr ?? 2010; y = Math.floor(y) + .5 + (e.key === "ArrowRight" ? 1 : -1);
    if (y > Y1 + .5) y = visaAbs && fokusAr === UD && e.key === "ArrowRight" ? ABS : UD; if (fokusAr === ABS && e.key === "ArrowLeft") y = UD; if (y < Y0) y = Y0 + .5;
    fokusAr = y; fokus();
  });
  absKnapp.addEventListener("click", () => {
    visaAbs = !visaAbs; absKnapp.setAttribute("aria-pressed", visaAbs); absEtikett.forEach((m) => (m.visible = visaAbs));
    if (!visaAbs && fokusAr === ABS) fokusAr = null; bytRum(rum, true);
  });

  // ---- interaktion i rummet ----
  const ray = new THREE.Raycaster(), mus = new THREE.Vector2();
  let ner = null, flytt = 0;
  const vald = (e) => {
    const r = canvas.getBoundingClientRect(); mus.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(mus, camera);
    for (const x of ray.intersectObjects(aktiva().map((s) => s.mesh), false)) { const s = FRO[x.object.userData.i]; if ((s.fade ?? 1) > .35) return s; } return null;
  };
  canvas.addEventListener("pointerdown", (e) => { ner = { x: e.clientX, y: e.clientY }; flytt = 0; canvas.setPointerCapture(e.pointerId); canvas.classList.add("grabbing"); });
  canvas.addEventListener("pointermove", (e) => {
    if (ner) {
      const dx = e.clientX - ner.x, dy = e.clientY - ner.y; flytt += Math.abs(dx) + Math.abs(dy); ner = { x: e.clientX, y: e.clientY };
      if (flytt > 6) { rotXMal = null; rotYMal = null; }
      if (rum === "falt") panMal = klampa(panMal - dx * .022 * camZ / 10);
      else if (rum === "rulle") { velX += dy * .004; panMal = klampa(panMal - dx * .015 * camZ / 10); }
      else { velY += dx * .004; if (rum === "moln") velX += dy * .004; }
      tips.style.transform = "translate(-9999px,0)"; return;
    }
    const s = vald(e);
    if (s !== hover) { if (hover) hover.het = false; hover = s; if (s) s.het = true; canvas.classList.toggle("pointer", !!s); }
    if (s) { tips.replaceChildren(s.v.titel, el("span", {}, s.abs ? "Absurdimo" : s.undated ? "odaterad" : String(Math.floor(s.v.ar)))); const r = rot.getBoundingClientRect(); tips.style.transform = `translate(${Math.min(e.clientX - r.left + 14, r.width - 260)}px,${e.clientY - r.top + 14}px)`; }
    else tips.style.transform = "translate(-9999px,0)";
  });
  canvas.addEventListener("pointerup", (e) => { canvas.classList.remove("grabbing"); if (ner && flytt < 6) { const s = vald(e); if (s) oppnaFro(s); } ner = null; });
  canvas.addEventListener("pointerleave", () => { if (hover) hover.het = false; hover = null; tips.style.transform = "translate(-9999px,0)"; });
  canvas.addEventListener("wheel", (e) => { e.preventDefault(); zoom = Math.max(.35, Math.min(2.2, zoom * (1 + e.deltaY * .0012))); }, { passive: false });
  docka.querySelectorAll("[data-rum]").forEach((b) => b.addEventListener("click", () => bytRum(b.dataset.rum)));
  blasKnapp.addEventListener("click", blas);
  const tangent = (e) => {
    if (!aktiv || visareOppen() || document.activeElement === tl || /input|textarea/i.test(document.activeElement?.tagName)) return;
    const map = { 1: "falt", 2: "rulle", 3: "moln", 4: "vagg" }; if (map[e.key]) bytRum(map[e.key]);
    if (e.key === " ") { e.preventDefault(); blas(); }
    if (e.key === "Escape" && fokusAr != null) { fokusAr = null; fokus(); }
  };
  addEventListener("keydown", tangent);

  function ordning() {
    const a = aktiva();
    if (rum === "rulle") return a.sort((x, y) => x.hue - y.hue || x.u - y.u);
    if (rum === "moln") return a.sort((x, y) => Math.atan2(x.tp.z, x.tp.x) - Math.atan2(y.tp.z, y.tp.x));
    return kronologisk();
  }
  function folj(s) {
    const R = ROOMS[rum]; aktuell = s;
    if (R.pan) panMal = klampa(s.tp.x);
    else { rotYMal = Math.atan2(s.tp.x, -s.tp.z); if (rum === "moln") rotXMal = -Math.asin(s.tp.y / Math.max(.01, s.tp.length())); }
  }
  function oppnaFro(s) {
    const o = ordning();
    oppna(o.map((x) => x.v), o.indexOf(s), { stil: ROOMS[rum].stil, onStep: (v) => folj(FRO.find((x) => x.v === v)) });
  }

  // ---- loop ----
  function storlek() {
    const w = rot.clientWidth, h = rot.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    UI.top = w < 600 ? 64 : 70; UI.bottom = h < 560 ? 132 : 150;
    camera.setViewOffset(w, h, 0, (UI.bottom - UI.top) / 2, w, h); camera.updateProjectionMatrix();
    if (rum === "vagg") ROOMS.vagg.layout();
  }
  const ro = new ResizeObserver(storlek); ro.observe(rot);
  const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _n = new THREE.Vector3(), _c = new THREE.Vector3();
  let sist = performance.now(), raf = 0, aktiv = false;
  function ruta(nu) {
    raf = requestAnimationFrame(ruta);
    const dt = Math.min(.05, (nu - sist) / 1000); sist = nu; klocka += dt;
    const k = 1 - Math.exp(-dt * (reduce ? 30 : 3.4)), kq = 1 - Math.exp(-dt * (reduce ? 30 : 4));
    if (!visareOppen()) aktuell = null;
    const lugn = aktuell || fokusAr != null ? .15 : 1;
    if (rum === "rulle") velX += dt * .05 * lugn;
    if (rum === "moln") velY += dt * .04 * lugn;
    rotX += velX * dt * 4; rotY += velY * dt * 4; velX *= Math.pow(.04, dt); velY *= Math.pow(.04, dt);
    if (rotXMal != null) { rotX += (rotXMal - rotX) * k * 1.2; velX *= .9; }
    if (rotYMal != null) { let d = rotYMal - rotY; d = Math.atan2(Math.sin(d), Math.cos(d)); rotY += d * k * 1.2; velY *= .9; }
    if (rum === "moln") rotX = Math.max(-1, Math.min(1, rotX));
    world.rotation.set(rotX, rotY, 0, "YXZ");
    const R = ROOMS[rum];
    panX += ((R.pan ? panMal : 0) - panX) * k; world.position.x = -panX;
    camZMal = R.inne ? .35 : R.fit() * zoom; camZ += (camZMal - camZ) * k;
    camera.position.set(0, 0, camZ); camera.lookAt(0, 0, camZ - 1);
    if (Math.abs(camera.fov - R.fov) > .01) { camera.fov += (R.fov - camera.fov) * k; camera.updateProjectionMatrix(); }
    if (rum === "rulle") { scene.fog.near = camZ - 1.5; scene.fog.far = camZ + 4.2; } else { scene.fog.near = R.inne ? 3 : Math.max(4, camZ - 2); scene.fog.far = camZ + (R.inne ? 14 : 24); }
    const fa = rum === "falt" ? 1 : 0; faltExtra.forEach((m) => (m.opacity += ((m === grid.material ? .6 : 1) * fa - m.opacity) * k));
    FRO.forEach((s) => {
      const m = s.mesh, av = s.abs && !visaAbs;
      if (klocka >= s.start) { m.position.lerp(s.tp, k); m.quaternion.slerp(s.tq, kq); }
      const f = av ? 0 : (s.het ? 1.22 : 1) * (aktuell === s ? 1.3 : 1) * (s.lyft ? 1.18 : s.tillbaka ? .86 : 1);
      m.scale.x += (s.bas.x * f - m.scale.x) * .2; m.scale.y += (s.bas.y * f - m.scale.y) * .2; m.visible = m.scale.x > .01;
      let fade = 1;
      if (rum === "rulle") { m.getWorldPosition(_p); m.getWorldQuaternion(_q); _n.set(0, 0, 1).applyQuaternion(_q); _c.copy(camera.position).sub(_p).normalize(); fade = Math.max(0, Math.min(1, (_n.dot(_c) - .05) / .45)); }
      s.fade = fade;
      const mal = s.klar ? (s.tillbaka ? .42 : 1) * fade : 0; s.op += (mal - s.op) * .15; s.mat.opacity = s.op; s.ram.opacity = s.op * (s.lyft ? 1 : .9);
    });
    renderer.render(scene, camera);
    ritaTL();
  }
  bytRum("falt", true);
  return {
    rot,
    starta() { aktiv = true; requestAnimationFrame(() => { storlek(); sist = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(ruta); }); },
    stoppa() { aktiv = false; cancelAnimationFrame(raf); },
  };
}
