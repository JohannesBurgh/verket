// Vite-konfiguration. Läser allt innehåll i content/ vid bygget och gör det
// tillgängligt för sajten som modulen "virtual:arkiv". Ingen databas behövs.
import { defineConfig } from "vite";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";
import delning from "./scripts/delning.mjs";
import sprak, { lasEngelska } from "./scripts/sprak.mjs";

const CONTENT = path.resolve("content");
const ID = "virtual:arkiv";
const RID = "\0" + ID;

function readDir(dir) {
  const p = path.join(CONTENT, dir);
  return fs.existsSync(p) ? fs.readdirSync(p).filter((f) => f.endsWith(".md")).sort() : [];
}

// "::verk id id id" i ett ärende blir en rad med bilagor.
function renderBody(md) {
  const html = marked.parse(
    md.replace(/^::verk\s+(.+)$/gm, (_, ids) => `\n<div class="bilagerad" data-verk="${ids.trim().split(/\s+/).join(" ")}"></div>\n`),
  );
  return html.replace(/<!--[\s\S]*?-->/g, "");
}

// Ett ärende med "utkast: true" visas när Johan kör npm run dev men lämnas
// utanför npm run build. Allt annat än ett uttryckligt false räknas som utkast,
// så att ett felskrivet värde hellre döljer ärendet än publicerar det.
const arUtkast = (data) => data.utkast != null && data.utkast !== false;

function load({ medUtkast = false } = {}) {
  const fel = [];
  const verk = readDir("verk").map((f) => {
    const id = f.replace(/\.md$/, "");
    const { data, content } = matter(fs.readFileSync(path.join(CONTENT, "verk", f), "utf8"));
    if (!data.titel) fel.push(`${f}: saknar titel`);
    if (data.typ === "foto" && !data.bild) fel.push(`${f}: foto utan bild`);
    if (data.typ === "youtube" && !data.youtube) fel.push(`${f}: youtube utan id`);
    const d = data.datum ? String(data.datum) : null;
    let ar = null;
    if (d) {
      const m = d.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
      if (m) ar = +m[1] + ((+(m[2] || 7) - 1) + (+(m[3] || 1) - 1) / 31) / 12;
    }
    return {
      id,
      titel: data.titel,
      datum: d,
      ar,
      gissat: !!data.datum_gissat,
      typ: data.typ || "foto",
      bild: data.bild ? "media/" + data.bild : null,
      video: data.video ? "media/" + data.video : null,
      youtube: data.youtube || null,
      kanal: data.kanal || null,
      format: Number(data.format) || 1.5,
      epok: data.epok || "",
      avdelning: data.avdelning || "Övrigt",
      vikt: data.vikt || "frö",
      synlig: data.synlig !== false,
      farg: data.farg || null,
      ton: data.ton || {},
      text: content.trim() ? marked.parseInline(content.trim()) : "",
    };
  });
  const allaArenden = readDir("arenden").map((f) => {
    const { data, content } = matter(fs.readFileSync(path.join(CONTENT, "arenden", f), "utf8"));
    return { id: f.replace(/\.md$/, ""), ...data, utkast: arUtkast(data), html: renderBody(content) };
  });
  const arenden = medUtkast ? allaArenden : allaArenden.filter((a) => !a.utkast);
  const utelamnade = allaArenden.length - arenden.length;
  if (utelamnade) console.log(`[innehåll] ${utelamnade} ärendeutkast lämnas utanför bygget.`);
  const v = matter(fs.readFileSync(path.join(CONTENT, "verket.md"), "utf8"));
  const ansokan = JSON.parse(fs.readFileSync(path.join(CONTENT, "ansokan.json"), "utf8"));
  if (fel.length) console.warn("\n[innehåll] " + fel.join("\n[innehåll] ") + "\n");
  // Den engelska versionen (content/en/). Verken delas, texterna läggs ovanpå.
  const en = lasEngelska(CONTENT, { verket: v.data, ansokan, arenden, renderBody, parseInline: (s) => marked.parseInline(s) });
  return { verk, arenden, verket: { ...v.data, bestallare: renderBody(v.content) }, ansokan, en };
}

function arkiv() {
  let medUtkast = false;
  return {
    name: "arkiv",
    // Utkast tas bara med i utvecklingsservern (npm run dev), aldrig i bygget.
    configResolved: (config) => { medUtkast = config.command === "serve" && config.mode !== "production"; },
    resolveId: (id) => (id === ID ? RID : null),
    load: (id) => (id === RID ? `export default ${JSON.stringify(load({ medUtkast }))};` : null),
    configureServer(server) {
      server.watcher.add(CONTENT);
      server.watcher.on("all", (_, file) => {
        if (file.startsWith(CONTENT)) {
          const m = server.moduleGraph.getModuleById(RID);
          if (m) server.moduleGraph.invalidateModule(m);
          server.ws.send({ type: "full-reload" });
        }
      });
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [arkiv(), delning(), sprak({ CONTENT }), import("./scripts/admin/plugin.mjs").then((m) => m.default())], // Redigeringsbordet finns bara i npm run dev
  build: { outDir: "dist", assetsInlineLimit: 0, chunkSizeWarningLimit: 900 },
});
