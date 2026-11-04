// Övergångarna mellan rummen, i tre tydliga steg:
//  1. Insamling. Handlingarna samlas i en bunt framför kameran, den senaste först,
//     så att den äldsta hamnar överst.
//  2. Förflyttning. Kameran tar sig till nästa rum medan bunten följer med.
//  3. Utdelning. Handlingarna delas ut från buntens topp i tidsordning, var och en i en båge.
import * as THREE from "three";

export const TID = { samla: .42, samlaSprid: .3, flytt: .6, dela: .56, delaSprid: .7 };
export const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const ut = (t) => 1 - Math.pow(1 - t, 3);
const KAM = TID.samlaSprid * .6 + TID.samla * .5, DELA = KAM + TID.flytt + .05;
const klamp = (t) => Math.max(0, Math.min(1, t));

export function skapaKoreografi({ world, camera }) {
  let aktiv = null;
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _q = new THREE.Quaternion(), _wq = new THREE.Quaternion(), _z = new THREE.Vector3(0, 0, 1);

  // buntens plats i kamerans rum, omräknad till rummets koordinater varje ruta
  function buntPlats(i, n, ut, utQ) {
    const s = i / Math.max(1, n);
    _a.set(Math.sin(i * 2.4) * .05, -.08 + Math.cos(i * 1.7) * .04, camera.position.z - 3.2 + s * .55);
    world.worldToLocal(ut.copy(_a));
    world.getWorldQuaternion(_wq).invert();
    _q.setFromAxisAngle(_z, Math.sin(i * 3.1) * .07);
    utQ.copy(_wq).multiply(_q);
  }

  // en båge: från a till b med en kontrollpunkt som lyfts mot kameran
  function bage(a, b, t, lyft, ut) {
    _c.copy(a).add(b).multiplyScalar(.5);
    _b.set(0, lyft * .4, lyft); world.getWorldQuaternion(_wq).invert(); _b.applyQuaternion(_wq); _c.add(_b);
    const m = 1 - t; return ut.set(m * m * a.x + 2 * m * t * _c.x + t * t * b.x, m * m * a.y + 2 * m * t * _c.y + t * t * b.y, m * m * a.z + 2 * m * t * _c.z + t * t * b.z);
  }

  // start: lista i utdelningsordning (äldst först), kamerans start- och målläge
  function starta(lista, nu, fran, till) {
    const n = lista.length;
    lista.forEach((s, k) => {
      const samlas = n - 1 - k; // den nyaste samlas först och hamnar underst
      s.flyg = {
        plats: samlas, p0: s.mesh.position.clone(), q0: s.mesh.quaternion.clone(),
        t0: nu + (samlas / Math.max(1, n)) * TID.samlaSprid,
        t1: nu + DELA + (k / Math.max(1, n)) * TID.delaSprid,
        bp: new THREE.Vector3(), bq: new THREE.Quaternion(), utdelad: false,
      };
    });
    aktiv = { nu, n, fran, till, kamStart: nu + KAM, slut: nu + DELA + TID.delaSprid + TID.dela };
    return aktiv;
  }
  const _p = new THREE.Vector3(), _bq = new THREE.Quaternion();
  // flytta ett kort; returnerar true när det har landat
  function kort(s, nu) {
    const f = s.flyg, m = s.mesh;
    if (nu < f.t0) return false;
    buntPlats(f.plats, aktiv ? aktiv.n : 1, _p, _bq);
    if (nu < f.t1) {
      const t = klamp((nu - f.t0) / TID.samla), e = ut(t);
      f.iBunt = t >= 1;
      bage(f.p0, _p, e, .7, m.position);
      m.quaternion.copy(f.q0).slerp(_bq, e);
      f.bp.copy(m.position); f.bq.copy(m.quaternion);
      return false;
    }
    if (!f.utdelad) { f.utdelad = true; f.iBunt = false; f.bp.copy(_p); f.bq.copy(_bq); f.ljud = true; }
    const t = klamp((nu - f.t1) / TID.dela), e = ease(t);
    bage(f.bp, s.mal || s.tp, e, 1.2, m.position);
    m.quaternion.copy(f.bq).slerp(s.tq, e);
    // pappret fladdrar lite i luften
    if (t < 1) { _q.setFromAxisAngle(_a.set(1, 0, 0), Math.sin(Math.PI * e) * .35); m.quaternion.multiply(_q); }
    return t >= 1;
  }
  // kamerans framsteg 0..1 i förflyttningen
  const kamera = (nu) => (aktiv ? ease(klamp((nu - aktiv.kamStart) / TID.flytt)) : 1);
  return {
    starta, kort, kamera,
    get aktiv() { return aktiv; },
    klar(nu) { if (aktiv && nu >= aktiv.slut) { aktiv = null; return true; } return false; },
    avbryt() { aktiv = null; },
  };
}
