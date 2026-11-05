# Verket för oväntade lösningar

Johan O Söderbergs portfolio. En fiktiv myndighet där besökaren ansöker om kreativ insats och får ett beslut med bilagor ur arkivet.

Sajten har fem delar:

| Del | Vad den gör |
|---|---|
| **Ansökan** | Fem frågor, en cirkel att rita, handläggning och beslut. Svaren styr vilka verk som bifogas. |
| **Ärenden** | Projektresor: från idé via skisser och material till färdigt verk. |
| **Registret** | Allt material på papper, ordnat efter år, med sök och filter. |
| **Arkivrummet** | Samma material i 3D: Fältet, Rullen, Molnet, Väggen och Mörkrummet, med en tidslinje som andas. Knappen "Återgivning" stänger av efterbehandlingen på svaga enheter. Med tangentbord: pilarna flyttar blicken, Enter öppnar handlingen mitt i bild, siffrorna 1 till 5 byter rum. |
| **För beställare** | Det torra: verksamhet, uppdragsgivare, kontakt. |

Allt finns också på engelska, på `…/en/` (se *Den engelska versionen* nedan).

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
  en/              Den engelska versionen: samma struktur, bara texterna
  verk/            Ett verk per fil (foto, film eller YouTube)
  arenden/         En projektresa per fil
  bilder.json      Vilka storlekar varje bild finns i (skapas av intaget, rör inte)
public/media/
  bilder/          Bilderna. Huvudbilden här, storlekarna (AVIF, WebP, JPEG) i bilder/storlek/
  film/            Egna filmfiler
public/typsnitt/   Typsnitten (Public Sans, IBM Plex Mono) ligger på sajten själv
inkorg/            Släpp nytt material här och kör npm run intag
scripts/           Intaget, kontrollen och Redigeringsbordet (scripts/admin/)
src/               Själva sajten (kod). Behöver sällan röras.
```

## Lägga till nytt material

1. Släpp bilder, filmer eller en `youtube.txt` i `inkorg/` (se `inkorg/LASMIG.txt`).
2. Kör `npm run intag`. Varje bild sparas i tre storlekar (480, 960 och 1600 pixlar på längsta sidan) i AVIF och WebP, med JPEG som reserv. Datum läses ur kamerans metadata och en fil skapas per verk i `content/verk/`.
3. Justera titel, avdelning och vikt i de nya filerna om du vill.
4. Kör `npm run kontroll`, som säger till om något saknas.

**Byta en liten bild mot originalet.** De äldre bilderna är bara 720 pixlar breda. Lägg originalfilen i `inkorg/` med samma namn som står i verkets `original:` (till exempel `CRW_7316.jpg`), eller döp den efter verket (`057-rattan.jpg`), och kör `npm run intag`. Bilden byts ut i alla storlekar. Texten i verkfilen rörs inte. `npm run bildstorlekar -- --lista` visar vilka bilder som fortfarande är små.

## Delning, ikoner och sökmotorer

- **Delningsbilder.** När sajten byggs skapas en bild på 1200×630 till startsidan och en till varje ärende (papper, stämpel, ett verk), plus en delningssida per ärende: `…/arende/nordisk-saga/`. Dela den adressen, så visas ärendets bild och text i Messenger, Slack, LinkedIn och liknande. Den som klickar hamnar i ärendet. Vilket verk som syns på startsidans bild styrs av `delningsverk:` i `content/verket.md`. För att titta på bilderna utan att bygga: `node scripts/delning.mjs` (hamnar i `dist-delning/`).
- **Adressen.** `adress:` i `content/verket.md` används i delningstaggarna och i `sitemap.xml`. Byt den om sajten får en egen domän.
- **Ikoner.** `npm run ikoner` gör favicon och hemskärmsikoner av emblemet. Behövs bara om emblemet ändras.
- **Storlekar för befintliga bilder.** `npm run bildstorlekar` skapar det som saknas. Intaget gör det själv för nya bilder.

## Redigeringsbordet

Ett verktyg för att ändra verken utan att öppna filerna. Det finns bara på din egen dator och kommer aldrig med på den publicerade sajten.

1. Kör `npm run dev`.
2. Öppna **http://localhost:5173/admin.html**.

Där kan du:

- se alla verk som rutnät och sätta vikt med ett klick: **hjälte**, **frö**, **damm** eller **dold** (dold = `synlig: false`). Ett klick på "Ångra" i rutan som dyker upp tar tillbaka det.
- klicka på en bild för att ändra titel, datum, epok, avdelning, ton och text. Spara med knappen eller Ctrl S (Cmd S på Mac). Bara de rader som ändrats skrivs om i filen.
- dra in bilder var som helst i fönstret. De läggs i `inkorg/` och intaget körs direkt. Sätt sedan titel, epok, avdelning, ton och vikt på de nya verken.
- välja fliken **Ärende**, klicka på verk i den ordning de ska visas och kopiera färdiga `::verk`-rader till en fil i `content/arenden/`.
- se resultatet av `npm run kontroll` uppe till höger. Den körs om av sig själv när något ändras.

Bordet svarar bara på `localhost`. Det går alltså inte att nå från en annan dator, inte ens med `npm run dev -- --host`.

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

### Utkast

Ett ärende som inte är färdigt får raden `utkast: true` i fälten överst:

```yaml
---
titel: "Clio"
diarienummer: "VOL UTK 2026/04"
utkast: true                 # syns i npm run dev, publiceras inte
---
```

- **`npm run dev`:** utkasten syns under rubriken *Utkast under beredning* längst ned på sidan Ärenden, med stämpeln UTKAST.
- **`npm run build` och den publicerade sajten:** utkasten finns inte med alls. De går inte att nå ens med rätt adress.
- **Publicera ett utkast:** ta bort raden `utkast: true` (eller skriv `utkast: false`). Allt annat än `false` räknas som utkast, så ett felskrivet värde hellre döljer ärendet än publicerar det.

I utkasten står frågor till dig som `[JOHAN: …]`. På ärendets sida blir de numrerade (F1, F2 …) och samlas längst ned i ett *Föreläggande om komplettering*. Svara gärna med ett röstmemo där du säger numret före varje svar, lägg det i `inkorg/` och be Claude föra in svaren. `npm run kontroll` varnar om ett publicerat ärende fortfarande har obesvarade `[JOHAN: …]`.

## Den engelska versionen

Sajten finns också på engelska, som *The Office for Unexpected Solutions*, på adressen `…/en/`. Språkvalet ligger i menyn, längst till höger ("English" och "Svenska"). Det leder till samma vy på det andra språket: ett öppet verk, ett ärende, en föredragning eller ett beslut följer med.

Verkfilerna i `content/verk/` delas mellan språken. Det engelska ligger i `content/en/`:

```
content/en/
  verket.md        namn, inledning, fotnot och texten under For Clients
  gransnitt.json   knappar, rubriker och meddelanden: svensk text till vänster, engelsk till höger
  ansokan.json     ansökans frågor, svar och beslutstexter (bara texterna, se nedan)
  verk.yml         verkens titlar och texter, avdelningarnas och epokernas namn
  arenden/         ett ärende på engelska, med samma filnamn som det svenska
```

- **Nytt verk.** Lägg till titel och text under `verk:` i `content/en/verk.yml`. Tills dess visas den svenska titeln. Be gärna Claude: *"Översätt de nya verken till engelska."*
- **Ansökan.** Den engelska filen innehåller bara texterna. Poäng, utslag och zonernas gränser hämtas alltid från `content/ansokan.json`, så ett beslut blir detsamma på båda språken. Ordningen på frågor, svar och zoner måste vara densamma i båda filerna. Nyckelorden under `tolkning` fungerar på båda sidorna: "coffee" tolkas som "kaffe" och tvärtom.
- **Ärenden.** Ett ärende utan engelsk fil visas på svenska, med en upplysning om att det inte har översatts. Diarienummer och omslag hämtas från det svenska ärendet. Utkasten är dina arbetspapper och står på svenska även på den engelska sidan.
- **Delade beslut.** Ett beslut har samma kod på båda språken. `#beslut-<kod>` och `#decision-<kod>` visar samma bilagor, med titlar på sidans språk.
- **Adresserna** är engelska på den engelska sidan (`#register`, `#cases`, `#case-nordisk-saga`, `#work-057-rattan`, `#decision-…`). De svenska fungerar också där.
- **Delning.** Bygget gör engelska delningsbilder och delningssidor: `…/en/case/nordisk-saga/`.
- **Kontrollen.** `npm run kontroll` säger till om något saknar översättning: texter i koden, verk, avdelningar, epoker och ärenden. Den varnar också för tankstreck i de engelska texterna. Det som saknas visas på svenska, så sajten går aldrig sönder av en saknad översättning.
- **Utveckling.** `npm run dev` visar den engelska sidan på http://localhost:5173/en/.

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

## Tester (vakten)

Varje pull request testas automatiskt i en riktig webbläsare, på dator och mobil. På pull requesten syns raden **Tester**: grön bock betyder att allt fungerar. Under *Details → Summary* står vad som gick fel och där finns skärmdumpar att ladda ned. Mer i `tests/LASMIG.md`.

```
npm test           # bygger sajten och kör alla tester
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
