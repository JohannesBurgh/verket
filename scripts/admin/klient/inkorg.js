// Redigeringsbordet: inkorgen. Dra in bilder och filmer, de hamnar i inkorg/ och intaget körs.
import { T, el, api, meddela, miniatyr, pa, sand } from "./gemensamt.js";

const TYPER = /\.(jpe?g|png|tiff?|webp|mp4|mov|webm|m4v|txt)$/i;
let yta, ytForm, logg = "", senastNya = [], pagar = false, filstatus = [];

export function initInkorg() {
  yta = document.getElementById("rb-flik-inkorg");
  pa("data", rita);
  rita();

  // Hela fönstret tar emot filer.
  const slapp = document.getElementById("rb-slapp");
  let djup = 0;
  const harFiler = (e) => [...(e.dataTransfer?.types || [])].includes("Files");
  addEventListener("dragenter", (e) => { if (!harFiler(e)) return; e.preventDefault(); djup++; slapp.hidden = false; });
  addEventListener("dragover", (e) => { if (!harFiler(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = "copy"; });
  addEventListener("dragleave", (e) => { if (!harFiler(e)) return; djup = Math.max(0, djup - 1); if (!djup) slapp.hidden = true; });
  addEventListener("drop", (e) => {
    if (!harFiler(e)) return;
    e.preventDefault(); djup = 0; slapp.hidden = true;
    taEmot([...e.dataTransfer.files]);
  });
}

const storlek = (b) => (b > 1e6 ? (b / 1e6).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(b / 1e3)) + " kB");

export async function taEmot(filer) {
  sand("flik", "inkorg");
  if (pagar) { meddela("Vänta tills intaget är klart.", { typ: "fel" }); return; }
  const ok = filer.filter((f) => TYPER.test(f.name)), nej = filer.filter((f) => !TYPER.test(f.name));
  nej.forEach((f) => meddela(`${f.name} tas inte emot. Bilder, filmer och textfiler går bra.`, { typ: "fel" }));
  if (!ok.length) return;
  pagar = true;
  // Textfiler (titel och text till en bild, youtube.txt) läggs in först så att intaget hittar dem.
  ok.sort((a, b) => Number(!/\.txt$/i.test(a.name)) - Number(!/\.txt$/i.test(b.name)));
  filstatus = ok.map((f) => ({ namn: f.name, storlek: f.size, laget: "väntar" }));
  rita();
  let lyckade = 0;
  for (const [i, f] of ok.entries()) {
    filstatus[i].laget = "skickas"; rita();
    try {
      const r = await api("inkorg?namn=" + encodeURIComponent(f.name), { metod: "POST", ra: f });
      filstatus[i].laget = r.namn === f.name ? "i inkorgen" : `i inkorgen som ${r.namn}`; lyckade++;
    } catch (e) { filstatus[i].laget = "fel: " + e.message; }
    rita();
  }
  pagar = false;
  if (lyckade) await korIntaget();
  else rita();
}

export async function korIntaget() {
  if (pagar) return;
  pagar = true; logg = "Intaget körs …"; rita();
  try {
    const r = await api("intag", { metod: "POST" });
    logg = r.utdata || "(intaget skrev inget)";
    senastNya = r.nya || [];
    senastNya.forEach((id) => T.nya.add(id));
    filstatus = [];
    if (r.kod !== 0) meddela("Intaget avslutades med ett fel. Se loggen i inkorgen.", { typ: "fel", tid: 9000 });
    else meddela(senastNya.length ? `Intaget är klart. ${senastNya.length === 1 ? "Ett nytt verk" : senastNya.length + " nya verk"}.` : "Intaget är klart. Inga nya verk.");
    pagar = false;
    await new Promise((ok) => { sand("hamta", ok); });
  } catch (e) {
    logg = "Intaget kunde inte köras. " + e.message;
    meddela(logg, { typ: "fel" });
  } finally { pagar = false; rita(); }
}

function youtubeForm() {
  const f = (namn, etikett, attrs = {}) => el("div", { class: "rb-falt" }, el("label", { for: "rb-yt-" + namn }, etikett), el("input", { id: "rb-yt-" + namn, name: namn, autocomplete: "off", ...attrs }));
  const form = el("form", { class: "rb-form rb-ytform", onsubmit: async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    try {
      const r = await api("youtube", { metod: "POST", data: d });
      meddela(`Lagt i inkorg/youtube.txt: ${r.rad}`);
      form.reset();
      await korIntaget();
    } catch (err) { meddela(err.message, { typ: "fel" }); }
  } },
  f("url", "Länk", { required: true, placeholder: "https://www.youtube.com/watch?v=…", inputmode: "url" }),
  el("div", { class: "rb-par" }, f("titel", "Titel"), f("kanal", "Kanal", { list: "rb-yt-kanaler" })),
  el("div", { class: "rb-par" }, f("ar", "År", { inputmode: "numeric", placeholder: "ÅÅÅÅ" }),
    el("div", { class: "rb-falt rb-slut" }, el("button", { type: "submit", class: "rb-btn ghost" }, "Lägg till och kör intaget"))),
  el("datalist", { id: "rb-yt-kanaler" }));
  return form;
}

function rita() {
  if (!yta) return;
  document.querySelectorAll('[data-rakna="inkorg"], #rb-rakna-inkorg').forEach((s) => (s.textContent = T.inkorg.length || ""));
  const aktiv = document.activeElement && yta.contains(document.activeElement) ? document.activeElement.id : null;
  const valj = el("input", { type: "file", id: "rb-valj-filer", multiple: true, accept: "image/*,video/*,.txt,.tif,.tiff", class: "rb-dold-text",
    onchange: (e) => { taEmot([...e.target.files]); e.target.value = ""; } });
  const zon = el("div", { class: "rb-zon" + (pagar ? " pagar" : "") },
    el("b", {}, pagar ? "Arbetar …" : "Dra in bilder här"),
    el("span", {}, "eller var som helst i fönstret. Jpg, png, tif, webp och filmer. En textfil med samma namn som bilden blir titel och text."),
    el("label", { class: "rb-btn", for: "rb-valj-filer" }, "Välj filer …"), valj);

  const ivantan = T.inkorg.filter((f) => !filstatus.some((s) => s.namn === f.namn));
  yta.replaceChildren(el("div", { class: "rb-inkorg" },
    el("div", { class: "rb-huvud" }, el("div", { class: "org" }, "Inkorg"), el("div", { class: "form" }, "inkorg/ · npm run intag"), el("h2", {}, "Nytt material")),
    zon,
    filstatus.length ? el("ul", { class: "rb-filer" }, filstatus.map((s) => el("li", { class: /^fel/.test(s.laget) ? "fel" : "" }, el("span", {}, s.namn), el("small", {}, `${storlek(s.storlek)} · ${s.laget}`)))) : null,
    ivantan.length ? [
      el("h3", {}, "Ligger i inkorgen"),
      el("ul", { class: "rb-filer" }, ivantan.map((f) => el("li", {}, el("span", {}, f.namn), el("small", {}, storlek(f.storlek))))),
    ] : null,
    el("div", { class: "rb-sparrad" },
      el("span", { class: "rb-status" }, T.inkorg.length ? `${T.inkorg.length} ${T.inkorg.length === 1 ? "fil väntar" : "filer väntar"}` : "Inkorgen är tom"),
      el("button", { type: "button", class: "rb-btn", id: "rb-kor-intag", disabled: pagar || !T.inkorg.length, onclick: korIntaget }, "Kör intaget")),
    senastNya.length ? [
      el("h3", {}, "Nya verk från intaget"),
      el("p", { class: "rb-mork" }, "Titta på bilden innan du sätter titel. Ge varje nytt verk epok, avdelning, ton och vikt."),
      el("ul", { class: "rb-nya" }, senastNya.filter((id) => T.byId[id]).map((id) => {
        const v = T.byId[id];
        return el("li", {}, el("button", { type: "button", onclick: () => sand("redigera", id) }, el("span", { class: "m" }, miniatyr(v)), el("span", {}, el("b", {}, v.titel), el("small", {}, id + " · Redigera"))));
      })),
    ] : null,
    logg ? el("details", { class: "rb-logg", open: true }, el("summary", {}, "Intagets logg"), el("pre", {}, logg)) : null,
    el("h3", {}, "YouTube-film"),
    el("p", { class: "rb-mork" }, "Läggs som en rad i inkorg/youtube.txt. Fält som lämnas tomma fylls i efteråt."),
    (ytForm ||= youtubeForm())));
  const kanaler = ytForm.querySelector("datalist");
  kanaler.replaceChildren(...[...new Set(T.verk.map((v) => v.kanal).filter(Boolean))].sort().map((k) => el("option", { value: k })));
  if (aktiv) document.getElementById(aktiv)?.focus();
}
