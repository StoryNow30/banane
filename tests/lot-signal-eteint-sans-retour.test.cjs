'use strict';
/* CH-062 — SIGNAL D'ESV ÉTEINT PENDANT LE LOT : le signal ne revient pas après le rechargement. Plafond d'un rechargement par partie : la deuxième
 * détection est seulement consignée, le lot continue au repli jusqu'à sa borne, sans boucle. Montage : tests/helpers/lot-signal.cjs. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {REGLAGE,lotSignal,ev,etapes,valides,attendreLot,etape}=require('./helpers/lot-signal.cjs');

test('sans retour du signal : un seul rechargement, deuxième détection consignée (plafond), le lot va à sa borne',async()=>{
 const {b,adapter}=await lotSignal({reglage:{...REGLAGE,lectures:2},esv:{signalApres:false},end:115});
 await etape(b,'repris');const v=await attendreLot(b);
 assert.equal(adapter.rechargements,1,'plafond : un rechargement par partie');
 assert.deepEqual(etapes(b),['detecte','pause','recharge','repris','detecte']);
 const d2=ev(b,'lot-signal-eteint')[4];assert.equal(d2.action,'aucune');assert.match(d2.raison,/1 rechargement déjà fait/);assert.equal(d2.rechargements,1);
 assert.equal(v.batch.stoppedAtEnd?.cut,115);assert.deepEqual(valides(b),[111,112,113,114]);
});
