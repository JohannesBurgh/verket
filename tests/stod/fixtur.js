// Gemensam grund för alla tester.
// - Vaktar konsolen: sidfel, konsolfel och saknade lokala filer fäller testet.
// - Ger sidan ett frö för Math.random, så att ett fel kan återskapas med VAKT_FRO.
// - Ersätter YouTube-spelaren med en tom ruta (den är tung och ligger utanför vår kontroll).
import fs from "node:fs";
import path from "node:path";
import { test as bas, expect } from "@playwright/test";

export { expect };

// Ett frö per test, härlett ur körningens frö och testets namn.
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export const test = bas.extend({
  fro: async ({}, use, info) => {
    const fro = hash(`${process.env.VAKT_FRO}|${info.project.name}|${info.titlePath.join("›")}`);
    info.annotations.push({ type: "frö", description: `VAKT_FRO=${process.env.VAKT_FRO} (testets frö ${fro})` });
    await use(fro);
  },

  // Slump i testet självt, styrd av samma frö.
  slump: async ({ fro }, use) => {
    let s = fro ^ 0x9e3779b9;
    await use(() => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });
  },

  page: async ({ page, fro, baseURL }, use) => {
    const fel = [];
    const lokal = (url) => !!url && url.startsWith(new URL(baseURL).origin);

    page.on("pageerror", (e) => fel.push(`Sidfel: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() !== "error") return;
      const url = m.location()?.url || "";
      // Typsnitt och YouTube-bilder hämtas utifrån. Om nätet strular är det inte sajtens fel.
      if (/Failed to load resource/.test(m.text()) && !lokal(url)) return;
      fel.push(`Konsolfel: ${m.text()}${url ? ` (${url})` : ""}`);
    });
    page.on("response", (r) => { if (lokal(r.url()) && r.status() >= 400) fel.push(`Saknas: ${r.status()} ${r.url()}`); });

    await page.route(/youtube(-nocookie)?\.com\/embed\//, (r) => r.fulfill({ contentType: "text/html", body: "<body style='margin:0;background:#000'></body>" }));
    await page.addInitScript((fro) => {
      let s = fro >>> 0;
      Math.random = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    }, fro);

    await use(page);
    expect(fel, "Sidan ska inte ge några fel i konsolen").toEqual([]);
  },
});

// Väntar tills typsnitten är på plats och animationer har lagt sig.
export async function lugnt(page, ms = 300) {
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(ms);
}

// Sparar en skärmdump både i rapporten och i utdata/skarmdumpar/<projekt>/, för Johan.
export async function skarmdump(page, info, namn, opt = {}) {
  const mapp = path.join(info.project.outputDir, "..", "skarmdumpar", info.project.name);
  fs.mkdirSync(mapp, { recursive: true });
  const fil = path.join(mapp, `${namn}.png`);
  const bild = await (opt.locator ? opt.locator.screenshot({ path: fil }) : page.screenshot({ path: fil, fullPage: opt.helsida ?? true }));
  await info.attach(namn, { body: bild, contentType: "image/png" });
  return bild;
}

// Trycker Tab tills knappen eller länken med namnet har fokus. Visar att den går att nå med tangentbordet.
export async function tabbaTill(page, namn, max = 40) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    const t = await page.evaluate(() => (document.activeElement?.innerText || document.activeElement?.getAttribute("aria-label") || "").trim());
    if (namn instanceof RegExp ? namn.test(t) : t === namn) return;
  }
  throw new Error(`Hittade inte "${namn}" med Tab efter ${max} tryck.`);
}

// Ingen sida ska kunna skrollas i sidled på mobil. Jämförs med skärmens bredd (clientWidth):
// innerWidth växer med sidan på mobil, när webbläsaren zoomar ut för att få plats med allt.
export async function ingenSidledsskroll(page) {
  const { bred, vy } = await page.evaluate(() => ({ bred: document.documentElement.scrollWidth, vy: document.documentElement.clientWidth }));
  expect(bred, "Sidan ska inte gå att skrolla i sidled").toBeLessThanOrEqual(vy + 1);
}
