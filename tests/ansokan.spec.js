// Ansökan, hela vägen till beslut. Urvalet är slumpat, så varje test prövar flera beslut.
import { test, expect, tabbaTill } from "./stod/fixtur.js";
import { fyllI, lasBeslut, kontrolleraBeslut, vantaPaBeslut } from "./stod/ansokan.js";
import { ANSOKAN } from "./stod/innehall.js";

const CIRKELTEXTER = Object.values(ANSOKAN.cirkel).map((c) => c.text);

test.describe("Ansökan", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("./#ansokan");
    await expect(page.getByRole("heading", { level: 1, name: "Ansökan om kreativ insats" })).toBeVisible();
  });

  test("med mus: frågor, cirkel och beslut med 3 till 4 bilagor", async ({ page, slump }) => {
    await page.getByRole("button", { name: "Påbörja ansökan" }).click();
    await expect(page.locator(".qmeta")).toContainText("Fråga 1 av");
    await fyllI(page, { satt: "mus", slump });
    const b = await lasBeslut(page);
    expect(b.rubrik).toBe("Beslut");
    kontrolleraBeslut(b);

    // Diarienumret följer med från ansökan till beslut.
    await expect(page.locator(".paper.beslut .fields")).toContainText(/\d{4}\/\d{5}/);
    // Cirkeln diarieförs och bedöms.
    await expect(page.locator(".sig svg path")).toHaveCount(1);
    const text = await page.locator(".beslut-text").innerText();
    expect(CIRKELTEXTER.some((c) => text.includes(c)), "Beslutet ska bedöma cirkeln").toBe(true);
  });

  test("med tangentbord: sifferknappar, Tab och Enter", async ({ page, slump, isMobile }) => {
    test.skip(isMobile, "Tangentbord prövas på dator.");
    await tabbaTill(page, "Påbörja ansökan");
    await page.keyboard.press("Enter");
    await expect(page.locator(".qmeta")).toContainText("Fråga 1 av");
    await fyllI(page, { satt: "tangentbord", slump });
    kontrolleraBeslut(await lasBeslut(page));
    // Avstod sökanden från att rita bedöms ingen cirkel.
    await expect(page.locator(".sig")).toHaveCount(0);
  });

  test("tillbaka till föregående fråga behåller svaret", async ({ page }) => {
    await page.getByRole("button", { name: "Påbörja ansökan" }).click();
    await page.locator(".opt").first().click();
    await expect(page.locator(".qmeta")).toContainText("Fråga 2 av");
    await page.getByRole("button", { name: "← Föregående fråga" }).click();
    await expect(page.locator(".qmeta")).toContainText("Fråga 1 av");
    await expect(page.locator(".opt").first()).toHaveAttribute("aria-pressed", "true");
  });

  test("överklagande ger nya bilagor som följer samma regler", async ({ page, slump }) => {
    await page.getByRole("button", { name: "Påbörja ansökan" }).click();
    await fyllI(page, { slump, rita: false });
    const sett = new Set(kontrolleraBeslut(await lasBeslut(page)).map((v) => v.id));
    for (let i = 1; i <= 4; i++) {
      await test.step(`överklagande ${i}`, async () => {
        await page.getByRole("button", { name: "Överklaga beslutet" }).click();
        await expect(page.locator(".paper.beslut h1")).toHaveText("Beslut efter överklagande");
        await expect(page.locator(".beslut-text")).toContainText(`överklagande (${i})`);
        await vantaPaBeslut(page);
        const nya = kontrolleraBeslut(await lasBeslut(page), { antal: [1, 4] });
        for (const v of nya) expect(sett.has(v.id), `${v.id} har redan bifogats och ska ha återkallats`).toBe(false);
        nya.forEach((v) => sett.add(v.id));
      });
    }
  });

  test("förenklat förfarande bifogar bara hjältar", async ({ page }) => {
    await page.getByRole("button", { name: "Förenklat förfarande (jag har bråttom)" }).click();
    await vantaPaBeslut(page);
    await expect(page.locator(".beslut-text")).toContainText("förenklat förfarande");
    kontrolleraBeslut(await lasBeslut(page), { baraHjaltar: true });
    // Och ett överklagande av det förenklade beslutet.
    await page.getByRole("button", { name: "Överklaga beslutet" }).click();
    await vantaPaBeslut(page);
    kontrolleraBeslut(await lasBeslut(page), { baraHjaltar: true, antal: [1, 4] });
  });

  test("förenklat förfarande går att nå mitt i ansökan", async ({ page }) => {
    await page.getByRole("button", { name: "Påbörja ansökan" }).click();
    await page.getByRole("button", { name: "Hoppa till förenklat förfarande" }).click();
    await vantaPaBeslut(page);
    kontrolleraBeslut(await lasBeslut(page), { baraHjaltar: true });
  });

  test("många beslut i följd håller reglerna", async ({ page, slump }) => {
    // Slumpen kan gömma fel som bara syns ibland. Här prövas åtta beslut i rad.
    test.setTimeout(180_000);
    for (let i = 0; i < 4; i++) {
      await test.step(`ansökan ${i + 1}`, async () => {
        await page.getByRole("button", { name: i ? "Ny ansökan" : "Påbörja ansökan" }).click();
        if (i) await page.getByRole("button", { name: "Påbörja ansökan" }).click();
        await fyllI(page, { slump, rita: false });
        kontrolleraBeslut(await lasBeslut(page));
      });
      await test.step(`förenklat ${i + 1}`, async () => {
        await page.getByRole("button", { name: "Ny ansökan" }).click();
        await page.getByRole("button", { name: "Förenklat förfarande (jag har bråttom)" }).click();
        await vantaPaBeslut(page);
        kontrolleraBeslut(await lasBeslut(page), { baraHjaltar: true });
      });
    }
  });

  test("bilagorna öppnas i visaren, och kontaktuppgifterna visas på begäran", async ({ page }) => {
    await page.getByRole("button", { name: "Förenklat förfarande (jag har bråttom)" }).click();
    await vantaPaBeslut(page);
    const b = await lasBeslut(page);
    await page.locator(".bilagor .bilaga").first().click();
    const visare = page.getByRole("dialog");
    await expect(visare).toBeVisible();
    await expect(visare.locator(".vcap b")).toHaveText(b.vanliga[0].titel);
    await page.keyboard.press("Escape");
    await expect(visare).toBeHidden();

    const kontakt = page.locator(".paper.beslut .kontakt");
    await expect(kontakt).toBeHidden();
    await page.getByRole("button", { name: "Begär handläggning" }).click();
    await expect(kontakt).toBeVisible();
    await expect(kontakt).toContainText("E-post");
  });
});
