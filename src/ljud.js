// Ljud byggda direkt i webbläsaren, inga ljudfiler. Startar först när besökaren klickat.
let ctx = null;
let pa = true;
try { pa = localStorage.getItem("verket-ljud") !== "av"; } catch (e) {}

let gest = false;
const g = () => { gest = true; };
addEventListener("pointerdown", g, { once: true, capture: true });
addEventListener("keydown", g, { once: true, capture: true });
function ac() {
  if (!pa || !gest) return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
  } catch (e) { return null; }
  return ctx;
}
function brus(c, sek) {
  const b = c.createBuffer(1, Math.floor(c.sampleRate * sek), c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource(); s.buffer = b; return s;
}
function kuvert(c, g, topp, a, r, t0 = c.currentTime) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(topp, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + r);
}

/** Stämpeln: en dov duns och ett kort smack. */
export function stampel() {
  const c = ac(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = "sine"; o.frequency.setValueAtTime(140, c.currentTime); o.frequency.exponentialRampToValueAtTime(48, c.currentTime + .18);
  kuvert(c, g, .55, .004, .22); o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + .3);
  const n = brus(c, .08), f = c.createBiquadFilter(), g2 = c.createGain();
  f.type = "lowpass"; f.frequency.value = 1800; kuvert(c, g2, .35, .002, .07);
  n.connect(f).connect(g2).connect(c.destination); n.start();
}
/** Papper som läggs på bordet. */
export function prassel(styrka = 1) {
  const c = ac(); if (!c) return;
  const n = brus(c, .35), f = c.createBiquadFilter(), g = c.createGain();
  f.type = "bandpass"; f.frequency.value = 2600 + Math.random() * 1400; f.Q.value = .7;
  kuvert(c, g, .07 * styrka, .03, .28); n.connect(f).connect(g).connect(c.destination); n.start();
}
/** Ett torrt klick, som en skrivmaskin. */
export function klick() {
  const c = ac(); if (!c) return;
  const n = brus(c, .03), f = c.createBiquadFilter(), g = c.createGain();
  f.type = "highpass"; f.frequency.value = 2200; kuvert(c, g, .12, .001, .025);
  n.connect(f).connect(g).connect(c.destination); n.start();
}
export const arPa = () => pa;
export function satt(v) {
  pa = v;
  try { localStorage.setItem("verket-ljud", v ? "pa" : "av"); } catch (e) {}
}
