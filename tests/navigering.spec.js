// Menyn, adresserna och det som gäller alla vyer.
import { test, expect, ingenSidledsskroll, lugnt } from "./stod/fixtur.js";
import { VERKET } from "./stod/innehall.js";

test.describe("Navigering", () => {
  test("varje menyval leder till sin vy och markeras i menyn", async ({ page }) => {
    await page.goto("./");
    await expect(page.locator("#brand-namn")).toHaveText(VERKET.namn);
    const lankar = page.locator(".nav a[data-r]");
    const antal = await lankar.count();
    expect(antal, "Menyn ska ha länkar").toBeGreaterThan(0);
    for (let i = 0; i < antal; i++) {
      const a = lankar.nth(i);
      const [namn, r] = [(await a.innerText()).trim(), await a.getAttribute("data-r")];
      await a.click();
      // Föredragningen skriver sitt frö i adressen (#foredragning-<frö>), så att den kan delas.
      await expect(page).toHaveURL(new RegExp(r === "foredragning" ? `#${r}-[0-9a-z]+$` : `#${r}$`));
      await expect(a, `${namn} ska vara markerad`).toHaveAttribute("aria-current", "page");
      await expect(page.locator('.nav a[aria-current="page"]')).toHaveCount(1);
      await expect(page.locator("#app > *").first()).toBeVisible();
      // Titeln sätts när vyn är klar. Arkivrummet laddas för sig och kan dröja.
      const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      await expect(page, `Sidtiteln för ${namn}`).toHaveTitle(new RegExp(`^(${esc(namn)} · |${esc(VERKET.namn)}$)`));
    }
  });

  test("en okänd adress visar ansökan", async ({ page }) => {
    await page.goto("./#finns-inte");
    await expect(page.getByRole("heading", { level: 1, name: "Ansökan om kreativ insats" })).toBeVisible();
    // Adressen rättas, så att menyn visar var man är (uppdrag 11).
    await expect(page).toHaveURL(/#ansokan$/);
    await expect(page.locator('.nav a[aria-current="page"]')).toHaveAttribute("data-r", "ansokan");
    // En adress som inte går att avkoda får inte stoppa sajten.
    await page.goto("./#%E0%A4%A");
    await expect(page.getByRole("heading", { level: 1, name: "Ansökan om kreativ insats" })).toBeVisible();
  });

  test("hopplänken leder förbi menyn", async ({ page, isMobile }) => {
    test.skip(isMobile, "Tangentbord prövas på dator.");
    await page.goto("./#registret");
    await expect(page.locator(".grid > button").first()).toBeVisible();
    await page.keyboard.press("Tab");
    const hopp = page.getByRole("link", { name: "Till innehållet" });
    await expect(hopp).toBeFocused();
    await expect(hopp).toBeInViewport();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 1, name: "Registret" })).toBeFocused();
    await expect(page).toHaveURL(/#registret$/);
  });

  test("ett ärende har sitt namn i sidans titel", async ({ page }) => {
    await page.goto("./#arenden");
    const lank = page.locator(".arendelista a").first();
    const namn = (await lank.locator("h3").innerText()).trim();
    await lank.click();
    await expect(page).toHaveTitle(new RegExp(`^${namn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} · `));
  });

  test("fotnoten syns överallt utom i Arkivrummet", async ({ page }) => {
    await page.goto("./#registret");
    await expect(page.locator("#fotnot")).toBeVisible();
    await page.goto("./#arkivrummet");
    await expect(page.locator("#fotnot")).toBeHidden();
  });

  test("ljudknappen slår av och på och minns valet", async ({ page }) => {
    await page.goto("./");
    const knapp = page.locator("#ljud");
    const fore = await knapp.getAttribute("aria-pressed");
    await knapp.click();
    const efter = fore === "true" ? "false" : "true";
    await expect(knapp).toHaveAttribute("aria-pressed", efter);
    await expect(knapp).toHaveText(efter === "true" ? "Ljud på" : "Ljud av");
    await page.reload();
    await expect(page.locator("#ljud")).toHaveAttribute("aria-pressed", efter);
  });

  test("hela menyn och ljudknappen syns utan att skrollas fram", async ({ page }) => {
    const vyer = ["ansokan", "registret", "arkivrummet"];
    for (const vy of vyer) {
      await page.goto(`./#${vy}`);
      await expect(page.locator("#app > *").first()).toBeVisible();
      await lugnt(page);
      await test.step(vy, async () => {
        const utanfor = await page.locator(".nav a, #ljud").evaluateAll((els) => {
          const w = document.documentElement.clientWidth;
          return els.filter((e) => {
            const r = e.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
            // Helt på skärmen, och inget annat ligger ovanpå.
            return r.left < 0 || r.right > w || !r.width || !e.contains(document.elementFromPoint(x, y));
          }).map((e) => e.textContent.trim());
        });
        expect(utanfor, "Menyval som inte syns").toEqual([]);
        // Menyraden täcker inte mer än en tredjedel av skärmen.
        const { bar, h } = await page.evaluate(() => ({ bar: document.querySelector(".bar").offsetHeight, h: innerHeight }));
        expect(bar, "Menyradens höjd").toBeLessThan(h / 3);
      });
    }
  });

  test("ingen vy går att skrolla i sidled", async ({ page }) => {
    await page.goto("./");
    const vyer = await page.locator(".nav a[data-r]").evaluateAll((l) => l.map((a) => a.dataset.r));
    for (const vy of vyer) {
      await page.goto(`./#${vy}`);
      await expect(page.locator("#app > *").first()).toBeVisible();
      await lugnt(page);
      await test.step(vy, () => ingenSidledsskroll(page));
    }
  });
});
