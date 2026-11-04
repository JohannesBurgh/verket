// Vakten: Playwright-tester för Verket för oväntade lösningar.
// Kör: npm test        (bygger sajten och testar den färdiga versionen)
// Se:  npm run test:rapport
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const ROT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.VAKT_PORT || 4173);
const CI = !!process.env.CI;

// Ett frö för hela körningen. Varje test härleder sitt eget ur det. Skriv VAKT_FRO=<tal> för att köra om exakt samma slump.
process.env.VAKT_FRO ||= String(Math.floor(Math.random() * 1e9));

const dator = { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } };

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.js",
  outputDir: "utdata/resultat",
  globalSetup: "./stod/forbered.js",
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 2 : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ["list"],
    ["html", { outputFolder: "utdata/rapport", open: "never" }],
    ["./stod/sammanfattning.js"],
  ],
  use: {
    baseURL: `http://127.0.0.1:${PORT}/`,
    locale: "sv-SE",
    timezoneId: "Europe/Stockholm",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "dator", use: dator },
    { name: "mobil", use: { ...devices["Pixel 7"] } },
    // Samma sak med prefers-reduced-motion: allt ska fungera utan rörelse.
    { name: "lugn", use: { ...dator, reducedMotion: "reduce" } },
  ],
  // Testerna körs mot den byggda sajten, alltså det som faktiskt publiceras.
  // I GitHub Actions byggs sajten i ett eget steg innan testerna körs.
  webServer: {
    command: `${CI ? "" : "npm run build && "}npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    cwd: ROT,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !CI,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
