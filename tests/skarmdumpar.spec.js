// Skärmdumpar av varje vy, på dator och mobil, så att Johan kan se sajten utan att köra något.
// Hamnar i tests/utdata/skarmdumpar/<dator|mobil>/ och i artefakten "skarmdumpar" på GitHub.
import { test, expect, lugnt, skarmdump } from "./stod/fixtur.js";
import { fyllI } from "./stod/ansokan.js";
import { ARENDEN } from "./stod/innehall.js";

test.describe("Skärmdumpar", () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === "lugn", "Skärmdumpar tas på dator och mobil.");
  });

  test("ansökan: start, fråga, cirkel och beslut", async ({ page, slump }, info) => {
    await page.goto("./#ansokan");
    await lugnt(page);
    await skarmdump(page, info, "01-ansokan-start");
    await page.getByRole("button", { name: "Påbörja ansökan" }).click();
    await expect(page.locator(".qmeta")).toContainText("Fråga 1 av");
    await lugnt(page, 500);
    await skarmdump(page, info, "02-ansokan-fraga");
    // Svara på allt utom ritningen, rita sedan och ta en bild innan ansökan lämnas in.
    while (!(await page.locator(".rita canvas").count())) {
      const nr = (await page.locator(".qmeta").textContent()).match(/Fråga (\d+)/)[1];
      const alt = page.locator(".opt");
      await alt.nth(Math.floor(slump() * (await alt.count()))).click();
      await expect(page.locator(".qmeta")).not.toContainText(`Fråga ${nr} av`);
    }
    await lugnt(page, 400);
    await fyllI(page, { slump });
    await lugnt(page, 600);
    await skarmdump(page, info, "03-ansokan-beslut");
  });

  test("registret och visaren", async ({ page }, info) => {
    await page.goto("./#registret");
    await expect(page.locator(".grid > button").first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    await lugnt(page);
    await skarmdump(page, info, "04-registret", { helsida: false });
    await page.locator(".grid > button img").first().locator("..").click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await lugnt(page, 700);
    await skarmdump(page, info, "05-visaren", { helsida: false });
  });

  test("ärenden och beställare", async ({ page }, info) => {
    await page.goto("./#arenden");
    await lugnt(page, 500);
    await skarmdump(page, info, "06-arenden");
    const forsta = ARENDEN.slice().sort((a, b) => String(b.diarienummer).localeCompare(String(a.diarienummer)))[0];
    if (forsta) {
      await page.goto(`./#arende-${forsta.id}`);
      await page.waitForLoadState("networkidle");
      await lugnt(page, 500);
      await skarmdump(page, info, "07-arende");
    }
    await page.goto("./#bestallare");
    await lugnt(page);
    await skarmdump(page, info, "08-bestallare");
  });
});
