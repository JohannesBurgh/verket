// Redigeringsbordet: ändrar enstaka fält i ett verks frontmatter utan att röra resten.
// Raderna behåller sin ordning, sina kommentarer och sitt skrivsätt. Bara de fält
// som faktiskt ändrats skrivs om, och då som en enda rad i samma stil som intaget använder.
import matter from "gray-matter";

export const DIMS = ["allvar", "lek", "stilla", "rorligt", "scen", "manniska", "ljus", "skruv", "uppdrag", "konst"];
export const VIKTER = ["hjälte", "frö", "damm"];

// Ordningen intaget skriver fälten i. Används bara när ett fält saknas och måste läggas till.
const ORDNING = ["titel", "datum", "datum_gissat", "typ", "bild", "video", "youtube", "kanal", "format",
  "epok", "avdelning", "vikt", "synlig", "dom", "farg", "ton", "original"];

const NYCKEL = /^([A-Za-z_][\w-]*)\s*:(.*)$/;

// Delar upp en fil i frontmatter-rader och brödtext.
export function dela(kalla) {
  const eol = kalla.includes("\r\n") ? "\r\n" : "\n";
  const rader = kalla.split(/\r?\n/);
  if (rader[0].trim() !== "---") throw new Error("Filen saknar frontmatter (första raden ska vara ---).");
  const slut = rader.findIndex((r, i) => i > 0 && r.trim() === "---");
  if (slut < 1) throw new Error("Frontmatter avslutas inte med ---.");
  return { eol, fm: rader.slice(1, slut), kropp: rader.slice(slut + 1).join("\n") };
}

// Hittar varje toppnyckel och vilka rader den upptar (nyckelraden plus indragna fortsättningsrader).
function block(fm) {
  const ut = [];
  fm.forEach((rad, i) => {
    const m = rad.match(NYCKEL);
    if (m && !/^\s/.test(rad)) ut.push({ nyckel: m[1], fran: i, till: i + 1 });
    else if (ut.length && (/^\s/.test(rad) || /^-\s/.test(rad)) && rad.trim()) ut[ut.length - 1].till = i + 1;
  });
  return ut;
}

const tal = (n) => String(Math.round(n * 100) / 100);
const strang = (s) => JSON.stringify(String(s));

export function tonText(ton) {
  const nycklar = [...DIMS.filter((d) => d in ton), ...Object.keys(ton).filter((k) => !DIMS.includes(k))];
  const delar = nycklar.filter((k) => Number(ton[k]) > 0).map((k) => `${k}: ${tal(Number(ton[k]))}`);
  return `{${delar.join(", ")}}`;
}

// Gör ett värde till YAML på en rad, i samma stil som de befintliga filerna.
function yaml(nyckel, varde) {
  if (varde === null || varde === undefined || varde === "") return "null";
  if (nyckel === "ton") return tonText(varde);
  if (typeof varde === "boolean") return varde ? "true" : "false";
  if (typeof varde === "number") return tal(varde);
  return strang(varde);
}

// js-yaml läser okvoterade datum som Date. Bordet arbetar med texten ÅÅÅÅ-MM-DD.
export const norm = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v);

const lika = (a, b) => {
  a = norm(a); b = norm(b);
  if (a && typeof a === "object" && b && typeof b === "object") {
    const k = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...k].every((x) => Number(a[x] || 0) === Number(b[x] || 0));
  }
  const n = (v) => (v === undefined || v === "" ? null : v);
  return String(n(a)) === String(n(b));
};

// Tillämpar ändringar på en fil. andringar = { titel, datum, epok, ..., ton, text }.
// text är brödtexten under strecket. Returnerar { kalla, andrade } där andrade är fälten som skrevs om.
export function andra(kalla, andringar) {
  const { eol, fm, kropp } = dela(kalla);
  const fore = matter(kalla, {}).data;
  const rader = fm.slice();
  const andrade = [];

  for (const [nyckel, varde] of Object.entries(andringar)) {
    if (nyckel === "text") continue;
    if (!/^[A-Za-z_][\w-]*$/.test(nyckel)) throw new Error(`Ogiltigt fältnamn: ${nyckel}`);
    const finns = nyckel in fore;
    if (finns && lika(fore[nyckel], varde)) continue;
    if (!finns && (varde === null || varde === "" || varde === false || (nyckel === "ton" && !Object.values(varde || {}).some((x) => x > 0)))) continue;
    const ny = `${nyckel}: ${yaml(nyckel, varde)}`;
    const b = block(rader).find((x) => x.nyckel === nyckel);
    if (b) rader.splice(b.fran, b.till - b.fran, ny);
    else {
      // Lägg till efter det närmast föregående fältet i intagets ordning, annars sist.
      const plats = ORDNING.indexOf(nyckel);
      const alla = block(rader);
      let efter = -1;
      for (const x of alla) { const p = ORDNING.indexOf(x.nyckel); if (plats >= 0 && p >= 0 && p < plats) efter = Math.max(efter, x.till); }
      if (efter < 0) efter = alla.length ? alla[alla.length - 1].till : rader.length;
      rader.splice(efter, 0, ny);
    }
    andrade.push(nyckel);
  }

  let nyKropp = kropp;
  if ("text" in andringar) {
    const text = String(andringar.text || "").replace(/\r\n/g, "\n").trim();
    if (text !== kropp.trim()) { nyKropp = text ? text + "\n" : ""; andrade.push("text"); }
  }

  const ut = ["---", ...rader, "---", nyKropp].join("\n").replace(/\n+$/, "") + "\n";
  const resultat = eol === "\n" ? ut : ut.replace(/\n/g, eol);

  // Kontrollera att filen fortfarande går att läsa och att värdena blev det vi menade.
  const efter = matter(resultat, {}).data;
  for (const k of andrade) {
    if (k === "text") continue;
    const v = andringar[k];
    if (!lika(efter[k] ?? null, v === "" ? null : v)) throw new Error(`Fältet ${k} blev inte rätt vid sparandet. Inget har skrivits.`);
  }
  return { kalla: andrade.length ? resultat : kalla, andrade };
}
