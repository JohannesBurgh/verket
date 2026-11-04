// Papperet i Arkivrummet: struktur, kort, skuggor och kanalkort.
// Samma brus som pappret på resten av sajten (feTurbulence i style.css),
// så att korn, kort och blankett har samma fiber.
import * as THREE from "three";
import { kanalFarg } from "../data.js";

// Samma filter som .paper i style.css, men med fullt kontrastomfång.
const brusSvg = (sida, frekvens, oktaver) =>
  "data:image/svg+xml," + encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${sida}' height='${sida}'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${frekvens}' numOctaves='${oktaver}' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='${sida}' height='${sida}' filter='url(#n)'/></svg>`);

// Reserv om SVG-filtret inte går att rita: enkelt värdebrus.
function reservBrus(c, sida) {
  const d = c.createImageData(sida, sida); let s = 7;
  for (let i = 0; i < d.data.length; i += 4) { s = (s * 16807) % 2147483647; const v = 96 + (s % 64); d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  c.putImageData(d, 0, 0);
}

// Kornet: 240 pixlar, frekvens .9 och två oktaver precis som pappret.
// Pappersstrukturen för korten: grövre botten och fibrer ovanpå.
export function skapaPapper() {
  const sida = 256;
  const korn = document.createElement("canvas"); korn.width = korn.height = 240;
  const yta = document.createElement("canvas"); yta.width = yta.height = sida;
  const kc = korn.getContext("2d"), yc = yta.getContext("2d");
  reservBrus(kc, 240); reservBrus(yc, sida);
  const kornTex = new THREE.CanvasTexture(korn), ytaTex = new THREE.CanvasTexture(yta);
  for (const t of [kornTex, ytaTex]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; }

  const ladda = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
  const klar = Promise.all([ladda(brusSvg(240, .9, 2)), ladda(brusSvg(sida, .22, 4))]).then(([a, b]) => {
    try {
      if (a) { kc.drawImage(a, 0, 0); kornTex.needsUpdate = true; }
      if (b) {
        yc.drawImage(b, 0, 0);
        // fibrer: korta, ljusa och mörka drag i alla riktningar
        let s = 3; const r = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
        yc.lineCap = "round";
        for (let i = 0; i < 520; i++) {
          const x = r() * sida, y = r() * sida, a2 = r() * Math.PI, l = 3 + r() * 14;
          yc.strokeStyle = r() < .5 ? `rgba(255,255,255,${.08 + r() * .14})` : `rgba(0,0,0,${.05 + r() * .1})`; yc.lineWidth = .6 + r() * .8;
          for (const dx of [0, -sida, sida]) for (const dy of [0, -sida, sida]) {
            yc.beginPath(); yc.moveTo(x + dx, y + dy); yc.quadraticCurveTo(x + dx + Math.cos(a2 + .4) * l * .5, y + dy + Math.sin(a2 + .4) * l * .5, x + dx + Math.cos(a2) * l, y + dy + Math.sin(a2) * l); yc.stroke();
          }
        }
        ytaTex.needsUpdate = true;
      }
    } catch (e) { /* reservbruset ligger kvar */ }
  });
  return { korn, kornTex, yta, ytaTex, klar };
}

// Mjuk skugga: en rundad rektangel med lång utfasning.
export function skuggTextur() {
  const cv = document.createElement("canvas"); cv.width = cv.height = 128; const c = cv.getContext("2d");
  c.filter = "blur(14px)"; c.fillStyle = "#000"; c.fillRect(30, 30, 68, 68);
  if (c.filter === "none" || !("filter" in c)) { const g = c.createRadialGradient(64, 64, 10, 64, 64, 64); g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = g; c.fillRect(0, 0, 128, 128); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.NoColorSpace; return t;
}

function radbryt(c, text, max) { const ord = text.split(" "), r = []; let l = ""; ord.forEach((w) => { const t = l ? l + " " + w : w; if (c.measureText(t).width > max && l) { r.push(l); l = w; } else l = t; }); if (l) r.push(l); return r; }

// Ett kort i kanalens färg för verk utan egen bild (YouTube).
export function kanalKort(v) {
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

// Delade värden för alla kortens skuggare.
export const GEMENSAMT = {
  uMork: { value: 0 },   // 0 = vanligt ljus, 1 = mörkrummet
  uTid: { value: 0 },
  uVatten: { value: 1 }, // vätskans krusning på bilderna i badet
};
const PAPPERSVITT = new THREE.Color(0xf2f3ee).convertSRGBToLinear();

// Fotografiets material: belyst papper som kan framkallas.
// uDev: 0 = vitt papper, 1 = färdig bild. Mörka partier kommer först, som i ett riktigt bad.
export function fotoMaterial(yta) {
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff, bumpMap: yta, bumpScale: .55 });
  const u = { uDev: { value: 0 }, uDim: { value: 1 } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u, GEMENSAMT, { uPapper: { value: PAPPERSVITT } });
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
uniform float uDev, uDim, uMork, uTid, uVatten; uniform vec3 uPapper;`)
      .replace("#include <map_fragment>", `
#ifdef USE_MAP
  vec2 kuv = vMapUv + uMork * uVatten * vec2(sin(vMapUv.y * 17. + uTid * 1.3), cos(vMapUv.x * 15. + uTid * 1.1)) * .0035;
  vec4 sampledDiffuseColor = texture2D(map, kuv);
  vec3 foto = sampledDiffuseColor.rgb;
#else
  vec3 foto = uPapper;
#endif
  float lum = dot(foto, vec3(.2126, .7152, .0722));
  vec3 bild = mix(foto, vec3(lum) * vec3(1., .97, .93), uMork * .88);
  float d = clamp(uDev * 1.7 - sqrt(lum) * .7, 0., 1.);
  d = d * d * (3. - 2. * d);
  float fiber = texture2D(bumpMap, vBumpMapUv * 1.7).r;
  vec3 alb = mix(uPapper, bild, d) * (.94 + .08 * fiber);
  diffuseColor.rgb *= alb * uDim;
`);
  };
  m.customProgramCacheKey = () => "verket-foto";
  return { m, u };
}
