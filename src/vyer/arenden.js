// Ärenden: projektresor. En markdownfil per ärende i content/arenden/.
import { A, S, el, papper, huvud, tumnagel, metaRad, byId, kontaktRuta, bild } from "../data.js";
import { oppna } from "../visare.js";

const ARENDEN = A.arenden.slice().sort((a, b) => String(b.diarienummer).localeCompare(String(a.diarienummer)));
const statusKlass = (s) => (/avgjor/i.test(s || "") ? "avgjord" : "oppen");

export function lista(app) {
  const p = papper();
  p.append(huvud("Ärendeförteckning", "Ärenden"),
    el("p", { class: "lead" }, "Utvalda projekt, från första idé via skisser och material till färdigt verk. Ärenden under handläggning fylls på efter hand."));
  const ul = el("ul", { class: "arendelista" });
  ARENDEN.forEach((a) => {
    const om = byId[a.omslag];
    ul.append(el("li", {}, el("a", { href: "#arende-" + a.id },
      el("div", { class: "om" }, om ? tumnagel(om) : el("div", { class: "ytthumb", style: "background:var(--field);color:var(--muted)" }, el("small", {}, a.diarienummer), el("strong", {}, "Handlingar inkommer"))),
      el("div", {}, el("h3", {}, a.titel), el("p", {}, `${a.diarienummer} · ${a.period || ""}`), a.ingress ? el("p", {}, a.ingress) : null),
      el("span", { class: "status " + statusKlass(a.status) }, a.status || "Under handläggning"))));
  });
  p.append(ul);
  app.replaceChildren(p);
}

export function arende(app, id) {
  const a = ARENDEN.find((x) => x.id === id);
  if (!a) return lista(app);
  const p = papper(); p.classList.add("arende");
  p.append(huvud(`Ärende · ${a.diarienummer}`, a.titel));
  const om = byId[a.omslag];
  if (om && om.bild) p.append(el("div", { class: "omslag" }, bild(om, { ivrig: true, sizes: "(max-width: 760px) 100vw, 800px" })));
  p.append(el("div", { class: "fields" },
    el("div", {}, el("span", {}, "Diarienummer"), el("b", {}, a.diarienummer)),
    el("div", {}, el("span", {}, "Period"), el("b", {}, a.period || "–")),
    el("div", {}, el("span", {}, "Status"), el("b", {}, a.status || "Under handläggning"))));
  if (a.ingress) p.append(el("p", { class: "lead" }, a.ingress));
  const kropp = el("div", { class: "kropp", html: a.html });
  // Fyll i bilageraderna (::verk i markdown).
  kropp.querySelectorAll(".bilagerad").forEach((rad) => {
    const verk = rad.dataset.verk.split(" ").map((x) => byId[x]).filter(Boolean);
    verk.forEach((v, k) => rad.append(el("button", { type: "button", class: "bilaga", onclick: () => oppna(alla(kropp), alla(kropp).indexOf(v)) },
      el("div", { class: "m" }, tumnagel(v)), el("b", {}, v.titel), el("span", { class: "meta" }, metaRad(v)))));
  });
  p.append(kropp, el("div", { class: "actions" }, el("a", { href: "#arenden", class: "btn ghost" }, "← Alla ärenden"), el("a", { href: "#ansokan", class: "btn" }, "Ansök om kreativ insats")));
  app.replaceChildren(p);
}
function alla(kropp) {
  return [...kropp.querySelectorAll(".bilagerad")].flatMap((r) => r.dataset.verk.split(" ").map((x) => byId[x]).filter(Boolean));
}

export function bestallare(app) {
  const p = papper(); p.classList.add("bestallare");
  p.append(huvud("Upplysningar · Utgåva 2026:1", "För beställare"), el("div", { html: S.bestallare }));
  p.append(kontaktRuta(null));
  app.replaceChildren(p);
}
