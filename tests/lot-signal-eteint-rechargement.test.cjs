'use strict';
/* CH-062 — SIGNAL D'ESV ÉTEINT PENDANT LE LOT, réglage allumé : rechargement au point sûr et reprise. Montage : tests/helpers/lot-signal.cjs (ESV simulé au repli jusqu'au rechargement). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {REGLAGE,lotSignal,ev,etapes,valides,attendreLot,etape,S}=require('./helpers/lot-signal.cjs');

test('allumé : pause après la validation prouvée du cut 113, rechargement, reprise au 114 par « Reprendre » ; chaque cut validé une fois',async()=>{
 const {b,adapter}=await lotSignal({reglage:REGLAGE});
 await etape(b,'repris');const v=await attendreLot(b);
 assert.equal(v.batch.stoppedAtEnd?.cut,115,'le lot va jusqu’à sa borne, comme sans rechargement');
 assert.equal(adapter.rechargements,1,'un seul rechargement');
 assert.deepEqual(etapes(b),['detecte','pause','recharge','repris']);
 const det=ev(b,'lot-signal-eteint')[0];assert.equal(det.action,'recharger');assert.equal(det.identity.cut,113);
 const pause=ev(b,'lot-signal-eteint')[1];assert.equal(pause.identity.cut,113,'pause après le cut 113');assert.equal(pause.preuve,'ecriture-observee');
 assert.deepEqual(valides(b),[111,112,113,114],'chaque cut validé une fois, dans l’ordre');
 /* Rien n'est capturé entre la validation du 113 et le rechargement : la première capture après la pause est celle du 114, au signal. */
 const i=adapter.regles.findIndex(([c])=>c===114);assert.deepEqual(adapter.regles[i],[114,'signal']);
 assert.equal(adapter.regles.filter(([c])=>c===114).length,1,'le 114 est lu une seule fois');
 assert.ok(ev(b,'batch-rebased-after-reload').length===1,'lot rattaché à la nouvelle page par le chemin de « Reprendre »');
 assert.equal(adapter.calls.includes('skip'),false,'jamais SKIP');
});
