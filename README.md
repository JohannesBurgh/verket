# Verket för oväntade lösningar

Johan O Söderbergs portfolio. En fiktiv myndighet där besökaren ansöker om kreativ insats och får ett beslut med bilagor ur arkivet.

Sajten har fem delar:

| Del | Vad den gör |
|---|---|
| **Ansökan** | Fem frågor, en cirkel att rita, handläggning och beslut. Svaren styr vilka verk som bifogas. |
| **Ärenden** | Projektresor: från idé via skisser och material till färdigt verk. |
| **Registret** | Allt material på papper, ordnat efter år, med sök och filter. |
| **Arkivrummet** | Samma material i 3D: Fältet, Rullen, Molnet och Väggen, med en tidslinje som andas. |
| **För beställare** | Det torra: verksamhet, uppdragsgivare, kontakt. |

All text och allt material ligger som vanliga filer i mappen `content/`. Det finns ingen databas och inget inloggningssystem att hålla reda på.

---

## Det enklaste sättet att uppdatera

Öppna projektet i Claude Code och säg vad du vill, med vanliga ord:

> "Lägg in bilderna jag släppt i inkorgen och ge dem bra titlar."
> "Gör Gasmasken till hjälte."
> "Skriv ett ärende om Speed Date av det här röstmemot."
> "Byt fråga tre mot något om kaffe."

Claude ändrar filerna, kör kontrollen och publicerar.

---

## Mapparna

```
content/
  verket.md        Sajtens namn, kontaktuppgifter, inledning och texten "För beställare"
  ansokan.json     Frågorna i ansökan, svaren och poängen
  verk/            Ett verk per fil (foto, film eller YouTube)
  arenden/         En projektresa per fil
public/media/
  bilder/          Bilderna, nedskalade
  film/            Egna filmfiler
inkorg/            Släpp nytt material här och kör npm run intag
scripts/           Intaget och kontrollen
src/               Själva sajten (kod). Behöver sällan röras.
```

## Lägga till nytt material

1. Släpp bilder, filmer eller en `youtube.txt` i `inkorg/` (se `inkorg/LASMIG.txt`).
2. Kör `npm run intag`. Bilderna skalas ned, datum läses ur kamerans metadata och en fil skapas per verk i `content/verk/`.
3. Justera titel, avdelning och vikt i de nya filerna om du vill.
4. Kör `npm run kontroll`, som säger till om något saknas.

## Ett verk

Varje verk är en textfil, till exempel `content/verk/057-rattan.md`:

```yaml
---
titel: "Råttan"
datum: "2010-02-10"       # ÅÅÅÅ-MM-DD, eller bara ÅÅÅÅ
datum_gissat: true        # valfri: visar "(uppskattat)"
typ: foto                 # foto, video eller youtube
bild: "bilder/057.jpg"    # foto och video
youtube: "dJY4xbJKWpw"    # bara youtube
kanal: "Kungliga Operan"  # bara youtube
format: 1.5               # bredd delat med höjd
epok: "Kolkata, 2010"     # en grupp; beslutet bifogar aldrig två ur samma epok
avdelning: "Människan"    # filtret i Registret
vikt: "hjälte"            # hjälte, frö eller damm (se nedan)
synlig: true              # false = finns kvar men visas inte
ton: {allvar: 0.7, skruv: 1, konst: 1}
---
Valfri text som visas under verket.
```

**Vikt**
- `hjälte` lyfts fram oftare, är större i Arkivrummet och visas i det förenklade förfarandet.
- `frö` är det vanliga.
- `damm` bifogas aldrig i beslut men finns i Registret, i Arkivrummet och som vindfrö.

**Ton** styr ansökan. Varje svar i `ansokan.json` ger poäng till samma tio dimensioner: `allvar, lek, stilla, rorligt, scen, manniska, ljus, skruv, uppdrag, konst`. Verk med höga värden där sökanden fick många poäng bifogas.

Domarna från sorteringsbordet (oktober 2026) ligger kvar som `dom:` i varje fil. Nej blev `synlig: false`, kanske blev `damm`.

## Ett ärende (projektresa)

En fil per ärende i `content/arenden/`. Vanlig markdown med en extra sak: en rad som börjar med `::verk` blir en rad med bilagor.

```markdown
---
titel: "Nordisk saga"
diarienummer: "VOL 2010/0517"
period: "maj–november 2010"
status: "Avgjort"            # eller "Under handläggning"
omslag: "019-maskerna-vid-bordet"
ingress: "En mening om ärendet."
---

## Inkom
Text om hur det började.

::verk 019-maskerna-vid-bordet 021-masker-svartvitt
```

## Kontaktuppgifter

Fyll i `epost`, `telefon` och gärna `instagram` överst i `content/verket.md`. Tills dess visas en platshållare.

---

## Köra sajten på din egen dator

Kräver [Node.js](https://nodejs.org) version 20 eller senare.

```
npm install
npm run dev        # öppnar sajten på http://localhost:5173 och uppdateras när du sparar
npm run build      # bygger den färdiga sajten till mappen dist/
```

## Publicera

Sajten är statisk, det vill säga bara filer, så den kan ligga nästan var som helst gratis.

**GitHub Pages (förberett):**
1. Skapa ett konto på github.com och ett nytt repo, till exempel `verket`.
2. Lägg upp projektet där (eller be Claude Code göra det).
3. På GitHub: *Settings → Pages → Source: GitHub Actions*.
4. Varje gång något ändras byggs och publiceras sajten automatiskt. Adressen blir `https://<användarnamn>.github.io/verket/`.

**Egen domän:** Köp en domän och peka den mot GitHub Pages under *Settings → Pages → Custom domain*.

Netlify och Vercel fungerar också: byggkommando `npm run build`, publiceringsmapp `dist`.
