// Visaren: ett verk i taget. Pilar, knappar, svep, Escape och delbara adresser.
import { test, expect } from "./stod/fixtur.js";
import { VERK } from "./stod/innehall.js";

// Registret visar verken i den här ordningen (se src/vyer/registret.js).
const nyckel = (v) => v.ar ?? (v.kanal === "Absurdimo" && !v.datum ? 3001 : 3000);
const ORDNING = VERK.slice().sort((a, b) => nyckel(a) - nyckel(b) || a.id.localeCompare(b.id));
const N = ORDNING.length;

const visare = (page) => page.getByRole("dialog");
async function visar(page, k) {
  const v = ORDNING[(k + N) % N];
  await expect(visare(page).locator(".vcap b")).toHaveText(v.titel);
  await expect(visare(page).locator(".vcap .mono")).toContainText(`${((k + N) % N) + 1} / ${N}`);
  await expect(page).toHaveURL(new RegExp(`#verk-${v.id}$`));
}

test.describe("Visaren", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("./#registret");
    await expect(page.locator(".grid > button")).toHaveCount(N);
  });

  test("pilarna bläddrar, runt i båda ändar", async ({ page, isMobile }) => {
    test.skip(isMobile, "Piltangenter prövas på dator. Mobilen prövar svep och knappar.");
    await page.locator(".grid > button").first().click();
    await expect(visare(page)).toBeVisible();
    await visar(page, 0);
    await page.keyboard.press("ArrowRight");
    await visar(page, 1);
    await page.keyboard.press("ArrowRight");
    await visar(page, 2);
    await page.keyboard.press("ArrowLeft");
    await visar(page, 1);
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await visar(page, -1);
    await page.keyboard.press("ArrowRight");
    await visar(page, 0);
  });

  test("knapparna Nästa, Förra och Stäng", async ({ page }) => {
    const sista = page.locator(".grid > button").last();
    await sista.click();
    await visar(page, N - 1);
    await visare(page).getByRole("button", { name: "Nästa →" }).click();
    await visar(page, 0);
    await visare(page).getByRole("button", { name: "← Förra" }).click();
    await visar(page, N - 1);
    await visare(page).getByRole("button", { name: "Stäng" }).click();
    await expect(visare(page)).toBeHidden();
    await expect(page).toHaveURL(/#registret$/);
  });

  test("Escape stänger och fokus går tillbaka", async ({ page, isMobile }) => {
    test.skip(isMobile, "Tangentbord prövas på dator.");
    const tredje = page.locator(".grid > button").nth(2);
    await tredje.focus();
    await page.keyboard.press("Enter");
    await visar(page, 2);
    await expect(visare(page).getByRole("button", { name: "Nästa →" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(visare(page)).toBeHidden();
    await expect(tredje).toBeFocused();
    await expect(page).toHaveURL(/#registret$/);
  });

  test("svep med fingret åt vänster visar nästa, åt höger förra", async ({ page, isMobile }) => {
    test.skip(!isMobile, "Svep prövas på mobil, med riktiga pekhändelser.");
    await page.locator(".grid > button").first().click();
    await visar(page, 0);
    const b = await visare(page).locator(".vscen").boundingBox();
    const cdp = await page.context().newCDPSession(page);
    const svep = async (fran, till) => {
      const y = b.y + b.height * 0.5, pt = (x) => [{ x: b.x + b.width * x, y }];
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt(fran) });
      for (let i = 1; i <= 6; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pt(fran + ((till - fran) * i) / 6) });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    };
    await svep(0.75, 0.25);
    await visar(page, 1);
    await svep(0.25, 0.75);
    await visar(page, 0);
  });

  test("en delad adress öppnar rätt verk", async ({ page, slump }) => {
    const k = Math.floor(slump() * N);
    // Som när någon öppnar en delad länk: en ny sidladdning.
    await page.goto("about:blank");
    await page.goto(`./#verk-${ORDNING[k].id}`);
    await expect(visare(page)).toBeVisible();
    await visar(page, k);
  });

  test("en adress som klistras in medan Registret visas öppnar verket", async ({ page, slump }) => {
    const [a, b] = [Math.floor(slump() * N), Math.floor(slump() * N)];
    // Adressfältet ändras utan sidladdning, som när någon klistrar in en länk.
    await page.evaluate((id) => (location.hash = `#verk-${id}`), ORDNING[a].id);
    await expect(visare(page)).toBeVisible();
    await visar(page, a);
    // Och en till medan visaren redan är öppen.
    await page.evaluate((id) => (location.hash = `#verk-${id}`), ORDNING[b].id);
    await visar(page, b);
    await expect(page.locator(".grid > button")).toHaveCount(N);
  });

  // Uppdrag 11: visaren är en dialog. Tabb stannar i den och sidan bakom går inte att nå.
  test("tabb stannar i visaren, och fokus går tillbaka när den stängs", async ({ page, isMobile }) => {
    test.skip(isMobile, "Tangentbord prövas på dator.");
    const forsta = page.locator(".grid > button").first();
    await forsta.focus();
    await page.keyboard.press("Enter");
    await expect(visare(page)).toBeVisible();
    await expect(visare(page)).toHaveAccessibleName(ORDNING[0].titel);
    await expect(page.locator("#app")).toHaveJSProperty("inert", true);
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press(i % 3 ? "Tab" : "Shift+Tab");
      expect(await page.evaluate(() => document.getElementById("visare").contains(document.activeElement)), "Fokus ska stanna i visaren").toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(visare(page)).toBeHidden();
    await expect(page.locator("#app")).toHaveJSProperty("inert", false);
    await expect(forsta).toBeFocused();
  });

  test("en adress till ett verk som inte finns stänger visaren", async ({ page }) => {
    await page.locator(".grid > button").first().click();
    await expect(visare(page)).toBeVisible();
    await page.evaluate(() => (location.hash = "#verk-finns-inte"));
    await expect(visare(page)).toBeHidden();
    await expect(page).toHaveURL(/#registret$/);
  });

  test("varje verk går att visa", async ({ page, isMobile }) => {
    test.skip(isMobile, "Det räcker att bläddra igenom allt på dator.");
    test.setTimeout(120_000);
    await page.locator(".grid > button").first().click();
    for (let k = 0; k < N; k++) {
      const v = ORDNING[k];
      await expect(visare(page).locator(".vcap b")).toHaveText(v.titel);
      // Det nya verket läggs först i scenen, det gamla glider ut efter.
      const m = visare(page).locator(".vscen .m").first();
      if (v.video) await expect(m.locator("video")).toHaveCount(1);
      else if (v.youtube) await expect(m.locator("iframe, .ytstor")).toHaveCount(1);
      else {
        await expect(m.locator("img")).toHaveJSProperty("complete", true);
        expect(await m.locator("img").evaluate((i) => i.naturalWidth), `Bilden till ${v.id}`).toBeGreaterThan(0);
      }
      await page.keyboard.press("ArrowRight");
    }
    await visar(page, 0);
  });
});
