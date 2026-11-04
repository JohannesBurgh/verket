// Hjälp för att fylla i ansökan och läsa beslutet. Skriven för att tåla nya frågor och
// nya svarstyper: okända frågetyper ger ett tydligt fel i stället för ett tyst fel.
import { expect } from "@playwright/test";
import { hittaVerk } from "./innehall.js";

const beslutSida = (page) => page.locator(".paper.beslut");

async function fragaNr(page) {
  const t = await page.locator(".qmeta").first().textContent();
  const m = t.match(/Fråga (\d+) av (\d+)/);
  if (!m) throw new Error(`Förstår inte frågeraden: "${t}"`);
  return { nr: +m[1], av: +m[2] };
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
 * Fyller i ansökan från första frågan till beslut.
 * satt: "mus" (klick och ritning) eller "tangentbord" (sifferknappar och Tab/Enter, ingen ritning).
 * slump: funktion som ger 0..1, för att välja svar.
 */
export async function fyllI(page, { satt = "mus", slump = Math.random, rita = true } = {}) {
  const svar = [];
  for (let varv = 0; varv < 50; varv++) {
    const { nr, av } = await fragaNr(page);
    const fs = page.locator("fieldset").first();
    const alternativ = fs.locator(".opt");
    const n = await alternativ.count();
    if (n > 0) {
      const k = Math.floor(slump() * n);
      svar.push((await alternativ.nth(k).innerText()).split("\n")[0]);
      if (satt === "tangentbord" && k < 9) await page.keyboard.press(String(k + 1));
      else await alternativ.nth(k).click();
    } else if (await fs.locator(".rita canvas").count()) {
      if (satt === "mus" && rita) {
        await ritaCirkel(page);
        await page.getByRole("button", { name: "Lämna in ansökan" }).click();
      } else if (satt === "tangentbord") {
        await page.getByRole("button", { name: "Avstår från att rita" }).focus();
        await page.keyboard.press("Enter");
      } else await page.getByRole("button", { name: "Avstår från att rita" }).click();
    } else if (await fs.locator('input[type="range"]').count()) {
      await fs.locator('input[type="range"]').first().fill(String(Math.round(slump() * 100)));
      await page.getByRole("button", { name: /Nästa|Fortsätt|Lämna in/ }).first().click();
    } else {
      throw new Error(`Fråga ${nr} har en svarstyp som testerna inte känner till. Lägg till den i tests/stod/ansokan.js.`);
    }
    if (nr >= av) break;
    await expect(beslutSida(page).or(page.locator(".qmeta", { hasText: `Fråga ${nr + 1} av` }))).toBeVisible();
    if (await beslutSida(page).count()) break;
  }
  await vantaPaBeslut(page);
  return svar;
}

export async function vantaPaBeslut(page) {
  await expect(beslutSida(page)).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".paper.beslut .stamp.go")).toBeVisible();
  await page.waitForTimeout(450);
}

// Läser bilagorna i beslutet och slår upp vilka verk de är.
export async function lasBeslut(page) {
  const sida = beslutSida(page);
  const rubrik = (await sida.locator("h1").innerText()).trim();
  const vanliga = await sida.locator(".bilagor .bilaga").evaluateAll((els) =>
    els.map((e) => ({ lbl: e.querySelector(".lbl")?.textContent, titel: e.querySelector("b")?.textContent, meta: e.querySelector(".meta")?.textContent })));
  const vind = await sida.locator(".vind").evaluateAll((els) =>
    els.map((e) => ({ lbl: e.querySelector(".mono")?.textContent, titel: e.querySelector("p")?.textContent })));
  return {
    rubrik,
    vanliga: vanliga.map((b) => ({ ...b, verk: hittaVerk(b.titel, b.meta) })),
    vind: vind.map((b) => ({ ...b, verk: hittaVerk(b.titel) })),
  };
}

/**
 * Reglerna för ett beslut:
 * - 3 till 4 bilagor (tre vanliga och ett vindfrö).
 * - Aldrig två bilagor ur samma epok.
 * - Aldrig damm bland de vanliga bilagorna. Vindfröet får vara damm, enligt README.
 * - Aldrig samma verk två gånger, och aldrig dolda verk.
 */
export function kontrolleraBeslut(b, { antal = [3, 4], baraHjaltar = false } = {}) {
  const alla = [...b.vanliga, ...b.vind].map((x) => x.verk);
  const lista = alla.map((v) => `${v.id} (${v.epok || "ingen epok"}, ${v.vikt})`).join(", ");
  expect(alla.length, `Antal bilagor: ${lista}`).toBeGreaterThanOrEqual(antal[0]);
  expect(alla.length, `Antal bilagor: ${lista}`).toBeLessThanOrEqual(antal[1]);
  expect(b.vind.length, "Högst ett vindfrö").toBeLessThanOrEqual(1);
  expect(new Set(alla.map((v) => v.id)).size, `Samma verk två gånger: ${lista}`).toBe(alla.length);
  expect(new Set(alla.map((v) => v.epok)).size, `Två bilagor ur samma epok: ${lista}`).toBe(alla.length);
  for (const { verk } of b.vanliga) {
    expect(verk.vikt, `Damm bland bilagorna: ${verk.id}`).not.toBe("damm");
    if (baraHjaltar) expect(verk.vikt, `Förenklat förfarande ska bara bifoga hjältar: ${verk.id}`).toBe("hjälte");
  }
  for (const { verk } of b.vind) expect(verk.vikt, `Vindfröet ska inte vara en hjälte: ${verk.id}`).not.toBe("hjälte");
  b.vanliga.forEach((x, k) => expect(x.lbl).toBe(`Bilaga ${k + 1}`));
  if (b.vind.length) expect(b.vind[0].lbl).toContain(`Bilaga ${b.vanliga.length + 1}`);
  return alla;
}
