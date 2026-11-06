'use strict';
/* CH-060 — SIGNAL D'ESV ÉTEINT, réglage allumé, et le signal NE REVIENT PAS après le rechargement (décision de l'intégrateur du 06/11 : un seul
 * rechargement par relecture et par partie, sans boucle). Service worker réel, ESV simulé (tests/helpers/relecture-signal.cjs). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {H,lotPause,attendreEtat}=require('./helpers/relecture-pause.cjs');
const {esvSignal,REGLAGE,avec,etape}=require('./helpers/relecture-signal.cjs');

test('SW, signal toujours éteint après le rechargement : un seul rechargement, la passe continue au repli et finit ; 7 cuts relus',async()=>{
 const {b,adapter}=await lotPause({esv:avec(esvSignal({signalApres:false}),(a,b)=>REGLAGE({actif:true,lectures:2})(b))});
 await attendreEtat(b,'en-pause');await etape(b,'repris');const fin=await H.finPasse(b,60000);
 assert.equal(fin.etat,'finie',fin.message);assert.equal(fin.faits,7);assert.equal(adapter.rechargements,1,'un seul rechargement');
 assert.equal(H.evenements(b,'relecture-pause').length,1);
 const sig=H.evenements(b,'relecture-signal-eteint');
 assert.deepEqual(sig.map(e=>e.etape),['detecte','recharge','repris','detecte']);
 assert.equal(sig[3].action,'aucune');assert.match(sig[3].raison,/1 rechargement déjà fait/);
 assert.deepEqual(H.evenements(b,'relecture-ombre').map(e=>e.identity.cut),[108,109,110,113,114,115,116]);
});
