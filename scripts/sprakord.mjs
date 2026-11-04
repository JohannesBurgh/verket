// Letar upp alla texter i koden som ska kunna översättas: t("…") och tDelar("…") i src/ och scripts/delning.mjs,
// och menyns namn i index.html. Används av npm run kontroll.
import fs from "node:fs";
import path from "node:path";

function filer(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? filer(path.join(dir, d.name)) : /\.m?js$/.test(d.name) ? [path.join(dir, d.name)] : []));
}
// Ett strängliteral med "…" eller `…` (utan ${}) direkt efter t( eller tDelar(.
const RE = /\b(?:t|tDelar)\(\s*(?:"((?:[^"\\]|\\.)*)"|`([^`$]*)`)/g;

export function sprakord(rot = process.cwd()) {
  const ord = new Map(); // text → första filen den förekommer i
  // Delningsbilderna och delningssidorna (scripts/delning.mjs) använder samma ordlista.
  for (const f of [...filer(path.join(rot, "src")), path.join(rot, "scripts", "delning.mjs")]) {
    // Kommentarer räknas inte: där står exempel, inte texter.
    const kod = fs.readFileSync(f, "utf8").replace(/^\s*(\/\/|\*|\/\*).*$/gm, "");
    for (const m of kod.matchAll(RE)) {
      const text = m[1] != null ? JSON.parse(`"${m[1]}"`) : m[2];
      if (!ord.has(text)) ord.set(text, path.relative(rot, f));
    }
  }
  const html = fs.readFileSync(path.join(rot, "index.html"), "utf8");
  for (const m of html.matchAll(/data-r="\w+">([^<]+)<\/a>/g)) if (!ord.has(m[1])) ord.set(m[1], "index.html");
  return ord;
}
