// Språket. Sajten finns på svenska (/) och engelska (/en/). Samma kod, samma verk.
// Den engelska sidan har <html lang="en">. Allt annat följer av det.
//
// t("Svensk text") ger den engelska motsvarigheten ur content/en/gransnitt.json,
// eller den svenska texten om ingen översättning finns. {namn} byts mot värden:
//   t("Fråga {i} av {n}", { i: 2, n: 5 })
// npm run kontroll säger till om en text i koden saknar översättning.
import arkiv from "virtual:arkiv";
import "./stil/sprak.css";

export const EN = document.documentElement.lang === "en";
export const SPRAK = EN ? "en" : "sv";
const ORD = EN ? arkiv.en.gransnitt : null;

export function t(sv, varden) {
  const s = (ORD && ORD[sv]) || sv;
  return varden ? s.replace(/\{(\w+)\}/g, (m, k) => (k in varden ? varden[k] : m)) : s;
}

/** Som t(), men {namn} kan vara element (till exempel en länk). Ger en lista att lägga in med append. */
export function tDelar(sv, delar) {
  const ut = [];
  t(sv).split(/(\{\w+\})/).forEach((bit) => {
    const m = bit.match(/^\{(\w+)\}$/);
    if (m && m[1] in delar) ut.push(delar[m[1]]); else if (bit) ut.push(bit);
  });
  return ut;
}

// ---------- adresserna ----------
// Vyerna heter samma sak i koden. Adressen efter # skrivs på sidans språk.
// Svenska adresser fungerar också på den engelska sidan, så att gamla länkar håller.
// Inga bindestreck i namnen: allt efter det första bindestrecket är vyns argument.
const ENGELSKA = {
  ansokan: "application", arenden: "cases", arende: "case", registret: "register", verk: "work",
  arkivrummet: "archive", foredragning: "presentation", bestallare: "clients", beslut: "decision",
};
const TILLBAKA = Object.fromEntries(Object.entries(ENGELSKA).map(([sv, en]) => [en, sv]));

/** Adressen till en vy på sidans språk: vag("verk", "057-rattan") → "#work-057-rattan" */
export function vag(vy, arg, sprak = SPRAK) {
  const namn = sprak === "en" ? ENGELSKA[vy] || vy : vy;
  return "#" + namn + (arg != null && arg !== "" ? "-" + arg : "");
}
/** Läser adressen: { vy, arg } med vyns svenska namn, oavsett språk. */
export function las(hash = location.hash) {
  let h = hash.replace(/^#/, "");
  try { h = decodeURIComponent(h); } catch (e) {}
  const [namn, ...rest] = h.split("-");
  return { vy: TILLBAKA[namn] || namn, arg: rest.join("-") };
}
export const arVy = (vy, hash = location.hash) => las(hash).vy === vy;

/** Samma vy på det andra språket. */
export function andraSpraket(hash = location.hash) {
  const { vy, arg } = las(hash), annat = EN ? "sv" : "en";
  return (EN ? "../" : "en/") + (vy ? vag(vy, arg, annat) : "");
}

// ---------- namn på det som inte är fri text ----------
const VERKORD = (EN && arkiv.en.verkord) || {};
/** Avdelningen (filtret i Registret) på sidans språk. Logiken använder alltid det svenska namnet. */
export const avdelningNamn = (a) => (EN && VERKORD.avdelningar?.[a]) || a;
/** Epoken på sidans språk. */
export const epokNamn = (e) => (EN && VERKORD.epoker?.[e]) || e;
/** Sortering och jämförelser i sidans språk. */
export const jamfor = (a, b) => String(a).localeCompare(String(b), SPRAK);
