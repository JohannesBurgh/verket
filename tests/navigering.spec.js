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
      await expect(page).toHaveURL(new RegExp(`#${r}$`));
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
