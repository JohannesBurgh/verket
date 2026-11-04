// Registret: alla synliga verk, filter och sök. Väntat antal räknas fram ur content/verk.
import { test, expect } from "./stod/fixtur.js";
import { VERK, sokRegistret } from "./stod/innehall.js";

const poster = (page) => page.locator(".grid > button");
const antalText = (page) => page.locator(".sok .small");

async function forvanta(page, lista, vad) {
  await expect(poster(page), vad).toHaveCount(lista.length);
  await expect(antalText(page)).toHaveText(`${lista.length} st`);
}

test.describe("Registret", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("./#registret");
    await expect(page.getByRole("heading", { level: 1, name: "Registret" })).toBeVisible();
  });

  test("visar alla synliga verk och inga dolda", async ({ page }) => {
    await forvanta(page, VERK, "Alla synliga verk ska finnas i Registret");
    const foton = VERK.filter((v) => v.typ === "foto").length;
    await expect(page.locator(".lead")).toContainText(`${VERK.length} handlingar, varav ${foton} fotografier och ${VERK.length - foton} filmer`);
    // Hjältar märks med stjärna, rörlig bild med ▶.
    await expect(page.locator(".grid > button .w")).toHaveCount(VERK.filter((v) => v.vikt === "hjälte").length);
    await expect(page.locator(".grid > button .k")).toHaveCount(VERK.filter((v) => v.typ !== "foto").length);
  });

  test("ordnat efter år, varje årsrubrik en gång", async ({ page }) => {
    const rubriker = await page.locator(".ar-grupp").allInnerTexts();
    expect(new Set(rubriker).size, `Årsrubrikerna: ${rubriker.join(", ")}`).toBe(rubriker.length);
    const ar = rubriker.filter((r) => /^\d{4}$/.test(r)).map(Number);
    expect(ar, "Åren i stigande ordning").toEqual([...ar].sort((a, b) => a - b));
    // Odaterat och Absurdimo kommer efter alla år.
    const forstaUtanAr = rubriker.findIndex((r) => !/^\d{4}$/.test(r));
    if (forstaUtanAr >= 0) expect(rubriker.slice(forstaUtanAr).every((r) => !/^\d{4}$/.test(r))).toBe(true);
  });

  test("filtret Stilla, Rörligt, Absurdimo och Allt", async ({ page }) => {
    const knapp = (namn) => page.locator(".filters").first().getByRole("button", { name: namn, exact: true });
    const fall = [
      ["Stilla", (v) => v.typ === "foto"],
      ["Rörligt", (v) => v.typ !== "foto"],
      ["Absurdimo", (v) => v.kanal === "Absurdimo"],
      ["Allt", () => true],
    ];
    for (const [namn, f] of fall) {
      await test.step(namn, async () => {
        await knapp(namn).click();
        await expect(knapp(namn)).toHaveAttribute("aria-pressed", "true");
        await forvanta(page, VERK.filter(f), namn);
      });
    }
    await knapp("Stilla").click();
    await expect(page.locator(".grid > button .k")).toHaveCount(0);
  });

  test("filtret för avdelningar", async ({ page }) => {
    const grupp = page.locator(".filters").nth(1);
    const avdelningar = (await grupp.getByRole("button").allInnerTexts()).slice(1);
    expect(avdelningar.sort()).toEqual([...new Set(VERK.map((v) => v.avdelning))].sort());
    for (const avd of avdelningar) {
      await test.step(avd, async () => {
        await grupp.getByRole("button", { name: avd, exact: true }).click();
        await forvanta(page, VERK.filter((v) => v.avdelning === avd), avd);
      });
    }
    // Filtren kan kombineras.
    const avd = avdelningar[0];
    await grupp.getByRole("button", { name: avd, exact: true }).click();
    await page.locator(".filters").first().getByRole("button", { name: "Stilla", exact: true }).click();
    await forvanta(page, VERK.filter((v) => v.avdelning === avd && v.typ === "foto"), `${avd} och Stilla`);
  });

  test("sök på titel, år och kanal", async ({ page, slump }) => {
    const sok = page.getByRole("searchbox", { name: "Sök i registret" });
    // Ett ord ur en slumpvis vald titel, ett år och en kanal, alla hämtade ur innehållet.
    const v = VERK[Math.floor(slump() * VERK.length)];
    const ord = v.titel.split(/\s+/).sort((a, b) => b.length - a.length)[0];
    const ar = VERK.find((x) => x.datum)?.datum.slice(0, 4);
    const kanal = VERK.find((x) => x.kanal)?.kanal;
    for (const q of [ord, ord.toUpperCase(), ar, kanal].filter(Boolean)) {
      await test.step(`"${q}"`, async () => {
        await sok.fill(q);
        const vantat = sokRegistret(q);
        expect(vantat.length).toBeGreaterThan(0);
        await forvanta(page, vantat, `Sökning på "${q}"`);
      });
    }
    await sok.fill("qqxq ingen handling heter så");
    await forvanta(page, [], "Sökning utan träff");
    await expect(page.locator(".tom")).toHaveText("Inga handlingar matchar sökningen.");
    await sok.fill("");
    await forvanta(page, VERK, "Tom sökning");
  });

  test("sök och filter tillsammans", async ({ page }) => {
    const ar = VERK.find((x) => x.datum && x.typ === "foto")?.datum.slice(0, 4);
    test.skip(!ar, "Inget daterat foto att söka på.");
    await page.locator(".filters").first().getByRole("button", { name: "Stilla", exact: true }).click();
    await page.getByRole("searchbox", { name: "Sök i registret" }).fill(ar);
    await forvanta(page, sokRegistret(ar, (v) => v.typ === "foto"), `Stilla och "${ar}"`);
  });

  test("bilderna laddas", async ({ page }) => {
    // Rulla igenom hela registret så att alla bilder hämtas. Saknade filer fäller testet via fixturen.
    const n = await poster(page).count();
    for (let i = 0; i < n; i += 12) await poster(page).nth(i).scrollIntoViewIfNeeded();
    await poster(page).last().scrollIntoViewIfNeeded();
    await page.waitForLoadState("networkidle");
    const trasiga = await page.locator(".grid img").evaluateAll((l) => l.filter((i) => i.complete && i.naturalWidth === 0 && i.src.startsWith(location.origin)).map((i) => i.src));
    expect(trasiga, "Bilder som inte gick att visa").toEqual([]);
  });
});
