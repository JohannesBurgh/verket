# Arbetsorder

Stora, fristående uppdrag för Claude Code på webben (claude.ai/code). Varje uppdrag körs i en egen session, på en egen gren, och lämnas som en pull request som Johan godkänner eller slänger. Uppdragen i våg 1 kan köras samtidigt.

## Så startar Johan ett uppdrag

Öppna claude.ai/code, välj repot `verket` och klistra in (byt N mot uppdragets nummer):

> Läs CLAUDE.md och ARBETSORDER.md. Utför uppdrag N i sin helhet, med högsta ambition. Arbeta på grenen `uppdrag-N`. Testa i en riktig webbläsare (Playwright), kör `npm run kontroll` och `npm run build`, och öppna en pull request mot `main` med skärmdumpar och en kort sammanfattning på svenska. Fråga inte om lov för steg inom uppdraget. Skriv `[JOHAN: …]` där fakta saknas.

## Gemensamma regler för alla uppdrag

- Läs CLAUDE.md först. Paletten, tonen och regeln om att aldrig hitta på fakta gäller alltid.
- Rör bara de filer uppdraget äger. Behöver du ändra något annat: gör minsta möjliga ändring och skriv det i pull requesten.
- Ny CSS läggs i en egen fil, `src/stil/<uppdrag>.css`, som importeras från uppdragets egen modul. Lägg inte till i `src/style.css`.
- Nya vyer kopplas in i `src/main.js` med en rad i `switch` och, vid behov, en länk i `index.html`. Inget mer där.
- Inga nya beroenden utan skäl. three, sharp, gray-matter och marked finns redan.
- Sajten ska fungera på mobil, med tangentbord och med `prefers-reduced-motion`.
- Inga fel i konsolen. Arkivrummet ska hålla flytande bildfrekvens på en vanlig laptop.
- Pull requesten ska innehålla skärmdumpar (dator och mobil), vad som ändrats och vad Johan behöver ta ställning till.

---

## Våg 1 (kan köras parallellt)

### Uppdrag 1. Arkivrummet: ljus, djup och ett nytt rum
**Äger:** `src/vyer/arkivrummet.js`, ny mapp `src/rum/`, `src/stil/arkivrummet.css`.

Arkivrummet ska kännas som ett ställe, inte en demo.
- Efterbehandling: mjuk vinjett, filmkorn som matchar papperets struktur, diskret djupskärpa på det som är långt bort, lätt bloom på lime-markeringar. Allt måste gå att stänga av för svaga enheter (sänk pixelratio, hoppa över efterbehandling på mobil).
- Korten: papperskänsla i materialet, mjuka skuggor, hjältar något tjockare än frön.
- Nytt rum, **Mörkrummet**: rött mörkrumsljus, verken ligger i framkallningsbad och bilden växer fram ur vitt när man närmar sig. Lägg till det i dockan bredvid de andra.
- Övergångarna mellan rummen ska vara koreograferade (kameran och korten rör sig i en tydlig ordning), inte bara interpolerade.
- Tidslinjen och årsfokus ska fungera exakt som nu i alla rum.

**Klart när:** alla fem rum fungerar på dator och mobil, utan fel i konsolen, och skärmdumpar av varje rum finns i pull requesten.

### Uppdrag 2. Föredragningen (showreel i webbläsaren)
**Äger:** ny `src/vyer/foredragning.js`, `src/stil/foredragning.css`, en rad i `src/main.js`, en länk i `index.html`.

En ny vy, `#foredragning`, där Verket föredrar sitt eget arkiv: en självspelande sekvens på 90 till 120 sekunder.
- Torr kinetisk typografi i myndighetens stil (diarienummer, rubriker, stämplar som slår ned i takt).
- Fotografier med långsam kamerarörelse, filmerna som stillbilder med kanalens färg, Absurdimo som avbrott.
- Ljudet syntetiseras med WebAudio (en sparsmakad puls, papper, stämpel). Inga ljudfiler. Följer ljudknappen.
- Urvalet styrs av ett frö i adressen, `#foredragning-<frö>`, så att en viss föredragning kan delas. Hjältar oftare, aldrig två verk ur samma epok i följd.
- Slutar med kontaktuppgifterna och "Föredragningen är avslutad."
- Mellanslag pausar, pilar hoppar, Escape avslutar. Med `prefers-reduced-motion` blir det ett lugnt bildspel.

**Klart när:** sekvensen spelar igenom utan avbrott på dator och mobil, och pull requesten har en skärminspelning eller en serie skärmdumpar.

### Uppdrag 3. Verkbeskrivningar
**Äger:** `content/verk/` (bara texter, titlar och `ton`).

Titta på varje bild i `public/media/bilder/` och skriv en kort text till verket.
- En till tre meningar i torr registerprosa: vad bilden visar, ljuset, kompositionen. Exempel på ton: "Fotografiet visar en kanin vid en bankomat. Kaninen förefaller inte ha något ärende."
- Hitta inte på var, när eller vem. Det som inte syns i bilden skrivs inte.
- Justera `ton` där den uppenbart inte stämmer med bilden.
- Ändra inte titlar. Föreslå i stället nya titlar i en tabell i pull requesten (nuvarande, förslag, skäl), så väljer Johan.
- YouTube-verk lämnas orörda.

**Klart när:** alla synliga foton har en text, kontrollen går igenom och tabellen med titelförslag finns i pull requesten.

### Uppdrag 4. Ärendeutkast ur filmerna
**Äger:** `content/arenden/`, plus stödet för utkast (se nedan) i `vite.config.js` och `src/vyer/arenden.js`.

- Inför fältet `utkast: true` i ärenden. Utkast visas när man kör `npm run dev` men tas inte med i den publicerade sajten. Dokumentera fältet i README.
- Gruppera YouTube-verken efter uppdragsgivare och sammanhang (Riksteatern, Clio, Kungliga Operan, Cullberg, NTF och så vidare) och skriv ett ärendeutkast per grupp, 6 till 10 stycken, alla med `utkast: true`.
- Använd bara det som står i verkfilerna (titel, kanal, år). Allt annat blir frågor till Johan: `[JOHAN: Vad var uppdraget? Vem beställde? Din roll?]`. Formulera frågorna så att Johan kan svara med ett röstmemo.
- Strukturen följer `nordisk-saga.md`: Inkom, Beredning, Material (med `::verk`), Beslut.

**Klart när:** utkasten syns i dev men inte i `npm run build`, och kontrollen går igenom.

### Uppdrag 5. Ansökan 2.0
**Äger:** `src/vyer/ansokan.js`, `content/ansokan.json`, `src/stil/ansokan.css`.

- En frågebank på 15 frågor. Varje besök drar fem, styrt av ett frö. Behåll cirkeln.
- Nya svarstyper: ett reglage ("Hur bråttom? Från igår till aldrig"), välj en av tre bilder ur arkivet, och ett fritt ord som tolkas mot nyckelord.
- Fler beslutstyper: bifall, delvis bifall, avslag med hänvisning (fortfarande med bilagor) och "Ärendet överlämnas till Absurdimo".
- Delbart beslut: `#beslut-<kod>` återskapar exakt samma beslut. Lägg till "Kopiera beslutets adress".
- Utskrift: beslutet skrivs ut som ett A4-dokument med diarienummer, hålslag och bilagor som miniatyrer.

**Klart när:** hela flödet fungerar med mus, tangentbord och på mobil, ett delat beslut återskapas korrekt och utskriften är snygg.

### Uppdrag 6. Bilder, delning och prestanda
**Äger:** `scripts/intag.mjs`, nya skript i `scripts/`, `index.html` (head), `tumnagel` i `src/data.js`.

- Intaget skapar framöver tre storlekar (480, 960, 1600) i WebP och AVIF med JPEG som reserv. Sajten använder `srcset`.
- Ta fram samma format för de befintliga bilderna så långt det går. De nuvarande är bara 720 pixlar breda: lista i pull requesten vilka originalfiler Johan bör lägga i inkorgen för att få full upplösning.
- Delningsbilder: ett skript som genererar en bild på 1200×630 i Verkets stil (papper, stämpel, ett verk) till startsidan och varje ärende. Lägg in Open Graph och Twitter-taggar.
- `sitemap.xml`, `robots.txt`, favicon i flera storlekar (emblemet).
- Mål: Lighthouse 90 eller mer på mobil för prestanda, tillgänglighet och SEO. Redovisa siffrorna före och efter.

**Klart när:** målen är nådda och redovisade i pull requesten.

### Uppdrag 7. Redigeringsbordet (administration på Johans dator)
**Äger:** ny mapp `scripts/admin/`, ny `admin.html`, en rad i `vite.config.js` som laddar pluginet från `scripts/admin/plugin.mjs`.

Ett verktyg som bara finns när Johan kör `npm run dev`, på `http://localhost:5173/admin.html`. Det publiceras aldrig.
- Alla verk som rutnät med miniatyrer. Knappar för vikt: hjälte, frö, damm, dold.
- Redigera titel, epok, avdelning, text och tonreglagen direkt. Sparar till filerna i `content/verk/` utan att förstöra ordningen i frontmatter.
- Dra in bilder: de hamnar i `inkorg/` och intaget körs.
- Ett ärende: välj verk med klick och få färdiga `::verk`-rader att klistra in.
- Visar resultatet av `npm run kontroll` direkt.
- Samma stil som sajten: mörkt rum, ljust papper.

**Klart när:** allt ovan fungerar lokalt, `npm run build` innehåller inget av det, och README har en kort instruktion.

### Uppdrag 8. Tester och vakt
**Äger:** ny mapp `tests/`, ny `.github/workflows/test.yml`, `devDependencies` i `package.json`.

- Playwright-tester för varje vy på dator och mobil: ansökan hela vägen till beslut (3 till 4 bilagor, aldrig två ur samma epok, aldrig damm), registret med filter och sök, visaren med pilar, ärenden och Arkivrummet (att något faktiskt ritas).
- Testerna körs på varje pull request och lägger upp skärmdumpar som artefakter, så att Johan kan se resultatet utan att köra något själv.
- Testerna ska tåla att innehållet växer: inga hårdkodade antal verk.

**Klart när:** testerna går igenom på `main` och körs automatiskt på pull requests.

---

## Våg 1,5 (görs nu, en session)

### Uppdrag 12. Få vakten grön på den samlade versionen
**Gren:** arbeta direkt på `samlat` (pull request #9), inte på en ny gren.

Alla åtta uppdragen är ihopslagna på `samlat`. Kontroll och bygge går igenom, men vakten (uppdrag 8) fäller 26 tester, eftersom testerna skrevs mot den gamla sajten. Gör så här:

- **Ansökan:** testerna i `tests/ansokan.spec.js` och `tests/stod/ansokan.js` förutsätter den gamla ansökan. Skriv om dem för Ansökan 2.0 (frågebank, reglage, bildval, fritt ord, fyra beslutstyper, `#beslut-<kod>`). Behåll reglerna: aldrig två bilagor ur samma epok, aldrig damm bland bilagorna, förenklat förfarande bara hjältar. Pröva också att ett delat beslut återskapas.
- **Navigering:** Föredragningen lägger till ett frö i adressen (`#foredragning-<frö>`). Testet ska acceptera det.
- **Arkivrummet:** testerna för rummen, Blås och tidslinjen får `Element is not attached to the DOM` och tidsgränser efter uppdrag 1 (efterbehandling, Mörkrummet). Ta reda på om det är testet eller sajten som har fel. Är det sajten (till exempel att canvas byts ut, eller att rummet ritar för långsamt utan grafikkort), rätta sajten. Är det testet, rätta testet. Sänk inte kraven bara för att få grönt.
- **Skärmdumpar:** `tests/skarmdumpar.spec.js` ska följa den nya ansökan.
- Gå också igenom det som uppdragen själva flaggade: menyn får inte plats på mobil ("För beställare" och ljudknappen sticker ut), och en adress `#verk-…` inklistrad medan man står i Registret gör ingenting.

**Klart när:** alla tester går igenom i GitHub Actions på pull request #9 (grön bock), utan att något test har tagits bort eller försvagats utan skäl. Skriv i pull requesten vad som var fel i sajten och vad som var fel i testerna.

---

## Våg 2 (efter att våg 1 är sammanslagen)

### Uppdrag 9. English version
"The Office for Unexpected Solutions". Översättning av gränssnitt, ansökan och beslut med samma torra ton på engelska. Språkval i menyn, `content/en/` för texter. Verkfilerna delas mellan språken.

### Uppdrag 10. Arkivrummet möter Föredragningen
Föredragningen kan spelas inne i Arkivrummet: kameran åker mellan korten i takt med sekvensen.

### Uppdrag 11. Granskning
En session som går igenom hela sajten med nya ögon: kod, texter, tillgänglighet, mobil. Rättar det som är fel och listar resten.
