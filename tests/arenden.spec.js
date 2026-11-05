// Ärenden och För beställare.
import { test, expect } from "./stod/fixtur.js";
import { ARENDEN, VERKET, byId } from "./stod/innehall.js";

test.describe("Ärenden", () => {
  test("förteckningen visar varje publicerat ärende", async ({ page }) => {
    await page.goto("./#arenden");
    await expect(page.getByRole("heading", { level: 1, name: "Ärenden" })).toBeVisible();
    const poster = page.locator(".arendelista > li");
    await expect(poster).toHaveCount(ARENDEN.length);
    for (const a of ARENDEN) {
      const post = page.locator(`.arendelista a[href="#arende-${a.id}"]`);
      await expect(post.locator("h3")).toHaveText(String(a.titel));
      if (a.diarienummer) await expect(post).toContainText(String(a.diarienummer));
    }
  });

  for (const a of ARENDEN) {
    test(`ärendet ${a.id}: rubrik, uppgifter och bilagor`, async ({ page }) => {
      await page.goto("./#arenden");
      await page.locator(`.arendelista a[href="#arende-${a.id}"]`).click();
      await expect(page).toHaveURL(new RegExp(`#arende-${a.id}$`));
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(String(a.titel));
      if (a.diarienummer) await expect(page.locator(".arende .fields")).toContainText(String(a.diarienummer));
      if (a.omslag && byId[a.omslag]?.bild) await expect(page.locator(".omslag img")).toHaveJSProperty("complete", true);

      // Varje ::verk-rad blir en rad med bilagor, med de verk som är synliga.
      const rader = page.locator(".kropp .bilagerad");
      await expect(rader).toHaveCount(a.verkrader.length);
      const synliga = a.verkrader.map((r) => r.filter((id) => byId[id]));
      for (let i = 0; i < synliga.length; i++) {
        await expect(rader.nth(i).locator(".bilaga")).toHaveCount(synliga[i].length);
        for (let k = 0; k < synliga[i].length; k++) await expect(rader.nth(i).locator(".bilaga b").nth(k)).toHaveText(byId[synliga[i][k]].titel);
      }

      // En bilaga öppnas i visaren, och pilen går vidare till nästa bilaga i ärendet.
      const alla = synliga.flat();
      if (alla.length) {
        await page.locator(".kropp .bilaga").first().click();
        const visare = page.getByRole("dialog");
        await expect(visare.locator(".vcap b")).toHaveText(byId[alla[0]].titel);
        await expect(visare.locator(".vcap .mono")).toContainText(`1 / ${alla.length}`);
        if (alla.length > 1) {
          await visare.getByRole("button", { name: "Nästa →" }).click();
          await expect(visare.locator(".vcap b")).toHaveText(byId[alla[1]].titel);
        }
        await visare.getByRole("button", { name: "Stäng" }).click();
        await expect(visare).toBeHidden();
      }

      await page.getByRole("link", { name: "← Alla ärenden" }).click();
      await expect(page).toHaveURL(/#arenden$/);
    });
  }

  test("ett okänt ärende visar förteckningen", async ({ page }) => {
    await page.goto("./#arende-finns-inte");
    await expect(page.getByRole("heading", { level: 1, name: "Ärenden" })).toBeVisible();
  });
});

test.describe("För beställare", () => {
  test("texten och kontaktuppgifterna visas", async ({ page }) => {
    await page.goto("./#bestallare");
    await expect(page.getByRole("heading", { level: 1, name: "För beställare" })).toBeVisible();
    const kontakt = page.locator(".bestallare .kontakt");
    await expect(kontakt).toBeVisible();
    if (VERKET.epost) await expect(kontakt.getByRole("link", { name: VERKET.epost })).toHaveAttribute("href", `mailto:${VERKET.epost}`);
    else await expect(kontakt).toContainText("Uppgiften kompletteras.");
  });
});
