// En kort sammanfattning på svenska efter varje körning.
// Skrivs till tests/utdata/sammanfattning.md och, i GitHub Actions, till körningens sammanfattningssida.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const UT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../utdata");
const PROJEKT = { dator: "Dator", mobil: "Mobil", lugn: "Dator, utan rörelse" };
const rensa = (s) => String(s || "").replace(/\u001b\[[0-9;]*m/g, "").split("\n").find((r) => r.trim())?.trim().slice(0, 240) || "";

export default class Sammanfattning {
  constructor() { this.tester = []; this.fps = []; }

  onTestEnd(test, result) {
    const fps = test.annotations.find((a) => a.type === "bildfrekvens");
    if (fps) this.fps.push(`${PROJEKT[test.parent.project()?.name] || ""}: ${fps.description}`);
    this.tester.push({ test, result });
  }

  onEnd(res) {
    // Ett test räknas efter sista försöket. Godkänt efter omkörning = ostadigt.
    const sista = new Map();
    for (const t of this.tester) sista.set(t.test, t);
    const rader = {};
    const fel = [], ostadiga = [];
    for (const [test, { result }] of sista) {
      const p = test.parent.project()?.name || "?";
      const r = (rader[p] ||= { ok: 0, fel: 0, ostadig: 0, hopp: 0 });
      const namn = `${PROJEKT[p] || p} › ${test.titlePath().slice(3).join(" › ")}`;
      const utfall = test.outcome();
      if (utfall === "expected") r.ok++;
      else if (utfall === "skipped") r.hopp++;
      else if (utfall === "flaky") { r.ostadig++; ostadiga.push(namn); }
      else { r.fel++; fel.push(`${namn}: ${rensa(result.error?.message)}`); }
    }
    const lyckat = res.status === "passed";
    const md = [
      `## Vakten: ${lyckat ? "allt i ordning" : "fel hittades"}`,
      "",
      "| Miljö | Godkända | Underkända | Ostadiga | Ej tillämpliga |",
      "|---|---|---|---|---|",
      ...Object.entries(rader).map(([p, r]) => `| ${PROJEKT[p] || p} | ${r.ok} | ${r.fel} | ${r.ostadig} | ${r.hopp} |`),
      "",
    ];
    if (fel.length) md.push("### Underkända", "", ...fel.map((f) => `- ${f}`), "");
    if (ostadiga.length) md.push("### Ostadiga (godkända först vid andra försöket)", "", ...ostadiga.map((f) => `- ${f}`), "");
    if (this.fps.length) md.push("### Bildfrekvens i Arkivrummet (informativ, testdatorn saknar grafikkort)", "", ...this.fps.map((f) => `- ${f}`), "");
    md.push(
      `Slumpen i körningen: \`VAKT_FRO=${process.env.VAKT_FRO}\`. Samma värde ger samma urval: \`VAKT_FRO=${process.env.VAKT_FRO} npm test\`.`,
      "",
      "Skärmdumpar från dator och mobil finns i artefakten **skarmdumpar** längst ned på den här sidan. Hela rapporten finns i **testrapport** (öppna `index.html`).",
      "",
    );
    const text = md.join("\n");
    fs.mkdirSync(UT, { recursive: true });
    fs.writeFileSync(path.join(UT, "sammanfattning.md"), text);
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + "\n");
  }

  printsToStdio() { return false; }
}
