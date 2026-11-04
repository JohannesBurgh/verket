# Vakten: testerna

Playwright-tester som går igenom sajten i en riktig webbläsare, på dator, på mobil och med `prefers-reduced-motion`. De körs automatiskt på varje pull request (`.github/workflows/test.yml`).

## För Johan

Du behöver inte köra något. På varje pull request finns en rad som heter **Tester**. Grön bock: allt fungerar. Rött kryss: något är trasigt, och pull requesten bör inte slås ihop än.

Klicka på **Details** vid raden och sedan på **Summary**. Där står vad som gick fel, på svenska, och längst ned finns två nedladdningar:

- **skarmdumpar**: bilder av varje vy på dator och mobil, och av varje rum i Arkivrummet.
- **testrapport**: hela rapporten. Packa upp och öppna `rapport/index.html`.

## Köra själv

```
npm test                # bygger sajten och kör alla tester
npm test -- --project=mobil         # bara mobil
npm test -- registret               # bara en fil
npm run test:rapport    # öppnar rapporten från senaste körningen
```

Första gången på en ny dator: `npx playwright install chromium`.

Skärmdumparna hamnar i `tests/utdata/skarmdumpar/`.

## Hur testerna är byggda

- **Inga hårdkodade antal.** `stod/innehall.js` läser `content/` på samma sätt som `vite.config.js` och räknar fram vad sajten borde visa. Läggs ett verk till, följer testerna med.
- **Testerna körs mot bygget**, alltså det som publiceras. Ärenden med `utkast: true` räknas inte.
- **Konsolen vaktas.** Ett sidfel, ett konsolfel eller en saknad lokal fil fäller testet (`stod/fixtur.js`). Typsnitt och YouTube-bilder hämtas utifrån och får misslyckas utan att testet fälls. YouTube-spelaren byts mot en tom ruta.
- **Slumpen har ett frö.** Varje körning skriver ut `VAKT_FRO=<tal>`. Samma tal ger samma urval i ansökan: `VAKT_FRO=123 npm test`. Fröet syns också i GitHub-sammanfattningen och kan anges när arbetsflödet körs för hand.
- **Ansökan prövas många gånger** per körning, eftersom urvalet är slumpat. Reglerna står i `stod/ansokan.js` (`kontrolleraBeslut`).
- **Arkivrummet** fotograferas och pixlarna räknas med sharp: ytan ska ha innehåll och många färger, och två rum i följd ska se olika ut. Rummen hämtas från dockan, så ett nytt rum prövas utan ändringar här.

## Miljöer

| Namn | Vad |
|---|---|
| `dator` | Chrome, 1440 × 900 |
| `mobil` | Pixel 7, pekskärm |
| `lugn` | Chrome med `prefers-reduced-motion: reduce` |

## När en vy ändras

Ändras gränssnittet med avsikt (ny frågetyp i ansökan, nytt filter i Registret), uppdatera testet i samma pull request. En okänd frågetyp i ansökan ger ett tydligt fel som pekar på `stod/ansokan.js`.
