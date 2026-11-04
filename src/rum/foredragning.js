// Föredragningen i Arkivrummet: samma föredragning som #foredragning-<frö>, men bilderna är
// korten i rummet och kameran åker mellan dem i takt med sekvensen.
//
// Föredragningens spelare (src/vyer/foredragning.js) står för klockan, ljudet, texterna och
// kontrollerna. Här bestäms var kameran står vid varje tidpunkt:
//  - Varje avsnitt är ett skott. Ett verk är ett skott mot sitt kort, en text är ett skott mot rummet.
//  - Kameran flyger från förra skottet till nästa på ett bestämt antal slag och landar på slaget.
//  - Varje paragraf hålls i ett eget rum. Rummet byts under rubriken, med rummets egen koreografi.
//  - Rummet flyttar sig också: Fältet och Mörkrummet glider i sidled, Rullen vrider sig fram,
//    som en filmrulle som matas fram en ruta i taget. I Molnet och Väggen vänder sig kameran.
//  - Absurdimo avbryter, och då blåser allt omkull. Föredragningen återupptas i nästa rum.
//  - I Mörkrummet framkallas hjälten medan kameran närmar sig och är klar när stämpeln slår ned.
// Allt räknas ur föredragningens tid, så att paus, spolning och pilarna fungerar som vanligt.
// Med prefers-reduced-motion klipper kameran i stället för att flyga, och ingenting blåser omkull.
import * as THREE from "three";
import { el, metaRad, bildUrl, bildBredd } from "../data.js";
import { iRummet, lapp, stampel, SLAG, nyttFro, tvatta } from "../vyer/foredragning.js";
import "../stil/rumsforedragning.css";

export { nyttFro };

// Rummen: inledningen i Väggen, sedan ett rum per paragraf.
const RUM_FOR = { "§ 1": "falt", "§ 2": "rulle", "§ 3": "moln", "§ 4": "mork" };
const FORSTA_RUM = "vagg";
// Hur många slag flygningen till ett kort tar, och hur stor del av bilden kortet fyller.
const FLYG = { foto: 1.5, film: 1.5, snabb: .5, hjalte: 6, avbrott: 1, blixt: .2 };
const FYLL = { foto: .74, film: .6, snabb: .76, hjalte: .72, avbrott: .56, blixt: .7 };
// Kameran skakar när en stämpel slår ned (slag från avsnittets början).
const SKAK = { oppning: [12], snabb: [1], hjalte: [7] };
const BLAS = 6.75; // slaget då Absurdimo blåser omkull rummet
const FOV = 38;

const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const klamp = (t, a = 0, b = 1) => Math.max(a, Math.min(b, t));
const mjuk = (a, b, x) => { const t = klamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const kort = (d) => Math.atan2(Math.sin(d), Math.cos(d));

// R: det som rummet lånar ut (se src/vyer/arkivrummet.js).
export function skapaRumsforedragning(R) {
  const { camera } = R;
  let sp = null, plan = null, skott = [], rumFor = [], sokare = new Map(), tona = null;
  let jNu = -1, A = null, e = 1, tidForra = null, tillstand = null, utgang = null;
  const sist = { p: new THREE.Vector3(), q: new THREE.Quaternion(), fov: 50, dof: [12, 8], varld: null, fokus: 10 };
  const B = { p: new THREE.Vector3(), q: new THREE.Quaternion(), fov: 50, dof: [12, 8], fokus: 10 };
  const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _u = new THREE.Vector3(), _n = new THREE.Vector3(), _r = new THREE.Vector3(),
    _q = new THREE.Quaternion(), _qw = new THREE.Quaternion(), _e = new THREE.Euler(), _m = new THREE.Matrix4(), _f = new THREE.Vector3(), _c = new THREE.Vector3();
  const fokusPunkt = new THREE.Vector3();
  let malKort = null; // kortet kameran är på väg till eller står vid
  let hjalte = null;  // avsnittet med handlingen av särskild vikt

  // ---------- manuset till rummet ----------
  function forbered() {
    skott = []; rumFor = []; hjalte = plan.seg.find((x) => x.typ === "hjalte") || null;
    if (hjalte) hjalte = { ...hjalte, i: plan.seg.indexOf(hjalte), kortet: R.kortFor(hjalte.v) };
    if (hjalte && !hjalte.kortet) hjalte = null;
    let rum = FORSTA_RUM;
    plan.seg.forEach((s, i) => {
      if (s.typ === "rubrik" && RUM_FOR[s.nr]) rum = RUM_FOR[s.nr];
      rumFor[i] = rum;
      const kortet = s.v ? R.kortFor(s.v) : null;
      // efter hjälten: kameran stannar vid den i halvbild, bredvid papperet, och drar sig långsamt bakåt
      if (hjalte && i > hjalte.i && (s.typ === "kontakt" || s.typ === "slut")) {
        skott.push({ t0: s.start, seg: s, i, kort: hjalte.kortet, flyg: 3 * SLAG, fyll: .34, komp: .3, drag: [hjalte.slut, plan.total, 1, .8] });
        return;
      }
      if (kortet) skott.push({ t0: s.start, seg: s, i, kort: kortet, flyg: FLYG[s.typ] * SLAG, fyll: FYLL[s.typ] ?? .74 });
      else skott.push({ t0: s.start, seg: s, i, flyg: (s.typ === "oppning" ? .5 : 1.25) * SLAG });
      if (s.typ === "avbrott" && !plan.lugn) skott.push({ t0: s.start + BLAS * SLAG, seg: s, i, flyg: 1.4 * SLAG, blast: true });
    });
  }
  const skottVid = (t) => { let j = 0; while (j < skott.length - 1 && t >= skott[j + 1].t0) j++; return j; };
  const segVid = (t) => { let i = 0; while (i < plan.seg.length - 1 && t >= plan.seg[i + 1].start) i++; return i; };
  // Läget rummet ska ha vid tiden t: vilket rum, och om Absurdimo har blåst omkull det.
  function onskat(t) {
    const i = segVid(t), s = plan.seg[i];
    return { rum: rumFor[i], blast: s.typ === "avbrott" && !plan.lugn && t - s.start >= BLAS * SLAG, i, lok: t - s.start };
  }

  // ---------- start och slut ----------
  function foredra(arg) {
    if (arg == null) { stoppa(); return; }
    let fro = tvatta(arg);
    if (sp && sp.plan.fro === fro && sp.rot.isConnected) return;
    stoppa();
    if (!fro) { fro = nyttFro(); history.replaceState(null, "", "#arkivrummet-foredragning-" + fro); }
    R.andrat(true);
    tona = el("div", { class: "rf-tona", "aria-hidden": "true" });
    sp = iRummet(fro, { rot: R.rot, bygg: BYGG, forbered: R.klar });
    sp.rot.prepend(tona);
    plan = sp.plan; forbered();
    jNu = -1; A = null; e = 1; tidForra = null; tillstand = null; utgang = null; malKort = null;
    sist.p.copy(camera.position); sist.q.copy(camera.quaternion); sist.fov = camera.fov; sist.dof = R.dof(); sist.varld = R.varld.las();
  }
  function stoppa() {
    if (!sp) return;
    sp.stoppa(); sp = null; plan = null; sokare.clear(); malKort = null;
    utgang = { p: camera.position.clone(), q: camera.quaternion.clone(), fov: camera.fov, dof: R.dof(true), t0: performance.now() };
    R.andrat(false);
  }

  // ---------- varje ruta, före rummets egen kamera ----------
  // Byter rum när föredragningen kommer till en ny paragraf, och ställer rummet för kortet.
  function fore() {
    if (!sp || !sp.igang) return;
    const t = sp.tid, mal = onskat(t);
    const kontinuerlig = tidForra != null && t >= tidForra && t - tidForra < .3;
    tidForra = t;
    if (!tillstand || tillstand.rum !== mal.rum || tillstand.blast !== mal.blast) {
      // Under uppspelning koreograferas bytet. Vid spolning byts rummet direkt.
      const animerat = !plan.lugn && sp.spelar && (kontinuerlig || mal.lok < .3);
      if (mal.blast) { if (R.rum !== mal.rum) R.bytRum(mal.rum, true); R.blas(!animerat); }
      else R.bytRum(mal.rum, !animerat);
      tillstand = { rum: mal.rum, blast: mal.blast };
    }
    const j = skottVid(t), sh = skott[j];
    if (j !== jNu) {
      jNu = j;
      // kortet som visas, och nästa, hämtas i större format om det finns (nya bilder via intaget)
      skarp(sh.kort); skarp(skott.slice(j + 1).find((x) => x.kort)?.kort);
      A = { p: sist.p.clone(), q: sist.q.clone(), fov: sist.fov, dof: sist.dof.slice(), varld: R.varld.las(), fokus: sist.fokus };
      if (plan.lugn && tona) tona.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 520, easing: "ease-out" });
    }
    e = plan.lugn ? 1 : ease(klamp((t - sh.t0) / sh.flyg));
    malKort = sh.kort || null;
    // texterna: rummet rör sig långsamt bakom papperet
    if (!sh.kort && !plan.lugn && !R.ko.aktiv) {
      if (sh.seg.typ === "oppning" && R.rum === "vagg") R.varld.mal({ rotY: .05 * (t - sh.t0) });
    }
    if (sh.kort && !R.ko.aktiv) {
      const w = malVarld(sh.kort, A.varld);
      R.varld.satt({ rotX: lerp(A.varld.rotX, w.rotX, e), rotY: lerp(A.varld.rotY, w.rotY, e), panX: lerp(A.varld.panX, w.panX, e) });
    }
  }
  // Fritt: rummet får röra sig av sig självt (Rullen snurrar, Molnet driver) när inget kort visas.
  const fritt = () => !sp || !sp.igang || !skott[jNu]?.kort;

  // Rummet laddar korten i den vanliga storleken. Den räcker inte när ett kort fyller skärmen.
  const skarpa = new Set(), laddare = new THREE.TextureLoader();
  function skarp(s) {
    if (!s || !s.v.bild || skarpa.has(s) || (bildBredd(s.v) || 0) < 1000) return;
    skarpa.add(s);
    laddare.load(bildUrl(s.v, 1600), (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; const g = s.mat.map; s.mat.map = t; s.mat.needsUpdate = true; if (g && g !== t) g.dispose(); });
  }

  // Hur rummet ska stå när kortet visas. Fältet och Mörkrummet glider i sidled, Rullen vrider sig fram.
  // I Molnet och Väggen står rummet still och kameran vänder sig i stället.
  function malVarld(s, fran) {
    const rum = R.rum, p = s.tp;
    if (rum === "falt") return { rotX: 0, rotY: 0, panX: p.x };
    if (rum === "mork") return { rotX: R.LUTNING, rotY: 0, panX: p.x };
    if (rum === "rulle") return { rotX: fran.rotX + kort(Math.PI / 2 - Math.atan2(p.z, p.y) - fran.rotX), rotY: 0, panX: p.x };
    return fran;
  }

  // Kamerans läge framför ett kort, med rummet ställt som w. lok: sekunder in i skottet.
  function kortLage(sh, w, lok, ut) {
    const s = sh.kort, m = s.mesh, seg = sh.seg, kb = seg.kb;
    _e.set(w.rotX, w.rotY, 0, "YXZ"); _qw.setFromEuler(_e);
    _c.copy(m.position).applyQuaternion(_qw); _c.x -= w.panX;
    _q.copy(_qw).multiply(m.quaternion);
    _n.set(0, 0, 1).applyQuaternion(_q); _u.set(0, 1, 0).applyQuaternion(_q); _r.set(1, 0, 0).applyQuaternion(_q);
    const fov = R.portratt() ? 52 : FOV, tn = Math.tan(THREE.MathUtils.degToRad(fov / 2)), a = R.anvand();
    const W = s.bas.x, H = s.bas.y, fyll = sh.fyll;
    let d = Math.max(H / (2 * fyll * tn * a), W / (2 * .9 * tn * camera.aspect));
    // långsam kamerarörelse över kortet, styrd av fröet, som i föredragningen
    const p = plan.lugn || !kb ? 0 : mjuk(0, 1, lok / seg.dur);
    let skala = 1, ox = 0, oy = 0, rull = 0;
    if (kb) {
      skala = plan.lugn ? 1.03 : lerp(kb.s0, kb.s1, p); ox = lerp(kb.x0, kb.x1, p) / 100 * W; oy = lerp(kb.y0, kb.y1, p) / 100 * H; rull = THREE.MathUtils.degToRad(lerp(kb.r0, kb.r1, p));
    }
    if (seg.typ === "hjalte" && !plan.lugn) skala *= lerp(.82, 1.06, mjuk(0, 1, lok / (seg.dur * .9)));
    if (sh.drag && !plan.lugn) skala *= lerp(sh.drag[2], sh.drag[3], mjuk(sh.drag[0], sh.drag[1], sh.t0 + lok));
    d /= skala;
    // på en stående skärm hamnar kortet en bit upp, så att lappen och papperen får plats under
    const synligH = d * tn * a, synligB = d * tn * camera.aspect;
    const upp = R.portratt() ? (sh.komp ? synligH * .42 : H * .16) : 0;
    // komp: kortet läggs åt höger, så att papperet till vänster inte skymmer det
    if (sh.komp && !R.portratt()) ox -= synligB * sh.komp;
    fokusPunkt.copy(_c).addScaledVector(_r, ox).addScaledVector(_u, oy - upp);
    ut.p.copy(fokusPunkt).addScaledVector(_n, d);
    _w.copy(_u).applyAxisAngle(_n, rull);
    _m.lookAt(ut.p, fokusPunkt, _w); ut.q.setFromRotationMatrix(_m);
    ut.fov = fov; ut.fokus = d; ut.dof = [d + Math.max(.3, H * .45), 2.2];
    return ut;
  }

  // ---------- varje ruta, efter rummets egen kamera ----------
  function kamera() {
    if (!sp || !sp.igang) {
      if (sp) { sist.p.copy(camera.position); sist.q.copy(camera.quaternion); sist.fov = camera.fov; sist.dof = R.dof(); sist.varld = R.varld.las(); }
      else if (utgang) utgangen();
      return;
    }
    const sh = skott[jNu], t = sp.tid, lok = t - sh.t0, wB = sh.kort ? malVarld(sh.kort, A.varld) : null;
    // B: dit kameran ska. Rummets egen kamera för texterna, kortet för verken.
    if (sh.kort) kortLage(sh, wB, lok, B);
    else { B.p.copy(camera.position); B.q.copy(camera.quaternion); B.fov = R.ko.aktiv ? camera.fov : R.fov(); B.dof = R.dof(); B.fokus = R.dof()[0]; }
    const p = sist.p, q = sist.q;
    p.lerpVectors(A.p, B.p, e); q.slerpQuaternions(A.q, B.q, e);
    // flygningen lyfter bakåt i en båge, mer ju längre den är, så att rummet syns på vägen
    if (e > 0 && e < 1) {
      const vag = A.p.distanceTo(B.p) + (wB ? Math.abs(wB.panX - A.varld.panX) * .6 + Math.abs(wB.rotX - A.varld.rotX) * 2.5 : 0);
      _f.set(0, 0, 1).applyQuaternion(A.q).add(_v.set(0, 0, 1).applyQuaternion(B.q));
      if (_f.lengthSq() < .04) _f.set(0, 1, 0); _f.normalize();
      p.addScaledVector(_f, Math.min(4.5, vag * .3) * Math.sin(Math.PI * e));
    }
    sist.fov = lerp(A.fov, B.fov, e);
    const mitt = e > 0 && e < 1 ? Math.sin(Math.PI * e) : 0;
    sist.dof = [lerp(A.dof[0], B.dof[0], e) + mitt * 3, lerp(A.dof[1], B.dof[1], e) + mitt * 4];
    sist.fokus = lerp(A.fokus ?? 10, B.fokus, e);
    sist.varld = R.varld.las();
    camera.position.copy(p); camera.quaternion.copy(q);
    // stämpeln slår ned: rummet skakar till
    if (!plan.lugn) {
      const s = plan.seg[segVid(t)], ls = (t - s.start) / SLAG;
      for (const b of SKAK[s.typ] || []) {
        const x = (ls - b) * SLAG;
        if (x >= 0 && x < .45) { _v.set(0, 1, 0).applyQuaternion(q); camera.position.addScaledVector(_v, -Math.sin(x * 46) * Math.exp(-x * 9) * .018 * Math.max(1, sist.fokus)); }
      }
    }
    if (Math.abs(camera.fov - sist.fov) > .001) { camera.fov = sist.fov; camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld();
  }
  // Efter föredragningen glider kameran tillbaka till rummets egen plats.
  function utgangen() {
    const x = (performance.now() - utgang.t0) / 1100;
    if (x >= 1) { utgang = null; return; }
    const k = ease(x);
    camera.position.lerpVectors(utgang.p, _v.copy(camera.position), k);
    camera.quaternion.slerpQuaternions(utgang.q, _q.copy(camera.quaternion), k);
    camera.fov = lerp(utgang.fov, camera.fov, k); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }

  // Ljuset: lampan hänger snett ovanför kameran och lyser mot det som visas.
  function ljus(lampa) {
    if (!sp && !utgang) return false;
    _v.set(-2.2, 3.4, 3.2).applyQuaternion(camera.quaternion).add(camera.position);
    lampa.position.copy(_v);
    _f.set(0, 0, -1).applyQuaternion(camera.quaternion);
    lampa.target.position.copy(camera.position).addScaledVector(_f, Math.max(2, sist.fokus));
    return true;
  }
  const dof = () => (sp && sp.igang ? sist.dof : utgang ? utgang.dof : null);

  // Per kort: storlek (kort som står i vägen för kameran viks undan), ljus och framkallning.
  function kortet(s) {
    if (!sp || !sp.igang) return null;
    const sh = skott[jNu];
    let skala = 1;
    if (malKort && s !== malKort) {
      _v.setFromMatrixPosition(s.mesh.matrixWorld); _f.subVectors(fokusPunkt, camera.position); const avst = _f.length(); _f.divideScalar(avst || 1);
      _w.subVectors(_v, camera.position); const langs = _w.dot(_f);
      if (langs > .05 && langs < avst - .12) {
        const sida = _w.addScaledVector(_f, -langs).length(), halv = langs * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.25;
        if (sida < halv + Math.max(s.bas.x, s.bas.y) * .6) skala = 0;
      }
    }
    const dim = malKort && s !== malKort ? lerp(1, .5, e) : 1;
    // hjälten framkallas medan kameran närmar sig och är färdig när stämpeln slår ned
    let fram = null;
    if (hjalte && s.v === hjalte.v && sp.tid >= hjalte.start) fram = mjuk(hjalte.start + SLAG, hjalte.start + 7 * SLAG, sp.tid);
    return { skala, dim, fram, sh };
  }

  // Sökaren: hörnen, stämpeln och etiketten följer kortet på skärmen.
  const _h = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  function efter() {
    if (!sp || !sp.igang) return;
    const i = sp.avsnitt, box = sokare.get(i), s = plan.seg[i];
    if (!box || !box.isConnected || !s.v) return;
    const k = R.kortFor(s.v); if (!k) return;
    const m = k.mesh, W = R.rot.clientWidth, H = R.rot.clientHeight;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, bakom = false;
    [[-.5, -.5], [.5, -.5], [.5, .5], [-.5, .5]].forEach(([x, y], n) => {
      _h[n].set(x, y, 0); m.localToWorld(_h[n]); _h[n].project(camera);
      if (_h[n].z > 1 || _h[n].z < -1) bakom = true;
      const px = (_h[n].x + 1) / 2 * W, py = (1 - _h[n].y) / 2 * H;
      x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py);
    });
    if (bakom || x1 - x0 > W * 3) { box.style.visibility = "hidden"; return; }
    box.style.visibility = "";
    box.style.transform = `translate(${x0.toFixed(1)}px,${y0.toFixed(1)}px)`;
    box.style.width = (x1 - x0).toFixed(1) + "px"; box.style.height = (y1 - y0).toFixed(1) + "px";
  }

  // ---------- avsnitten i rummet ----------
  // Verken visas som korten själva. Här byggs bara det som ligger ovanpå: sökaren, lappen och stämplarna.
  const ankomst = (s) => Math.max(.5, (plan.lugn ? 0 : FLYG[s.typ]) - .25);
  function sok(k, s, art, ...barn) {
    const inne = el("div", { class: "rf-inne" }, ...["a", "b", "c", "d"].map((h) => el("i", { class: "rf-horn " + h })), ...barn);
    const box = el("div", { class: "rf-sokare rf-" + art, "aria-hidden": "true" }, inne);
    box.style.visibility = "hidden";
    sokare.set(s.i, box);
    return { box, inne };
  }
  function tidkod(k, s) {
    const tc = el("span", { class: "fd-tc mono" });
    k.ticks.push((lok) => {
      const f = Math.floor((s.tc + lok) * 25), ss = Math.floor(f / 25);
      tc.textContent = [Math.floor(ss / 3600), Math.floor(ss / 60) % 60, ss % 60, f % 25].map((x) => String(x).padStart(2, "0")).join(":");
    });
    return tc;
  }
  const BYGG = {
    foto(s, k, opt = {}) {
      const { box, inne } = sok(k, s, opt.art || "foto");
      k.inn(inne, ankomst(s), "tona", .5);
      if (opt.stampel) inne.append(k.stampa(stampel(opt.stampel[0]), opt.stampel[1], s.rot));
      return el("div", { class: "fd-seg rf-seg" }, box, opt.utanLapp ? null : lapp(k, s, metaRad(s.v), null, ankomst(s)), ...(opt.extra || []));
    },
    snabb(s, k) {
      if (k.lugn) return BYGG.foto(s, k);
      return BYGG.foto(s, k, { stampel: [`Bilaga ${s.nr}`, 1], utanLapp: true, art: "snabb",
        extra: [el("p", { class: "fd-snabbrad mono" }, `${s.v.titel} · ${metaRad(s.v)}`)] });
    },
    hjalte(s, k) {
      const film = s.v.typ !== "foto";
      return film ? BYGG.film(s, k, { stampel: ["Arkiveras", 7] }) : BYGG.foto(s, k, { stampel: ["Arkiveras", 7], art: "hjalte" });
    },
    film(s, k, opt = {}) {
      const v = s.v;
      const { box, inne } = sok(k, s, "film", el("span", { class: "fd-rec mono" }, v.kanal === "Absurdimo" ? "▶ Absurdimo" : "▶ Rörlig bild"), tidkod(k, s));
      k.inn(inne, ankomst(s), "tona", .5);
      if (opt.stampel) inne.append(k.stampa(stampel(opt.stampel[0]), opt.stampel[1], s.rot));
      return el("div", { class: "fd-seg rf-seg fd-film" }, box, lapp(k, s, [v.kanal, metaRad(v)].filter(Boolean).join(" · "), null, ankomst(s)));
    },
    avbrott(s, k) {
      const v = s.v, yta = el("div", { class: "fd-magenta" });
      if (!k.lugn) k.anim(yta, [1, 0, .85, 0, .55, 0, .3, 0].flatMap((o, i, l) => [{ opacity: o, offset: i / l.length }, { opacity: o, offset: i === l.length - 1 ? 1 : (i + 1) / l.length - .0001 }]), 0, .9, { easing: "linear" });
      else k.anim(yta, [{ opacity: 0 }, { opacity: .18 }], 0, 1, { easing: "ease" });
      const svep = el("div", { class: "fd-svep", "aria-hidden": "true" }, "Avbrott");
      if (!k.lugn) k.anim(svep, [{ transform: "translateX(40%)", opacity: 0 }, { opacity: .9, offset: .12 }, { opacity: .5, offset: .75 }, { transform: "translateX(-75%)", opacity: 0 }], 0, 4, { easing: "cubic-bezier(.3,.6,.2,1)" });
      const text = k.inn(el("p", { class: "fd-avbrottstext mono" }, "Föredragningen har avbrutits av Absurdimo."), .5, "tona", .5);
      const { box, inne } = sok(k, s, "abs", el("span", { class: "fd-rec mono" }, "▶ Absurdimo"), tidkod(k, s),
        el("div", { class: "fd-absetikett" }, el("span", { class: "mono" }, `Bilaga ${s.nr}. Inkom oanmäld.`), el("b", {}, v.titel)));
      k.inn(inne, 1.1, "pop", .6);
      if (!k.lugn) k.anim(inne, [{ rotate: "-3deg" }, { rotate: "2deg" }, { rotate: "-3deg" }], 2.1, 1, { iterations: 4, fill: "none", easing: "ease-in-out" });
      k.ut(inne, BLAS - (k.lugn ? 0 : .1), k.lugn ? 1 : .3);
      const beklagar = k.inn(el("p", { class: "fd-beklagar mono" }, "Verket beklagar avbrottet."), 5.75, "tona", .6);
      return el("div", { class: "fd-seg rf-seg fd-avbrott rf-avbrott" }, yta, svep, text, box, beklagar);
    },
  };

  return {
    foredra, stoppa, fore, kamera, ljus, dof, kort: kortet, efter,
    get aktiv() { return !!sp; },
    get fritt() { return fritt(); },
  };
}
