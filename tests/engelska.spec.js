// Den engelska sidan (uppdrag 9): /en/, "The Office for Unexpected Solutions".
// Samma kod och samma verk som den svenska. Testerna ser till att
// - allt som syns är på engelska (bara egennamn och originaltitlar får vara svenska),
// - språkvalet leder till samma vy på det andra språket,
// - ansökan går hela vägen till beslut, med samma regler som på svenska,
// - ett delat beslut är detsamma på båda språken.
import { test, expect, lugnt, ingenSidledsskroll } from "./stod/fixtur.js";
import { fyllI, lasBeslut, ritaCirkel, UTGANGAR } from "./stod/ansokan.js";
import { VERK, ARENDEN, EN, hittaVerkEn, byId } from "./stod/innehall.js";

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Svenska som får synas på den engelska sidan: egennamn, kanaler och de originaltitlar som står kvar på svenska.
const TILLATET = [
  ...VERK.filter((v) => EN.titel(v) === v.titel).map((v) => v.titel),
  // Produktionsnamn som står kvar på svenska framför en engelsk tillägg: "Bäst före?!, interview".
  ...VERK.map((v) => EN.titel(v).split(", ")[0]).filter((n) => n && VERK.some((v) => v.titel.startsWith(n))),
  ...new Set(VERK.map((v) => v.kanal).filter(Boolean)),
  "Söderberg", "Svenska", "Skövde", "Bonnierförlagen", "Kylián", "Natur & Kultur", "Nyköpings gästabud", "Värdet av konst", "Tre Vänner",
].map((s) => s.toLowerCase()).sort((a, b) => b.length - a.length);
async function svenskaKvar(page, rot = "body") {
  // innerText följer CSS (versaler), så jämförelsen görs i gemener.
  let text = (await page.locator(rot).first().innerText()).toLowerCase();
  for (const t of TILLATET) text = text.split(t).join(" ");
  const rader = text.split("\n").filter((r) => /[åäöÅÄÖ]|\b(och|inte|eller|som|från|till|handling|handlingar|ansökan|beslut|bilaga)\b/i.test(r));
  return rader.map((r) => r.trim()).filter(Boolean);
}

test.describe("Den engelska sidan", () => {
  test("huvud, meny och sidtitlar är på engelska", async ({ page }) => {
    await page.goto("./en/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("#brand-namn")).toHaveText(EN.verket.namn);
    await expect(page).toHaveTitle(EN.verket.namn);
    await expect(page.getByRole("heading", { level: 1, name: EN.t("Ansökan om kreativ insats") })).toBeVisible();
    await expect(page.locator('link[rel="alternate"][hreflang="sv"]')).toHaveCount(1);
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveCount(1);
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute("content", "en_GB");

    const lankar = page.locator(".nav a[data-r]");
    const n = await lankar.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      const a = lankar.nth(i);
      const namn = (await a.innerText()).trim();
      expect(namn, "Menyvalet ska vara översatt").not.toMatch(/[åäöÅÄÖ]/);
      await a.click();
      await expect(a).toHaveAttribute("aria-current", "page");
      // Adresserna är engelska: #register, #cases … Föredragningen skriver sitt frö efter namnet.
      await expect(page).toHaveURL(/\/en\/#(application|cases|register|archive|presentation(-[0-9a-z]+)?|clients)$/);
      await expect(page).toHaveTitle(new RegExp(`^(${esc(namn)} · |${esc(EN.verket.namn)}$)`));
    }
    await expect(page.locator("#ljud")).toHaveText(/^Sound (on|off)$/);
  });

  test("ingen svenska kvar i vyerna", async ({ page }) => {
    const publicerade = ARENDEN.filter((a) => EN.arende(a.id));
    const vyer = ["application", "register", "cases", "clients", ...publicerade.map((a) => `case-${a.id}`)];
    for (const vy of vyer) {
      await test.step(vy, async () => {
        await page.goto(`./en/#${vy}`);
        await expect(page.locator("#app .paper").first()).toBeVisible();
        await lugnt(page, 400);
        expect(await svenskaKvar(page), `Svensk text på /en/#${vy}`).toEqual([]);
      });
    }
  });

  test("Registret: engelska titlar, avdelningar och sökning på båda språken", async ({ page }) => {
    await page.goto("./en/#register");
    const v = VERK.find((x) => x.typ === "foto" && EN.titel(x) !== x.titel && x.vikt !== "damm");
    // Avdelningarna heter något på engelska.
    for (const a of new Set(VERK.map((x) => x.avdelning))) await expect(page.locator(".filters button", { hasText: EN.avdelning(a) }).first()).toBeVisible();
    const sok = page.locator("#reg-sok");
    await expect(sok).toHaveAttribute("placeholder", EN.t("Sök titel, år, kanal …"));
    for (const q of [EN.titel(v), v.titel]) {
      await sok.fill(q);
      await expect(page.getByRole("button", { name: new RegExp(`^${esc(EN.titel(v))},`) }).first()).toBeVisible();
    }
    await sok.fill("");
    // Visaren visar den engelska titeln och adressen #work-<id>.
    await page.goto(`./en/#work-${v.id}`);
    await expect(page.locator("#visare")).toBeVisible();
    await expect(page.locator("#visare .vcap b")).toHaveText(EN.titel(v));
    await expect(page.locator("#visare .vknappar button").last()).toHaveText(EN.t("Stäng"));
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/#work-[\w-]+$/);
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/#register$/);
  });

  test("språkvalet leder till samma vy på det andra språket", async ({ page }) => {
    const v = VERK.find((x) => x.typ === "foto");
    await page.goto("./#registret");
    const val = page.locator(".sprakval");
    await expect(val).toHaveAccessibleName("English");
    await expect(val).toHaveAttribute("lang", "en");
    await val.click();
    await expect(page).toHaveURL(/\/en\/#register$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    // En öppen handling följer med.
    // Visaren täcker menyn, men språkvalet räknar om sin adress när det får fokus (Tab).
    await page.goto(`./en/#work-${v.id}`);
    await expect(page.locator("#visare")).toBeVisible();
    await page.locator(".sprakval").focus();
    await expect(page.locator(".sprakval")).toHaveAttribute("href", `../#verk-${v.id}`);
    await page.goto(`./#verk-${v.id}`);
    await expect(page.locator("#visare .vcap b")).toHaveText(v.titel);

    // Ett ärende och föredragningens frö följer också med.
    const a = ARENDEN[0];
    if (a) {
      await page.goto(`./#arende-${a.id}`);
      await page.locator(".sprakval").click();
      await expect(page).toHaveURL(new RegExp(`/en/#case-${esc(a.id)}$`));
    }
    await page.goto("./en/#presentation-abcde");
    await expect(page.locator(".fd")).toBeVisible();
    await page.locator(".sprakval").click();
    await expect(page).toHaveURL(/\/#foredragning-abcde$/);
  });

  test("ett ärende utan engelsk version visas på svenska, med en upplysning", async ({ page }) => {
    const utan = ARENDEN.find((a) => !EN.arende(a.id));
    test.skip(!utan, "Alla publicerade ärenden är översatta.");
    await page.goto(`./en/#case-${utan.id}`);
    await expect(page.locator(".sprak-not")).toHaveText(EN.t("Ärendet har ännu inte översatts. Det återges på svenska."));
    await expect(page.locator(".arende .kropp")).toHaveAttribute("lang", "sv");
  });

  test("ansökan hela vägen till beslut, på engelska", async ({ page, slump }) => {
    await page.goto("./en/");
    await page.getByRole("button", { name: EN.t("Påbörja ansökan") }).click();
    for (let varv = 0; varv < 12; varv++) {
      const rad = (await page.locator(".qmeta > span").first().innerText()).trim();
      if (rad === EN.underskrift) break;
      expect(rad).toMatch(/^Question \d+ of \d+$/);
      const fs = page.locator("fieldset").first();
      expect(await svenskaKvar(page, "fieldset"), "Frågan ska vara på engelska").toEqual([]);
      const typ = ((await fs.getAttribute("class")) || "").replace(/^q-/, "");
      if (typ === "val" || typ === "bild") {
        const alt = fs.locator(typ === "val" ? ".opt" : ".bv");
        await alt.nth(Math.floor(slump() * (await alt.count()))).click();
      } else if (typ === "reglage") {
        await fs.locator('input[type="range"]').fill(String(Math.floor(slump() * 101)));
        await fs.getByRole("button", { name: /^(Next question|Proceed to signature)$/ }).click();
      } else if (typ === "ord") {
        await fs.locator('input[type="text"]').fill("coffee");
        await fs.getByRole("button", { name: "Register the word" }).click();
      } else throw new Error(`Okänd frågetyp ${typ}`);
      await expect(page.locator(".qmeta > span").first()).not.toHaveText(rad);
    }
    await expect(page.locator("fieldset legend")).toHaveText("Draw a circle. The circle will be registered.");
    await ritaCirkel(page);
    await page.getByRole("button", { name: "Submit application" }).click();

    const sida = page.locator(".paper.beslut");
    await expect(sida).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/en\/#decision-[A-Za-z0-9_-]+$/);
    await expect(sida.locator(".stamp").first()).toHaveClass(/\bgo\b/);
    const klass = (await sida.getAttribute("class")) || "";
    const typ = UTGANGAR.find((u) => klass.includes(`utgang-${u}`));
    const B = EN.beslut[typ];
    await expect(sida.locator(".fields")).toContainText(B.utgang);
    expect((await sida.locator(".stamp").first().evaluate((e) => e.firstChild.textContent)).trim()).toBe(B.stampel);
    // Samma regler som på svenska: rätt antal, aldrig samma epok, aldrig damm.
    const bilagor = await sida.locator(".bilagor .bilaga").evaluateAll((els) => els.map((e) => ({ lbl: e.querySelector(".lbl")?.textContent, titel: e.querySelector("b")?.textContent, meta: e.querySelector(".meta")?.textContent })));
    expect(bilagor.length).toBe(B.antal);
    const verk = bilagor.map((b, k) => { expect(b.lbl).toMatch(new RegExp(`^Enclosure ${k + 1}( · |$)`)); return hittaVerkEn(b.titel, b.meta); });
    expect(new Set(verk.map((v) => v.epok)).size, "Aldrig två bilagor ur samma epok").toBe(verk.length);
    verk.forEach((v) => expect(v.vikt, "Aldrig damm bland bilagorna").not.toBe("damm"));
    expect(await svenskaKvar(page, ".paper.beslut"), "Beslutet ska vara på engelska").toEqual([]);
  });

  test("ett delat beslut är detsamma på båda språken", async ({ page, slump }) => {
    await page.goto("./");
    await page.getByRole("button", { name: "Påbörja ansökan" }).click();
    await fyllI(page, { slump });
    const sv = await lasBeslut(page);
    const kod = new URL(page.url()).hash.replace(/^#beslut-/, "");

    // Språkvalet tar med beslutet.
    await page.locator(".sprakval").click();
    await expect(page).toHaveURL(new RegExp(`/en/#decision-${esc(kod)}$`));
    const sida = page.locator(".paper.beslut");
    await expect(sida).toBeVisible();
    await expect(sida).toHaveClass(new RegExp(`utgang-${sv.typ}`));
    const en = await sida.locator(".bilagor .bilaga b, .vind p").allInnerTexts();
    expect(en, "Samma bilagor, i samma ordning, med engelska titlar").toEqual([...sv.vanliga, ...sv.vind].map((b) => EN.titel(b.verk)));

    // En svensk adress (#beslut-…) fungerar också på den engelska sidan.
    await page.goto(`./en/#beslut-${kod}`);
    await expect(page.locator(".paper.beslut")).toHaveClass(new RegExp(`utgang-${sv.typ}`));
    // Och tillbaka.
    await page.goto(`./en/#decision-${kod}`);
    await expect(page.locator(".paper.beslut")).toBeVisible();
    await page.locator(".sprakval").click();
    await expect(page).toHaveURL(new RegExp(`/#beslut-${esc(kod)}$`));
    await expect(page.locator(".paper.beslut .bilagor .bilaga b")).toHaveText(sv.vanliga.map((b) => b.titel));
  });

  test("förenklat förfarande ger bifall med hjältar", async ({ page }) => {
    await page.goto("./en/");
    await page.getByRole("button", { name: EN.t("Förenklat förfarande (jag har bråttom)") }).click();
    const sida = page.locator(".paper.beslut");
    await expect(sida).toBeVisible({ timeout: 15_000 });
    await expect(sida).toHaveClass(/utgang-bifall/);
    await expect(sida.locator(".beslut-text")).toContainText("simplified procedure");
    const titlar = await sida.locator(".bilagor .bilaga b").allInnerTexts();
    titlar.forEach((t) => expect(VERK.find((v) => EN.titel(v) === t)?.vikt).toBe("hjälte"));
  });

  test("Arkivrummet: rummen heter något på engelska", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("./en/#archive");
    await expect(page.locator(".rum canvas.gl")).toBeVisible({ timeout: 20_000 });
    const knappar = page.locator(".docka button[data-rum]");
    await expect(knappar).toHaveText(["Fältet", "Rullen", "Molnet", "Väggen", "Mörkrummet"].map((n) => EN.t(n)));
    await expect(page.locator(".rumnamn b")).toHaveText(EN.t("Fältet"));
    await knappar.last().click();
    await expect(page.locator(".rumnamn b")).toHaveText(EN.t("Mörkrummet"));
    await expect(page.locator(".rum .blas")).toHaveText(EN.t("Blås"));
  });

  test("Föredragningen börjar på engelska", async ({ page }) => {
    await page.goto("./en/#presentation-abcde");
    await expect(page.locator(".fd")).toBeVisible();
    await expect(page.locator(".fd-kontroll .fd-fro")).toHaveText("Seed abcde");
    await expect(page.locator(".fd-oppning .fd-stor")).toContainText("presents", { timeout: 20_000 });
  });

  test("ingen sidledsskroll och hela menyn syns på mobil", async ({ page }, info) => {
    test.skip(info.project.name !== "mobil", "Gäller mobil.");
    for (const vy of ["application", "register", "cases"]) {
      await page.goto(`./en/#${vy}`);
      await expect(page.locator("#app > *").first()).toBeVisible();
      await lugnt(page);
      await ingenSidledsskroll(page);
      const utanfor = await page.locator(".nav a, #ljud").evaluateAll((els) => els.filter((e) => {
        const r = e.getBoundingClientRect();
        return r.left < 0 || r.right > document.documentElement.clientWidth + 1 || r.width === 0;
      }).map((e) => e.textContent));
      expect(utanfor, `Menyval utanför skärmen på /en/#${vy}`).toEqual([]);
    }
  });

  test("delningssidor och delningsbilder finns på engelska", async ({ page, request }) => {
    for (const p of ["en/dela/verket.jpg", ...ARENDEN.map((a) => `en/dela/arende-${a.id}.jpg`)]) {
      const r = await request.get(p);
      expect(r.status(), p).toBe(200);
    }
    for (const a of ARENDEN) {
      const r = await request.get(`en/case/${a.id}/`);
      expect(r.status()).toBe(200);
      const html = await r.text();
      expect(html).toContain('<html lang="en">');
      expect(html).toContain(`#case-${a.id}`);
    }
    // Den som öppnar en delningssida hamnar i ärendet.
    if (ARENDEN[0]) {
      await page.goto(`./en/case/${ARENDEN[0].id}/`);
      await expect(page).toHaveURL(new RegExp(`/en/#case-${esc(ARENDEN[0].id)}$`));
      await expect(page.locator(".arende h1")).toBeVisible();
    }
    expect(byId).toBeTruthy();
  });
});
