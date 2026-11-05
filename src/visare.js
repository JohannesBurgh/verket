// Visaren: ett verk i taget, stort. Pilar, svep och Esc. Delas av alla vyer.
import { el, metaRad, kanalFarg, PREVIEW, reduce, storBild } from "./data.js";
import { klick } from "./ljud.js";
import { t, vag, arVy, SPRAK, avdelningNamn } from "./sprak.js";

const root = document.getElementById("visare");
let lista = [], i = 0, stil = "glid", onStep = null, tidigareFokus = null;

const scen = el("div", { class: "vscen" });
const p = el("button", { type: "button", class: "vnav p", "aria-label": t("Föregående") }, "‹");
const n = el("button", { type: "button", class: "vnav n", "aria-label": t("Nästa") }, "›");
scen.append(p, n);
const titel = el("b", { id: "visare-titel" }), meta = el("div", { class: "mono" }), text = el("div", { class: "text" });
const nasta = el("button", { type: "button" }, t("Nästa →"));
const knappar = el("div", { class: "vknappar" },
  el("button", { type: "button", onclick: () => steg(-1) }, t("← Förra")), nasta, el("button", { type: "button", onclick: stang }, t("Stäng")));
root.append(scen, el("div", { class: "vcap" }, el("div", {}, titel, meta, text), knappar));
p.onclick = () => steg(-1); n.onclick = () => steg(1); nasta.onclick = () => steg(1);

function media(v) {
  const m = el("div", { class: "m" });
  if (v.video) m.append(el("video", { src: v.video, controls: true, playsinline: true, poster: v.bild || null, preload: "metadata" }));
  else if (v.youtube && !PREVIEW) m.append(el("iframe", { src: `https://www.youtube-nocookie.com/embed/${v.youtube}?rel=0&modestbranding=1`, title: v.titel, allow: "autoplay; encrypted-media; picture-in-picture; fullscreen", allowfullscreen: true, loading: "lazy" }));
  else if (v.youtube) {
    const [bg, fg] = kanalFarg(v.kanal);
    m.append(el("div", { class: "ytstor", style: `background:${bg};color:${fg}` }, el("small", {}, v.kanal), el("strong", {}, v.titel),
      el("a", { href: "https://www.youtube.com/watch?v=" + v.youtube, target: "_blank", rel: "noopener" }, t("Spela på YouTube"))));
  } else m.append(storBild(v));
  return m;
}
const STILAR = {
  glid: (d) => [[{ transform: "translateX(0)", opacity: 1 }, { transform: `translateX(${-42 * d}%)`, opacity: 0 }], [{ transform: `translateX(${42 * d}%)`, opacity: 0 }, { transform: "none", opacity: 1 }]],
  trumma: (d) => [[{ transform: "rotateY(0)", opacity: 1 }, { transform: `translateX(${-34 * d}%) rotateY(${40 * d}deg)`, opacity: 0 }], [{ transform: `translateX(${34 * d}%) rotateY(${-40 * d}deg)`, opacity: 0 }, { transform: "none", opacity: 1 }]],
  dimma: (d) => [[{ transform: "scale(1)", filter: "blur(0)", opacity: 1 }, { transform: `translateX(${-26 * d}%) scale(.82)`, filter: "blur(10px)", opacity: 0 }], [{ transform: `translateX(${26 * d}%) scale(1.18)`, filter: "blur(10px)", opacity: 0 }, { transform: "none", filter: "blur(0)", opacity: 1 }]],
  vagg: (d) => [[{ transform: "skewX(0)", opacity: 1 }, { transform: `translateX(${-70 * d}%) skewX(${10 * d}deg)`, opacity: .2 }], [{ transform: `translateX(${70 * d}%) skewX(${-10 * d}deg)`, opacity: .2 }, { transform: "none", opacity: 1 }]],
  mork: () => [[{ opacity: 1 }, { opacity: 0 }], [{ filter: "brightness(3.2) grayscale(1) contrast(.6)", opacity: 1 }, { filter: "brightness(1.4) grayscale(.6) contrast(.9)", opacity: 1, offset: .5 }, { filter: "none", opacity: 1 }]],
};
function visa(d) {
  const v = lista[i], gammal = scen.querySelector(".m"), ny = media(v);
  scen.querySelectorAll("video").forEach((x) => x.pause());
  scen.prepend(ny);
  if (gammal) {
    if (d && !reduce) {
      const [ut, inn] = STILAR[stil](d), o = { duration: 440, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" };
      gammal.animate(ut, o).onfinish = () => gammal.remove();
      ny.animate(inn, o);
    } else gammal.remove();
  }
  titel.textContent = v.titel;
  meta.textContent = `${metaRad(v)} · ${avdelningNamn(v.avdelning)} · ${i + 1} / ${lista.length}`;
  text.innerHTML = v.text || "";
  // En text som ännu inte översatts visas på svenska, och märks så att skärmläsaren uttalar den rätt.
  if (v.textSprak && v.textSprak !== SPRAK) text.setAttribute("lang", v.textSprak); else text.removeAttribute("lang");
  if (onStep) onStep(v);
}
// Medan visaren är öppen går det inte att nå sidan bakom, varken med tabb eller skärmläsare.
const BAKOM = ["#hoppa", ".bar", "#app", "#fotnot", ".lamp"];
const bakom = (av) => BAKOM.forEach((s) => { const e = document.querySelector(s); if (e) e.inert = av; });
export function oppna(l, start, opt = {}) {
  lista = l; i = Math.max(0, start); stil = opt.stil || "glid"; onStep = opt.onStep || null;
  if (root.hidden) tidigareFokus = document.activeElement;
  root.hidden = false; bakom(true);
  scen.querySelectorAll(".m").forEach((m) => m.remove());
  visa(0);
  nasta.focus({ preventScroll: true });
}
export function steg(d) { if (!lista.length) return; i = (i + d + lista.length) % lista.length; klick(); visa(d); }
export function stang() {
  if (root.hidden) return;
  scen.querySelectorAll("video").forEach((x) => x.pause());
  scen.querySelectorAll(".m").forEach((m) => m.remove());
  root.hidden = true; bakom(false);
  if (tidigareFokus) tidigareFokus.focus({ preventScroll: true });
  if (arVy("verk")) history.replaceState(null, "", vag("registret"));
}
export const oppen = () => !root.hidden;

let sx = null;
scen.addEventListener("pointerdown", (e) => { if (e.target.closest("video,a,button,iframe")) return; sx = e.clientX; });
scen.addEventListener("pointerup", (e) => { if (sx == null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 50) steg(dx < 0 ? 1 : -1); });
addEventListener("keydown", (e) => {
  if (root.hidden) return;
  if (["Escape", "ArrowRight", "ArrowLeft"].includes(e.key) || /^[1-9]$/.test(e.key)) e.stopImmediatePropagation();
  // Tabb stannar i visaren: från sista knappen till första och tvärtom.
  if (e.key === "Tab") {
    const f = [...root.querySelectorAll("button, a[href], video[controls], iframe")].filter((x) => x.offsetParent !== null || x === document.activeElement);
    if (!f.length) return;
    const forst = f[0], sist = f[f.length - 1], nu = document.activeElement;
    if (e.shiftKey && (nu === forst || !root.contains(nu))) { e.preventDefault(); sist.focus(); }
    else if (!e.shiftKey && (nu === sist || !root.contains(nu))) { e.preventDefault(); forst.focus(); }
    return;
  }
  if (e.key === "Escape") stang();
  else if (e.key === "ArrowRight") { e.preventDefault(); steg(1); }
  else if (e.key === "ArrowLeft") { e.preventDefault(); steg(-1); }
}, true);
