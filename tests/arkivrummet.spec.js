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

// Väntar tills korten har landat i rummet efter ett byte (rummet sätter data-overgang under flytten).
async function landat(page) {
  await expect(page.locator(".rum")).not.toHaveAttribute("data-overgang", /.*/, { timeout: 20_000 });
  await page.waitForTimeout(800);
}

// bild: en färdig skärmdump av hela vyn, som ytan skärs ut ur. Annars fotograferas ytan.
async function arRitat(page, vad, helaVyn = null) {
  let bild;
  if (helaVyn) {
    const b = await yta(page).boundingBox(), { width, height } = await sharp(helaVyn).metadata();
    const s = width / page.viewportSize().width, x = Math.max(0, Math.round(b.x * s)), y = Math.max(0, Math.round(b.y * s));
    bild = await sharp(helaVyn).extract({ left: x, top: y, width: Math.min(width - x, Math.round(b.width * s)), height: Math.min(height - y, Math.round(b.height * s)) }).png().toBuffer();
  } else bild = await yta(page).screenshot();
  const { andel, farger } = await analys(bild);
  expect(andel, `${vad}: andel av ytan med innehåll`).toBeGreaterThan(0.02);
  expect(farger, `${vad}: antal färger (bilder ska synas, inte bara ytor)`).toBeGreaterThan(150);
  return bild;
}

test.describe("Arkivrummet", () => {
  test("varje rum i dockan ritar något", async ({ page }, info) => {
    await oppnaRummet(page);
    const n = await rumknappar(page).count();
    // Varje rum har en koreograferad övergång. Tiden räknas per rum, så att ett nytt rum får plats.
    test.setTimeout(60_000 + n * 30_000);
    expect(n, "Dockan ska ha rum").toBeGreaterThan(0);
    // Alla rum och Blås syns i dockan, även på smala skärmar.
    const w = await page.evaluate(() => document.documentElement.clientWidth);
    for (const b of await page.locator(".docka button").all()) {
      const r = await b.boundingBox();
      expect(r.x >= 0 && r.x + r.width <= w, `${await b.textContent()} ska synas i dockan`).toBe(true);
    }
    const bilder = [];
    for (let i = 0; i < n; i++) {
      const knapp = rumknappar(page).nth(i);
      const namn = (await knapp.textContent()).trim();
      await test.step(namn, async () => {
        await knapp.click();
        await expect(knapp).toHaveAttribute("aria-pressed", "true");
        await expect(page.locator('.docka [data-rum][aria-pressed="true"]')).toHaveCount(1);
        await expect(page.locator(".rumnamn b")).toHaveText(namn);
        await landat(page);
        const vyn = await skarmdump(page, info, `09-arkivrummet-${i + 1}-${await knapp.getAttribute("data-rum")}`, { helsida: false });
        bilder.push(await arRitat(page, namn, vyn));
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
    await landat(page);
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
    const [, y, n] = (await ar.textContent()).match(/^(\d{4}) · (\d+) handling(?:ar)?/);
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

  test("full återgivning, med efterbehandling, ritar också", async ({ page }) => {
    // Utan grafikkort börjar rummet förenklat. Besökaren kan ändå välja full återgivning.
    await oppnaRummet(page);
    const knapp = page.locator(".atergivning");
    if ((await knapp.getAttribute("aria-pressed")) !== "true") await knapp.click();
    await expect(knapp).toHaveAttribute("aria-pressed", "true");
    await expect(knapp).toHaveText("Återgivning: full");
    await page.waitForTimeout(1500);
    await arRitat(page, "Full återgivning");
    // Valet sparas och gäller nästa gång.
    await page.reload();
    await expect(page.locator(".atergivning")).toHaveText("Återgivning: full");
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

  // Uppdrag 11: rummet går att använda med bara tangentbordet.
  test("med tangentbord: Enter öppnar en handling, mellanslag på en knapp blåser inte", async ({ page, isMobile }) => {
    test.skip(isMobile, "Tangentbord prövas på dator.");
    await oppnaRummet(page);
    await yta(page).focus();
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(800);
    await page.keyboard.press("Enter");
    const visare = page.getByRole("dialog");
    await expect(visare).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(visare).toBeHidden();
    await expect(yta(page)).toBeFocused();
    // Tidslinjen säger vilket år den står på.
    const tl = page.getByRole("slider", { name: /Tidslinje/ });
    await tl.focus();
    await page.keyboard.press("ArrowRight");
    await expect(tl).toHaveAttribute("aria-valuetext", /^\d{4} · \d+ handling/);
    // Mellanslag på en rumsknapp väljer det rummet. Blås, som annars ligger på mellanslag, ska inte ske.
    const knapp = rumknappar(page).nth(1);
    await knapp.focus();
    await page.keyboard.press(" ");
    await expect(knapp).toHaveAttribute("aria-pressed", "true");
    await landat(page);
    await expect(knapp).toHaveAttribute("aria-pressed", "true");
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
