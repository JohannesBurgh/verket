// Skärmdumpar av varje vy, på dator och mobil, så att Johan kan se sajten utan att köra något.
// Hamnar i tests/utdata/skarmdumpar/<dator|mobil>/ och i artefakten "skarmdumpar" på GitHub.
import { test, expect, lugnt, skarmdump } from "./stod/fixtur.js";
import { besvara, fyllI, ritaCirkel, vantaPaBeslut, UTGANGAR } from "./stod/ansokan.js";
import { ARENDEN } from "./stod/innehall.js";

test.describe("Skärmdumpar", () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === "lugn", "Skärmdumpar tas på dator och mobil.");
  });

  test("ansökan: start, frågorna, cirkeln och beslutet", async ({ page, slump }, info) => {
    await page.goto("./#ansokan");
    await lugnt(page);
    await skarmdump(page, info, "01-ansokan-start");
    await page.getByRole("button", { name: "Påbörja ansökan" }).click();
    await expect(page.locator(".qmeta")).toContainText("Fråga 1 av");
    // En bild av varje slags fråga: val, reglage, bild och ord.
    const sedda = new Set();
    await besvara(page, {
      slump,
      vidFraga: async (typ) => {
        if (sedda.has(typ)) return;
        sedda.add(typ);
        await lugnt(page, 500);
        await skarmdump(page, info, `02-ansokan-fraga-${typ}`);
      },
    });
    // Underskriften, med cirkeln ritad men inte inlämnad.
    await ritaCirkel(page);
    await lugnt(page, 300);
    await skarmdump(page, info, "02-ansokan-underskrift");
    await page.getByRole("button", { name: "Lämna in ansökan" }).click();
    await vantaPaBeslut(page);
    await lugnt(page, 600);
    await skarmdump(page, info, "03-ansokan-beslut");
  });

  test("ansökan: de fyra beslutstyperna", async ({ page, slump }, info) => {
    test.setTimeout(150_000);
    for (const mal of UTGANGAR) {
      await page.goto("./#ansokan");
      await page.getByRole("button", { name: "Påbörja ansökan" }).click();
      await fyllI(page, { slump, mal, rita: true });
      await lugnt(page, 600);
      await skarmdump(page, info, `03-ansokan-beslut-${mal}`);
    }
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

  // Den engelska sidan (uppdrag 9).
  test("den engelska sidan", async ({ page }, info) => {
    test.setTimeout(120_000);
    const bild = async (adress, namn, opt = {}) => {
      await page.goto(adress);
      await expect(page.locator("#app > *").first()).toBeVisible();
      await page.waitForLoadState("networkidle");
      await lugnt(page, 500);
      await skarmdump(page, info, namn, opt);
    };
    await bild("./en/#application", "20-en-ansokan-start");
    await bild("./en/#register", "21-en-registret", { helsida: false });
    await bild("./en/#cases", "22-en-arenden");
    await bild("./en/#case-riksteatern", "23-en-arende");
    await bild("./en/#clients", "24-en-bestallare");
    await page.goto("./en/#application");
    await page.getByRole("button", { name: "Simplified procedure (I am in a hurry)" }).click();
    await expect(page.locator(".paper.beslut .stamp").first()).toHaveClass(/\bgo\b/);
    await lugnt(page, 600);
    await skarmdump(page, info, "25-en-beslut");
  });
});
