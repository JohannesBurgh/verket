// Ansökan 2.0, hela vägen till beslut: frågebank, reglage, bildval, fritt ord, underskrift,
// fyra slags beslut och delbara beslut (#beslut-<kod>). Urvalet är slumpat, så varje test prövar flera beslut.
import { test, expect, tabbaTill } from "./stod/fixtur.js";
import { besvara, fyllI, ritaCirkel, lasBeslut, kontrolleraBeslut, vantaPaBeslut, UTGANGAR, BESLUT } from "./stod/ansokan.js";
import { ANSOKAN } from "./stod/innehall.js";

const BEDOMNING = ["noggrann", "fri", "potatis"].map((k) => ANSOKAN.cirkel[k].text);
const START = { level: 1, name: "Ansökan om kreativ insats" };

test.describe("Ansökan", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("./#ansokan");
    await expect(page.getByRole("heading", START)).toBeVisible();
  });

  test("med mus: frågor, cirkel och beslut", async ({ page, slump }) => {
    await page.getByRole("button", { name: "Påbörja ansökan" }).click();
    await expect(page.locator(".qmeta")).toContainText("Fråga 1 av");
    const typer = new Set();
    await besvara(page, { satt: "mus", slump, vidFraga: (typ) => typer.add(typ) });
    // Strecket syns på ritytan medan sökanden ritar.
    await ritaCirkel(page);
    const streck = await page.locator(".rita canvas").evaluate((c) => {
      if (!c.width || !c.height) return 0;
      const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 128) n++;
      return n / (c.width * c.height);
    });
    expect(streck, "Andel av ritytan som täcks av strecket").toBeGreaterThan(0.005);
    await page.getByRole("button", { name: "Lämna in ansökan" }).click();
    await vantaPaBeslut(page);
    // Varje besök får frågor av alla fyra slag (urval i content/ansokan.json).
    for (const [typ, n] of Object.entries(ANSOKAN.urval)) if (n > 0) expect(typer.has(typ), `En fråga av typen ${typ}`).toBe(true);
    const b = await lasBeslut(page);
    expect(b.rubrik).toBe("Beslut");
    kontrolleraBeslut(b);
    // Cirkeln diarieförs och bedöms. En noggrant ritad cirkel bedöms som noggrann.
    await expect(page.locator(".sig svg path")).toHaveCount(1);
    const text = await page.locator(".beslut-text").innerText();
    expect(BEDOMNING.some((c) => text.includes(c)), "Beslutet ska bedöma cirkeln").toBe(true);
    expect(text, "En noggrant ritad cirkel").toContain(ANSOKAN.cirkel.noggrann.text);
  });

  test("med tangentbord: sifferknappar, piltangenter, Tab och Enter", async ({ page, slump, isMobile }) => {
    test.skip(isMobile, "Tangentbord prövas på dator.");
    await tabbaTill(page, "Påbörja ansökan");
    await page.keyboard.press("Enter");
    await expect(page.locator(".qmeta")).toContainText("Fråga 1 av");
    await fyllI(page, { satt: "tangentbord", slump });
    kontrolleraBeslut(await lasBeslut(page));
    // Avstod sökanden från att rita bedöms ingen cirkel.
    await expect(page.locator(".sig")).toHaveCount(0);
    await expect(page.locator(".beslut-text")).toContainText(ANSOKAN.cirkel.avstod);
  });

  // Var och en av de fyra utgångarna, framkallad med svar som styr mot den.
  for (const mal of UTGANGAR) {
    test(`beslutstypen ${mal}`, async ({ page, slump }) => {
      await page.getByRole("button", { name: "Påbörja ansökan" }).click();
      await fyllI(page, { slump, mal, rita: false });
      const b = kontrolleraBeslut(await lasBeslut(page), { mal });
      await expect(page.locator(".paper.beslut")).toHaveClass(new RegExp(`utgang-${mal}`));
      await expect(page.locator(".paper.beslut .lagrum")).toHaveText(BESLUT[mal].lagrum);
      expect(b.length).toBeGreaterThan(0);
    });
  }

  test("ett delat beslut återskapas från adressen", async ({ page, slump, browser }) => {
    await page.getByRole("button", { name: "Påbörja ansökan" }).click();
    await fyllI(page, { slump });
    const las = async (p) => ({
      ...(await lasBeslut(p)),
      text: await p.locator(".beslut-text").innerText(),
      cirkel: await p.locator(".sig svg path").evaluateAll((e) => e.map((x) => x.getAttribute("d"))),
    });
    const fore = await las(page);
    kontrolleraBeslut(fore);
    const adress = page.url();
    expect(adress).toMatch(/#beslut-[A-Za-z0-9_-]+$/);
    await expect(page.locator(".utskrift")).toContainText(adress);

    // En annan besökare, i en egen webbläsare, öppnar adressen.
    const ctx = await browser.newContext();
    const annan = await ctx.newPage();
    const fel = [];
    annan.on("pageerror", (e) => fel.push(e.message));
    await annan.goto(adress);
    await vantaPaBeslut(annan);
    const efter = await las(annan);
    for (const k of ["typ", "rubrik", "falt", "stampel", "text", "cirkel"]) expect(efter[k], `Det delade beslutet: ${k}`).toEqual(fore[k]);
    expect(efter.vanliga.map((x) => x.verk.id), "Samma bilagor").toEqual(fore.vanliga.map((x) => x.verk.id));
    expect(efter.vind.map((x) => x.verk.id), "Samma vindfrö").toEqual(fore.vind.map((x) => x.verk.id));

    // Det delade beslutet går att överklaga, och reglerna gäller fortfarande.
    await annan.getByRole("button", { name: "Överklaga beslutet" }).click();
    await expect(annan.locator(".paper.beslut h1")).toHaveText("Beslut efter överklagande");
    await vantaPaBeslut(annan);
    kontrolleraBeslut(await lasBeslut(annan), { antal: [1, 4] });
    expect(fel, "Inga sidfel hos den andra besökaren").toEqual([]);
    await ctx.close();
  });

  test("en skadad beslutsadress ger ett begripligt besked", async ({ page }) => {
    await page.goto("./#beslut-intekod");
    await expect(page.getByRole("heading", { level: 1, name: "Beslutet kunde inte återfinnas" })).toBeVisible();
    await page.getByRole("button", { name: "Ny ansökan" }).click();
    await expect(page.getByRole("heading", START)).toBeVisible();
    await expect(page).toHaveURL(/#ansokan$/);
  });

  test("tillbaka till föregående fråga behåller svaret", async ({ page }) => {
    await page.getByRole("button", { name: "Påbörja ansökan" }).click();
    await page.locator(".opt").first().click();
    await expect(page.locator(".qmeta")).toContainText("Fråga 2 av");
    await page.getByRole("button", { name: "← Föregående fråga" }).click();
    await expect(page.locator(".qmeta")).toContainText("Fråga 1 av");
    await expect(page.locator(".opt").first()).toHaveAttribute("aria-pressed", "true");
  });

  test("ordet måste anges eller avstås", async ({ page, slump }) => {
    await page.getByRole("button", { name: "Påbörja ansökan" }).click();
    // Svara tills ordfrågan kommer.
    let sett = false;
    await besvara(page, {
      slump,
      vidFraga: async (typ) => {
        if (typ !== "ord" || sett) return;
        sett = true;
        await page.getByRole("button", { name: "Diarieför ordet" }).click();
        await expect(page.locator(".hint.fel")).toHaveText("Ange ett ord, eller avstå.");
        await expect(page.locator("fieldset input[type=text]")).toBeFocused();
      },
    });
    expect(sett, "Ansökan ska ha en ordfråga").toBe(true);
  });

  test("överklagande ger nya bilagor som följer samma regler", async ({ page, slump }) => {
    await page.getByRole("button", { name: "Påbörja ansökan" }).click();
    await fyllI(page, { slump, rita: false });
    const forsta = await lasBeslut(page);
    const sett = new Set(kontrolleraBeslut(forsta).map((v) => v.id));
    for (let i = 1; i <= 4; i++) {
      await test.step(`överklagande ${i}`, async () => {
        await page.getByRole("button", { name: "Överklaga beslutet" }).click();
        await expect(page.locator(".paper.beslut h1")).toHaveText("Beslut efter överklagande");
        await expect(page.locator(".beslut-text")).toContainText(`överklagande (${i})`);
        await vantaPaBeslut(page);
        const b = await lasBeslut(page);
        // Ett överklagande flyttar beslutet mot bifall. Absurdimo lämnar inte tillbaka ärenden.
        if (forsta.typ === "absurdimo") expect(b.typ).toBe("absurdimo");
        else expect(UTGANGAR.indexOf(b.typ), `Från ${forsta.typ} till ${b.typ}`).toBeLessThanOrEqual(UTGANGAR.indexOf(forsta.typ));
        const nya = kontrolleraBeslut(b, { antal: [1, 4] });
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
    test.setTimeout(240_000);
    for (let i = 0; i < 4; i++) {
      await test.step(`ansökan ${i + 1}`, async () => {
        await page.getByRole("button", { name: i ? "Ny ansökan" : "Påbörja ansökan" }).click();
        if (i) await page.getByRole("button", { name: "Påbörja ansökan" }).click();
        await fyllI(page, { slump, rita: slump() < 0.5 });
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
    // Visaren lämnar beslutets adress orörd.
    await expect(page).toHaveURL(/#beslut-/);

    const kontakt = page.locator(".paper.beslut .kontakt");
    await expect(kontakt).toBeHidden();
    const knapp = page.getByRole("button", { name: "Begär handläggning" });
    await expect(knapp).toHaveAttribute("aria-expanded", "false");
    await knapp.click();
    await expect(kontakt).toBeVisible();
    await expect(knapp).toHaveAttribute("aria-expanded", "true");
    await expect(kontakt).toContainText("E-post");
  });
});
