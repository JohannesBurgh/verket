// Körs en gång före testerna: tömmer gamla skärmdumpar så att mappen bara visar senaste körningen.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export default function forbered() {
  const mapp = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../utdata/skarmdumpar");
  fs.rmSync(mapp, { recursive: true, force: true });
  console.log(`Vakten kör med VAKT_FRO=${process.env.VAKT_FRO}`);
}
