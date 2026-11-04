// Mörkrummet: ett bord med framkallningsbad under rött ljus.
// Varje år har sitt eget bad, i tidsordning längs bordet. Handlingarna ligger i vätskan
// som vitt papper, och bilden växer fram när man närmar sig.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export const LUTNING = .74;      // hur mycket bordet lutar mot kameran (radianer)
const XM = 1.25;                  // bordets skala längs tiden
const DJUP = 3.3, KANT = .2, YTA = .13, TZ = .35, VZ = TZ - DJUP / 2 - .85; // badens mitt och väggen

// Krusningar som går att lägga sida vid sida: en summa av heltalsvågor.
function krusning() {
  const N = 128, cv = document.createElement("canvas"); cv.width = cv.height = N;
  const c = cv.getContext("2d"), d = c.createImageData(N, N), h = new Float32Array(N * N);
  const vag = [[1, 2, .9], [3, -1, .5], [-2, 3, .35], [5, 2, .2], [-4, -5, .12]];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let v = 0; vag.forEach(([a, b, s], i) => (v += s * Math.sin(((a * x + b * y) / N) * Math.PI * 2 + i * 1.7))); h[y * N + x] = v;
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = h[y * N + ((x + 1) % N)] - h[y * N + ((x - 1 + N) % N)], dy = h[((y + 1) % N) * N + x] - h[((y - 1 + N) % N) * N + x];
    const n = new THREE.Vector3(-dx * 1.4, -dy * 1.4, 1).normalize(), i = (y * N + x) * 4;
    d.data[i] = (n.x * .5 + .5) * 255; d.data[i + 1] = (n.y * .5 + .5) * 255; d.data[i + 2] = (n.z * .5 + .5) * 255; d.data[i + 3] = 255;
  }
  c.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; return t;
}

function textur(b, h, rita, srgb = true) {
  const cv = document.createElement("canvas"); cv.width = b; cv.height = h; rita(cv.getContext("2d"), b, h);
  const t = new THREE.CanvasTexture(cv); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export function skapaMorkrum({ world, tot, Y0, Y1, borjan, bredd, antal, ZON_UD, ZON_ABS, rnd, ytaTex }) {
  const x = (u) => (u - tot / 2) * XM, u = (p) => p / XM + tot / 2;
  const grupp = new THREE.Group(); grupp.visible = false; world.add(grupp);
  const mats = []; // [material, full opacitet]
  const reg = (m, op = 1) => { m.transparent = true; m.opacity = 0; mats.push([m, op]); return m; };

  // baden: ett per år med handlingar, plus utan datum och Absurdimo
  const bad = [];
  for (let y = Y0; y <= Y1; y++) if (antal[y] > 0) bad.push({ nyckel: y, x0: x(borjan[y]) + .07, x1: x(borjan[y] + bredd[y]) - .07, text: String(y) });
  bad.push({ nyckel: "ud", x0: x(tot) + .12, x1: x(tot + ZON_UD) - .07, text: "UTAN DATUM" });
  const absBad = { nyckel: "abs", x0: x(tot + ZON_UD) + .07, x1: x(tot + ZON_UD + ZON_ABS) - .12, text: "ABSURDIMO", abs: true };
  bad.push(absBad);
  const B = new Map(bad.map((b) => [b.nyckel, b]));

  // bord och vägg
  const vanster = x(-6), hoger = x(tot + ZON_UD + ZON_ABS + 6), langd = hoger - vanster, mitt = (vanster + hoger) / 2;
  const bordYta = ytaTex.clone(); bordYta.repeat.set(langd / 3, 2.4); bordYta.needsUpdate = true;
  const bord = new THREE.Mesh(new THREE.BoxGeometry(langd, .14, 6.2), reg(new THREE.MeshLambertMaterial({ color: 0x3a3330, bumpMap: bordYta, bumpScale: 1.2 })));
  bord.position.set(mitt, -.08, VZ + 3); grupp.add(bord);
  const vagg = new THREE.Mesh(new THREE.PlaneGeometry(langd, 8), reg(new THREE.MeshLambertMaterial({ color: 0x2a2220 })));
  vagg.position.set(mitt, 3.9, VZ); grupp.add(vagg);
  const list = new THREE.Mesh(new THREE.BoxGeometry(langd, .1, .1), reg(new THREE.MeshLambertMaterial({ color: 0x4a3f3a })));
  list.position.set(mitt, .02, VZ + .06); grupp.add(list);

  // karen: botten och fyra kanter, sammanslagna till en geometri
  const delar = [], vatten = [], absDelar = [], absVatten = [];
  const lada = (b, h, d, px, py, pz, lista) => { const g = new THREE.BoxGeometry(b, h, d); g.translate(px, py, pz); lista.push(g); };
  bad.forEach((b) => {
    const w = b.x1 - b.x0, cx = (b.x0 + b.x1) / 2, L = b.abs ? absDelar : delar;
    lada(w, .03, DJUP, cx, 0, TZ, L);
    lada(w, KANT, .05, cx, KANT / 2, TZ + DJUP / 2, L); lada(w, KANT, .05, cx, KANT / 2, TZ - DJUP / 2, L);
    lada(.05, KANT, DJUP, b.x0, KANT / 2, TZ, L); lada(.05, KANT, DJUP, b.x1, KANT / 2, TZ, L);
    const v = new THREE.PlaneGeometry(w - .06, DJUP - .06); v.rotateX(-Math.PI / 2); v.translate(cx, YTA, TZ);
    const uv = v.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, (b.x0 + uv.getX(i) * w) / 2.2, uv.getY(i) * DJUP / 2.2);
    (b.abs ? absVatten : vatten).push(v);
  });
  const karMat = reg(new THREE.MeshLambertMaterial({ color: 0x3b3634 }));
  const karAbsMat = reg(new THREE.MeshLambertMaterial({ color: 0xef3fe6 }));
  const kar = new THREE.Mesh(mergeGeometries(delar), karMat); kar.renderOrder = 1; grupp.add(kar);
  const karAbs = new THREE.Mesh(mergeGeometries(absDelar), karAbsMat); karAbs.renderOrder = 1; grupp.add(karAbs);
  const kTex = krusning();
  const vMat = reg(new THREE.MeshPhongMaterial({ color: 0x1a0504, specular: 0x7a2616, shininess: 40, normalMap: kTex, normalScale: new THREE.Vector2(.14, .14), depthWrite: false }), .42);
  const vY = new THREE.Mesh(mergeGeometries(vatten), vMat); vY.renderOrder = 5; grupp.add(vY);
  const vAbs = new THREE.Mesh(mergeGeometries(absVatten), vMat); vAbs.renderOrder = 5; grupp.add(vAbs);

  // tejpbitar med årtal framför varje bad
  const etiketter = [];
  bad.forEach((b) => {
    const text = b.text, bred = text.length > 4 ? 1.5 : .8;
    const t = textur(256, 64, (c, W, H) => {
      c.fillStyle = "#e9e1cf"; c.beginPath(); c.moveTo(4, 6); c.lineTo(W - 2, 2); c.lineTo(W - 6, H - 4); c.lineTo(2, H - 1); c.closePath(); c.fill();
      c.fillStyle = b.abs ? "#c0249e" : "#2a2622"; c.font = `500 ${text.length > 4 ? 30 : 38}px 'IBM Plex Mono', monospace`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(text, W / 2, H / 2 + 2);
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(bred, .2), reg(new THREE.MeshLambertMaterial({ map: t, depthWrite: false })));
    m.rotation.set(-Math.PI / 2, 0, (rnd() - .5) * .06); m.position.set(Math.min(b.x1 - bred / 2, b.x0 + .1 + bred / 2), .004, TZ + DJUP / 2 + .3); m.renderOrder = 2;
    m.userData.abs = !!b.abs; grupp.add(m); etiketter.push(m);
  });

  // lampor och skyltar längs väggen
  const halo = textur(128, 128, (c) => { const g = c.createRadialGradient(64, 64, 2, 64, 64, 64); g.addColorStop(0, "rgba(255,80,40,.9)"); g.addColorStop(.25, "rgba(255,40,20,.35)"); g.addColorStop(1, "rgba(255,20,10,0)"); c.fillStyle = g; c.fillRect(0, 0, 128, 128); });
  const lampFront = reg(new THREE.MeshBasicMaterial({ color: 0xff3a1c }));
  const lampHus = reg(new THREE.MeshLambertMaterial({ color: 0x1a1414 }));
  const haloMat = reg(new THREE.MeshBasicMaterial({ map: halo, blending: THREE.AdditiveBlending, depthWrite: false }), .55);
  const skylt = textur(512, 160, (c, W, H) => {
    c.fillStyle = "#120706"; c.fillRect(0, 0, W, H); c.strokeStyle = "#ff3a1c"; c.lineWidth = 4; c.strokeRect(10, 10, W - 20, H - 20);
    c.fillStyle = "#ff4a26"; c.font = "800 46px 'Public Sans', Arial"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("FRAMKALLNING PÅGÅR", W / 2, H / 2 + 3, W - 60);
  });
  const lapp = textur(512, 200, (c, W, H) => {
    c.fillStyle = "#eee9dd"; c.fillRect(0, 0, W, H);
    c.fillStyle = "#2a2622"; c.font = "500 22px 'IBM Plex Mono', monospace"; c.fillText("MEDDELANDE NR 4", 30, 46);
    c.font = "400 25px 'Public Sans', Arial";
    ["Handlingar som inte har framkallats", "anses inte ha inkommit.", "Ljus tänds först när ärendet är avgjort."].forEach((r, i) => c.fillText(r, 30, 96 + i * 34));
  });
  const skyltMat = reg(new THREE.MeshBasicMaterial({ map: skylt })), lappMat = reg(new THREE.MeshLambertMaterial({ map: lapp }));
  const lampor = [];
  for (let px = vanster + 4, i = 0; px < hoger - 2; px += 9, i++) {
    const hus = new THREE.Mesh(new THREE.BoxGeometry(1, .55, .3), lampHus); hus.position.set(px, 2.15, VZ + .16); grupp.add(hus);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(.86, .41), lampFront); f.position.set(px, 2.15, VZ + .32); grupp.add(f);
    const h = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), haloMat); h.position.set(px, 2.15, VZ + .36); h.renderOrder = 6; grupp.add(h);
    lampor.push(px);
    if (i % 2 === 0) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(1.9, .6), skyltMat); s.position.set(px + 4.5, 1.05, VZ + .02); grupp.add(s);
      const l = new THREE.Mesh(new THREE.PlaneGeometry(1.6, .62), lappMat); l.position.set(px + 6.4, .62, VZ + .02); l.rotation.z = (rnd() - .5) * .04; grupp.add(l);
    }
  }

  // läggningen: varje handling i sitt bad, på sin plats i tiden, i två eller tre lager
  const _p = new THREE.Vector3(), _m = new THREE.Vector3(), _upp = new THREE.Vector3();
  function lagg(lista, rikta, visaAbs) {
    const per = new Map();
    lista.forEach((s) => { const k = s.abs ? "abs" : s.undated ? "ud" : Math.floor(s.v.ar); if (!per.has(k)) per.set(k, []); per.get(k).push(s); });
    per.forEach((l, k) => {
      const b = B.get(k); if (!b) return;
      const rader = l.length <= 2 ? 1 : l.length <= 7 ? 2 : 3, zs = rader === 1 ? [0] : rader === 2 ? [-.62, .62] : [-1.02, 0, 1.02];
      const w = b.x1 - b.x0;
      l.forEach((s, i) => {
        const hb = s.bas.x / 2 + .06;
        let px = s.abs || s.undated ? b.x0 + (i + .5) / l.length * w : x(s.u);
        px = Math.max(b.x0 + Math.min(hb, w / 2), Math.min(b.x1 - Math.min(hb, w / 2), px + (rnd() - .5) * .25));
        const pz = TZ + zs[i % rader] + (rnd() - .5) * .3;
        _p.set(px, .035 + i * .007, pz); _m.copy(_p).y += 1;
        const vr = (rnd() - .5) * .3; _upp.set(Math.sin(vr), 0, -Math.cos(vr));
        rikta(s, _p, _m, _upp);
      });
    });
    absBad.synlig = visaAbs;
  }

  function steg(vikt, tid, panX) {
    grupp.visible = vikt > .004;
    if (!grupp.visible) return;
    mats.forEach(([m, op]) => (m.opacity = op * vikt));
    karAbs.visible = vAbs.visible = absBad.synlig !== false;
    etiketter.forEach((e) => (e.visible = !e.userData.abs || absBad.synlig !== false));
    kTex.offset.set(tid * .012, tid * .007);
  }
  return { grupp, x, u, lagg, steg, lampor, hoger, vanster, VZ, TZ };
}
