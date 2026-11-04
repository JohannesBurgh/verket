// Arkivrummet: att något faktiskt ritas, i varje rum, och att tidslinjen och korten svarar.
// Rummen räknas från dockan, så ett nytt rum prövas automatiskt.
import sharp from "sharp";
import { test, expect, skarmdump } from "./stod/fixtur.js";
import { VERK } from "./stod/innehall.js";

const BAKGRUND = [0x0c, 0x11, 0x14]; // scene.background i src/vyer/arkivrummet.js

// Andel av ytan som inte är bakgrund, och hur många olika färger som syns.
async function analys(bild) {
  const { data, info } = await sharp(bild).raw().toBuffer({ resolveWithObject: true });
  let ritat = 0;
  const farger = new Set();
  for (let i = 0; i < data.length; i += info.channels) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    if (Math.max(Math.abs(r - BAKGRUND[0]), Math.abs(g - BAKGRUND[1]), Math.abs(b - BAKGRUND[2])) > 28) ritat++;
    farger.add((r >> 4) << 8 | (g >> 4) << 4 | (b >> 4));
  }
  return { andel: ritat / (data.length / info.channels), farger: farger.size };
}
async function skillnad(a, b) {
  const [x, y] = await Promise.all([a, b].map((i) => sharp(i).resize(160, 100, { fit: "fill" }).raw().toBuffer()));
  let s = 0;
  for (let i = 0; i < x.length; i++) s += Math.abs(x[i] - y[i]);
  return s / x.length;
}

const yta = (page) => page.locator("canvas.gl");
const rumknappar = (page) => page.locator(".docka [data-rum]");

async function oppnaRummet(page) {
  await page.goto("./#arkivrummet");
  await expect(yta(page)).toBeVisible();
  // "[ handlingarna hämtas ]" tonas bort när bilderna har laddats.
  await expect.poll(() => page.locator(".laddar").evaluate((e) => +getComputedStyle(e).opacity), { timeout: 20_000 }).toBe(0);
  await page.waitForTimeout(1800);
}

async function arRitat(page, vad) {
  const bild = await yta(page).screenshot();
  const { andel, farger } = await analys(bild);
  expect(andel, `${vad}: andel av ytan med innehåll`).toBeGreaterThan(0.02);
  expect(farger, `${vad}: antal färger (bilder ska synas, inte bara ytor)`).toBeGreaterThan(150);
  return bild;
}

test.describe("Arkivrummet", () => {
  test("varje rum i dockan ritar något", async ({ page }, info) => {
    test.setTimeout(120_000);
    await oppnaRummet(page);
    const n = await rumknappar(page).count();
    expect(n, "Dockan ska ha rum").toBeGreaterThan(0);
    const bilder = [];
    for (let i = 0; i < n; i++) {
      const knapp = rumknappar(page).nth(i);
      const namn = (await knapp.textContent()).trim();
      await test.step(namn, async () => {
        await knapp.click();
        await expect(knapp).toHaveAttribute("aria-pressed", "true");
        await expect(page.locator('.docka [data-rum][aria-pressed="true"]')).toHaveCount(1);
        await expect(page.locator(".rumnamn b")).toHaveText(namn);
        await page.waitForTimeout(2200);
        bilder.push(await arRitat(page, namn));
        await skarmdump(page, info, `09-arkivrummet-${i + 1}-${await knapp.getAttribute("data-rum")}`, { helsida: false });
      });
    }
    // Rummen ska se olika ut.
    for (let i = 1; i < bilder.length; i++) expect(await skillnad(bilder[i - 1], bilder[i]), "Två rum i följd ser likadana ut").toBeGreaterThan(2);
  });

  test("sifferknapparna byter rum", async ({ page, isMobile }) => {
    test.skip(isMobile, "Tangentbord prövas på dator.");
    await oppnaRummet(page);
    test.skip((await rumknappar(page).count()) < 2, "Bara ett rum.");
    await page.keyboard.press("2");
    await expect(rumknappar(page).nth(1)).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("1");
    await expect(rumknappar(page).nth(0)).toHaveAttribute("aria-pressed", "true");
  });

  test("Blås blåser omkull allt och landar i ett annat rum", async ({ page }) => {
    await oppnaRummet(page);
    test.skip((await rumknappar(page).count()) < 2, "Bara ett rum.");
    const fore = await page.locator('.docka [data-rum][aria-pressed="true"]').getAttribute("data-rum");
    await page.getByRole("button", { name: "Blås" }).click();
    await expect(page.locator('.docka [data-rum][aria-pressed="true"]')).not.toHaveAttribute("data-rum", fore, { timeout: 5000 });
    await page.waitForTimeout(2200);
    await arRitat(page, "Efter Blås");
  });

  test("tidslinjen lyfter fram ett år och släpper det igen", async ({ page }) => {
    await oppnaRummet(page);
    const tl = page.getByRole("slider", { name: /Tidslinje/ });
    const ar = page.locator(".tidslinje .ar");
    await tl.focus();
    await page.keyboard.press("ArrowRight");
    await expect(ar).toContainText("klicka igen för att släppa");
    // Antalet handlingar för året stämmer med innehållet.
    const [, y, n] = (await ar.textContent()).match(/^(\d{4}) · (\d+) handlingar/);
    const vantat = VERK.filter((v) => v.ar != null && !(v.kanal === "Absurdimo" && !v.datum) && Math.floor(v.ar) === +y).length;
    expect(+n, `Antal handlingar ${y}`).toBe(vantat);
    await page.keyboard.press("ArrowRight");
    await expect(ar).toContainText(String(+y + 1));
    // Escape släpper årsfokus.
    await page.evaluate(() => document.activeElement.blur());
    await page.keyboard.press("Escape");
    await expect(ar).not.toContainText("klicka igen");
    await arRitat(page, "Efter årsfokus");
  });

  test("Absurdimo kan döljas och visas", async ({ page }) => {
    await oppnaRummet(page);
    const knapp = page.getByRole("button", { name: "Absurdimo", exact: true });
    await expect(knapp).toHaveAttribute("aria-pressed", "true");
    await knapp.click();
    await expect(knapp).toHaveAttribute("aria-pressed", "false");
    await knapp.click();
    await expect(knapp).toHaveAttribute("aria-pressed", "true");
  });

  test("ett kort under pekaren går att öppna", async ({ page }) => {
    await oppnaRummet(page);
    const b = await yta(page).boundingBox();
    const tips = page.locator(".rum .tips");
    let traff = null;
    // Sök över ytan tills pekaren står på ett kort och lappen med titeln visas.
    sok: for (let ry = 0.3; ry <= 0.7; ry += 0.1) {
      for (let rx = 0.1; rx <= 0.9; rx += 0.05) {
        await page.mouse.move(b.x + b.width * rx, b.y + b.height * ry);
        const t = await tips.evaluate((e) => (e.style.transform.includes("-9999") ? null : e.firstChild?.textContent || null));
        if (t) { traff = { x: b.x + b.width * rx, y: b.y + b.height * ry, titel: t }; break sok; }
      }
    }
    expect(traff, "Pekaren hittade inget kort i rummet").not.toBeNull();
    await page.mouse.click(traff.x, traff.y);
    const visare = page.getByRole("dialog");
    await expect(visare).toBeVisible();
    await expect(visare.locator(".vcap b")).toHaveText(traff.titel);
    await visare.getByRole("button", { name: "Stäng" }).click();
    await expect(visare).toBeHidden();
  });

  test("rummet stannar när man går ut och ritar igen när man kommer tillbaka", async ({ page }, info) => {
    await oppnaRummet(page);
    const bilder = () => page.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(n / ((performance.now() - t0) / 1000)); }; requestAnimationFrame(f); }));
    const fps = await bilder();
    info.annotations.push({ type: "bildfrekvens", description: `${Math.round(fps)} bilder per sekund` });
    await page.getByRole("link", { name: "Registret" }).click();
    await expect(yta(page)).toHaveCount(0);
    await page.getByRole("link", { name: "Arkivrummet" }).click();
    await expect(yta(page)).toBeVisible();
    await page.waitForTimeout(1500);
    await arRitat(page, "Efter återbesök");
  });
});
