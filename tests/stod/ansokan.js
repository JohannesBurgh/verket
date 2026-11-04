// Hjälp för att fylla i Ansökan 2.0 och läsa beslutet.
// Frågorna dras ur en frågebank (content/ansokan.json) och har fyra svarstyper: val, reglage,
// bild och ord. Efter frågorna kommer underskriften (en cirkel), handläggningen och ett av
// fyra slags beslut. Okända frågetyper ger ett tydligt fel i stället för ett tyst fel.
import { expect } from "@playwright/test";
import { hittaVerk, ANSOKAN } from "./innehall.js";

export const UTGANGAR = ["bifall", "delvis", "avslag", "absurdimo"];
export const BESLUT = ANSOKAN.beslut;

// Ord som Verkets nyckelordsregister tolkar så att just den utgången blir följden,
// när alla andra svar saknar utslag. Läses ur content/ansokan.json, så att listan följer med.
const tolkadTill = (typ, n) => ANSOKAN.tolkning.find((t) => (t.utslag || {})[typ] >= n && Object.keys(t.utslag).length === 1)?.ord[0];
const neutraltOrd = () => ANSOKAN.tolkning.find((t) => !t.utslag || !Object.keys(t.utslag).length)?.ord[0];
export const STYROD = {
  bifall: neutraltOrd(),
  delvis: tolkadTill("delvis", 1),
  avslag: tolkadTill("avslag", 2),
  absurdimo: tolkadTill("absurdimo", 2),
};
// Ord som inte finns i registret, och ord med flera ord, prövas också i slumpläget.
const SLUMPORD = [...ANSOKAN.tolkning.map((t) => t.ord[0]), "kaffekopp", "råtta", "en cykel", "xyzzy", ""];

const beslutSida = (page) => page.locator(".paper.beslut");
const harUtslag = (x) => !!x && Object.values(x.utslag || {}).some((n) => n > 0);

// Var i ansökan står vi? En fråga, underskriften eller beslutet.
async function lage(page) {
  const t = (await page.locator(".qmeta > span").first().textContent()).trim();
  const m = t.match(/^Fråga (\d+) av (\d+)$/);
  if (m) return { nr: +m[1], av: +m[2] };
  if (t === ANSOKAN.underskrift.rubrik) return { underskrift: true };
  throw new Error(`Förstår inte frågeraden: "${t}"`);
}

// Frågan i banken, hittad via frågetexten som syns på sidan.
async function fragan(page, typ) {
  const text = (await page.locator("fieldset legend").first().textContent()).trim();
  const q = ANSOKAN.fragor.find((f) => f.fraga === text && f.typ === typ);
  if (!q) throw new Error(`Frågan "${text}" (${typ}) finns inte i content/ansokan.json.`);
  return q;
}

// Ritar en cirkel på ritytan med musen.
export async function ritaCirkel(page, { radie = 0.32, varv = 1 } = {}) {
  const yta = page.locator(".rita canvas");
  await expect(yta).toBeVisible();
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const b = await yta.boundingBox();
  const cx = b.x + b.width / 2, cy = b.y + b.height / 2, r = Math.min(b.width, b.height) * radie;
  const n = 48;
  await page.mouse.move(cx + r, cy);
  await page.mouse.down();
  for (let i = 1; i <= n * varv; i++) {
    const a = (i / n) * Math.PI * 2;
    await page.mouse.move(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  await page.mouse.up();
}

/**
 * Besvarar frågorna fram till underskriften.
 * satt: "mus" (klick och skrivning) eller "tangentbord" (sifferknappar, piltangenter, Tab och Enter).
 * slump: funktion som ger 0..1, för att välja svar.
 * mal: en av UTGANGAR. Då väljs svar utan utslag och ett ord som styr mot just den utgången.
 * vidFraga: anropas med (typ, nr) innan varje fråga besvaras, till exempel för skärmdumpar.
 */
export async function besvara(page, { satt = "mus", slump = Math.random, mal = null, vidFraga = null } = {}) {
  const svar = [];
  for (let varv = 0; varv < 20; varv++) {
    const l = await lage(page);
    if (l.underskrift) return svar;
    const fs = page.locator("fieldset").first();
    const typ = ((await fs.getAttribute("class")) || "").replace(/^q-/, "");
    if (vidFraga) await vidFraga(typ, l.nr);

    if (typ === "val" || typ === "bild") {
      const alternativ = fs.locator(typ === "val" ? ".opt" : ".bv");
      const n = await alternativ.count();
      expect(n, `Fråga ${l.nr} (${typ}) ska ha svar att välja`).toBeGreaterThan(0);
      if (typ === "bild") expect(n, "Bildfrågan visar tre handlingar").toBe(3);
      let mojliga = [...Array(n).keys()];
      if (typ === "val" && mal) {
        const q = await fragan(page, "val");
        mojliga = mojliga.filter((k) => !harUtslag(q.svar[k]));
      }
      const k = mojliga[Math.floor(slump() * mojliga.length)];
      svar.push({ typ, svar: (await alternativ.nth(k).innerText()).split("\n").filter(Boolean).pop() });
      if (satt === "tangentbord") await page.keyboard.press(String(k + 1));
      else await alternativ.nth(k).click();
    } else if (typ === "reglage") {
      const q = await fragan(page, "reglage");
      const zoner = q.zoner.map((z, i) => ({ ...z, fran: i ? q.zoner[i - 1].till + 1 : 0 })).filter((z) => z.fran <= z.till);
      const ok = mal ? zoner.filter((z) => !harUtslag(z)) : zoner;
      const z = ok[Math.floor(slump() * ok.length)];
      const v = z.fran + Math.floor(slump() * (z.till - z.fran + 1));
      const inp = fs.locator('input[type="range"]');
      if (satt === "tangentbord") {
        // Reglaget har fokus. Home ger 0, sedan pil höger till värdet.
        await expect(inp).toBeFocused();
        await page.keyboard.press("Home");
        for (let i = 0; i < v; i++) await page.keyboard.press("ArrowRight");
        await expect(inp).toHaveValue(String(v));
        await expect(fs.locator(".lage")).toHaveText(z.etikett);
        await page.keyboard.press("Tab");
        await expect(fs.getByRole("button", { name: /^(Nästa fråga|Till underskrift)$/ })).toBeFocused();
        await page.keyboard.press("Enter");
      } else {
        await inp.fill(String(v));
        await expect(fs.locator(".lage")).toHaveText(z.etikett);
        await fs.getByRole("button", { name: /^(Nästa fråga|Till underskrift)$/ }).click();
      }
      svar.push({ typ, svar: `${v} (${z.etikett})` });
    } else if (typ === "ord") {
      const ord = mal ? STYROD[mal] : SLUMPORD[Math.floor(slump() * SLUMPORD.length)];
      const inp = fs.locator('input[type="text"]');
      if (!ord) {
        const avstar = fs.getByRole("button", { name: /^Avstår/ });
        if (satt === "tangentbord") await tabbaTillKnapp(page, avstar);
        else await avstar.click();
      } else if (satt === "tangentbord") {
        await expect(inp).toBeFocused();
        await page.keyboard.type(ord);
        await page.keyboard.press("Enter");
      } else {
        await inp.fill(ord);
        await fs.getByRole("button", { name: "Diarieför ordet" }).click();
      }
      svar.push({ typ, svar: ord || "(avstår)" });
    } else {
      throw new Error(`Fråga ${l.nr} har svarstypen "${typ}", som testerna inte känner till. Lägg till den i tests/stod/ansokan.js.`);
    }
    // Vänta tills nästa fråga, eller underskriften, har kommit fram.
    await expect(page.locator(".qmeta > span").first()).toHaveText(l.nr < l.av ? `Fråga ${l.nr + 1} av ${l.av}` : ANSOKAN.underskrift.rubrik);
  }
  throw new Error("Ansökan tog aldrig slut.");
}

// Trycker Tab tills knappen har fokus och sedan Enter.
async function tabbaTillKnapp(page, knapp) {
  for (let i = 0; i < 30 && !(await knapp.evaluate((b) => b === document.activeElement)); i++) await page.keyboard.press("Tab");
  await expect(knapp).toBeFocused();
  await page.keyboard.press("Enter");
}

// Underskriften: rita en cirkel och lämna in, eller avstå.
export async function skrivUnder(page, { satt = "mus", rita = true } = {}) {
  await expect(page.locator(".rita canvas")).toBeVisible();
  if (satt === "tangentbord") {
    await tabbaTillKnapp(page, page.getByRole("button", { name: "Avstår från att rita" }));
  } else if (rita) {
    await ritaCirkel(page);
    await page.getByRole("button", { name: "Lämna in ansökan" }).click();
  } else {
    await page.getByRole("button", { name: "Avstår från att rita" }).click();
  }
}

/** Fyller i ansökan från första frågan till beslut. Samma val som besvara() och skrivUnder(). */
export async function fyllI(page, opt = {}) {
  const svar = await besvara(page, opt);
  await skrivUnder(page, opt);
  await vantaPaBeslut(page);
  return svar;
}

export async function vantaPaBeslut(page) {
  await expect(beslutSida(page)).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".paper.beslut .stamp").first()).toHaveClass(/\bgo\b/);
  await expect(page).toHaveURL(/#beslut-[A-Za-z0-9_-]+$/);
  await page.waitForTimeout(450);
}

// Läser beslutet: utgång, bilagor och vilka verk de är.
export async function lasBeslut(page) {
  const sida = beslutSida(page);
  const rubrik = (await sida.locator("h1").innerText()).trim();
  const klass = (await sida.getAttribute("class")) || "";
  const typ = UTGANGAR.find((u) => klass.includes(`utgang-${u}`));
  if (!typ) throw new Error(`Beslutet har ingen känd utgång (klass: "${klass}").`);
  const falt = Object.fromEntries(await sida.locator(".fields > div").evaluateAll((els) =>
    els.map((e) => [e.querySelector("span")?.textContent.trim(), e.querySelector("b")?.textContent.trim()])));
  const stampel = (await sida.locator(".stamp").first().evaluate((e) => e.firstChild.textContent)).trim();
  const vanliga = await sida.locator(".bilagor .bilaga").evaluateAll((els) =>
    els.map((e) => ({ lbl: e.querySelector(".lbl")?.textContent, titel: e.querySelector("b")?.textContent, meta: e.querySelector(".meta")?.textContent, aterkallad: e.classList.contains("aterkallad") })));
  const vind = await sida.locator(".vind").evaluateAll((els) =>
    els.map((e) => ({ lbl: e.querySelector(".mono")?.textContent, titel: e.querySelector("p")?.textContent })));
  expect(vanliga.filter((b) => b.aterkallad), "Ett nytt beslut ska inte ha återkallade bilagor").toEqual([]);
  return {
    typ, rubrik, falt, stampel,
    vanliga: vanliga.map((b) => ({ ...b, verk: hittaVerk(b.titel, b.meta) })),
    vind: vind.map((b) => ({ ...b, verk: hittaVerk(b.titel) })),
  };
}

/**
 * Reglerna för ett beslut:
 * - Utgången är en av fyra, och fält, stämpel och antal bilagor stämmer med content/ansokan.json.
 * - Bilagorna är de vanliga plus högst ett vindfrö.
 * - Aldrig två bilagor ur samma epok, vindfröet inräknat.
 * - Aldrig damm bland de vanliga bilagorna. Vindfröet får vara damm, enligt README.
 * - Aldrig samma verk två gånger, och aldrig dolda verk.
 * - Förenklat förfarande: bifall och bara hjältar.
 * - Absurdimo: första bilagan kommer från Absurdimo.
 * antal: [min, max] för de vanliga bilagorna. Utelämnat: exakt det antal utgången föreskriver.
 */
export function kontrolleraBeslut(b, { antal = null, baraHjaltar = false, mal = null } = {}) {
  const B = BESLUT[b.typ];
  const alla = [...b.vanliga, ...b.vind].map((x) => x.verk);
  const lista = alla.map((v) => `${v.id} (${v.epok || "ingen epok"}, ${v.vikt})`).join(", ");
  if (mal) expect(b.typ, "Svaren styrde mot en viss utgång").toBe(mal);
  if (baraHjaltar) expect(b.typ, "Förenklat förfarande ger bifall").toBe("bifall");
  expect(b.falt["Utgång"], "Fältet Utgång").toBe(B.utgang);
  expect(b.falt["Diarienummer"], "Diarienumret").toMatch(/\d{4}\/\d{5}$/);
  expect(b.stampel, "Stämpeln").toBe(B.stampel);
  const [min, max] = antal || [B.antal, B.antal];
  expect(b.vanliga.length, `Antal bilagor vid ${b.typ}: ${lista}`).toBeGreaterThanOrEqual(min);
  expect(b.vanliga.length, `Antal bilagor vid ${b.typ}: ${lista}`).toBeLessThanOrEqual(max);
  expect(b.vind.length, "Högst ett vindfrö").toBeLessThanOrEqual(1);
  expect(new Set(alla.map((v) => v.id)).size, `Samma verk två gånger: ${lista}`).toBe(alla.length);
  expect(new Set(alla.map((v) => v.epok)).size, `Två bilagor ur samma epok: ${lista}`).toBe(alla.length);
  for (const { verk } of b.vanliga) {
    expect(verk.vikt, `Damm bland bilagorna: ${verk.id}`).not.toBe("damm");
    if (baraHjaltar) expect(verk.vikt, `Förenklat förfarande ska bara bifoga hjältar: ${verk.id}`).toBe("hjälte");
  }
  for (const { verk } of b.vind) expect(verk.vikt, `Vindfröet ska inte vara en hjälte: ${verk.id}`).not.toBe("hjälte");
  if (b.typ === "absurdimo" && !baraHjaltar && b.vanliga.length) expect(b.vanliga[0].verk.kanal, "Ett ärende som överlämnas till Absurdimo börjar med en handling därifrån").toBe("Absurdimo");
  b.vanliga.forEach((x, k) => expect(x.lbl).toMatch(new RegExp(`^Bilaga ${k + 1}( · |$)`)));
  if (b.vind.length) expect(b.vind[0].lbl).toBe(`Bilaga ${b.vanliga.length + 1} · Vindfrö`);
  return alla;
}
