'use strict';
/* CH-062 — SIGNAL D'ESV ÉTEINT PENDANT LE LOT, réglage livré COUPÉ. Montage : tests/helpers/lot-signal.cjs (ESV simulé au repli jusqu'au rechargement). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {REGLAGE,lotSignal,ev,etapes,valides,attendreLot,etape,S}=require('./helpers/lot-signal.cjs');

test('livré coupé : un seul événement de détection, aucun rechargement, mêmes commandes et mêmes cuts validés qu’un lot au signal',async()=>{
 assert.equal(S.lot.signalEteint.actif,false,'coupé par défaut');
 assert.equal(S.lot.signalEteint.rechargementsMax,1);assert.equal(S.lot.signalEteint.lectures,8);
 const x=await lotSignal({reglage:{...S.lot.signalEteint,lectures:2},end:114});await attendreLot(x.b);
 const e=ev(x.b,'lot-signal-eteint');
 assert.equal(e.length,1,'un seul événement');assert.equal(e[0].etape,'detecte');assert.equal(e[0].action,'aucune');assert.match(e[0].raison,/coupé/);
 assert.equal(e[0].identity.cut,112,'détecté à la 2e lecture au repli');assert.equal(x.adapter.rechargements,0);
 /* Témoin : le même lot, ESV au signal (réglage livré) : mêmes commandes. */
 const y=await lotSignal({esv:{rechargee:true},end:114});await attendreLot(y.b);
 assert.equal(ev(y.b,'lot-signal-eteint').length,0,'au signal : rien');
 assert.deepEqual(x.adapter.calls,y.adapter.calls,'mêmes commandes envoyées à ESV');
 assert.deepEqual(valides(x.b),valides(y.b));assert.equal(x.b.get('engine').s.batch.stoppedAtEnd?.cut,114);assert.deepEqual(valides(x.b),[111,112,113]);
});

