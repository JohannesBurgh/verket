// Återgivningen: hur mycket Arkivrummet ritar. Börjar högt på dator och lågt på mobil,
// sänker pixeltätheten och stänger av efterbehandlingen om bildfrekvensen sjunker.
// Besökarens eget val (knappen "Återgivning") sparas och gäller före allt annat.
const NYCKEL = "verket-atergivning";

export function skapaKvalitet() {
  const mobil = matchMedia("(pointer: coarse)").matches && Math.min(screen.width, screen.height) < 820;
  const svag = (navigator.deviceMemory && navigator.deviceMemory < 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);
  const dpr = () => devicePixelRatio || 1;
  // nivåer: 3 full, 2 full med lägre täthet, 1 förenklad, 0 förenklad och lägsta täthet
  const NIVA = [
    { efter: false, dpr: () => 1 },
    { efter: false, dpr: () => Math.min(dpr(), 1.5) },
    { efter: true, dpr: () => Math.min(dpr(), 1.25) },
    { efter: true, dpr: () => Math.min(dpr(), 1.75) },
  ];
  let val = null; try { val = localStorage.getItem(NYCKEL); } catch (e) {}
  let niva = val === "full" ? 3 : val === "enkel" ? 1 : mobil || svag ? 1 : 3;

  // mätning: snittet av rutorna under två sekunder, utan de första och utan långa avbrott
  let summa = 0, antal = 0, vila = 2.5;
  function mat(dt, stor) {
    if (val || niva === 0) return false;
    if (stor || dt > .25) { vila = Math.max(vila, 1); summa = antal = 0; return false; }
    if (vila > 0) { vila -= dt; return false; }
    summa += dt; antal++;
    if (summa < 2) return false;
    const snitt = summa / antal; summa = antal = 0;
    if (snitt > 1 / 42) { niva--; vila = 1.5; return true; }
    return false;
  }
  return {
    mobil,
    get efter() { return NIVA[niva].efter; },
    get dpr() { return NIVA[niva].dpr(); },
    get eget() { return val; },
    vaxla() {
      val = NIVA[niva].efter ? "enkel" : "full"; niva = val === "full" ? 3 : 1;
      try { localStorage.setItem(NYCKEL, val); } catch (e) {}
    },
    mat,
  };
}
