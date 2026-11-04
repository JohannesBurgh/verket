// Föredragningen i Arkivrummet (uppdrag 10): samma föredragning som #foredragning-<frö>,
// men kameran åker mellan korten i rummet i takt med sekvensen.
import { test, expect, skarmdump, ingenSidledsskroll } from "./stod/fixtur.js";

const TECKEN = "abcdefghjkmnpqrstuvwxyz23456789";
// Ett frö för föredragningen, styrt av testets frö.
const froFor = (slump) => Array.from({ length: 5 }, () => TECKEN[Math.floor(slump() * TECKEN.length)]).join("");

const spelaren = (page) => page.locator(".fd-rum");
// Den spelare som visas just nu: i rummet eller utan.
const fd = (page) => page.locator(".fd");
const avsnitt = (page) => fd(page).getAttribute("data-avsnitt");

// Genomgångarna görs i ett mindre fönster: rummet ritas i mjukvara på testdatorerna, och färre pixlar går fortare.
const mindre = (page) => page.setViewportSize({ width: 1024, height: 640 });

async function oppna(page, fro) {
  await page.goto(`./#arkivrummet-foredragning-${fro}`);
  await expect(spelaren(page)).toBeVisible();
  // "Föredragningen förbereds" försvinner när rummets handlingar är hämtade.
  await expect(spelaren(page).locator(".fd-laddar")).toHaveClass(/klar/, { timeout: 30_000 });
}
async function pausa(page) {
  await page.keyboard.press(" ");
  await expect(fd(page).locator(".fd-paus")).toHaveAttribute("aria-pressed", "true");
}
// Hoppar ett avsnitt framåt och väntar tills det nya avsnittet syns.
async function nasta(page) {
  const fore = await fd(page).locator(".fd-tid").textContent();
  await page.keyboard.press("ArrowRight");
  await expect(fd(page).locator(".fd-tid")).not.toHaveText(fore);
  const rum = await page.locator(".rum").count() ? await page.locator(".rum").getAttribute("data-rum") : null;
  return { typ: await avsnitt(page), rum, live: await fd(page).locator(".fd-sr").textContent() };
}

test.describe("Föredragningen i Arkivrummet", () => {
  // Rummet ritas i mjukvara på testdatorerna. Att ladda det tar tid, och här laddas det ofta två gånger.
  test.describe.configure({ timeout: 150_000 });

  test("knappen i rummet startar en föredragning med ett frö i adressen", async ({ page }) => {
    await page.goto("./#arkivrummet");
    await expect(page.locator("canvas.gl")).toBeVisible();
    await page.getByRole("button", { name: "Föredra arkivet" }).click();
    await expect(page).toHaveURL(/#arkivrummet-foredragning-[0-9a-z]+$/);
    await expect(spelaren(page)).toBeVisible();
    await expect(page).toHaveTitle(/^Föredragningen i Arkivrummet · /);
    // Rummets egna reglage göms medan föredragningen pågår, och menyn visar fortfarande Arkivrummet.
    await expect(page.locator(".rum .hud")).toBeHidden();
    await expect(page.locator('.nav a[aria-current="page"]')).toHaveAttribute("data-r", "arkivrummet");
    await expect(spelaren(page).locator(".fd-laddar")).toHaveClass(/klar/, { timeout: 30_000 });
    await expect(spelaren(page).getByRole("button", { name: "Paus" })).toBeVisible();
  });

  test("en adress utan frö får ett", async ({ page }) => {
    await page.goto("./#arkivrummet-foredragning");
    await expect(page).toHaveURL(/#arkivrummet-foredragning-[0-9a-z]+$/);
    await expect(spelaren(page)).toBeVisible();
  });

  test("kameran går mellan korten, rummet byts för varje paragraf, och urvalet är detsamma som utan rummet", async ({ page, slump, isMobile }, info) => {
    test.skip(isMobile, "Genomgången görs på dator. Mobilens utseende prövas för sig.");
    test.setTimeout(300_000);
    await mindre(page);
    const fro = froFor(slump);
    await oppna(page, fro);
    await pausa(page);
    const sedda = [], rum = [];
    for (let n = 0; n < 60; n++) {
      const a = await nasta(page);
      sedda.push(a);
      if (rum.at(-1) !== a.rum) rum.push(a.rum);
      if (/^Bilaga/.test(a.live)) {
        // Lappen och sökaren hör till samma verk som avsnittet. Sökaren ligger på kortet, inne i rummet.
        const titel = a.live.match(/^Bilaga \d+ av \d+\. (.+?)\. /)[1];
        if (a.typ !== "blixt") {
          // (utan rörelse tonas avsnitten över i varandra; det gamla har klassen fd-gammal)
          const sokare = spelaren(page).locator(".fd-seg:not(.fd-gammal) .rf-sokare");
          await expect.poll(async () => {
            const r = await sokare.evaluate((e) => { const b = e.getBoundingClientRect(); return e.style.visibility === "hidden" ? null : { x: b.x, y: b.y, w: b.width, h: b.height }; });
            const v = page.viewportSize();
            return !!r && r.w > 40 && r.h > 30 && r.x > -r.w / 2 && r.y > -r.h / 2 && r.x + r.w / 2 < v.width && r.y + r.h / 2 < v.height;
          }, { message: `Sökaren ska ligga på kortet för "${titel}"`, timeout: 15_000 }).toBe(true);
        }
        if (a.typ !== "snabb" && a.typ !== "blixt") await expect(spelaren(page).locator(".fd-seg:not(.fd-gammal)").locator(".fd-lapp b, .fd-absetikett b")).toHaveText(titel);
      }
      if (a.typ === "hjalte") { await page.waitForTimeout(1500); await skarmdump(page, info, "10-foredragning-i-rummet-hjalte", { helsida: false }); }
      if (a.typ === "slut") break;
    }
    expect(sedda.at(-1).typ, "Föredragningen ska gå att bläddra till slutet").toBe("slut");
    expect(sedda.filter((a) => /^Bilaga/.test(a.live)).length, "Verk i föredragningen").toBeGreaterThan(5);
    // Inledningen i Väggen, sedan Fältet, Rullen, Molnet och Mörkrummet, i den ordningen.
    expect(rum.filter((r) => r !== "vagg"), "Rummen i föredragningen").toEqual(["falt", "rulle", "moln", "mork"]);
    await expect(spelaren(page).getByRole("heading", { name: "Föredragningen är avslutad." })).toBeVisible();

    // Samma frö utan rummet: samma avsnitt, samma verk, i samma ordning.
    await page.goto(`./#foredragning-${fro}`);
    await expect(page.locator(".fd:not(.fd-rum) .fd-laddar")).toHaveClass(/klar/, { timeout: 30_000 });
    await pausa(page);
    const utan = [];
    for (let n = 0; n < 60; n++) { const a = await nasta(page); utan.push(a.live); if (a.typ === "slut") break; }
    expect(sedda.map((a) => a.live), "Samma föredragning i rummet som utan").toEqual(utan);
  });

  test("Utan rummet fortsätter på samma ställe, och tillbaka", async ({ page, slump, isMobile }) => {
    test.skip(isMobile, "Prövas på dator.");
    await mindre(page);
    const fro = froFor(slump);
    await oppna(page, fro);
    await pausa(page);
    for (let n = 0; n < 4; n++) await nasta(page);
    const [tid, typ] = [await spelaren(page).locator(".fd-tid").textContent(), await avsnitt(page)];
    await spelaren(page).getByRole("button", { name: "Utan rummet" }).click();
    await expect(page).toHaveURL(new RegExp(`#foredragning-${fro}$`));
    const utan = page.locator(".fd:not(.fd-rum)");
    await expect(utan.locator(".fd-laddar")).toHaveClass(/klar/, { timeout: 30_000 });
    await expect(utan.locator(".fd-tid")).toHaveText(tid);
    await expect(utan).toHaveAttribute("data-avsnitt", typ);
    await utan.getByRole("button", { name: "I Arkivrummet" }).click();
    await expect(page).toHaveURL(new RegExp(`#arkivrummet-foredragning-${fro}$`));
    await expect(spelaren(page).locator(".fd-laddar")).toHaveClass(/klar/, { timeout: 30_000 });
    await expect(spelaren(page).locator(".fd-tid")).toHaveText(tid);
  });

  test("Escape avslutar, och rummet går att använda som vanligt igen", async ({ page, slump }) => {
    await oppna(page, froFor(slump));
    await page.keyboard.press("Escape");
    await expect(spelaren(page)).toHaveAttribute("data-avsnitt", "slut");
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/#arkivrummet$/);
    await expect(spelaren(page)).toHaveCount(0);
    await expect(page.locator(".rum .hud")).toBeVisible();
    await expect(page.locator('.docka [data-rum][aria-pressed="true"]')).toHaveCount(1);
    // Rummet svarar på dockan igen.
    const forsta = page.locator(".docka [data-rum]").first();
    await forsta.click();
    await expect(forsta).toHaveAttribute("aria-pressed", "true");
  });

  test("på mobil ryms kontrollerna och sidan går inte att skrolla i sidled", async ({ page, slump, isMobile }, info) => {
    test.skip(!isMobile, "Prövas på mobil.");
    await oppna(page, froFor(slump));
    await pausa(page);
    for (let n = 0; n < 3; n++) await nasta(page);
    await page.waitForTimeout(1500);
    const w = await page.evaluate(() => document.documentElement.clientWidth);
    for (const b of await spelaren(page).locator(".fd-knappar button:visible").all()) {
      const r = await b.boundingBox();
      expect(r.x >= 0 && r.x + r.width <= w + 1, `${await b.getAttribute("aria-label")} ska synas`).toBe(true);
    }
    await ingenSidledsskroll(page);
    await skarmdump(page, info, "10-foredragning-i-rummet", { helsida: false });
  });
});
