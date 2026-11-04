# Instruktioner för Claude i det här projektet

Ägare: Johan O Söderberg, filmare och fotograf. Ingen utvecklare. Svara på svenska, kort och konkret.

## Vad det är
En statisk portfolio (Vite + vanilla JS + three.js). Konceptet är en fiktiv svensk myndighet, "Verket för oväntade lösningar". Tonen på pappret är torr och trovärdig. Skämtet sitter i detaljerna, aldrig i utrop.

## Regler
- Innehåll ändras i `content/`, aldrig i `src/`, om inte Johan ber om en funktionsändring.
- Nytt material: lägg i `inkorg/`, kör `npm run intag`, ge sedan bra titlar, `epok`, `avdelning`, `ton` och `vikt` utifrån vad bilden faktiskt visar. Titta på bilden innan du sätter titel.
- Kör alltid `npm run kontroll` och `npm run build` innan du säger att något är klart.
- Hitta inte på fakta om projekt, år, uppdragsgivare eller roller. Skriv `[JOHAN: …]` där en uppgift saknas.
- Texter som publiceras: inga tankstreck (em-dash). Myndighetsprosa: korta meningar, passiv form går bra, inga utropstecken.
- Ärenden (projektresor) kan skrivas från Johans röstmemon eller anteckningar. Behåll hans formuleringar där de bär.
- Visuell stil: mörkt rum, ljust papper, lime (#d4ff3f) bara för det som går att klicka på, cyan för rörlig bild, magenta för Absurdimo. Rör inte paletten utan att fråga.

## Arbetsorder
Större uppdrag står i `ARBETSORDER.md`. Ett uppdrag per session och gren (`uppdrag-N`), lämnas som pull request mot `main`. Ny CSS i `src/stil/<uppdrag>.css`, inte i `src/style.css`.

## Kommandon
`npm run dev` · `npm run build` · `npm run intag` · `npm run kontroll`
